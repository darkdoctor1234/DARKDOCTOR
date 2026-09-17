from datetime import timedelta
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.validators import FileExtensionValidator
from django.db import models
from django.utils import timezone

from .constants import PG_DEPARTMENT_CHOICES

# Free self-correction window for a UG/PG college change (e.g. a signup typo) —
# see UserProfile.is_college_locked.
COLLEGE_EDIT_GRACE_PERIOD = timedelta(hours=48)


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", User.Role.SUPER_ADMIN)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        SUPER_ADMIN = "super_admin", "Super Admin"
        ADMIN = "admin", "Admin"
        USER = "user", "User"

    email     = models.EmailField(unique=True)
    email_verified = models.BooleanField(
        default=False,
        help_text="Whether this user has confirmed ownership of their email via the OTP verification flow.",
    )
    username  = models.CharField(
        max_length=30, unique=True, blank=True, null=True, default=None,
        help_text="Public display name shown on Q&A and Discussions. Reviews stay anonymous. Alphanumeric and underscores only.",
    )
    full_name = models.CharField(max_length=255, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.USER)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        db_table = "accounts_user"
        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["role"]),
        ]

    def __str__(self):
        return f"{self.email} ({self.role})"

    @property
    def is_super_admin(self):
        return self.role == self.Role.SUPER_ADMIN

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN


class UserProfile(models.Model):
    class Status(models.TextChoices):
        UG_ASPIRANT          = "ug_aspirant",          "UG Aspirant"
        UG_STUDENT           = "ug_student",           "UG Student"
        PG_ASPIRANT          = "pg_aspirant",          "PG Aspirant"
        PG_STUDENT           = "pg_student",           "PG Student"
        WORKING_PROFESSIONAL = "working_professional", "Working Professional"
        ALUMNI               = "alumni",               "Alumni"
        FACULTY              = "faculty",              "Faculty / Professor"
        OTHER                = "other",                "Other"

    # Statuses that make someone eligible for Specialty/PG Communities — see
    # modules/communities. Deliberately explicit rather than derived from
    # highest_education, since that's a broader "have they done PG" signal
    # while this is "are they a PG doctor, alumnus, or faculty member today".
    COMMUNITY_ELIGIBLE_STATUSES = (
        Status.PG_STUDENT,
        Status.WORKING_PROFESSIONAL,
        Status.ALUMNI,
        Status.FACULTY,
    )

    class Education(models.TextChoices):
        UG = "ug", "UG"
        PG = "pg", "PG"

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    current_status = models.CharField(
        max_length=30, choices=Status.choices, blank=True, default="",
    )
    highest_education = models.CharField(
        max_length=10, choices=Education.choices, blank=True, default="",
    )
    # ForeignKeys use string reference (app_label.Model) to avoid any import ordering issues
    ug_college = models.ForeignKey(
        "colleges.College",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="ug_profiles",
    )
    pg_college = models.ForeignKey(
        "colleges.College",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="pg_profiles",
    )
    # When each college field was last freely set (initial set, or an
    # admin-approved change) — anchors the self-correction grace window in
    # is_college_locked. Left null for rows that predate this feature, which
    # is deliberately treated as "already locked" (see is_college_locked).
    ug_college_set_at = models.DateTimeField(null=True, blank=True)
    pg_college_set_at = models.DateTimeField(null=True, blank=True)
    pg_department = models.CharField(
        max_length=100, blank=True, default="", choices=PG_DEPARTMENT_CHOICES,
        help_text="Self-reported PG specialty — drives which Specialty Communities this profile is auto-joined to.",
    )
    batch = models.CharField(
        max_length=20, blank=True, default="",
        help_text="Batch year, e.g. 2016. Required when current_status is a student or alumni status.",
    )
    phone   = models.CharField(max_length=20, blank=True, default="")
    address = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "accounts_userprofile"

    def __str__(self):
        return f"Profile({self.user.email})"

    @property
    def is_community_eligible(self) -> bool:
        """PG doctors (student/working/alumni) and faculty — never UG."""
        return self.current_status in self.COMMUNITY_ELIGIBLE_STATUSES

    def is_college_locked(self, field: str) -> bool:
        """Whether `field` ("ug_college" or "pg_college") can no longer be
        self-edited from Settings and needs a CollegeChangeRequest instead.

        Setting a currently-empty field is always free (that's the normal UG
        student -> PG student progression, not a "change"). Changing an
        already-set value is free only briefly, to fix an honest signup typo:
        within COLLEGE_EDIT_GRACE_PERIOD of when it was set, AND only as long
        as no review has been posted under that affiliation yet — a review
        being live is exactly the signal that this "typo fix" would really be
        the review-farming loophole this whole mechanism exists to close.
        """
        current_id = getattr(self, f"{field}_id")
        if not current_id:
            return False
        set_at = getattr(self, f"{field}_set_at")
        if set_at is None or timezone.now() - set_at >= COLLEGE_EDIT_GRACE_PERIOD:
            return True
        from modules.colleges.models import Review
        return Review.objects.filter(user_id=self.user_id, college_id=current_id).exists()


def college_change_proof_upload_path(instance, filename):
    return f"college_change_proofs/{instance.user_id}/{filename}"


# What a real admission letter / bonafide certificate / ID card scan
# actually comes as — a scanned document or a photo of one. Deliberately
# not "anything" (that's how the 5 migration-test .txt files got in — see
# HANDOVER.md's Supabase migration section; those pre-existing rows are
# unaffected, this only gates new uploads going forward).
PROOF_ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"]
PROOF_ALLOWED_CONTENT_TYPES = {
    "application/pdf": "pdf",
    "image/jpeg": ("jpg", "jpeg"),
    "image/png": "png",
}


class CollegeChangeRequest(models.Model):
    """A user's request to change an already-locked ug_college/pg_college,
    with proof, reviewed by an admin — see UserProfile.is_college_locked."""

    class Field(models.TextChoices):
        UG = "ug_college", "UG College"
        PG = "pg_college", "PG College"

    class Status(models.TextChoices):
        PENDING  = "pending",  "Pending Review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    user   = models.ForeignKey(User, on_delete=models.CASCADE, related_name="college_change_requests")
    field  = models.CharField(max_length=10, choices=Field.choices)
    current_college = models.ForeignKey(
        "colleges.College", on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
    )
    requested_college = models.ForeignKey(
        "colleges.College", on_delete=models.CASCADE, related_name="+",
    )
    proof  = models.FileField(
        upload_to=college_change_proof_upload_path,
        validators=[FileExtensionValidator(allowed_extensions=PROOF_ALLOWED_EXTENSIONS)],
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    rejection_reason = models.CharField(max_length=255, blank=True, default="")
    resolved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
    )
    created_at  = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "accounts_collegechangerequest"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.email}: {self.field} -> college {self.requested_college_id} ({self.status})"
