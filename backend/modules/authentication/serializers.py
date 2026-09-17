from django.db import transaction
from rest_framework import serializers
from django.contrib.auth import authenticate
from modules.accounts.models import User, UserProfile
from .password_validation import validate_password_strength


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
    pg_department = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    batch      = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
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

    def validate(self, attrs):
        status = attrs.get("current_status", "")
        requires_batch = status in (
            UserProfile.Status.UG_STUDENT,
            UserProfile.Status.PG_STUDENT,
            UserProfile.Status.ALUMNI,
        )
        if requires_batch and not attrs.get("batch", "").strip():
            raise serializers.ValidationError({"batch": "Batch year is required for students and alumni."})

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
            "phone":             validated_data.pop("phone",             ""),
            "address":           validated_data.pop("address",           ""),
        }
        ug_college_id = validated_data.pop("ug_college", None)
        pg_college_id = validated_data.pop("pg_college", None)

        with transaction.atomic():
            user = User.objects.create_user(
                email=validated_data["email"],
                password=validated_data["password"],
                full_name=validated_data["full_name"],
                username=validated_data.get("username") or None,
                role=User.Role.USER,
            )
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

            try:
                from modules.communities.services import sync_memberships
                sync_memberships(profile)
            except Exception:
                pass  # best-effort — never block registration on this

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
