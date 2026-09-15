from rest_framework import serializers
from .models import (
    College, Department, SeatEntry, FeeEntry, StipendEntry,
    Review, ReviewImage, ReviewReport,
    Question, Answer, QuestionReport, AnswerReport,
)


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Department
        fields = ["id", "name"]


class SeatEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model  = SeatEntry
        fields = ["id", "program", "department", "seats", "display_order"]


class FeeEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model  = FeeEntry
        fields = ["id", "program", "department", "amount", "display_order"]


class StipendEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model  = StipendEntry
        fields = ["id", "program", "department", "amount", "display_order"]


class CollegeListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for the list endpoint — no full dept/entry objects."""
    dept_count    = serializers.IntegerField(source="departments.count", read_only=True)
    avg_rating    = serializers.SerializerMethodField()
    review_count  = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model  = College
        fields = [
            "id", "name", "intake_seats", "established_year", "location", "state",
            "college_type",
            "is_ug", "is_pg",
            "has_mbbs", "has_dental", "has_nursing",
            "university", "website_url", "google_maps_url", "about",
            "dept_count", "avg_rating", "review_count",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_avg_rating(self, obj):
        rating = getattr(obj, "avg_rating", None)
        return round(rating, 1) if rating is not None else None


class CollegeSerializer(serializers.ModelSerializer):
    """Full serializer for the detail endpoint — includes all related objects."""
    departments     = DepartmentSerializer(many=True, read_only=True)
    seat_entries    = SeatEntrySerializer(many=True, read_only=True)
    fee_entries     = FeeEntrySerializer(many=True, read_only=True)
    stipend_entries = StipendEntrySerializer(many=True, read_only=True)

    class Meta:
        model  = College
        fields = [
            "id", "name", "intake_seats", "established_year", "location", "state",
            "college_type",
            "is_ug", "is_pg",
            "has_mbbs", "has_dental", "has_nursing",
            "university", "website_url", "google_maps_url", "about",
            "departments",
            "seat_entries",
            "fee_entries",
            "stipend_entries",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class CollegeWriteSerializer(serializers.ModelSerializer):
    # departments accepted as list of name strings on write
    departments = serializers.ListField(
        child=serializers.CharField(max_length=255),
        write_only=True,
        required=False,
        default=list,
    )

    class Meta:
        model  = College
        fields = [
            "id", "name", "intake_seats", "established_year", "location", "state",
            "college_type",
            "is_ug", "is_pg",
            "has_mbbs", "has_dental", "has_nursing",
            "university", "website_url", "google_maps_url", "about",
            "departments",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        if not attrs.get("is_ug") and not attrs.get("is_pg"):
            raise serializers.ValidationError({"level": "Select at least one level: UG or PG."})
        if not any([attrs.get("has_mbbs"), attrs.get("has_dental"), attrs.get("has_nursing")]):
            raise serializers.ValidationError({"course_type": "Select at least one course type."})
        return attrs

    def validate_established_year(self, value):
        from datetime import date
        if value < 1800 or value > date.today().year:
            raise serializers.ValidationError("Enter a valid established year.")
        return value

    def create(self, validated_data):
        dept_names = validated_data.pop("departments", [])
        college    = College.objects.create(**validated_data)
        Department.objects.bulk_create([
            Department(college=college, name=name.strip())
            for name in dept_names if name.strip()
        ])
        return college

    def update(self, instance, validated_data):
        dept_names = validated_data.pop("departments", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if dept_names is not None:
            instance.departments.all().delete()
            Department.objects.bulk_create([
                Department(college=instance, name=name.strip())
                for name in dept_names if name.strip()
            ])
        return instance

    def to_representation(self, instance):
        # Re-fetch with all related data prefetched so the response is complete
        instance_with_prefetch = (
            College.objects
            .prefetch_related("departments", "seat_entries", "fee_entries", "stipend_entries")
            .get(pk=instance.pk)
        )
        return CollegeSerializer(instance_with_prefetch).data


# ── Review serializers ────────────────────────────────────────────────────────

class ReviewImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model  = ReviewImage
        fields = ["id", "image_url"]

    def get_image_url(self, obj):
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url


class ReviewSerializer(serializers.ModelSerializer):
    """
    Public serializer — reviews are fully anonymous. No username, name, email, or
    user id is ever sent to the public audience; only the super admin can see who
    wrote a review (via ReviewAdminSerializer). `is_mine` lets the current viewer
    recognize their own review without exposing identity to anyone else.
    """
    images         = ReviewImageSerializer(many=True, read_only=True)
    display_name   = serializers.SerializerMethodField()
    is_mine        = serializers.SerializerMethodField()
    college_name   = serializers.CharField(source="college.name", read_only=True)
    average_rating = serializers.FloatField(read_only=True)

    class Meta:
        model  = Review
        fields = [
            "id", "college", "college_name",
            "display_name", "is_mine",
            "role", "department", "batch_year",
            "title", "content",
            "rating_infrastructure", "rating_clinical",
            "rating_hostel", "rating_administration", "rating_overall",
            "average_rating",
            "status", "rejection_reason", "is_verified",
            "helpful_count", "report_count",
            "images",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "status", "rejection_reason", "is_verified",
            "helpful_count", "report_count", "created_at", "updated_at",
        ]

    def get_display_name(self, obj):
        return "Anonymous"

    def get_is_mine(self, obj):
        request = self.context.get("request")
        return bool(request and request.user and request.user.is_authenticated and obj.user_id == request.user.id)


class ReviewAdminSerializer(ReviewSerializer):
    """
    Admin-only serializer — adds real name and email on top of the public fields.
    Used only in super-admin / admin endpoints. This is the ONLY place a review's
    author is ever identified.
    """
    user              = serializers.IntegerField(source="user_id", read_only=True)
    user_name         = serializers.CharField(source="user.full_name", read_only=True)
    user_email        = serializers.CharField(source="user.email",     read_only=True)
    resolved_by_email = serializers.SerializerMethodField()

    class Meta(ReviewSerializer.Meta):
        fields = ReviewSerializer.Meta.fields + ["user", "user_name", "user_email", "resolved_by_email"]

    def get_resolved_by_email(self, obj):
        return obj.resolved_by.email if obj.resolved_by_id else None


class ReviewCreateSerializer(serializers.ModelSerializer):
    images = serializers.ListField(
        child=serializers.ImageField(),
        write_only=True, required=False, max_length=2,
    )

    class Meta:
        model  = Review
        fields = [
            "role", "department", "batch_year",
            "title", "content",
            "rating_infrastructure", "rating_clinical",
            "rating_hostel", "rating_administration", "rating_overall",
            "images",
        ]

    def validate_images(self, value):
        if len(value) > 2:
            raise serializers.ValidationError("You can upload a maximum of 2 images.")
        return value

    def validate(self, attrs):
        if attrs.get("role") in (Review.Role.STUDENT, Review.Role.ALUMNI) and not attrs.get("batch_year", "").strip():
            raise serializers.ValidationError({"batch_year": "Batch year is required for students and alumni."})
        return attrs

    def create(self, validated_data):
        images = validated_data.pop("images", [])
        review = Review.objects.create(**validated_data)
        for img in images:
            ReviewImage.objects.create(review=review, image=img)
        return review

    def update(self, instance, validated_data):
        """Used only for resubmitting a rejected review — puts it back into the
        pending queue and clears the previous rejection reason/resolver."""
        images = validated_data.pop("images", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.status = Review.Status.PENDING
        instance.rejection_reason = ""
        instance.resolved_by = None
        instance.save()
        if images is not None:
            instance.images.all().delete()
            for img in images:
                ReviewImage.objects.create(review=instance, image=img)
        return instance


class ReviewReportSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ReviewReport
        fields = ["reason", "detail"]


# ── Q&A / Discussions ────────────────────────────────────────────────────────

class AnswerSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    is_mine       = serializers.SerializerMethodField()

    class Meta:
        model  = Answer
        fields = ["id", "question", "content", "display_name", "is_mine", "created_at"]
        read_only_fields = ["id", "question", "display_name", "is_mine", "created_at"]

    def get_display_name(self, obj):
        return obj.user.username or "Anonymous"

    def get_is_mine(self, obj):
        request = self.context.get("request")
        return bool(request and request.user and request.user.is_authenticated and obj.user_id == request.user.id)


class AnswerCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Answer
        fields = ["content"]


class QuestionSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    is_mine       = serializers.SerializerMethodField()
    college_name  = serializers.CharField(source="college.name", read_only=True)
    answer_count  = serializers.IntegerField(source="answers.count", read_only=True)

    class Meta:
        model  = Question
        fields = [
            "id", "college", "college_name", "user",
            "display_name", "is_mine", "kind", "title", "content",
            "answer_count",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "user", "display_name", "is_mine", "college_name",
            "answer_count", "created_at", "updated_at",
        ]

    def get_display_name(self, obj):
        return obj.user.username or "Anonymous"

    def get_is_mine(self, obj):
        request = self.context.get("request")
        return bool(request and request.user and request.user.is_authenticated and obj.user_id == request.user.id)


class QuestionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Question
        # college & user are injected in the view (see QuestionListCreateView.post),
        # matching the ReviewCreateSerializer pattern — not client-supplied.
        fields = ["kind", "title", "content"]


class QuestionAdminSerializer(QuestionSerializer):
    """Admin-only — adds real name/email, same convention as ReviewAdminSerializer."""
    user_name  = serializers.CharField(source="user.full_name", read_only=True)
    user_email = serializers.CharField(source="user.email",     read_only=True)

    class Meta(QuestionSerializer.Meta):
        fields = QuestionSerializer.Meta.fields + ["status", "report_count", "user_name", "user_email"]


class AnswerAdminSerializer(AnswerSerializer):
    """Admin-only — adds real name/email plus enough question context to judge
    the report without a second lookup (title, college)."""
    user_name     = serializers.CharField(source="user.full_name", read_only=True)
    user_email    = serializers.CharField(source="user.email",     read_only=True)
    question_title = serializers.CharField(source="question.title", read_only=True)
    college_name   = serializers.CharField(source="question.college.name", read_only=True)

    class Meta(AnswerSerializer.Meta):
        fields = AnswerSerializer.Meta.fields + ["status", "report_count", "user_name", "user_email", "question_title", "college_name"]


class QuestionReportSerializer(serializers.ModelSerializer):
    class Meta:
        model  = QuestionReport
        fields = ["reason", "detail"]


class AnswerReportSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AnswerReport
        fields = ["reason", "detail"]
