from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class College(models.Model):

    class CollegeType(models.TextChoices):
        GOVT    = "govt",    "Government"
        PRIVATE = "private", "Private"

    # ── basic info ──────────────────────────────────────
    name             = models.CharField(max_length=255)
    intake_seats     = models.PositiveIntegerField()
    established_year = models.PositiveSmallIntegerField()
    location         = models.CharField(max_length=255)
    college_type     = models.CharField(max_length=10, choices=CollegeType.choices)

    # ── level: UG / PG (both allowed) ───────────────────
    is_ug = models.BooleanField(default=False)
    is_pg = models.BooleanField(default=False)

    # ── course types (multiple allowed) ─────────────────
    has_mbbs    = models.BooleanField(default=False)
    has_dental  = models.BooleanField(default=False)
    has_nursing = models.BooleanField(default=False)

    # ── state ───────────────────────────────────────────
    state = models.CharField(max_length=100, blank=True, default="")

    # ── extra info ──────────────────────────────────────
    university      = models.CharField(max_length=300, blank=True, default="")
    website_url     = models.URLField(max_length=500, blank=True, default="")
    google_maps_url = models.URLField(max_length=1000, blank=True, default="")
    about           = models.TextField(blank=True, default="")

    # ── meta ────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "colleges_college"
        ordering = ["-created_at"]
        indexes  = [
            models.Index(fields=["college_type"]),
            models.Index(fields=["name"]),
        ]

    def __str__(self):
        return self.name


class Department(models.Model):
    college = models.ForeignKey(
        College,
        on_delete=models.CASCADE,
        related_name="departments",
    )
    name = models.CharField(max_length=255)

    class Meta:
        db_table = "colleges_department"
        unique_together = [("college", "name")]

    def __str__(self):
        return f"{self.college.name}: {self.name}"


class SeatEntry(models.Model):
    """
    Granular seat breakdown for a college.

    Two usage patterns:
      • program-level only   → department = ""   e.g. MBBS = 20
      • program + department → department filled  e.g. PG / General Surgery = 10

    All entries for a college are replaced atomically via the
    PUT /colleges/{pk}/seats/ endpoint.
    """

    college       = models.ForeignKey(
        College,
        on_delete=models.CASCADE,
        related_name="seat_entries",
    )
    program       = models.CharField(max_length=100)
    department    = models.CharField(max_length=150, blank=True, default="")
    seats         = models.PositiveIntegerField()
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "colleges_seatentry"
        ordering = ["display_order", "program", "department"]

    def __str__(self):
        dept = f" / {self.department}" if self.department else ""
        return f"{self.college.name}, {self.program}{dept}: {self.seats}"


class FeeEntry(models.Model):
    """
    Per-program annual fee breakdown for a college (INR, whole rupees).

    Two usage patterns:
      • program-level only   → department = ""   e.g. MBBS = 150000
      • program + department → department filled  e.g. PG / Cardiology = 200000

    All entries for a college are replaced atomically via the
    PUT /colleges/{pk}/fees/ endpoint.
    """

    college       = models.ForeignKey(
        College,
        on_delete=models.CASCADE,
        related_name="fee_entries",
    )
    program       = models.CharField(max_length=100)
    department    = models.CharField(max_length=150, blank=True, default="")
    amount        = models.PositiveIntegerField(help_text="Annual fee in INR (whole rupees)")
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "colleges_feeentry"
        ordering = ["display_order", "program", "department"]

    def __str__(self):
        dept = f" / {self.department}" if self.department else ""
        return f"{self.college.name}, {self.program}{dept}: ₹{self.amount:,}"


