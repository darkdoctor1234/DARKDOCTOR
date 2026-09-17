from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from modules.accounts.models import User, UserProfile, CollegeChangeRequest, COLLEGE_EDIT_GRACE_PERIOD
from modules.colleges.models import College, Review


def make_college(name="Test Medical College"):
    return College.objects.create(
        name=name, intake_seats=100, established_year=2000,
        location="Testville", college_type=College.CollegeType.GOVT,
        is_ug=True, has_mbbs=True,
    )


class IsCollegeLockedTests(TestCase):
    """Direct unit tests on UserProfile.is_college_locked — the exact
    mechanism the review-farming fix depends on, so its edge cases matter
    more than almost anything else in this app."""

    def setUp(self):
        self.user = User.objects.create_user(email="lock@example.com", password="x", username="lockuser")
        self.college = make_college()
        self.other_college = make_college("Other College")
        self.profile = UserProfile.objects.create(user=self.user)

    def test_unset_field_is_never_locked(self):
        self.assertFalse(self.profile.is_college_locked("ug_college"))

    def test_freshly_set_field_within_grace_period_is_not_locked(self):
        self.profile.ug_college = self.college
        self.profile.ug_college_set_at = timezone.now()
        self.profile.save()
        self.assertFalse(self.profile.is_college_locked("ug_college"))

    def test_field_set_past_grace_period_is_locked(self):
        self.profile.ug_college = self.college
        self.profile.ug_college_set_at = timezone.now() - COLLEGE_EDIT_GRACE_PERIOD - timedelta(hours=1)
        self.profile.save()
        self.assertTrue(self.profile.is_college_locked("ug_college"))

    def test_field_with_null_set_at_is_treated_as_locked(self):
        """Legacy rows predating this feature (set_at never populated) must be
        treated as already-locked, not as a free pass — this is the fallback
        that keeps the exploit closed for old data."""
        self.profile.ug_college = self.college
        self.profile.ug_college_set_at = None
        self.profile.save()
        self.assertTrue(self.profile.is_college_locked("ug_college"))

    def test_field_within_grace_period_but_with_existing_review_is_locked(self):
        """The actual exploit this whole mechanism exists to close: even
        seconds after setting the college, if a review already exists under
        it, the field must lock immediately regardless of the grace period."""
        self.profile.ug_college = self.college
        self.profile.ug_college_set_at = timezone.now()
        self.profile.save()
        Review.objects.create(
            college=self.college, user=self.user, role=Review.Role.STUDENT,
            batch_year="2020", title="t", content="c",
            rating_infrastructure=4, rating_clinical=4, rating_hostel=4,
            rating_administration=4, rating_overall=4,
        )
        self.assertTrue(self.profile.is_college_locked("ug_college"))

    def test_pg_college_lock_is_independent_of_ug_college_lock(self):
        self.profile.ug_college = self.college
        self.profile.ug_college_set_at = timezone.now() - COLLEGE_EDIT_GRACE_PERIOD - timedelta(hours=1)
        self.profile.pg_college = self.other_college
        self.profile.pg_college_set_at = timezone.now()
        self.profile.save()
        self.assertTrue(self.profile.is_college_locked("ug_college"))
        self.assertFalse(self.profile.is_college_locked("pg_college"))


