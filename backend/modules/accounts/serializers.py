from rest_framework import serializers
from .models import User, UserProfile, CollegeChangeRequest


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "full_name", "role", "is_active", "created_at"]
        read_only_fields = ["id", "role", "created_at"]


class CreateAdminSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    id = serializers.IntegerField(read_only=True)
    # Writable, but only an existing super admin can ever reach this serializer
    # in the first place (AdminListCreateView is IsSuperAdmin-gated), so
    # letting them choose super_admin here is safe — never exposed to regular
    # admins, and "user" isn't a valid choice at all.
    role = serializers.ChoiceField(
        choices=[User.Role.ADMIN, User.Role.SUPER_ADMIN], default=User.Role.ADMIN,
    )
    is_active = serializers.BooleanField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "password", "role", "is_active", "created_at"]

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower()

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class UpdateAdminSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, min_length=6, required=False, allow_blank=True
    )

    class Meta:
        model = User
        fields = ["full_name", "email", "password"]

    def validate_email(self, value):
        # Allow the same email (no change), block duplicates from other users
        if User.objects.filter(email=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower()

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class UserProfileSerializer(serializers.ModelSerializer):
    email           = serializers.EmailField(source="user.email",     read_only=True)
    full_name       = serializers.CharField(source="user.full_name",  read_only=True)
    username        = serializers.CharField(source="user.username",   read_only=True)
    ug_college_name   = serializers.SerializerMethodField()
    pg_college_name   = serializers.SerializerMethodField()
    ug_college_locked = serializers.SerializerMethodField()
    pg_college_locked = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            "email",
            "full_name",
            "username",
            "current_status",
            "highest_education",
            "ug_college",
            "ug_college_name",
            "ug_college_locked",
            "pg_college",
            "pg_college_name",
            "pg_college_locked",
            "pg_department",
            "batch",
            "phone",
            "address",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "email", "full_name", "username",
            "ug_college_name", "pg_college_name",
            "ug_college_locked", "pg_college_locked",
            "created_at", "updated_at",
        ]

    def get_ug_college_name(self, obj):
        return obj.ug_college.name if obj.ug_college else None

    def get_pg_college_name(self, obj):
        return obj.pg_college.name if obj.pg_college else None

    def get_ug_college_locked(self, obj):
        return obj.is_college_locked("ug_college")

    def get_pg_college_locked(self, obj):
        return obj.is_college_locked("pg_college")

    def validate(self, attrs):
        # Batch year is required once the user identifies as a current student or alumni.
        # Fall back to the existing instance value for partial (PATCH) updates that don't
        # touch these fields, so e.g. saving just a phone number doesn't re-trigger this.
        status = attrs.get("current_status", getattr(self.instance, "current_status", "") if self.instance else "")
        batch  = attrs.get("batch", getattr(self.instance, "batch", "") if self.instance else "")
        requires_batch = status in (
            UserProfile.Status.UG_STUDENT,
            UserProfile.Status.PG_STUDENT,
            UserProfile.Status.ALUMNI,
        )
        if requires_batch and not str(batch).strip():
            raise serializers.ValidationError({"batch": "Batch year is required for students and alumni."})
        return attrs


class CollegeChangeRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CollegeChangeRequest
        fields = ["field", "requested_college", "proof"]

    def validate_proof(self, value):
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("File must be 5MB or smaller.")
        return value


class CollegeChangeRequestSerializer(serializers.ModelSerializer):
    """Admin-facing view of a request — includes context to judge it by."""
    user_email            = serializers.EmailField(source="user.email", read_only=True)
    user_full_name        = serializers.CharField(source="user.full_name", read_only=True)
    field_display         = serializers.CharField(source="get_field_display", read_only=True)
    current_college_name   = serializers.CharField(source="current_college.name", read_only=True, default=None)
    requested_college_name = serializers.CharField(source="requested_college.name", read_only=True)
    resolved_by_email      = serializers.EmailField(source="resolved_by.email", read_only=True, default=None)

    class Meta:
        model  = CollegeChangeRequest
        fields = [
            "id", "user_email", "user_full_name",
            "field", "field_display",
            "current_college_name", "requested_college_name",
            "proof", "status", "rejection_reason",
            "resolved_by_email", "created_at", "resolved_at",
        ]


class LeadSerializer(serializers.ModelSerializer):
    """Read-only serializer for the super-admin leads table."""
    full_name         = serializers.CharField(source="user.full_name")
    email             = serializers.EmailField(source="user.email")
    registered_at     = serializers.DateTimeField(source="user.created_at")
    status_display    = serializers.SerializerMethodField()
    education_display = serializers.SerializerMethodField()
    ug_college_name   = serializers.SerializerMethodField()
    pg_college_name   = serializers.SerializerMethodField()
    ug_college_state  = serializers.SerializerMethodField()
    pg_college_state  = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            "id",
            "full_name",
            "email",
            "current_status",
            "status_display",
            "highest_education",
            "education_display",
            "ug_college_name",
            "pg_college_name",
            "ug_college_state",
            "pg_college_state",
            "phone",
            "address",
            "created_at",     # when the profile was completed
            "registered_at",  # when the account was created
        ]

    def get_status_display(self, obj):
        return obj.get_current_status_display() if obj.current_status else ""

    def get_education_display(self, obj):
        return obj.get_highest_education_display() if obj.highest_education else ""

    def get_ug_college_name(self, obj):
        return obj.ug_college.name if obj.ug_college else None

    def get_pg_college_name(self, obj):
        return obj.pg_college.name if obj.pg_college else None

    def get_ug_college_state(self, obj):
        return obj.ug_college.state if obj.ug_college else None

    def get_pg_college_state(self, obj):
        return obj.pg_college.state if obj.pg_college else None
