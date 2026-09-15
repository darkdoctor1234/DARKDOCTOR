from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from modules.accounts.models import User


class RegistrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = "/api/v1/auth/register/"
        self.valid_payload = {
            "full_name": "Asha Rao",
            "username": "asha_rao",
            "email": "asha@example.com",
            "password": "correcthorse",
        }

    def test_register_creates_user_and_returns_tokens(self):
        response = self.client.post(self.url, self.valid_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["email"], "asha@example.com")
        self.assertEqual(response.data["user"]["role"], User.Role.USER)
        self.assertFalse(response.data["user"]["email_verified"])
        self.assertTrue(User.objects.filter(email="asha@example.com").exists())

    def test_register_rejects_duplicate_email(self):
        User.objects.create_user(email="asha@example.com", password="x", username="taken1")
        response = self.client.post(self.url, self.valid_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_register_rejects_duplicate_username_case_insensitive(self):
        User.objects.create_user(email="other@example.com", password="x", username="Asha_Rao")
        response = self.client.post(self.url, self.valid_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.data)

    def test_register_rejects_username_with_invalid_characters(self):
        payload = {**self.valid_payload, "username": "asha rao!"}
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.data)

    def test_register_rejects_short_password(self):
        payload = {**self.valid_payload, "password": "abc"}
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    def test_register_requires_batch_for_student_status(self):
        payload = {
            **self.valid_payload,
            "current_status": "ug_student",
            # batch deliberately omitted
        }
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_rejects_nonexistent_college_id(self):
        payload = {**self.valid_payload, "ug_college": 999999}
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ug_college", response.data)


class LoginTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email="user@example.com", password="correcthorse", username="regularjoe")
        self.admin = User.objects.create_user(email="admin@example.com", password="correcthorse", username="adminjoe", role=User.Role.ADMIN)

    def test_user_login_succeeds_with_correct_credentials(self):
        response = self.client.post("/api/v1/auth/user/login/", {"email": "user@example.com", "password": "correcthorse"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

    def test_user_login_fails_with_wrong_password(self):
        response = self.client.post("/api/v1/auth/user/login/", {"email": "user@example.com", "password": "wrongpass"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_login_fails_for_nonexistent_email(self):
        response = self.client.post("/api/v1/auth/user/login/", {"email": "ghost@example.com", "password": "whatever"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_login_rejects_admin_role_at_user_endpoint(self):
        """An admin account logging in via the user endpoint must be refused —
        role_required enforcement, not just credential correctness."""
        response = self.client.post("/api/v1/auth/user/login/", {"email": "admin@example.com", "password": "correcthorse"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_login_succeeds_at_admin_endpoint(self):
        response = self.client.post("/api/v1/auth/admin/login/", {"email": "admin@example.com", "password": "correcthorse"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_regular_user_rejected_at_admin_endpoint(self):
        response = self.client.post("/api/v1/auth/admin/login/", {"email": "user@example.com", "password": "correcthorse"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_inactive_user_cannot_login(self):
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])
        response = self.client.post("/api/v1/auth/user/login/", {"email": "user@example.com", "password": "correcthorse"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class UsernameEmailCheckTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        User.objects.create_user(email="taken@example.com", password="x", username="takenname")

    def test_username_check_reports_available(self):
        response = self.client.get("/api/v1/auth/username-check/?username=freshname")
        self.assertTrue(response.data["available"])

    def test_username_check_reports_taken(self):
        response = self.client.get("/api/v1/auth/username-check/?username=takenname")
        self.assertFalse(response.data["available"])

    def test_username_check_rejects_too_short(self):
        response = self.client.get("/api/v1/auth/username-check/?username=ab")
        self.assertFalse(response.data["available"])

    def test_email_check_reports_taken_case_insensitive(self):
        response = self.client.get("/api/v1/auth/email-check/?email=TAKEN@example.com")
        self.assertFalse(response.data["available"])


class EmailVerificationTests(TestCase):
    """Covers the OTP-based email verification flow: correct code, wrong code,
    already-verified short-circuit, and the resend cooldown."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(email="verify@example.com", password="correcthorse", username="verifyme")
        self.client.force_authenticate(user=self.user)

    def test_send_verification_returns_dev_otp_when_no_smtp_configured(self):
        response = self.client.post("/api/v1/auth/email/send-verification/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("dev_otp", response.data)

    def test_verify_with_correct_otp_marks_verified(self):
        send_resp = self.client.post("/api/v1/auth/email/send-verification/")
        otp = send_resp.data["dev_otp"]
        verify_resp = self.client.post("/api/v1/auth/email/verify/", {"otp": otp}, format="json")
        self.assertEqual(verify_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(verify_resp.data["email_verified"])
        self.user.refresh_from_db()
        self.assertTrue(self.user.email_verified)

    def test_verify_with_wrong_otp_fails(self):
        self.client.post("/api/v1/auth/email/send-verification/")
        response = self.client.post("/api/v1/auth/email/verify/", {"otp": "000000"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertFalse(self.user.email_verified)

    def test_verify_without_ever_sending_fails(self):
        response = self.client.post("/api/v1/auth/email/verify/", {"otp": "123456"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_resend_before_cooldown_expires_is_rate_limited(self):
        self.client.post("/api/v1/auth/email/send-verification/")
        response = self.client.post("/api/v1/auth/email/send-verification/")
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_send_verification_for_already_verified_user_is_rejected(self):
        self.user.email_verified = True
        self.user.save(update_fields=["email_verified"])
        response = self.client.post("/api/v1/auth/email/send-verification/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_requires_authentication(self):
        anon_client = APIClient()
        response = anon_client.post("/api/v1/auth/email/verify/", {"otp": "123456"}, format="json")
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))


class PasswordResetTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(email="reset@example.com", password="oldpassword", username="resetme")

    def test_forgot_password_returns_dev_otp_for_existing_user(self):
        response = self.client.post("/api/v1/auth/forgot-password/", {"email": "reset@example.com"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("dev_otp", response.data)

    def test_forgot_password_does_not_reveal_nonexistent_email(self):
        """Same 200 + generic message for an unknown email — no enumeration, and
        crucially no dev_otp key (nothing was actually generated)."""
        response = self.client.post("/api/v1/auth/forgot-password/", {"email": "ghost@example.com"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn("dev_otp", response.data)

    def test_reset_password_with_correct_otp_succeeds(self):
        otp = self.client.post("/api/v1/auth/forgot-password/", {"email": "reset@example.com"}, format="json").data["dev_otp"]
        response = self.client.post("/api/v1/auth/reset-password/", {
            "email": "reset@example.com", "otp": otp, "new_password": "brandnewpass",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        login = self.client.post("/api/v1/auth/user/login/", {"email": "reset@example.com", "password": "brandnewpass"}, format="json")
        self.assertEqual(login.status_code, status.HTTP_200_OK)

    def test_reset_password_with_wrong_otp_fails_and_leaves_password_unchanged(self):
        self.client.post("/api/v1/auth/forgot-password/", {"email": "reset@example.com"}, format="json")
        response = self.client.post("/api/v1/auth/reset-password/", {
            "email": "reset@example.com", "otp": "000000", "new_password": "brandnewpass",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        login = self.client.post("/api/v1/auth/user/login/", {"email": "reset@example.com", "password": "oldpassword"}, format="json")
        self.assertEqual(login.status_code, status.HTTP_200_OK)

    def test_reset_password_otp_is_single_use(self):
        otp = self.client.post("/api/v1/auth/forgot-password/", {"email": "reset@example.com"}, format="json").data["dev_otp"]
        first = self.client.post("/api/v1/auth/reset-password/", {
            "email": "reset@example.com", "otp": otp, "new_password": "firstnewpass",
        }, format="json")
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        second = self.client.post("/api/v1/auth/reset-password/", {
            "email": "reset@example.com", "otp": otp, "new_password": "secondnewpass",
        }, format="json")
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)


class ProtectedEndpointAuthTests(TestCase):
    """Sanity check on the JWT/permission wiring itself, independent of any
    one app's business logic: an unauthenticated client must never reach an
    IsAuthenticated-protected view."""

    def test_update_username_requires_authentication(self):
        client = APIClient()
        response = client.patch("/api/v1/auth/username/", {"username": "whatever"}, format="json")
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_update_username_works_when_authenticated(self):
        user = User.objects.create_user(email="rename@example.com", password="x", username="oldname")
        client = APIClient()
        client.force_authenticate(user=user)
        response = client.patch("/api/v1/auth/username/", {"username": "newname"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "newname")

    def test_invalid_jwt_degrades_to_anonymous_not_500(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-token")
        response = client.get("/api/v1/colleges/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
