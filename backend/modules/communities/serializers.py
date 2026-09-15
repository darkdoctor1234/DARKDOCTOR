from rest_framework import serializers
from .models import (
    Community, CommunityMembership, DiscussionPost, PollOption, PollVote,
    CommunityComment, DiscussionPostReport, CommunityCommentReport,
)


def _display_name(user) -> str:
    """Community shows real identity (unlike Review/Q&A) — full name, falling
    back to username, falling back to a generic label if neither is set."""
    return user.full_name or user.username or "Doctor"


def _author_department(user) -> str:
    try:
        return user.profile.pg_department or ""
    except Exception:
        return ""


class MyCommunitySerializer(serializers.ModelSerializer):
    """
    One row per active CommunityMembership — this, not a `Community` list
    endpoint, is what drives the frontend: a user only ever sees their own
    (up to 3) communities, never a directory of every community that exists.
    """
    id           = serializers.IntegerField(source="community.id")
    type         = serializers.CharField(source="community.type")
    name         = serializers.CharField(source="community.name")
    department   = serializers.CharField(source="community.department")
    state        = serializers.CharField(source="community.state")
    member_count = serializers.SerializerMethodField()
    has_unread   = serializers.SerializerMethodField()

    class Meta:
        model  = CommunityMembership
        fields = ["id", "type", "name", "department", "state", "member_count", "has_unread", "is_active", "joined_at"]

    def get_member_count(self, obj):
        return obj.community.memberships.filter(is_active=True).count()

    def get_has_unread(self, obj):
        last_activity = obj.community.last_activity_at
        if not last_activity:
            return False
        if not obj.last_seen_at:
            return True
        return last_activity > obj.last_seen_at


class PollOptionSerializer(serializers.ModelSerializer):
    vote_count = serializers.IntegerField(source="votes.count", read_only=True)

    class Meta:
        model  = PollOption
        fields = ["id", "text", "display_order", "vote_count"]


class CommunityCommentSerializer(serializers.ModelSerializer):
    display_name       = serializers.SerializerMethodField()
    author_department   = serializers.SerializerMethodField()
    is_mine             = serializers.SerializerMethodField()

    class Meta:
        model  = CommunityComment
        fields = ["id", "post", "display_name", "author_department", "is_mine", "content", "created_at"]
        read_only_fields = ["id", "post", "display_name", "author_department", "is_mine", "created_at"]

    def get_display_name(self, obj):
        return _display_name(obj.author)

    def get_author_department(self, obj):
        return _author_department(obj.author)

    def get_is_mine(self, obj):
        request = self.context.get("request")
        return bool(request and request.user and request.user.is_authenticated and obj.author_id == request.user.id)


class CommunityCommentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CommunityComment
        fields = ["content"]

    def validate_content(self, value):
        if not value.strip():
            raise serializers.ValidationError("Comment cannot be empty.")
        return value


class DiscussionPostListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for a community's feed."""
    display_name      = serializers.SerializerMethodField()
    author_department  = serializers.SerializerMethodField()
    is_mine            = serializers.SerializerMethodField()
    community_name     = serializers.CharField(source="community.name", read_only=True)
    poll_options       = PollOptionSerializer(many=True, read_only=True)
    has_poll           = serializers.SerializerMethodField()
    total_votes        = serializers.SerializerMethodField()
    my_vote            = serializers.SerializerMethodField()
    comment_count      = serializers.IntegerField(source="comments.count", read_only=True)

    class Meta:
        model  = DiscussionPost
        fields = [
            "id", "community", "community_name",
            "display_name", "author_department", "is_mine",
            "title", "content",
            "poll_options", "has_poll", "total_votes", "my_vote",
            "comment_count",
            "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_display_name(self, obj):
        return _display_name(obj.author)

    def get_author_department(self, obj):
        return _author_department(obj.author)

    def get_is_mine(self, obj):
        request = self.context.get("request")
        return bool(request and request.user and request.user.is_authenticated and obj.author_id == request.user.id)

    def get_has_poll(self, obj):
        return len(obj.poll_options.all()) > 0

    def get_total_votes(self, obj):
        return sum(len(o.votes.all()) for o in obj.poll_options.all())

    def get_my_vote(self, obj):
        request = self.context.get("request")
        if not (request and request.user and request.user.is_authenticated):
            return None
        for option in obj.poll_options.all():
            for vote in option.votes.all():
                if vote.user_id == request.user.id:
                    return option.id
        return None


class DiscussionPostDetailSerializer(DiscussionPostListSerializer):
    comments = CommunityCommentSerializer(many=True, read_only=True)

    class Meta(DiscussionPostListSerializer.Meta):
        fields = DiscussionPostListSerializer.Meta.fields + ["comments"]
        read_only_fields = fields


class DiscussionPostCreateSerializer(serializers.ModelSerializer):
    poll_options = serializers.ListField(
        child=serializers.CharField(max_length=200),
        write_only=True, required=False, default=list,
    )

    class Meta:
        model  = DiscussionPost
        fields = ["community", "title", "content", "poll_options"]

    def validate_poll_options(self, value):
        cleaned = [v.strip() for v in value if v.strip()]
        if len(cleaned) == 1:
            raise serializers.ValidationError("A poll needs at least 2 options (or leave it empty for no poll).")
        if len(cleaned) > 8:
            raise serializers.ValidationError("A poll can have at most 8 options.")
        return cleaned

    def create(self, validated_data):
        option_texts = validated_data.pop("poll_options", [])
        post = DiscussionPost.objects.create(**validated_data)
        PollOption.objects.bulk_create([
            PollOption(post=post, text=text, display_order=i)
            for i, text in enumerate(option_texts)
        ])
        return post


# ── Moderation ───────────────────────────────────────────────────────────────

class DiscussionPostReportSerializer(serializers.ModelSerializer):
    class Meta:
        model  = DiscussionPostReport
        fields = ["reason", "detail"]


class CommunityCommentReportSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CommunityCommentReport
        fields = ["reason", "detail"]


class DiscussionPostAdminSerializer(DiscussionPostListSerializer):
    """Super-admin moderation queue — adds real author identity (already
    visible via display_name here, unlike Review) plus status/report_count."""
    author_email = serializers.CharField(source="author.email", read_only=True)

    class Meta(DiscussionPostListSerializer.Meta):
        fields = DiscussionPostListSerializer.Meta.fields + ["author_email", "status", "report_count"]
        read_only_fields = fields


class CommunityCommentAdminSerializer(CommunityCommentSerializer):
    author_email  = serializers.CharField(source="author.email", read_only=True)
    post_title    = serializers.CharField(source="post.title", read_only=True)

    class Meta(CommunityCommentSerializer.Meta):
        fields = CommunityCommentSerializer.Meta.fields + ["author_email", "post_title", "status", "report_count"]
        read_only_fields = fields
