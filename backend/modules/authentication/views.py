import secrets
import hashlib
from django.conf import settings
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from modules.accounts.models import User
from .serializers import LoginSerializer, RegisterSerializer
from .emails import send_verification_email, send_password_reset_email
from .throttles import AuthRateThrottle
from .password_validation import validate_password_strength


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    refresh["role"] = user.role
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }


def build_user_payload(user):
    """
    Builds the `user` dict included in every auth response.
    Profile fields are included so the frontend can cache feed prefs
    immediately — no extra API call needed on the feed page.
    """
    profile_fields = {
        "current_status":    "",
        "highest_education": "",
        "ug_college":        None,
        "pg_college":        None,
    }
    try:
        p = user.profile
        profile_fields = {
            "current_status":    p.current_status    or "",
            "highest_education": p.highest_education or "",
            "ug_college":        p.ug_college_id,   # FK id (None if not set)
            "pg_college":        p.pg_college_id,   # FK id (None if not set)
        }
    except Exception:
        pass  # user has no profile yet — defaults above are fine

    return {
        "id":             user.id,
        "email":          user.email,
        "email_verified": user.email_verified,
        "full_name":      user.full_name,
        "username":       user.username,
        "role":           user.role,
        **profile_fields,
    }


class AdminLoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthRateThrottle]

    def post(self, request):
        serializer = LoginSerializer(data={**request.data, "role_required": User.Role.ADMIN})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)

        user = serializer.validated_data["user"]
        tokens = get_tokens_for_user(user)
        return Response({
            "access": tokens["access"],
            "refresh": tokens["refresh"],
            "user": build_user_payload(user),
        })


class SuperAdminLoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthRateThrottle]

    def post(self, request):
        serializer = LoginSerializer(data={**request.data, "role_required": User.Role.SUPER_ADMIN})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)

        user = serializer.validated_data["user"]
        tokens = get_tokens_for_user(user)
        return Response({
            "access": tokens["access"],
            "refresh": tokens["refresh"],
            "user": build_user_payload(user),
        })


class LogoutView(APIView):
    # AllowAny — we only need the refresh token to blacklist it;
    # no need to validate the access token on logout.
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if not refresh_token:
                return Response({"detail": "Refresh token required."}, status=status.HTTP_400_BAD_REQUEST)
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"detail": "Logged out successfully."})
        except TokenError:
            # Token already expired/invalid — treat as successful logout
            return Response({"detail": "Logged out."})
        except Exception:
            return Response({"detail": "Logged out."})  # Always succeed on client side


class UserLoginView(APIView):
    """Login for end users (role=user)."""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthRateThrottle]

    def post(self, request):
        serializer = LoginSerializer(data={**request.data, "role_required": User.Role.USER})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)
        user = serializer.validated_data["user"]
        tokens = get_tokens_for_user(user)
        return Response({
            "access":  tokens["access"],
            "refresh": tokens["refresh"],
            "user": build_user_payload(user),
        })


class RegisterView(APIView):
    """Public registration — creates a new end user and returns tokens (auto-login)."""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthRateThrottle]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        user = serializer.save()
        tokens = get_tokens_for_user(user)
        try:
            _send_new_verification_code(user)
        except Exception:
            pass  # best-effort — never block registration on an email hiccup
        return Response({
            "access":  tokens["access"],
            "refresh": tokens["refresh"],
            "user": build_user_payload(user),
        }, status=status.HTTP_201_CREATED)


class TokenRefreshView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from rest_framework_simplejwt.views import TokenRefreshView as JWTRefreshView
        return JWTRefreshView.as_view()(request._request)


class ForgotPasswordView(APIView):
    """
    POST /api/v1/auth/forgot-password/
    Body: { "email": "user@example.com" }
    Generates a 6-digit OTP, stored in cache for 15 minutes, and emails it.
    Always returns 200 to prevent email enumeration.
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthRateThrottle]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        if not email:
            return Response({"detail": "Email is required."}, status=400)

        try:
            user = User.objects.get(email=email, role=User.Role.USER, is_active=True)
        except User.DoesNotExist:
            # Don't reveal whether email exists
            return Response({"detail": "If that email is registered, you will receive a reset code."})

        otp = str(secrets.randbelow(900000) + 100000)  # 6-digit OTP
        cache_key = f"pwd_reset_{hashlib.sha256(email.encode()).hexdigest()}"
        cache.set(cache_key, otp, timeout=900)  # 15 minutes
        send_password_reset_email(email, otp)

        response = {"detail": "If that email is registered, you will receive a reset code."}
        if not settings.EMAIL_HOST:
            # No real SMTP configured (local dev) — the email just went to the
            # server console, so hand the code back here too for convenience.
            response["dev_otp"] = otp
        return Response(response)


class ResetPasswordView(APIView):
    """
    POST /api/v1/auth/reset-password/
    Body: { "email": "...", "otp": "123456", "new_password": "..." }
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthRateThrottle]

    def post(self, request):
        email        = request.data.get("email", "").strip().lower()
        otp          = str(request.data.get("otp", "")).strip()
        new_password = request.data.get("new_password", "")

        if not all([email, otp, new_password]):
            return Response({"detail": "Email, OTP, and new password are required."}, status=400)

        cache_key   = f"pwd_reset_{hashlib.sha256(email.encode()).hexdigest()}"
        stored_otp  = cache.get(cache_key)

        if not stored_otp or stored_otp != otp:
            return Response({"detail": "Invalid or expired reset code."}, status=400)

        try:
            user = User.objects.get(email=email, role=User.Role.USER, is_active=True)
        except User.DoesNotExist:
            return Response({"detail": "Invalid or expired reset code."}, status=400)

        try:
            validate_password_strength(new_password, user=user)
        except DRFValidationError as exc:
            return Response({"detail": exc.detail[0] if isinstance(exc.detail, list) else exc.detail}, status=400)

        user.set_password(new_password)
        user.save(update_fields=["password"])
        cache.delete(cache_key)

        return Response({"detail": "Password reset successfully. You can now log in."})