class StipendEntry(models.Model):
    """
    Per-program monthly stipend breakdown for a college (INR, whole rupees).

    Two usage patterns:
      • program-level only   → department = ""   e.g. PG = 50000
      • program + department → department filled  e.g. PG / Cardiology = 75000

    All entries for a college are replaced atomically via the
    PUT /colleges/{pk}/stipends/ endpoint.
    """

    college       = models.ForeignKey(
        College,
        on_delete=models.CASCADE,
        related_name="stipend_entries",
    )
    program       = models.CharField(max_length=100)
    department    = models.CharField(max_length=150, blank=True, default="")
    amount        = models.PositiveIntegerField(help_text="Monthly stipend in INR (whole rupees)")
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "colleges_stipendentry"
        ordering = ["display_order", "program", "department"]

    def __str__(self):
        dept = f" / {self.department}" if self.department else ""
        return f"{self.college.name}, {self.program}{dept}: ₹{self.amount:,}/mo"


# ── Reviews ───────────────────────────────────────────────────────────────────

def review_image_upload_path(instance, filename):
    return f"reviews/{instance.review.college_id}/{filename}"


class Review(models.Model):

    class Role(models.TextChoices):
        STUDENT = "student", "Current Student"
        ALUMNI  = "alumni",  "Alumni"
        FACULTY = "faculty", "Faculty"

    class Status(models.TextChoices):
        PENDING  = "pending",  "Pending Approval"
        VISIBLE  = "visible",  "Visible"
        REJECTED = "rejected", "Rejected, resubmission allowed"
        FLAGGED  = "flagged",  "Flagged (pending review)"
        REMOVED  = "removed",  "Removed by admin"

    RATING_VALIDATORS = [MinValueValidator(1), MaxValueValidator(5)]

    college    = models.ForeignKey(College, on_delete=models.CASCADE, related_name="reviews")
    user       = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="reviews")

    role       = models.CharField(max_length=10, choices=Role.choices)
    department = models.CharField(max_length=150, blank=True, default="")
    batch_year = models.CharField(max_length=20,  blank=True, default="")

    title      = models.CharField(max_length=200)
    content    = models.TextField()

    # ── Ratings (1–5) ────────────────────────────────────────────────────────
    rating_infrastructure   = models.PositiveSmallIntegerField(validators=RATING_VALIDATORS)
    rating_clinical         = models.PositiveSmallIntegerField(validators=RATING_VALIDATORS)
    rating_hostel           = models.PositiveSmallIntegerField(validators=RATING_VALIDATORS)
    rating_administration   = models.PositiveSmallIntegerField(validators=RATING_VALIDATORS)
    rating_overall          = models.PositiveSmallIntegerField(validators=RATING_VALIDATORS)

    # ── Status & verification ────────────────────────────────────────────────
    status            = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    rejection_reason  = models.TextField(blank=True, default="")
    resolved_by       = models.ForeignKey(
        "accounts.User", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    is_verified    = models.BooleanField(default=False)
    helpful_count  = models.PositiveIntegerField(default=0)
    report_count   = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table  = "colleges_review"
        ordering  = ["-created_at"]
        indexes   = [
            models.Index(fields=["college", "status"]),
            models.Index(fields=["user"]),
        ]
        # one review per user per college
        unique_together = [("college", "user")]

    def __str__(self):
        return f"{self.user.email} → {self.college.name}: {self.title}"

    @property
    def average_rating(self):
        return round((
            self.rating_infrastructure +
            self.rating_clinical +
            self.rating_hostel +
            self.rating_administration +
            self.rating_overall
        ) / 5, 1)


class ReviewImage(models.Model):
    review     = models.ForeignKey(Review, on_delete=models.CASCADE, related_name="images")
    image      = models.ImageField(upload_to=review_image_upload_path)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "colleges_reviewimage"

    def __str__(self):
        return f"Image for review {self.review_id}"


class ReviewReport(models.Model):

    class Reason(models.TextChoices):
        FAKE        = "fake",        "Fake / Not a real student"
        SPAM        = "spam",        "Spam or advertisement"
        OFFENSIVE   = "offensive",   "Offensive or inappropriate"
        IRRELEVANT  = "irrelevant",  "Not relevant to this college"
        OTHER       = "other",       "Other"

    review     = models.ForeignKey(Review, on_delete=models.CASCADE, related_name="reports")
    reporter   = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="review_reports")
    reason     = models.CharField(max_length=20, choices=Reason.choices)
    detail     = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table       = "colleges_reviewreport"
        unique_together = [("review", "reporter")]

    def __str__(self):
        return f"Report on review {self.review_id} by {self.reporter.email}"


