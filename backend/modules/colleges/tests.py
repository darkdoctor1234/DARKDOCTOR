from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from modules.accounts.models import User, UserProfile
from modules.colleges.models import College, Review, Question, Answer, ModerationStatus


def make_college(name="Test Medical College"):
    return College.objects.create(
        name=name, intake_seats=100, established_year=2000,
        location="Testville", college_type=College.CollegeType.GOVT,
        is_ug=True, has_mbbs=True,
    )


REVIEW_PAYLOAD = {
    "role": "student", "department": "General Medicine", "batch_year": "2020",
    "title": "Solid clinical exposure", "content": "Detailed honest feedback here.",
    "rating_infrastructure": 4, "rating_clinical": 5, "rating_hostel": 3,
    "rating_administration": 4, "rating_overall": 4,
}


class ReviewCreationPermissionTests(TestCase):
    """The affiliation gate: only a user whose profile links to a college
    (as ug_college or pg_college) may review it — the direct precondition
    the college-lock mechanism exists to protect."""

    def setUp(self):
        self.client = APIClient()
        self.college = make_college()
        self.unaffiliated_college = make_college("Unaffiliated College")
        self.user = User.objects.create_user(email="reviewer@example.com", password="x", username="reviewer1")
        self.client.force_authenticate(user=self.user)

    def test_user_without_profile_cannot_review(self):
        response = self.client.post(f"/api/v1/colleges/{self.college.id}/reviews/", REVIEW_PAYLOAD, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_can_review_their_affiliated_college(self):
        UserProfile.objects.create(user=self.user, ug_college=self.college)
        response = self.client.post(f"/api/v1/colleges/{self.college.id}/reviews/", REVIEW_PAYLOAD, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Review.objects.get().status, Review.Status.PENDING)

    def test_user_cannot_review_an_unaffiliated_college(self):
        UserProfile.objects.create(user=self.user, ug_college=self.college)
        response = self.client.post(f"/api/v1/colleges/{self.unaffiliated_college.id}/reviews/", REVIEW_PAYLOAD, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Review.objects.count(), 0)

    def test_unauthenticated_user_cannot_post_review(self):
        anon = APIClient()
        response = anon.post(f"/api/v1/colleges/{self.college.id}/reviews/", REVIEW_PAYLOAD, format="json")
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_second_review_for_same_college_is_rejected(self):
        UserProfile.objects.create(user=self.user, ug_college=self.college)
        self.client.post(f"/api/v1/colleges/{self.college.id}/reviews/", REVIEW_PAYLOAD, format="json")
        response = self.client.post(f"/api/v1/colleges/{self.college.id}/reviews/", REVIEW_PAYLOAD, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Review.objects.count(), 1)

    def test_student_role_requires_batch_year(self):
        UserProfile.objects.create(user=self.user, ug_college=self.college)
        payload = {**REVIEW_PAYLOAD, "batch_year": ""}
        response = self.client.post(f"/api/v1/colleges/{self.college.id}/reviews/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rating_out_of_range_is_rejected(self):
        UserProfile.objects.create(user=self.user, ug_college=self.college)
        payload = {**REVIEW_PAYLOAD, "rating_overall": 6}
        response = self.client.post(f"/api/v1/colleges/{self.college.id}/reviews/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ReviewVisibilityAndModerationTests(TestCase):
    """Pending/rejected/removed reviews must never leak into the public feed
    — this is what the whole Review Approval Workflow exists to guarantee."""

    def setUp(self):
        self.client = APIClient()
        self.college = make_college()
        self.author = User.objects.create_user(email="author@example.com", password="x", username="author1")
        self.admin = User.objects.create_user(email="reviewadmin@example.com", password="x", username="reviewadmin", role=User.Role.ADMIN)
        UserProfile.objects.create(user=self.author, ug_college=self.college)

    def _create_review(self):
        self.client.force_authenticate(user=self.author)
        self.client.post(f"/api/v1/colleges/{self.college.id}/reviews/", REVIEW_PAYLOAD, format="json")
        self.client.force_authenticate(user=None)
        return Review.objects.get()

    def test_pending_review_is_not_publicly_visible(self):
        self._create_review()
        response = self.client.get(f"/api/v1/colleges/{self.college.id}/reviews/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_approved_review_becomes_publicly_visible(self):
        review = self._create_review()
        self.client.force_authenticate(user=self.admin)
        self.client.patch(f"/api/v1/colleges/reviews/{review.id}/admin/", {"action": "approve"}, format="json")
        self.client.force_authenticate(user=None)

        response = self.client.get(f"/api/v1/colleges/{self.college.id}/reviews/")
        self.assertEqual(len(response.data), 1)

    def test_rejected_review_stays_hidden_and_can_be_resubmitted(self):
        review = self._create_review()
        self.client.force_authenticate(user=self.admin)
        reject = self.client.patch(f"/api/v1/colleges/reviews/{review.id}/admin/", {"action": "reject", "reason": "Too vague"}, format="json")
        self.assertEqual(reject.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=self.author)
        resubmit_payload = {**REVIEW_PAYLOAD, "content": "More detailed content now."}
        resubmit = self.client.patch(f"/api/v1/colleges/reviews/{review.id}/resubmit/", resubmit_payload, format="json")
        self.assertEqual(resubmit.status_code, status.HTTP_200_OK)
        review.refresh_from_db()
        self.assertEqual(review.status, Review.Status.PENDING)
        # Still exactly one row — resubmission reuses it, doesn't create a second.
        self.assertEqual(Review.objects.filter(college=self.college, user=self.author).count(), 1)

    def test_approve_reject_remove_require_admin_role(self):
        review = self._create_review()
        self.client.force_authenticate(user=self.author)
        response = self.client.patch(f"/api/v1/colleges/reviews/{review.id}/admin/", {"action": "approve"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_review_report_auto_flags_at_threshold_and_hides_from_public(self):
        review = self._create_review()
        self.client.force_authenticate(user=self.admin)
        self.client.patch(f"/api/v1/colleges/reviews/{review.id}/admin/", {"action": "approve"}, format="json")

        reporters = [
            User.objects.create_user(email=f"reporter{i}@example.com", password="x", username=f"reporter{i}")
            for i in range(5)
        ]
        for reporter in reporters:
            client = APIClient()
            client.force_authenticate(user=reporter)
            resp = client.post(f"/api/v1/colleges/reviews/{review.id}/report/", {"reason": "spam"}, format="json")
            self.assertEqual(resp.status_code, status.HTTP_200_OK)

        review.refresh_from_db()
        self.assertEqual(review.report_count, 5)
        self.assertEqual(review.status, Review.Status.FLAGGED)

        public = self.client.get(f"/api/v1/colleges/{self.college.id}/reviews/")
        self.assertEqual(len(public.data), 0)

    def test_same_user_cannot_report_same_review_twice(self):
        review = self._create_review()
        self.client.force_authenticate(user=self.admin)
        self.client.patch(f"/api/v1/colleges/reviews/{review.id}/admin/", {"action": "approve"}, format="json")

        reporter = User.objects.create_user(email="doublereport@example.com", password="x", username="doublereport")
        client = APIClient()
        client.force_authenticate(user=reporter)
        first = client.post(f"/api/v1/colleges/reviews/{review.id}/report/", {"reason": "spam"}, format="json")
        second = client.post(f"/api/v1/colleges/reviews/{review.id}/report/", {"reason": "spam"}, format="json")
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        review.refresh_from_db()
        self.assertEqual(review.report_count, 1)


class QuestionAnswerTests(TestCase):
    """Q&A: creation, public visibility filtering, and the moderation
    (report/auto-flag/admin) pattern shared with Reviews and Community."""

    def setUp(self):
        self.client = APIClient()
        self.college = make_college()
        self.asker = User.objects.create_user(email="asker@example.com", password="x", username="asker1")
        self.answerer = User.objects.create_user(email="answerer@example.com", password="x", username="answerer1")
        self.admin = User.objects.create_user(email="qaadmin@example.com", password="x", username="qaadmin", role=User.Role.ADMIN)

    def test_authenticated_user_can_post_question(self):
        self.client.force_authenticate(user=self.asker)
        response = self.client.post(
            f"/api/v1/colleges/{self.college.id}/questions/",
            {"kind": "question", "title": "Hostel food quality?", "content": "How is it really?"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Question.objects.get().status, ModerationStatus.VISIBLE)

    def test_unauthenticated_user_cannot_post_question(self):
        anon = APIClient()
        response = anon.post(
            f"/api/v1/colleges/{self.college.id}/questions/",
            {"kind": "question", "title": "x", "content": "y"}, format="json",
        )
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_answer_creation_and_public_listing(self):
        question = Question.objects.create(college=self.college, user=self.asker, title="Q", content="C")
        self.client.force_authenticate(user=self.answerer)
        response = self.client.post(f"/api/v1/colleges/questions/{question.id}/answers/", {"content": "Here's my answer."}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        anon = APIClient()
        listing = anon.get(f"/api/v1/colleges/questions/{question.id}/answers/")
        self.assertEqual(len(listing.data), 1)

    def test_flagged_question_is_hidden_from_public_list(self):
        question = Question.objects.create(college=self.college, user=self.asker, title="Q", content="C")
        reporters = [
            User.objects.create_user(email=f"qreporter{i}@example.com", password="x", username=f"qreporter{i}")
            for i in range(5)
        ]
        for reporter in reporters:
            client = APIClient()
            client.force_authenticate(user=reporter)
            client.post(f"/api/v1/colleges/questions/{question.id}/report/", {"reason": "spam"}, format="json")

        question.refresh_from_db()
        self.assertEqual(question.status, ModerationStatus.FLAGGED)

        anon = APIClient()
        listing = anon.get(f"/api/v1/colleges/{self.college.id}/questions/")
        self.assertEqual(len(listing.data), 0)
        # But it's in the admin flagged queue:
        self.client.force_authenticate(user=self.admin)
        flagged = self.client.get("/api/v1/colleges/questions/flagged/")
        self.assertEqual(len(flagged.data), 1)

    def test_admin_can_remove_flagged_question_permanently(self):
        question = Question.objects.create(college=self.college, user=self.asker, title="Q", content="C", status=ModerationStatus.FLAGGED, report_count=5)
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(f"/api/v1/colleges/questions/{question.id}/admin/", {"action": "remove"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        question.refresh_from_db()
        self.assertEqual(question.status, ModerationStatus.REMOVED)

    def test_non_admin_cannot_access_flagged_queue(self):
        self.client.force_authenticate(user=self.asker)
        response = self.client.get("/api/v1/colleges/questions/flagged/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class CollegeListTests(TestCase):
    """Baseline smoke coverage for the most-hit public endpoint."""

    def test_college_list_is_public(self):
        make_college("A")
        make_college("B")
        client = APIClient()
        response = client.get("/api/v1/colleges/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_college_create_requires_authentication(self):
        client = APIClient()
        response = client.post("/api/v1/colleges/", {
            "name": "New College", "intake_seats": 50, "established_year": 2010,
            "location": "X", "college_type": "govt", "is_ug": True, "has_mbbs": True,
        }, format="json")
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
