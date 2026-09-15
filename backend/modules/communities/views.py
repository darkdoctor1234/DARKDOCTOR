from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response

from modules.notifications.services import notify
from .models import (
    Community, CommunityMembership, DiscussionPost, PollOption, PollVote,
    CommunityComment, DiscussionPostReport, CommunityCommentReport,
)
from .serializers import (
    MyCommunitySerializer,
    DiscussionPostListSerializer,
    DiscussionPostDetailSerializer,
    DiscussionPostCreateSerializer,
    CommunityCommentSerializer,
    CommunityCommentCreateSerializer,
    DiscussionPostReportSerializer,
    CommunityCommentReportSerializer,
    DiscussionPostAdminSerializer,
    CommunityCommentAdminSerializer,
)
from .services import eligible_communities_for, AUTO_HIDE_THRESHOLD
from modules.authentication.permissions import IsSuperAdmin

# ── shared prefetch queryset ────────────────────────────────────────────────
_POST_QUERYSET = (
    DiscussionPost.objects
    .select_related("community", "author", "author__profile")
    .prefetch_related("poll_options__votes", "comments")
)


def _active_membership(user, community_id):
    """The user's active CommunityMembership for this community, or None.
    Communities are closed groups — no membership means no read or write
    access, unlike the old open-channel model."""
    if not (user and user.is_authenticated):
        return None
    try:
        m = CommunityMembership.objects.select_related("community").get(
            user=user, community_id=community_id, is_active=True,
        )
        return m
    except CommunityMembership.DoesNotExist:
        return None


def _touch_activity(community_id):
    Community.objects.filter(pk=community_id).update(last_activity_at=timezone.now())


# ── My communities (the only "list" endpoint — no open browsing) ───────────

class MyCommunitiesView(APIView):
    """
    GET /communities/mine/ — the (up to 3) communities that exist for this
    profile, active or not. A left (is_active=False) community still shows
    up here so there's a way back in via Join — it just doesn't count as a
    membership for posting/reading purposes elsewhere.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        memberships = (
            CommunityMembership.objects
            .filter(user=request.user)
            .select_related("community")
            .order_by("community__type")
        )
        return Response(MyCommunitySerializer(memberships, many=True).data)


class JoinCommunityView(APIView):
    """
    POST /communities/{id}/join/ — rejoin a community you'd previously left,
    or (edge case) join one you're newly eligible for since the last profile
    save. Only ever works for a community your CURRENT profile actually
    qualifies for — you can't join an arbitrary department/state.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        community = get_object_or_404(Community, pk=pk)
        try:
            profile = request.user.profile
        except Exception:
            return Response({"detail": "Complete your profile first."}, status=403)

        eligible_ids = {c.id for c in eligible_communities_for(profile)}
        if community.id not in eligible_ids:
            return Response({"detail": "This community isn't available to your profile."}, status=403)

        membership, created = CommunityMembership.objects.get_or_create(
            user=request.user, community=community,
            defaults={"is_active": True},
        )
        if not created and not membership.is_active:
            membership.is_active = True
            membership.left_at = None
            membership.save(update_fields=["is_active", "left_at"])

        return Response(MyCommunitySerializer(membership).data)


