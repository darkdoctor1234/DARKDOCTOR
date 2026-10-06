import hashlib
import logging
from django.core.cache import cache
from django.db import transaction
from rest_framework import serializers
from django.contrib.auth import authenticate
from modules.accounts.models import User, UserProfile
from .password_validation import validate_password_strength

logger = logging.getLogger(__name__)


def _signup_verified_key(email: str) -> str:
    """Kept in sync with the identical helper in views.py (SendSignupOtpView
    / VerifySignupOtpView) — duplicated rather than imported to avoid a
    views-importing-serializers-importing-views cycle."""
    return f"signup_verified_{hashlib.sha256(email.encode()).hexdigest()}"


class RegisterSerializer(serializers.Serializer):
    # ── Auth fields (required) ────────────────────────────────────────────────
    full_name = serializers.CharField(min_length=2, max_length=255)
    username  = serializers.CharField(min_length=3, max_length=30)
    email     = serializers.EmailField()
    # No min_length here — validate() below runs Django's real
    # AUTH_PASSWORD_VALIDATORS (min length 8, not-too-common,
    # not-all-numeric, not-too-similar-to-email/username), which is the
    # actual configured policy; a separate, smaller min_length here would
    # just be a second, weaker, inconsistent check.
    password  = serializers.CharField(write_only=True)

    # ── Profile fields (all optional — collected on signup step 2 & 3) ───────
    current_status    = serializers.ChoiceField(
        choices=UserProfile.Status.choices, required=False, allow_blank=True, default="",
    )
    highest_education = serializers.ChoiceField(
        choices=UserProfile.Education.choices, required=False, allow_blank=True, default="",
    )
    ug_college = serializers.IntegerField(required=False, allow_null=True, default=None)
    pg_college = serializers.IntegerField(required=False, allow_null=True, default=None)
    # Faculty only, and optional — the college they currently work at.
    work_college = serializers.IntegerField(required=False, allow_null=True, default=None)
    pg_department = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    batch      = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    pg_batch   = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    year_of_study = serializers.ChoiceField(
        choices=UserProfile.YearOfStudy.choices, required=False, allow_blank=True, default="",
    )
    phone      = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    address    = serializers.CharField(required=False, allow_blank=True, default="")

    # ── Field-level validation ────────────────────────────────────────────────
    def validate_username(self, value):
        import re
        value = value.strip()
        if not re.match(r'^[a-zA-Z0-9_]+$', value):
            raise serializers.ValidationError("Username can only contain letters, numbers and underscores.")
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_full_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Name cannot be blank.")
        return value.strip()

    def validate_ug_college(self, value):
        if value is None:
            return None
        from modules.colleges.models import College
        if not College.objects.filter(pk=value).exists():
            raise serializers.ValidationError("Invalid college selected.")
        return value

    def validate_pg_college(self, value):
        if value is None:
            return None
        from modules.colleges.models import College
        if not College.objects.filter(pk=value).exists():
            raise serializers.ValidationError("Invalid college selected.")
        return value

    def validate_work_college(self, value):
        if value is None:
            return None
        from modules.colleges.models import College
        if not College.objects.filter(pk=value).exists():
            raise serializers.ValidationError("Invalid college selected.")
        return value

    def validate(self, attrs):
        # Email must have cleared the pre-signup OTP gate (see
        # SendSignupOtpView / VerifySignupOtpView in views.py) before an
        # account can be created at all — this is the actual enforcement
        # point; the frontend's "verified" state is just UX, never trusted
        # on its own. validate_email() above already confirmed the email
        # isn't taken, so attrs["email"] is the clean, lowercased value.
        email = attrs.get("email", "")
        if email and not cache.get(_signup_verified_key(email)):
            raise serializers.ValidationError({"email": "Please verify your email before creating an account."})

        # Status, the relevant college(s), and (where it matters for
        # Community eligibility) PG specialty are all required at signup —
        # an account with none of this set can't get a personalised feed,
        # can't review anything (affiliation-gated), and can't join
        # Communities, so it's a dead end most people never circle back to
        # fix in Settings. Mirrors app/signup/page.tsx's goToStep3() exactly
        # — keep both in sync if this logic ever changes.
        status = attrs.get("current_status", "")
        highest_education = attrs.get("highest_education", "")
        ug_college = attrs.get("ug_college")
        pg_college = attrs.get("pg_college")
        pg_department = attrs.get("pg_department", "")

        needs_edu_statuses = (
            UserProfile.Status.WORKING_PROFESSIONAL,
            UserProfile.Status.ALUMNI,
            UserProfile.Status.FACULTY,
        )
        if not status or status == UserProfile.Status.OTHER:
            # "other" is a valid enum value but was never offered as a
            # signup choice (the frontend filters it out) — reject it here
            # too so a direct API call can't use it to dodge this gate.
            raise serializers.ValidationError({"current_status": "Please select your current status."})
        if status in needs_edu_statuses and not highest_education:
            raise serializers.ValidationError({"highest_education": "Please select your highest education level."})

        if status in (UserProfile.Status.UG_ASPIRANT, UserProfile.Status.UG_STUDENT):
            show_ug, show_pg = True, False
        elif status in (UserProfile.Status.PG_ASPIRANT, UserProfile.Status.PG_STUDENT):
            show_ug, show_pg = True, True
        elif status in needs_edu_statuses:
            show_ug, show_pg = True, highest_education == UserProfile.Education.PG
        else:
            show_ug, show_pg = False, False

        if show_ug and not ug_college:
            raise serializers.ValidationError({"ug_college": "Please select your UG college."})
        if show_pg and not pg_college:
            raise serializers.ValidationError({"pg_college": "Please select your PG college."})

        show_pg_dept = show_pg and status != UserProfile.Status.PG_ASPIRANT
        if show_pg_dept and not pg_department.strip():
            raise serializers.ValidationError({"pg_department": "Please select your PG specialty."})

        if attrs.get("work_college") and status != UserProfile.Status.FACULTY:
            raise serializers.ValidationError({"work_college": "Only faculty can set a workplace college."})

        # `batch` (UG year) / `pg_batch` (PG year) each mean "year joined"
        # while still pursuing that level, or "year completed" once it's
        # finished — see their help_text on the UserProfile model. Kept in
        # sync with UserProfileSerializer.validate (modules/accounts/serializers.py).
        requires_batch = status in (
            UserProfile.Status.UG_STUDENT,
            UserProfile.Status.PG_ASPIRANT,
            UserProfile.Status.PG_STUDENT,
            UserProfile.Status.WORKING_PROFESSIONAL,
            UserProfile.Status.ALUMNI,
            UserProfile.Status.FACULTY,
        )
        if requires_batch and not attrs.get("batch", "").strip():
            raise serializers.ValidationError({"batch": "UG year is required for this status."})

        requires_pg_batch = status == UserProfile.Status.PG_STUDENT or (
            status in (UserProfile.Status.WORKING_PROFESSIONAL, UserProfile.Status.ALUMNI, UserProfile.Status.FACULTY)
            and highest_education == UserProfile.Education.PG
        )
        if requires_pg_batch and not attrs.get("pg_batch", "").strip():
            raise serializers.ValidationError({"pg_batch": "PG year is required for this status."})

        # Object-level (not field-level validate_password) so
        # UserAttributeSimilarityValidator can actually compare the
        # password against the email/username being registered — an
        # unsaved, in-memory instance is enough, Django never touches the
        # DB for this.
        try:
            validate_password_strength(attrs.get("password", ""), user=User(
                email=attrs.get("email", ""), username=attrs.get("username", ""),
            ))
        except serializers.ValidationError as exc:
            raise serializers.ValidationError({"password": exc.detail})

        return attrs

    # ── Atomic create: User + UserProfile in one transaction ─────────────────
    def create(self, validated_data):
        profile_data = {
            "current_status":    validated_data.pop("current_status",    ""),
            "highest_education": validated_data.pop("highest_education", ""),
            "pg_department":     validated_data.pop("pg_department",     ""),
            "batch":             validated_data.pop("batch",             ""),
            "pg_batch":          validated_data.pop("pg_batch",          ""),
            "year_of_study":     validated_data.pop("year_of_study",     ""),
            "phone":             validated_data.pop("phone",             ""),
            "address":           validated_data.pop("address",           ""),
        }
        ug_college_id = validated_data.pop("ug_college", None)
        pg_college_id = validated_data.pop("pg_college", None)
        work_college_id = validated_data.pop("work_college", None)

        with transaction.atomic():
            user = User.objects.create_user(
                email=validated_data["email"],
                password=validated_data["password"],
                full_name=validated_data["full_name"],
                username=validated_data.get("username") or None,
                role=User.Role.USER,
                # Guaranteed by validate() above — this account could not
                # have been created without the email already clearing the
                # pre-signup OTP gate.
                email_verified=True,
            )
            # Single-use: consumed the moment it's actually spent on an
            # account, so it can't be replayed for a second registration
            # attempt against the same email within its TTL.
            cache.delete(_signup_verified_key(user.email))
            profile = UserProfile.objects.create(user=user, **profile_data)

            # Assign college FKs after profile creation to avoid College import at module level
            if ug_college_id:
                from modules.colleges.models import College
                try:
                    profile.ug_college = College.objects.get(pk=ug_college_id)
                except College.DoesNotExist:
                    pass
            if pg_college_id:
                from modules.colleges.models import College
                try:
                    profile.pg_college = College.objects.get(pk=pg_college_id)
                except College.DoesNotExist:
                    pass
            if ug_college_id or pg_college_id:
                profile.save(update_fields=["ug_college", "pg_college"])

            # Starts the same 48h self-correction window Settings gives a
            # newly-set college, so a typo'd workplace can be fixed freely
            # right after signup instead of needing proof.
            if work_college_id:
                from modules.colleges.models import College
                from django.utils import timezone
                profile.work_college = College.objects.get(pk=work_college_id)
                profile.work_college_set_at = timezone.now()
                profile.save(update_fields=["work_college", "work_college_set_at"])

            try:
                from modules.communities.services import sync_memberships
                sync_memberships(profile)
            except Exception:
                # best-effort — never block registration on this, but log it
                # so a sync failure isn't completely invisible (previously a
                # bare `except Exception: pass`).
                logger.exception("Community membership sync failed at registration for profile id=%s", profile.pk)

        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    role_required = serializers.CharField(write_only=True, required=False)

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")
        role_required = attrs.get("role_required")

        user = authenticate(username=email, password=password)
        if not user:
            raise serializers.ValidationError("Invalid credentials.")
        if not user.is_active:
            raise serializers.ValidationError("Account is disabled.")
        if role_required and user.role != role_required:
            raise serializers.ValidationError("Access denied.")

        attrs["user"] = user
        return attrs


class TokenResponseSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = serializers.SerializerMethodField()

    def get_user(self, obj):
        user = obj.get("user")
        return {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
        }
