from django.db import models
from modules.accounts.constants import PG_DEPARTMENT_CHOICES


class Community(models.Model):
    """
    A PG-doctor community. Every PG-eligible user (see
    `UserProfile.is_community_eligible`) belongs to exactly up to three of
    these, auto-derived from their profile — never a free-browse directory:

      • one National Overall community (everyone eligible)
      • one Department–National community, for their own `pg_department`
      • one Department–State community, for their own `pg_department` ×
        their `pg_college.state`

    Department–State rows are created lazily (get_or_create the first time a
    profile needs one) rather than pre-seeded for every department × state
    combination — most would sit empty.
    """
    class Type(models.TextChoices):
        NATIONAL_OVERALL    = "national_overall",    "National, All PG Doctors"
        DEPARTMENT_NATIONAL = "department_national",  "Department, National"
        DEPARTMENT_STATE    = "department_state",     "Department, State"

    type       = models.CharField(max_length=20, choices=Type.choices)
    department = models.CharField(max_length=100, blank=True, default="", choices=PG_DEPARTMENT_CHOICES)
    state      = models.CharField(max_length=100, blank=True, default="")
    name       = models.CharField(max_length=180, blank=True, default="", help_text="Cached display name — computed on save if left blank.")

    # Denormalized so "is there anything new?" (the unread badge) is a cheap
    # read instead of an aggregate over posts+comments on every page load.
    last_activity_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "communities_community"
        unique_together = [("type", "department", "state")]
        indexes = [models.Index(fields=["type", "department", "state"])]
        verbose_name_plural = "communities"

    def save(self, *args, **kwargs):
        if not self.name:
            self.name = self._compute_name()
        super().save(*args, **kwargs)

    def _compute_name(self) -> str:
        if self.type == self.Type.NATIONAL_OVERALL:
            return "All PG Doctors, India"
        if self.type == self.Type.DEPARTMENT_NATIONAL:
            return f"{self.department}, India"
        return f"{self.department}, {self.state}"

    def __str__(self):
        return self.name


class CommunityMembership(models.Model):
    """
    A user's membership in a Community. Membership is auto-granted (see
    `modules/communities/services.py:sync_memberships`) whenever a profile
    becomes eligible for a community — there is no "browse and join a
    stranger's community" flow, only Join (rejoin) / Exit on your own three.

    `is_active=False` is a soft-leave: exiting never deletes the row, so a
    later profile save (e.g. editing an unrelated field) can't silently
    re-add a community the user deliberately left.
    """
    user       = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="community_memberships")
    community  = models.ForeignKey(Community, on_delete=models.CASCADE, related_name="memberships")
    is_active  = models.BooleanField(default=True)
    joined_at  = models.DateTimeField(auto_now_add=True)
    left_at    = models.DateTimeField(null=True, blank=True)
    last_seen_at = models.DateTimeField(null=True, blank=True, help_text="Last time this user opened this community — drives the unread badge.")

    class Meta:
        db_table = "communities_communitymembership"
        unique_together = [("user", "community")]
        indexes = [models.Index(fields=["user", "is_active"])]

    def __str__(self):
        return f"{self.user.email} in {self.community} ({'active' if self.is_active else 'left'})"


class DiscussionPost(models.Model):
    """
    A post inside a Community. Unlike Review/Q&A, Community posts show the
    author's real name (see DiscussionPostSerializer) — this is a
    professional-networking space, not an anonymous one, per explicit product
    direction. Has the same visible/flagged/removed moderation pipeline as
    Review (see DiscussionPostReport below).
    """
    class Status(models.TextChoices):
        VISIBLE = "visible", "Visible"
        FLAGGED = "flagged", "Flagged (pending review)"
        REMOVED = "removed", "Removed by admin"

    community  = models.ForeignKey(Community, on_delete=models.CASCADE, related_name="posts")
    author     = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="community_posts")
    title      = models.CharField(max_length=200)
    content    = models.TextField()

    status        = models.CharField(max_length=10, choices=Status.choices, default=Status.VISIBLE)
    report_count  = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "communities_discussionpost"
        ordering = ["-created_at"]
        indexes  = [
            models.Index(fields=["community", "status"]),
            models.Index(fields=["author"]),
        ]

    def __str__(self):
        return f"[{self.community}] {self.title}"


