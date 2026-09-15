from django.urls import path
from .views import (
    MyCommunitiesView,
    JoinCommunityView,
    ExitCommunityView,
    DiscussionPostListCreateView,
    DiscussionPostDetailView,
    PollVoteView,
    MyDiscussionPostsView,
    CommunityCommentListCreateView,
    DiscussionPostReportView,
    CommunityCommentReportView,
    DiscussionPostAdminListView,
    DiscussionPostAdminActionView,
    CommunityCommentAdminListView,
    CommunityCommentAdminActionView,
)

urlpatterns = [
    path("mine/",                        MyCommunitiesView.as_view(),              name="communities-mine"),
    path("<int:pk>/join/",                JoinCommunityView.as_view(),              name="community-join"),
    path("<int:pk>/exit/",                ExitCommunityView.as_view(),              name="community-exit"),

    path("posts/",                       DiscussionPostListCreateView.as_view(),   name="post-list-create"),
    path("posts/mine/",                  MyDiscussionPostsView.as_view(),          name="posts-mine"),
    path("posts/flagged/",               DiscussionPostAdminListView.as_view(),    name="posts-flagged"),
    path("posts/<int:pk>/",              DiscussionPostDetailView.as_view(),       name="post-detail"),
    path("posts/<int:pk>/vote/",         PollVoteView.as_view(),                   name="post-vote"),
    path("posts/<int:pk>/report/",       DiscussionPostReportView.as_view(),       name="post-report"),
    path("posts/<int:pk>/admin/",        DiscussionPostAdminActionView.as_view(),  name="post-admin"),
    path("posts/<int:pk>/comments/",     CommunityCommentListCreateView.as_view(), name="post-comments"),

    path("comments/flagged/",            CommunityCommentAdminListView.as_view(),   name="comments-flagged"),
    path("comments/<int:pk>/report/",    CommunityCommentReportView.as_view(),      name="comment-report"),
    path("comments/<int:pk>/admin/",     CommunityCommentAdminActionView.as_view(), name="comment-admin"),
]
