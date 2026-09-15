from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from modules.accounts.models import User, UserProfile
from modules.colleges.models import College
from modules.communities.models import Community, CommunityMembership, DiscussionPost
from modules.communities.services import sync_memberships


def make_pg_college(state="Karnataka"):
    return College.objects.create(
        name="PG Medical College", intake_seats=50, established_year=2000,
        location="Testville", college_type=College.CollegeType.GOVT,
        is_pg=True, has_mbbs=True, state=state,
    )


class SyncMembershipsTests(TestCase):
    """The auto-membership engine: exactly up to 3 communities, derived
    purely from profile state, never touching an explicit exit."""

    def setUp(self):
        self.college = make_pg_college()
        self.user = User.objects.create_user(email="pgdoc@example.com", password="x", username="pgdoc")

    def test_ug_student_is_not_community_eligible(self):
        profile = UserProfile.objects.create(user=self.user, current_status="ug_student", pg_department="Anatomy")
        eligible = sync_memberships(profile)
        self.assertEqual(eligible, [])
        self.assertEqual(CommunityMembership.objects.filter(user=self.user).count(), 0)

    def test_pg_student_without_department_gets_only_national_overall(self):
        profile = UserProfile.objects.create(user=self.user, current_status="pg_student")
        sync_memberships(profile)
        memberships = CommunityMembership.objects.filter(user=self.user, is_active=True)
        self.assertEqual(memberships.count(), 1)
        self.assertEqual(memberships.first().community.type, Community.Type.NATIONAL_OVERALL)

    def test_pg_student_with_department_and_state_gets_all_three_communities(self):
        profile = UserProfile.objects.create(
            user=self.user, current_status="pg_student",
            pg_department="Anatomy", pg_college=self.college,
        )
        sync_memberships(profile)
        types = set(
            CommunityMembership.objects.filter(user=self.user, is_active=True)
            .values_list("community__type", flat=True)
        )
        self.assertEqual(types, {
            Community.Type.NATIONAL_OVERALL,
            Community.Type.DEPARTMENT_NATIONAL,
            Community.Type.DEPARTMENT_STATE,
        })

    def test_working_professional_alumni_and_faculty_are_all_eligible(self):
        for status_value in ("working_professional", "alumni", "faculty"):
            user = User.objects.create_user(email=f"{status_value}@example.com", password="x", username=status_value)
            profile = UserProfile.objects.create(user=user, current_status=status_value)
            eligible = sync_memberships(profile)
            self.assertEqual(len(eligible), 1)

    def test_syncing_twice_does_not_duplicate_memberships(self):
        profile = UserProfile.objects.create(user=self.user, current_status="pg_student", pg_department="Anatomy", pg_college=self.college)
        sync_memberships(profile)
        sync_memberships(profile)
        self.assertEqual(CommunityMembership.objects.filter(user=self.user).count(), 3)

    def test_explicit_exit_is_never_reversed_by_a_later_sync(self):
        profile = UserProfile.objects.create(user=self.user, current_status="pg_student")
        sync_memberships(profile)
        membership = CommunityMembership.objects.get(user=self.user)
        membership.is_active = False
        membership.save(update_fields=["is_active"])

        sync_memberships(profile)
        membership.refresh_from_db()
        self.assertFalse(membership.is_active)
        self.assertEqual(CommunityMembership.objects.filter(user=self.user).count(), 1)  # no duplicate row


class DiscussionPostMembershipGateTests(TestCase):
    """Posting/reading requires active membership — no free-browse."""

    def setUp(self):
        self.client = APIClient()
        self.member = User.objects.create_user(email="member@example.com", password="x", username="member1")
        self.outsider = User.objects.create_user(email="outsider@example.com", password="x", username="outsider1")
        profile = UserProfile.objects.create(user=self.member, current_status="working_professional")
        sync_memberships(profile)
        self.community = CommunityMembership.objects.get(user=self.member).community

    def test_member_can_post(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post("/api/v1/communities/posts/", {
            "community": self.community.id, "title": "Hello", "content": "First post",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_non_member_cannot_post(self):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.post("/api/v1/communities/posts/", {
            "community": self.community.id, "title": "Hello", "content": "First post",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_non_member_cannot_read_posts(self):
        self.client.force_authenticate(user=self.member)
        self.client.post("/api/v1/communities/posts/", {"community": self.community.id, "title": "Hello", "content": "First post"}, format="json")

        self.client.force_authenticate(user=self.outsider)
        response = self.client.get(f"/api/v1/communities/posts/?community={self.community.id}")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_exiting_then_rejoining_restores_posting_access(self):
        self.client.force_authenticate(user=self.member)
        self.client.post(f"/api/v1/communities/{self.community.id}/exit/")
        blocked = self.client.post("/api/v1/communities/posts/", {"community": self.community.id, "title": "x", "content": "y"}, format="json")
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)

        self.client.post(f"/api/v1/communities/{self.community.id}/join/")
        allowed = self.client.post("/api/v1/communities/posts/", {"community": self.community.id, "title": "x", "content": "y"}, format="json")
        self.assertEqual(allowed.status_code, status.HTTP_201_CREATED)


class DiscussionPostModerationTests(TestCase):
    """Report/auto-flag/admin-remove — gated IsSuperAdmin, not IsAdmin, unlike
    Review and Q&A (a real, deliberate difference worth a regression test)."""

    def setUp(self):
        self.client = APIClient()
        self.author = User.objects.create_user(email="postauthor@example.com", password="x", username="postauthor")
        self.admin = User.objects.create_user(email="commadmin@example.com", password="x", username="commadmin", role=User.Role.ADMIN)
        self.superadmin = User.objects.create_user(email="commsuper@example.com", password="x", username="commsuper", role=User.Role.SUPER_ADMIN)
        profile = UserProfile.objects.create(user=self.author, current_status="working_professional")
        sync_memberships(profile)
        self.community = CommunityMembership.objects.get(user=self.author).community
        self.post = DiscussionPost.objects.create(community=self.community, author=self.author, title="T", content="C")

    def test_report_auto_flags_at_threshold(self):
        for i in range(5):
            reporter = User.objects.create_user(email=f"postreporter{i}@example.com", password="x", username=f"postreporter{i}")
            profile = UserProfile.objects.create(user=reporter, current_status="working_professional")
            sync_memberships(profile)
            client = APIClient()
            client.force_authenticate(user=reporter)
            resp = client.post(f"/api/v1/communities/posts/{self.post.id}/report/", {"reason": "spam"}, format="json")
            self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.post.refresh_from_db()
        self.assertEqual(self.post.status, DiscussionPost.Status.FLAGGED)

    def test_plain_admin_cannot_action_flagged_post(self):
        self.post.status = DiscussionPost.Status.FLAGGED
        self.post.save(update_fields=["status"])
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(f"/api/v1/communities/posts/{self.post.id}/admin/", {"action": "remove"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_superadmin_can_action_flagged_post(self):
        self.post.status = DiscussionPost.Status.FLAGGED
        self.post.save(update_fields=["status"])
        self.client.force_authenticate(user=self.superadmin)
        response = self.client.patch(f"/api/v1/communities/posts/{self.post.id}/admin/", {"action": "remove"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.post.refresh_from_db()
        self.assertEqual(self.post.status, DiscussionPost.Status.REMOVED)