class ExitCommunityView(APIView):
    """POST /communities/{id}/exit/ — soft-leave; never re-auto-added later."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        membership = get_object_or_404(CommunityMembership, user=request.user, community_id=pk)
        if membership.is_active:
            membership.is_active = False
            membership.left_at = timezone.now()
            membership.save(update_fields=["is_active", "left_at"])
        return Response({"detail": "Left the community."})


# ── Posts ────────────────────────────────────────────────────────────────────

class DiscussionPostListCreateView(APIView):
    """
    GET  /communities/posts/?community={id}  — members only; reading marks
                                                the community "seen" (clears
                                                the unread badge).
    POST /communities/posts/                 — members only.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        community_id = request.query_params.get("community")
        if not community_id:
            return Response({"detail": "?community=<id> is required."}, status=400)

        membership = _active_membership(request.user, community_id)
        if not membership:
            return Response({"detail": "You're not a member of this community."}, status=403)

        membership.last_seen_at = timezone.now()
        membership.save(update_fields=["last_seen_at"])

        qs = _POST_QUERYSET.filter(community_id=community_id, status=DiscussionPost.Status.VISIBLE)
        return Response(DiscussionPostListSerializer(qs, many=True, context={"request": request}).data)

    def post(self, request):
        community_id = request.data.get("community")
        if not _active_membership(request.user, community_id):
            return Response({"detail": "You're not a member of this community."}, status=403)

        serializer = DiscussionPostCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        post = serializer.save(author=request.user)
        _touch_activity(post.community_id)

        post = _POST_QUERYSET.get(pk=post.pk)
        return Response(
            DiscussionPostDetailSerializer(post, context={"request": request}).data,
            status=201,
        )


class DiscussionPostDetailView(APIView):
    """GET /communities/posts/{pk}/ — members only."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        post = get_object_or_404(_POST_QUERYSET, pk=pk)
        if not _active_membership(request.user, post.community_id):
            return Response({"detail": "You're not a member of this community."}, status=403)
        return Response(DiscussionPostDetailSerializer(post, context={"request": request}).data)


class PollVoteView(APIView):
    """POST /communities/posts/{pk}/vote/  body: {"option": <id>} — members only."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        post = get_object_or_404(DiscussionPost, pk=pk)
        if not _active_membership(request.user, post.community_id):
            return Response({"detail": "You're not a member of this community."}, status=403)

        option_id = request.data.get("option")
        option = get_object_or_404(PollOption, pk=option_id, post=post)

        with transaction.atomic():
            PollVote.objects.filter(post=post, user=request.user).delete()
            PollVote.objects.create(post=post, option=option, user=request.user)

        refreshed = _POST_QUERYSET.get(pk=pk)
        return Response(DiscussionPostDetailSerializer(refreshed, context={"request": request}).data)


class MyDiscussionPostsView(generics.ListAPIView):
    """GET /communities/posts/mine/ — current user's own posts. Reading your
    own authored content doesn't need a membership re-check."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class    = DiscussionPostListSerializer

    def get_queryset(self):
        return _POST_QUERYSET.filter(author=self.request.user)


# ── Comments ─────────────────────────────────────────────────────────────────

class CommunityCommentListCreateView(APIView):
    """GET/POST /communities/posts/{pk}/comments/ — members only, both ways."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        post = get_object_or_404(DiscussionPost, pk=pk)
        if not _active_membership(request.user, post.community_id):
            return Response({"detail": "You're not a member of this community."}, status=403)
        comments = post.comments.filter(status=CommunityComment.Status.VISIBLE).select_related("author", "author__profile")
        return Response(CommunityCommentSerializer(comments, many=True, context={"request": request}).data)

    def post(self, request, pk):
        post = get_object_or_404(DiscussionPost, pk=pk)
        if not _active_membership(request.user, post.community_id):
            return Response({"detail": "You're not a member of this community."}, status=403)

        serializer = CommunityCommentCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        comment = serializer.save(post=post, author=request.user)
        _touch_activity(post.community_id)
        notify(
            post.author, "community_comment",
            f'New comment on your post "{post.title}"',
            url=f"/communities/{post.community_id}/posts/{post.id}", actor=request.user,
        )

        return Response(
            CommunityCommentSerializer(comment, context={"request": request}).data,
            status=201,
        )


# ── Reporting ────────────────────────────────────────────────────────────────

