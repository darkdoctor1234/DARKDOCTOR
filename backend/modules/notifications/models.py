from django.db import models


class Notification(models.Model):
    class Verb(models.TextChoices):
        REVIEW_NEW       = "review_new",       "New review at your college"
        REVIEW_APPROVED  = "review_approved",  "Your review was approved"
        REVIEW_REJECTED  = "review_rejected",  "Your review was rejected"
        REVIEW_HELPFUL   = "review_helpful",   "Someone found your review helpful"
        ANSWER_NEW       = "answer_new",       "Someone answered your question"
        DISCUSSION_REPLY = "discussion_reply", "New reply in a discussion you're part of"
        COMMUNITY_COMMENT = "community_comment", "New comment on your community post"
        COLLEGE_CHANGE_APPROVED = "college_change_approved", "Your college change request was approved"
        COLLEGE_CHANGE_REJECTED = "college_change_rejected", "Your college change request was rejected"

    recipient = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="notifications",
    )
    # Who triggered the notification, e.g. the answerer or commenter. Null for
    # system-driven ones (e.g. an admin's review approval isn't attributed).
    actor = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
    )
    verb    = models.CharField(max_length=30, choices=Verb.choices)
    message = models.CharField(max_length=255)
    # Frontend path to navigate to on click, e.g. "/colleges/12/questions/34".
    url = models.CharField(max_length=255, blank=True)
    is_read    = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "is_read"]),
        ]

    def __str__(self):
        return f"{self.get_verb_display()} -> {self.recipient}"
