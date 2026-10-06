import hashlib
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from modules.accounts.models import User
from modules.colleges.models import College


def make_college(name="Test Medical College"):
    return College.objects.create(
        name=name, intake_seats=100, established_year=2000,
        location="Testville", college_type=College.CollegeType.GOVT,
        is_ug=True, has_mbbs=True,
    )


def mark_email_verified(email: str) -> None:
    """Test helper standing in for the real OTP round-trip (SendSignupOtpView
    -> VerifySignupOtpView) — sets the same cache flag RegisterSerializer.validate()
    checks, so tests that aren't specifically about the verification gate
    itself don't need to simulate the whole email flow just to get past it."""
    key = f"signup_verified_{hashlib.sha256(email.strip().lower().encode()).hexdigest()}"
    cache.set(key, True, timeout=1800)


class RegistrationTests(TestCase):
    def setUp(self):
        # Registration shares the "auth" throttle scope (see AuthThrottleTests)
        # — without clearing between tests, this class's own cumulative
        # request count across methods can trip the 10/min limit itself.
        cache.clear()
        self.client = APIClient()
        self.url = "/api/v1/auth/register/"
        self.college = make_college()
        self.valid_payload = {
            "full_name": "Asha Rao",
            "username": "asha_rao",
            "email": "asha@example.com",
            "password": "Correcthorse1!",
            # Status + the relevant college(s) are required at signup — see
            # RegisterSerializer.validate(). "ug_aspirant" is the lightest
            # valid status (no batch/highest_education/pg_department needed
            # on top), so it's the default here; tests that care about a
            # specific status override these explicitly.
            "current_status": "ug_aspirant",
            "ug_college": self.college.id,
        }
        mark_email_verified(self.valid_payload["email"])

    def test_register_creates_user_and_returns_tokens(self):
        response = self.client.post(self.url, self.valid_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["email"], "asha@example.com")
        self.assertEqual(response.data["user"]["role"], User.Role.USER)
        # Verified at creation time now — the whole point of the pre-signup
        # OTP gate (SendSignupOtpView/VerifySignupOtpView) is that an account
        # can't exist at all without its email already having cleared it.
        self.assertTrue(response.data["user"]["email_verified"])
        self.assertTrue(User.objects.filter(email="asha@example.com").exists())
        self.assertTrue(User.objects.get(email="asha@example.com").email_verified)

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

    def test_register_enforces_the_configured_password_validators(self):
        """AUTH_PASSWORD_VALIDATORS (config/settings/base.py) is real,
        enforced policy, not decoration — these three are exactly the
        cases it's configured to catch, and none of them are merely
        "too short" (all well past the 8-char minimum on their own)."""
        cases = {
            "entirely numeric": "13579108642",
            "a well-known common password": "password123",
            "too similar to the account's own email": "asha@example",
        }
        for label, password in cases.items():
            email = f"{label[:6]}@example.com".replace(" ", "")
            mark_email_verified(email)
            payload = {**self.valid_payload, "email": email, "password": password}
            response = self.client.post(self.url, payload, format="json")
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, f"{label} ({password!r}) should be rejected")
            self.assertIn("password", response.data, f"{label} should fail on the password field specifically")

    def test_register_accepts_a_genuinely_strong_password(self):
        payload = {**self.valid_payload, "password": "Xk7$mQp2vLwN9z"}
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

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

    def test_register_rejects_email_that_was_never_verified(self):
        """The core guarantee of the pre-signup OTP gate: no verified-email
        cache flag means no account, full stop — regardless of how strong
        everything else about the submission is."""
        payload = {**self.valid_payload, "email": "never-verified@example.com"}
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)
        self.assertFalse(User.objects.filter(email="never-verified@example.com").exists())

    def test_register_requires_a_current_status(self):
        payload = {k: v for k, v in self.valid_payload.items() if k not in ("current_status", "ug_college")}
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("current_status", response.data)

    def test_register_rejects_other_as_a_status(self):
        """"other" is a real enum value but was never offered as a signup
        choice (the frontend filters it out) — must not be usable to dodge
        the status/college requirement via a direct API call."""
        payload = {**self.valid_payload, "current_status": "other"}
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("current_status", response.data)

    def test_register_requires_ug_college_for_ug_aspirant(self):
        payload = {k: v for k, v in self.valid_payload.items() if k != "ug_college"}
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ug_college", response.data)

    def test_register_requires_pg_college_for_pg_student(self):
        payload = {**self.valid_payload, "current_status": "pg_student", "batch": "2018", "pg_batch": "2022", "pg_department": "Cardiology"}
        # pg_college deliberately omitted
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("pg_college", response.data)

    def test_register_requires_pg_department_for_pg_student(self):
        payload = {
            **self.valid_payload, "current_status": "pg_student", "batch": "2018", "pg_batch": "2022",
            "pg_college": make_college("PG Test College").id,
            # pg_department deliberately omitted
        }
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("pg_department", response.data)

    def test_register_does_not_require_pg_department_for_pg_aspirant(self):
        """pg_aspirant hasn't started PG yet, so there's no specialty to
        report — only actual PG students/graduates/faculty need one."""
        payload = {
            **self.valid_payload, "current_status": "pg_aspirant", "batch": "2023",
            "pg_college": make_college("Aspirant Target College").id,
        }
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_register_succeeds_for_working_professional_with_full_pg_details(self):
        payload = {
            **self.valid_payload, "current_status": "working_professional", "highest_education": "pg",
            "batch": "2012", "pg_batch": "2016", "pg_department": "Cardiology",
            "pg_college": make_college("Working Professional PG College").id,
        }
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


    def test_register_faculty_can_set_a_workplace_college(self):
        work = make_college("Faculty Workplace College")
        payload = {
            **self.valid_payload, "current_status": "faculty", "highest_education": "ug",
            "batch": "2005", "work_college": work.id,
        }
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        profile = User.objects.get(email="asha@example.com").profile
        self.assertEqual(profile.work_college_id, work.id)
        # Starts the grace window, so a typo'd workplace can be fixed without proof.
        self.assertIsNotNone(profile.work_college_set_at)
        self.assertFalse(profile.is_college_locked("work_college"))

    def test_register_workplace_is_optional_for_faculty(self):
        payload = {**self.valid_payload, "current_status": "faculty", "highest_education": "ug", "batch": "2005"}
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(User.objects.get(email="asha@example.com").profile.work_college_id)

    def test_register_rejects_workplace_for_non_faculty(self):
        payload = {**self.valid_payload, "work_college": make_college("Not Faculty College").id}
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("work_college", response.data)

    def test_register_rejects_a_nonexistent_workplace_college(self):
        payload = {
            **self.valid_payload, "current_status": "faculty", "highest_education": "ug",
            "batch": "2005", "work_college": 999999,
        }
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class SignupOtpGateTests(TestCase):
    """SendSignupOtpView / VerifySignupOtpView — the pre-signup email
    verification gate that RegisterSerializer.validate() enforces (see
    RegistrationTests.test_register_rejects_email_that_was_never_verified
    for the enforcement side)."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.send_url = "/api/v1/auth/signup/send-otp/"
        self.verify_url = "/api/v1/auth/signup/verify-otp/"
        self.register_url = "/api/v1/auth/register/"
        self.email = "newstudent@example.com"

    def test_send_otp_returns_dev_otp_in_debug_without_smtp(self):
        response = self.client.post(self.send_url, {"email": self.email}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("dev_otp", response.data)

    def test_send_otp_rejects_already_registered_email(self):
        User.objects.create_user(email=self.email, password="x", username="existing")
        response = self.client.post(self.send_url, {"email": self.email}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_send_otp_rejects_malformed_email(self):
        """Unlike RegisterSerializer (a real EmailField), this view reads
        the raw request body — without its own format check, a malformed
        address would "successfully" generate an OTP that can never be
        delivered, dead-ending signup with no visible error."""
        response = self.client.post(self.send_url, {"email": "not-an-email"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_otp_rejects_wrong_code(self):
        self.client.post(self.send_url, {"email": self.email}, format="json")
        response = self.client.post(self.verify_url, {"email": self.email, "otp": "000000"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_otp_rejects_code_for_a_different_email(self):
        send_response = self.client.post(self.send_url, {"email": self.email}, format="json")
        otp = send_response.data["dev_otp"]
        response = self.client.post(self.verify_url, {"email": "someone-else@example.com", "otp": otp}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_full_send_verify_register_flow_succeeds(self):
        send_response = self.client.post(self.send_url, {"email": self.email}, format="json")
        otp = send_response.data["dev_otp"]

        verify_response = self.client.post(self.verify_url, {"email": self.email, "otp": otp}, format="json")
        self.assertEqual(verify_response.status_code, status.HTTP_200_OK)
        self.assertTrue(verify_response.data["verified"])

        register_response = self.client.post(self.register_url, {
            "full_name": "New Student", "username": "new_student_99",
            "email": self.email, "password": "Xk7$mQp2vLwN9z",
            "current_status": "ug_aspirant", "ug_college": make_college("OTP Flow College").id,
        }, format="json")
        self.assertEqual(register_response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.get(email=self.email).email_verified)

    def test_otp_is_single_use(self):
        """Verifying consumes the code — replaying it (e.g. a second,
        unrelated registration attempt) must not work twice."""
        send_response = self.client.post(self.send_url, {"email": self.email}, format="json")
        otp = send_response.data["dev_otp"]
        first = self.client.post(self.verify_url, {"email": self.email, "otp": otp}, format="json")
        self.assertEqual(first.status_code, status.HTTP_200_OK)

        second = self.client.post(self.verify_url, {"email": self.email, "otp": otp}, format="json")
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)

    def test_resending_invalidates_the_previous_code(self):
        first_send = self.client.post(self.send_url, {"email": self.email}, format="json")
        old_otp = first_send.data["dev_otp"]
        cache.delete(f"signup_otp_cooldown_{hashlib.sha256(self.email.encode()).hexdigest()}")  # bypass cooldown for the test
        self.client.post(self.send_url, {"email": self.email}, format="json")

        response = self.client.post(self.verify_url, {"email": self.email, "otp": old_otp}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


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
            "email": "reset@example.com", "otp": otp, "new_password": "Brandnewpass1!",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        login = self.client.post("/api/v1/auth/user/login/", {"email": "reset@example.com", "password": "Brandnewpass1!"}, format="json")
        self.assertEqual(login.status_code, status.HTTP_200_OK)

    def test_reset_password_with_wrong_otp_fails_and_leaves_password_unchanged(self):
        self.client.post("/api/v1/auth/forgot-password/", {"email": "reset@example.com"}, format="json")
        response = self.client.post("/api/v1/auth/reset-password/", {
            "email": "reset@example.com", "otp": "000000", "new_password": "brandnewpass",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        login = self.client.post("/api/v1/auth/user/login/", {"email": "reset@example.com", "password": "oldpassword"}, format="json")
        self.assertEqual(login.status_code, status.HTTP_200_OK)

    def test_reset_password_rejects_a_weak_new_password_and_leaves_old_one_active(self):
        """Same AUTH_PASSWORD_VALIDATORS policy as registration — a valid
        OTP alone must not be enough to set a common/weak password. The OTP
        itself must not be silently consumed by a rejected attempt either,
        so a legitimate retry with a strong password still works."""
        otp = self.client.post("/api/v1/auth/forgot-password/", {"email": "reset@example.com"}, format="json").data["dev_otp"]
        weak = self.client.post("/api/v1/auth/reset-password/", {
            "email": "reset@example.com", "otp": otp, "new_password": "password123",
        }, format="json")
        self.assertEqual(weak.status_code, status.HTTP_400_BAD_REQUEST)

        still_old = self.client.post("/api/v1/auth/user/login/", {"email": "reset@example.com", "password": "oldpassword"}, format="json")
        self.assertEqual(still_old.status_code, status.HTTP_200_OK)

        retry = self.client.post("/api/v1/auth/reset-password/", {
            "email": "reset@example.com", "otp": otp, "new_password": "Xk7$mQp2vLwN9z",
        }, format="json")
        self.assertEqual(retry.status_code, status.HTTP_200_OK)

    def test_reset_password_otp_is_single_use(self):
        otp = self.client.post("/api/v1/auth/forgot-password/", {"email": "reset@example.com"}, format="json").data["dev_otp"]
        first = self.client.post("/api/v1/auth/reset-password/", {
            "email": "reset@example.com", "otp": otp, "new_password": "Firstnewpass1!",
        }, format="json")
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        second = self.client.post("/api/v1/auth/reset-password/", {
            "email": "reset@example.com", "otp": otp, "new_password": "Secondnewpass1!",
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


class AuthThrottleTests(TestCase):
    """The dedicated, much stricter throttle on credential-guessing
    surfaces (modules.authentication.throttles.AuthRateThrottle, 10/min) —
    distinct from and far tighter than the generic 100/hour anon rate that
    covers every other public endpoint."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        User.objects.create_user(email="throttletest@example.com", password="correcthorse", username="throttleuser")

    def test_login_endpoint_blocks_after_the_auth_rate_limit(self):
        payload = {"email": "throttletest@example.com", "password": "wrongpassword"}
        statuses = [self.client.post("/api/v1/auth/user/login/", payload, format="json").status_code for _ in range(11)]
        # First 10 are evaluated normally (401, wrong password) — none throttled yet.
        self.assertEqual(statuses[:10].count(status.HTTP_429_TOO_MANY_REQUESTS), 0)
        # The 11th is blocked by the throttle itself, before credentials are even checked.
        self.assertEqual(statuses[10], status.HTTP_429_TOO_MANY_REQUESTS)

    def test_generic_anon_endpoints_are_unaffected_by_the_auth_throttle(self):
        """Exhausting the auth-scoped budget must not touch the separate,
        much looser generic anon throttle that every other public endpoint
        (e.g. the college directory) relies on."""
        for _ in range(11):
            self.client.post("/api/v1/auth/user/login/", {"email": "x@x.com", "password": "x"}, format="json")
        response = self.client.get("/api/v1/colleges/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_throttle_cannot_be_bypassed_by_spoofing_x_forwarded_for(self):
        """The actual bug NUM_PROXIES (config/settings/base.py) exists to
        close: neither AWS's ALB nor nginx *replace* an existing
        X-Forwarded-For header, they only ever append to it — so without
        NUM_PROXIES telling DRF exactly which entry its own trusted proxy
        appended, a client sending a different fake prefix on every request
        would get a brand new throttle identity each time, bypassing the
        limit entirely. Simulates the real 2-hop chain (ALB appends the
        real IP, nginx appends its own) with an attacker-controlled,
        request-varying first segment."""
        payload = {"email": "throttletest@example.com", "password": "wrongpassword"}
        real_client_ip = "203.0.113.7"  # what the ALB actually appended
        nginx_own_ip = "172.18.0.5"     # what nginx's own hop appended after that
        statuses = []
        for i in range(11):
            spoofed_prefix = f"9.9.9.{i}"  # attacker varies this every single request
            xff = f"{spoofed_prefix}, {real_client_ip}, {nginx_own_ip}"
            response = self.client.post(
                "/api/v1/auth/user/login/", payload, format="json",
                HTTP_X_FORWARDED_FOR=xff,
            )
            statuses.append(response.status_code)
        self.assertEqual(statuses[:10].count(status.HTTP_429_TOO_MANY_REQUESTS), 0)
        self.assertEqual(statuses[10], status.HTTP_429_TOO_MANY_REQUESTS)


class HealthCheckTests(TestCase):
    def test_health_check_reports_healthy_and_needs_no_auth(self):
        client = APIClient()
        response = client.get("/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")

    def test_health_check_failure_never_leaks_the_raw_db_error(self):
        """This endpoint is public and unauthenticated by design (an ALB
        health check carries no credentials) — a raw DB exception can
        contain the hostname/port/other connection details, which must
        never reach an anonymous caller. The detail still needs to exist
        *somewhere* for debugging, just server-side (see the view's own
        logger.exception call, not asserted here since that's a logging
        concern, not a response-shape one)."""
        from unittest.mock import patch
        from django.db.utils import OperationalError

        secret_looking_detail = "could not connect to server: host ep-frosty-cherry-azq7yzj9.aws.neon.tech"
        with patch("config.views.connection") as mock_connection:
            mock_connection.cursor.side_effect = OperationalError(secret_looking_detail)
            client = APIClient()
            response = client.get("/health/")

        self.assertEqual(response.status_code, 503)
        body = response.content.decode()
        self.assertEqual(response.json()["status"], "unhealthy")
        self.assertNotIn("neon.tech", body)
        self.assertNotIn(secret_looking_detail, body)


class ProductionSettingsHardFailTests(TestCase):
    """config/settings/production.py must refuse to boot at all if
    SECRET_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, or ALLOWED_HOSTS are
    still at their known-insecure default — see that file's own comment
    for why (it's the only thing that actually guards the real gunicorn
    boot path; Django's system-checks framework does not run for a plain
    WSGI load). This is import-time behavior, so it has to run in a real
    subprocess to isolate cleanly — an in-process test can't "unimport" a
    settings module once Django has loaded it."""

    # Every setting the check cares about, all given real/safe values —
    # each test below overrides exactly ONE of these back to its insecure
    # default, so a failure can only ever be caused by the one thing that
    # test claims to be checking (otherwise, e.g., the ALLOWED_HOSTS test
    # could "pass" for the wrong reason — SUPERADMIN_EMAIL happening to
    # also be unset — which is exactly what a first draft of this test
    # actually did).
    _SAFE_ENV = {
        "SECRET_KEY": "a-real-randomly-generated-secret-key-abc123xyz",
        "SUPERADMIN_EMAIL": "real-admin@realdomain.com",
        "SUPERADMIN_PASSWORD": "a-real-strong-password",
        "ALLOWED_HOSTS": "example.com",
    }

    def _run(self, **overrides):
        import subprocess, sys, os
        env = os.environ.copy()
        env.update({
            "DJANGO_SETTINGS_MODULE": "config.settings.production",
            "DB_NAME": "x", "DB_USER": "x", "DB_PASSWORD": "x",
        })
        env.update(self._SAFE_ENV)
        env.update(overrides)
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        return subprocess.run(
            [sys.executable, "-c", "import django; django.setup()"],
            env=env, capture_output=True, text=True, cwd=backend_dir, timeout=30,
        )

    def test_refuses_to_boot_with_default_secret_key(self):
        result = self._run(SECRET_KEY="django-insecure-change-this-in-production-!!!")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("SECRET_KEY", result.stderr)

    def test_refuses_to_boot_with_default_superadmin_credentials(self):
        result = self._run(SUPERADMIN_EMAIL="dark@gmail.com", SUPERADMIN_PASSWORD="000346")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("SUPERADMIN_EMAIL", result.stderr)

    def test_refuses_to_boot_with_wildcard_allowed_hosts(self):
        result = self._run(ALLOWED_HOSTS="*")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("ALLOWED_HOSTS", result.stderr)

    def test_boots_cleanly_with_real_values(self):
        result = self._run()  # no overrides — every setting stays at its safe value
        self.assertEqual(result.returncode, 0, result.stderr)