class ProfileMeViewCollegeLockTests(TestCase):
    """End-to-end through the actual PATCH /accounts/profile/me/ endpoint —
    proves the lock is enforced at the API boundary, not just the model."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email="settings@example.com", password="x", username="settingsuser")
        self.college = make_college()
        self.other_college = make_college("Switch-To College")
        self.client.force_authenticate(user=self.user)

    def _create_profile(self, **extra):
        payload = {"current_status": "working_professional", **extra}
        return self.client.post("/api/v1/accounts/profile/me/", payload, format="json")

    def test_creating_profile_with_college_sets_lock_timestamp(self):
        response = self._create_profile(ug_college=self.college.id)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        profile = UserProfile.objects.get(user=self.user)
        self.assertIsNotNone(profile.ug_college_set_at)
        self.assertFalse(response.data["ug_college_locked"])

    def test_changing_college_within_grace_period_succeeds(self):
        self._create_profile(ug_college=self.college.id)
        response = self.client.patch("/api/v1/accounts/profile/me/", {"ug_college": self.other_college.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        profile = UserProfile.objects.get(user=self.user)
        self.assertEqual(profile.ug_college_id, self.other_college.id)

    def _backdate_ug_college_set_at(self):
        """Directly mutates the DB row, then re-authenticates the client with
        a freshly-queried user instance. Necessary because DRF's
        force_authenticate() pins one Python object across every request made
        with this client, and Django caches the reverse OneToOne accessor
        (user.profile) on that object after its first access — so without
        this, the view's `request.user.profile` would keep returning the
        stale pre-backdate profile instead of re-querying the DB."""
        profile = UserProfile.objects.get(user=self.user)
        profile.ug_college_set_at = timezone.now() - COLLEGE_EDIT_GRACE_PERIOD - timedelta(hours=1)
        profile.save(update_fields=["ug_college_set_at"])
        self.client.force_authenticate(user=User.objects.get(pk=self.user.pk))
        return profile

    def test_changing_college_past_grace_period_is_blocked(self):
        self._create_profile(ug_college=self.college.id)
        profile = self._backdate_ug_college_set_at()

        response = self.client.patch("/api/v1/accounts/profile/me/", {"ug_college": self.other_college.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("ug_college", response.data)
        profile.refresh_from_db()
        self.assertEqual(profile.ug_college_id, self.college.id)  # unchanged

    def test_setting_same_college_value_is_never_blocked_even_when_locked(self):
        """Re-submitting an unchanged value (e.g. saving the rest of the form)
        must not trip the lock check."""
        self._create_profile(ug_college=self.college.id)
        self._backdate_ug_college_set_at()

        response = self.client.patch("/api/v1/accounts/profile/me/", {"ug_college": self.college.id, "phone": "9999999999"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_setting_previously_empty_pg_college_is_free_even_after_ug_is_locked(self):
        """UG -> PG progression: setting a college field for the first time is
        never a 'change', regardless of the other field's lock state."""
        self._create_profile(ug_college=self.college.id)
        profile = self._backdate_ug_college_set_at()

        response = self.client.patch("/api/v1/accounts/profile/me/", {"pg_college": self.other_college.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        profile.refresh_from_db()
        self.assertEqual(profile.pg_college_id, self.other_college.id)


class CollegeChangeRequestFlowTests(TestCase):
    """The proof-based escape hatch for a genuinely locked field."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email="changereq@example.com", password="x", username="changerequser")
        self.admin = User.objects.create_user(email="admin2@example.com", password="x", username="admin2", role=User.Role.ADMIN)
        self.college = make_college()
        self.other_college = make_college("Requested College")
        self.profile = UserProfile.objects.create(
            user=self.user, ug_college=self.college,
            ug_college_set_at=timezone.now() - COLLEGE_EDIT_GRACE_PERIOD - timedelta(hours=1),
        )

    def _submit(self, client, proof=None, **overrides):
        from django.core.files.uploadedfile import SimpleUploadedFile
        if proof is None:
            proof = SimpleUploadedFile("proof.pdf", b"%PDF-1.4 fake but valid-looking", content_type="application/pdf")
        payload = {"field": "ug_college", "requested_college": self.other_college.id, "proof": proof, **overrides}
        return client.post("/api/v1/accounts/college-change-requests/", payload, format="multipart")

    def test_regular_user_can_submit_change_request(self):
        self.client.force_authenticate(user=self.user)
        response = self._submit(self.client)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CollegeChangeRequest.objects.count(), 1)

    def test_cannot_submit_second_pending_request_for_same_field(self):
        self.client.force_authenticate(user=self.user)
        self._submit(self.client)
        response = self._submit(self.client)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(CollegeChangeRequest.objects.count(), 1)

    def test_admin_approval_unlocks_and_applies_new_college(self):
        self.client.force_authenticate(user=self.user)
        self._submit(self.client)
        change_request = CollegeChangeRequest.objects.get(user=self.user)

        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin)
        response = admin_client.patch(
            f"/api/v1/accounts/college-change-requests/{change_request.id}/admin/",
            {"action": "approve"}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.profile.refresh_from_db()
        self.assertEqual(self.profile.ug_college_id, self.other_college.id)
        self.assertIsNotNone(self.profile.ug_college_set_at)
        # A fresh grace period started, so the field is unlocked again.
        self.assertFalse(self.profile.is_college_locked("ug_college"))

    def test_admin_rejection_requires_reason_and_leaves_college_unchanged(self):
        self.client.force_authenticate(user=self.user)
        self._submit(self.client)
        change_request = CollegeChangeRequest.objects.get(user=self.user)

        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin)
        no_reason = admin_client.patch(
            f"/api/v1/accounts/college-change-requests/{change_request.id}/admin/",
            {"action": "reject"}, format="json",
        )
        self.assertEqual(no_reason.status_code, status.HTTP_400_BAD_REQUEST)

        with_reason = admin_client.patch(
            f"/api/v1/accounts/college-change-requests/{change_request.id}/admin/",
            {"action": "reject", "reason": "Document unclear"}, format="json",
        )
        self.assertEqual(with_reason.status_code, status.HTTP_200_OK)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.ug_college_id, self.college.id)  # unchanged

    def test_regular_user_cannot_access_admin_action_endpoint(self):
        self.client.force_authenticate(user=self.user)
        self._submit(self.client)
        change_request = CollegeChangeRequest.objects.get(user=self.user)

        response = self.client.patch(
            f"/api/v1/accounts/college-change-requests/{change_request.id}/admin/",
            {"action": "approve"}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_user_cannot_submit_change_request(self):
        anon_client = APIClient()
        response = self._submit(anon_client)
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_proof_upload_accepts_jpg_and_png_too(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.client.force_authenticate(user=self.user)
        for i, (name, content_type) in enumerate([("proof.jpg", "image/jpeg"), ("proof.png", "image/png")]):
            profile = UserProfile.objects.create(
                user=User.objects.create_user(email=f"{name}@example.com", password="x", username=f"prooftype{i}"),
                ug_college=self.college,
                ug_college_set_at=timezone.now() - COLLEGE_EDIT_GRACE_PERIOD - timedelta(hours=1),
            )
            client = APIClient()
            client.force_authenticate(user=profile.user)
            proof = SimpleUploadedFile(name, b"fake image bytes", content_type=content_type)
            response = self._submit(client, proof=proof)
            self.assertEqual(response.status_code, status.HTTP_201_CREATED, f"{name} should be accepted")

    def test_proof_upload_rejects_disallowed_file_type(self):
        """The real bug this closes: proof uploads used to accept literally
        anything — this is exactly how .txt test files ended up in
        production Supabase storage during the migration (see HANDOVER.md).
        A rejected upload must also not create a change-request row at all."""
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.client.force_authenticate(user=self.user)
        proof = SimpleUploadedFile("proof.txt", b"not a real document", content_type="text/plain")
        response = self._submit(self.client, proof=proof)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(CollegeChangeRequest.objects.count(), 0)

    def test_proof_upload_rejects_mismatched_extension_and_content_type(self):
        """A file renamed to look allowed (.pdf extension) but whose actual
        declared content type isn't one of the allowed ones — the
        content-type check is independent of the extension check, so
        spoofing just the filename isn't enough on its own."""
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.client.force_authenticate(user=self.user)
        proof = SimpleUploadedFile("proof.pdf", b"actually an executable or script", content_type="application/x-msdownload")
        response = self._submit(self.client, proof=proof)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(CollegeChangeRequest.objects.count(), 0)

    def test_proof_upload_rejects_oversized_file_regardless_of_type(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.client.force_authenticate(user=self.user)
        proof = SimpleUploadedFile("proof.pdf", b"x" * (6 * 1024 * 1024), content_type="application/pdf")
        response = self._submit(self.client, proof=proof)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class AdminPasswordStrengthTests(TestCase):
    """A super admin creating/editing another admin account goes through
    the exact same AUTH_PASSWORD_VALIDATORS policy as self-registration —
    see modules.authentication.password_validation."""

    def setUp(self):
        self.client = APIClient()
        self.superadmin = User.objects.create_user(
            email="super1@example.com", password="x", username="super1", role=User.Role.SUPER_ADMIN,
        )
        self.client.force_authenticate(user=self.superadmin)

    def test_creating_admin_with_weak_password_is_rejected(self):
        response = self.client.post("/api/v1/accounts/admins/", {
            "email": "newadmin@example.com", "full_name": "New Admin", "password": "password123",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)
        self.assertFalse(User.objects.filter(email="newadmin@example.com").exists())

    def test_creating_admin_with_strong_password_succeeds(self):
        response = self.client.post("/api/v1/accounts/admins/", {
            "email": "newadmin2@example.com", "full_name": "New Admin", "password": "Xk7$mQp2vLwN9z",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_editing_admin_leaving_password_blank_does_not_trigger_validation(self):
        """Blank password on the update endpoint means "don't change it" —
        must not get rejected as if it were a weak password."""
        target = User.objects.create_user(email="existing@example.com", password="x", username="existingadmin", role=User.Role.ADMIN)
        response = self.client.patch(f"/api/v1/accounts/admins/{target.id}/", {
            "full_name": "Renamed Admin", "email": "existing@example.com", "password": "",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_editing_admin_with_weak_new_password_is_rejected(self):
        target = User.objects.create_user(email="existing2@example.com", password="x", username="existingadmin2", role=User.Role.ADMIN)
        response = self.client.patch(f"/api/v1/accounts/admins/{target.id}/", {
            "full_name": "Existing Admin", "email": "existing2@example.com", "password": "12345678",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
