from django.contrib import admin
from .models import (
    Community, CommunityMembership, DiscussionPost, PollOption, PollVote,
    CommunityComment, DiscussionPostReport, CommunityCommentReport,
)


@admin.register(Community)
class CommunityAdmin(admin.ModelAdmin):
    list_display  = ["name", "type", "department", "state", "member_count", "last_activity_at", "created_at"]
    list_filter   = ["type", "department", "state"]
    search_fields = ["name", "department", "state"]
    readonly_fields = ["last_activity_at"]

    def member_count(self, obj):
        return obj.memberships.filter(is_active=True).count()


@admin.register(CommunityMembership)
class CommunityMembershipAdmin(admin.ModelAdmin):
    list_display  = ["user", "community", "is_active", "joined_at", "left_at"]
    list_filter   = ["is_active", "community__type"]
    search_fields = ["user__email", "community__name"]


class PollOptionInline(admin.TabularInline):
    model = PollOption
    extra = 0


@admin.register(DiscussionPost)
class DiscussionPostAdmin(admin.ModelAdmin):
    list_display  = ["title", "community", "author", "status", "report_count", "created_at"]
    list_filter   = ["status", "community__type"]
    search_fields = ["title", "content", "author__email"]
    inlines       = [PollOptionInline]


@admin.register(CommunityComment)
class CommunityCommentAdmin(admin.ModelAdmin):
    list_display  = ["post", "author", "status", "report_count", "created_at"]
    list_filter   = ["status"]
    search_fields = ["content", "author__email"]


@admin.register(DiscussionPostReport)
class DiscussionPostReportAdmin(admin.ModelAdmin):
    list_display  = ["post", "reporter", "reason", "created_at"]
    list_filter   = ["reason"]


@admin.register(CommunityCommentReport)
class CommunityCommentReportAdmin(admin.ModelAdmin):
    list_display  = ["comment", "reporter", "reason", "created_at"]
    list_filter   = ["reason"]


admin.site.register(PollVote)