class DiscussionPostReportView(APIView):
    """POST /communities/posts/{pk}/report/ — members only."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        post = get_object_or_404(DiscussionPost, pk=pk)
        if not _active_membership(request.user, post.community_id):
            return Response({"detail": "You're not a member of this community."}, status=403)
        if DiscussionPostReport.objects.filter(post=post, reporter=request.user).exists():
            return Response({"detail": "You have already reported this post."}, status=400)

        serializer = DiscussionPostReportSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        with transaction.atomic():
            DiscussionPostReport.objects.create(post=post, reporter=request.user, **serializer.validated_data)
            new_count = post.report_count + 1
            DiscussionPost.objects.filter(pk=pk).update(report_count=new_count)
            if new_count >= AUTO_HIDE_THRESHOLD:
                DiscussionPost.objects.filter(pk=pk).update(status=DiscussionPost.Status.FLAGGED)

        return Response({"detail": "Post reported. Thank you for flagging it."})


class CommunityCommentReportView(APIView):
    """POST /communities/comments/{pk}/report/ — members only."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        comment = get_object_or_404(CommunityComment, pk=pk)
        if not _active_membership(request.user, comment.post.community_id):
            return Response({"detail": "You're not a member of this community."}, status=403)
        if CommunityCommentReport.objects.filter(comment=comment, reporter=request.user).exists():
            return Response({"detail": "You have already reported this comment."}, status=400)

        serializer = CommunityCommentReportSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        with transaction.atomic():
            CommunityCommentReport.objects.create(comment=comment, reporter=request.user, **serializer.validated_data)
            new_count = comment.report_count + 1
            CommunityComment.objects.filter(pk=pk).update(report_count=new_count)
            if new_count >= AUTO_HIDE_THRESHOLD:
                CommunityComment.objects.filter(pk=pk).update(status=CommunityComment.Status.FLAGGED)

        return Response({"detail": "Comment reported. Thank you for flagging it."})


# ── Super-admin moderation ──────────────────────────────────────────────────

class DiscussionPostAdminListView(generics.ListAPIView):
    """GET /communities/posts/flagged/ — super admin only."""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]
    serializer_class    = DiscussionPostAdminSerializer

    def get_queryset(self):
        return _POST_QUERYSET.filter(status=DiscussionPost.Status.FLAGGED).order_by("-report_count")


class DiscussionPostAdminActionView(APIView):
    """PATCH /communities/posts/{pk}/admin/ — approve or remove a flagged post."""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def patch(self, request, pk):
        post = get_object_or_404(DiscussionPost, pk=pk)
        action = request.data.get("action")
        if action == "approve":
            post.status = DiscussionPost.Status.VISIBLE
            post.save(update_fields=["status"])
            return Response({"detail": "Post approved and restored."})
        elif action == "remove":
            post.status = DiscussionPost.Status.REMOVED
            post.save(update_fields=["status"])
            return Response({"detail": "Post removed."})
        return Response({"detail": "action must be 'approve' or 'remove'."}, status=400)


class CommunityCommentAdminListView(generics.ListAPIView):
    """GET /communities/comments/flagged/ — super admin only."""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]
    serializer_class    = CommunityCommentAdminSerializer

    def get_queryset(self):
        return (
            CommunityComment.objects
            .filter(status=CommunityComment.Status.FLAGGED)
            .select_related("author", "author__profile", "post")
            .order_by("-report_count")
        )


class CommunityCommentAdminActionView(APIView):
    """PATCH /communities/comments/{pk}/admin/ — approve or remove a flagged comment."""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def patch(self, request, pk):
        comment = get_object_or_404(CommunityComment, pk=pk)
        action = request.data.get("action")
        if action == "approve":
            comment.status = CommunityComment.Status.VISIBLE
            comment.save(update_fields=["status"])
            return Response({"detail": "Comment approved and restored."})
        elif action == "remove":
            comment.status = CommunityComment.Status.REMOVED
            comment.save(update_fields=["status"])
            return Response({"detail": "Comment removed."})
        return Response({"detail": "action must be 'approve' or 'remove'."}, status=400)