class PollOption(models.Model):
    """One selectable option on a DiscussionPost's poll. A post with zero
    options has no poll (poll is optional)."""
    post          = models.ForeignKey(DiscussionPost, on_delete=models.CASCADE, related_name="poll_options")
    text          = models.CharField(max_length=200)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "communities_polloption"
        ordering = ["display_order", "id"]

    def __str__(self):
        return f"{self.text} (post {self.post_id})"


class PollVote(models.Model):
    """One user's vote on a poll. Single-choice: `unique_together` on
    (post, user) means casting a new vote replaces the existing one."""
    post       = models.ForeignKey(DiscussionPost, on_delete=models.CASCADE, related_name="poll_votes")
    option     = models.ForeignKey(PollOption, on_delete=models.CASCADE, related_name="votes")
    user       = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="community_poll_votes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "communities_pollvote"
        unique_together = [("post", "user")]

    def __str__(self):
        return f"{self.user.email} → option {self.option_id}"


class CommunityComment(models.Model):
    """A comment on a DiscussionPost. Real name visible, same as the post
    itself. Membership is required to comment (and to post) — see
    IsCommunityMember in modules/authentication/permissions.py."""

    class Status(models.TextChoices):
        VISIBLE = "visible", "Visible"
        FLAGGED = "flagged", "Flagged (pending review)"
        REMOVED = "removed", "Removed by admin"

    post       = models.ForeignKey(DiscussionPost, on_delete=models.CASCADE, related_name="comments")
    author     = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="community_comments")
    content    = models.TextField()

    status        = models.CharField(max_length=10, choices=Status.choices, default=Status.VISIBLE)
    report_count  = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "communities_communitycomment"
        ordering = ["created_at"]

    def __str__(self):
        return f"Comment on post {self.post_id} by {self.author.email}"


# ── Moderation ───────────────────────────────────────────────────────────────

class DiscussionPostReport(models.Model):
    class Reason(models.TextChoices):
        SPAM        = "spam",        "Spam or advertisement"
        OFFENSIVE   = "offensive",   "Offensive or inappropriate"
        MISLEADING  = "misleading",  "Medically misleading / misinformation"
        HARASSMENT  = "harassment",  "Harassment of another member"
        OTHER       = "other",       "Other"

    post       = models.ForeignKey(DiscussionPost, on_delete=models.CASCADE, related_name="reports")
    reporter   = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="community_post_reports")
    reason     = models.CharField(max_length=20, choices=Reason.choices)
    detail     = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "communities_discussionpostreport"
        unique_together = [("post", "reporter")]

    def __str__(self):
        return f"Report on post {self.post_id} by {self.reporter.email}"


class CommunityCommentReport(models.Model):
    class Reason(models.TextChoices):
        SPAM        = "spam",        "Spam or advertisement"
        OFFENSIVE   = "offensive",   "Offensive or inappropriate"
        MISLEADING  = "misleading",  "Medically misleading / misinformation"
        HARASSMENT  = "harassment",  "Harassment of another member"
        OTHER       = "other",       "Other"

    comment    = models.ForeignKey(CommunityComment, on_delete=models.CASCADE, related_name="reports")
    reporter   = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="community_comment_reports")
    reason     = models.CharField(max_length=20, choices=Reason.choices)
    detail     = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "communities_communitycommentreport"
        unique_together = [("comment", "reporter")]

    def __str__(self):
        return f"Report on comment {self.comment_id} by {self.reporter.email}"