class ReviewHelpful(models.Model):
    """Tracks which users marked a review as helpful (one per user per review)."""
    review  = models.ForeignKey(Review, on_delete=models.CASCADE, related_name="helpful_votes")
    user    = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="helpful_votes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table       = "colleges_reviewhelpful"
        unique_together = [("review", "user")]


# ── Q&A / Discussions ────────────────────────────────────────────────────────

class ModerationStatus(models.TextChoices):
    """Shared by Question and Answer — no pending-approval step (they're live
    the moment they're posted, like Community content), just post-hoc report
    → auto-flag → admin approve/remove, same as DiscussionPost/CommunityComment."""
    VISIBLE = "visible", "Visible"
    FLAGGED = "flagged", "Flagged (pending review)"
    REMOVED = "removed", "Removed by admin"


class Question(models.Model):
    """
    A question or open-ended discussion post about a college, asked by a user.

    `kind` distinguishes the two framings shown on the profile page:
      • question   — expects an answer; "unanswered" = zero Answer rows.
      • discussion — open-ended, no expectation of a definitive answer.
    """

    class Kind(models.TextChoices):
        QUESTION   = "question",   "Question"
        DISCUSSION = "discussion", "Discussion"

    college = models.ForeignKey(College, on_delete=models.CASCADE, related_name="questions")
    user    = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="questions")

    kind    = models.CharField(max_length=10, choices=Kind.choices, default=Kind.QUESTION)
    title   = models.CharField(max_length=200)
    content = models.TextField()

    status       = models.CharField(max_length=10, choices=ModerationStatus.choices, default=ModerationStatus.VISIBLE)
    report_count = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "colleges_question"
        ordering = ["-created_at"]
        indexes  = [
            models.Index(fields=["college", "kind"]),
            models.Index(fields=["user"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"[{self.kind}] {self.title} ({self.college.name})"


class Answer(models.Model):
    """A reply to a Question (used for both 'question' and 'discussion' kinds)."""

    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="answers")
    user     = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="answers")
    content  = models.TextField()

    status       = models.CharField(max_length=10, choices=ModerationStatus.choices, default=ModerationStatus.VISIBLE)
    report_count = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "colleges_answer"
        ordering = ["created_at"]
        indexes  = [models.Index(fields=["status"])]

    def __str__(self):
        return f"Answer to question {self.question_id} by {self.user.email}"


class QuestionReport(models.Model):
    class Reason(models.TextChoices):
        SPAM       = "spam",       "Spam or advertisement"
        OFFENSIVE  = "offensive",  "Offensive or inappropriate"
        MISLEADING = "misleading", "Medically misleading / misinformation"
        HARASSMENT = "harassment", "Harassment or bullying"
        OTHER      = "other",      "Other"

    question  = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="reports")
    reporter  = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="question_reports")
    reason    = models.CharField(max_length=20, choices=Reason.choices)
    detail    = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table        = "colleges_questionreport"
        unique_together = [("question", "reporter")]

    def __str__(self):
        return f"Report on question {self.question_id} by {self.reporter.email}"


class AnswerReport(models.Model):
    answer    = models.ForeignKey(Answer, on_delete=models.CASCADE, related_name="reports")
    reporter  = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="answer_reports")
    reason    = models.CharField(max_length=20, choices=QuestionReport.Reason.choices)
    detail    = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table        = "colleges_answerreport"
        unique_together = [("answer", "reporter")]

    def __str__(self):
        return f"Report on answer {self.answer_id} by {self.reporter.email}"