class UsernameCheckView(APIView):
    """GET /auth/username-check/?username=foo — returns {available: bool}"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        import re
        username = request.query_params.get("username", "").strip()
        if not username:
            return Response({"available": False, "error": "Username is required."})
        if len(username) < 3:
            return Response({"available": False, "error": "At least 3 characters."})
        if len(username) > 30:
            return Response({"available": False, "error": "Max 30 characters."})
        if not re.match(r'^[a-zA-Z0-9_]+$', username):
            return Response({"available": False, "error": "Letters, numbers and underscores only."})
        taken = User.objects.filter(username__iexact=username).exists()
        return Response({"available": not taken})


class EmailCheckView(APIView):
    """GET /auth/email-check/?email=foo — returns {available: bool}"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        email = request.query_params.get("email", "").strip().lower()
        if not email:
            return Response({"available": False, "error": "Email is required."})
        taken = User.objects.filter(email__iexact=email).exists()
        return Response({"available": not taken})


class UpdateUsernameView(APIView):
    """PATCH /auth/username/ — authenticated user updates their own username."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        import re
        username = request.data.get("username", "").strip()
        if not username:
            return Response({"detail": "Username is required."}, status=400)
        if len(username) < 3 or len(username) > 30:
            return Response({"detail": "Username must be 3–30 characters."}, status=400)
        if not re.match(r'^[a-zA-Z0-9_]+$', username):
            return Response({"detail": "Letters, numbers and underscores only."}, status=400)
        if User.objects.filter(username__iexact=username).exclude(pk=request.user.pk).exists():
            return Response({"detail": "This username is already taken."}, status=400)
        request.user.username = username
        request.user.save(update_fields=["username"])
        return Response({"username": request.user.username})


# ── Email verification ──────────────────────────────────────────────────────

_VERIFY_OTP_TTL = 900       # 15 minutes, matches the password-reset OTP
_VERIFY_COOLDOWN = 45       # seconds a user must wait between resend requests


def _verify_cache_key(user_id: int) -> str:
    return f"email_verify_otp_{user_id}"


def _verify_cooldown_key(user_id: int) -> str:
    return f"email_verify_cooldown_{user_id}"


def _send_new_verification_code(user) -> None:
    """Generate a fresh OTP, store it, email it, and start the resend cooldown.
    Shared by registration (auto-send) and the resend endpoint below."""
    otp = str(secrets.randbelow(900000) + 100000)
    cache.set(_verify_cache_key(user.id), otp, timeout=_VERIFY_OTP_TTL)
    cache.set(_verify_cooldown_key(user.id), True, timeout=_VERIFY_COOLDOWN)
    send_verification_email(user.email, otp)


class SendEmailVerificationView(APIView):
    """
    POST /api/v1/auth/email/send-verification/
    Sends (or resends) a 6-digit code to the signed-in user's own email.
    Rate-limited to one request per _VERIFY_COOLDOWN seconds per user.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.email_verified:
            return Response({"detail": "Your email is already verified."}, status=400)
        if cache.get(_verify_cooldown_key(user.id)):
            return Response({"detail": "Please wait a moment before requesting another code."}, status=429)

        _send_new_verification_code(user)
        response = {"detail": "Verification code sent."}
        if not settings.EMAIL_HOST:
            response["dev_otp"] = cache.get(_verify_cache_key(user.id))
        return Response(response)


class VerifyEmailView(APIView):
    """
    POST /api/v1/auth/email/verify/
    Body: { "otp": "123456" }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.email_verified:
            return Response({"detail": "Your email is already verified.", "email_verified": True})

        otp = str(request.data.get("otp", "")).strip()
        if not otp:
            return Response({"detail": "Code is required."}, status=400)

        stored_otp = cache.get(_verify_cache_key(user.id))
        if not stored_otp or stored_otp != otp:
            return Response({"detail": "Invalid or expired code."}, status=400)

        user.email_verified = True
        user.save(update_fields=["email_verified"])
        cache.delete(_verify_cache_key(user.id))
        cache.delete(_verify_cooldown_key(user.id))
        return Response({"detail": "Email verified.", "email_verified": True})
