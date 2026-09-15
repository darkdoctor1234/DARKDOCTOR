from django.urls import path
from .views import (
    AdminListCreateView, AdminDetailView, AdminToggleActiveView,
    ProfileMeView, LeadsListView, LeadsExportView,
    CollegeChangeRequestCreateView, MyCollegeChangeRequestsView,
    CollegeChangeRequestAdminListView, CollegeChangeRequestActionView,
)

urlpatterns = [
    path("admins/", AdminListCreateView.as_view(), name="admin-list-create"),
    path("admins/<int:pk>/", AdminDetailView.as_view(), name="admin-detail"),
    path("admins/<int:pk>/toggle-active/", AdminToggleActiveView.as_view(), name="admin-toggle-active"),
    path("profile/me/", ProfileMeView.as_view(), name="profile-me"),
    path("leads/", LeadsListView.as_view(), name="leads-list"),
    path("leads/export/", LeadsExportView.as_view(), name="leads-export"),
    path("college-change-requests/", CollegeChangeRequestCreateView.as_view(), name="college-change-request-create"),
    path("college-change-requests/mine/", MyCollegeChangeRequestsView.as_view(), name="college-change-request-mine"),
    path("college-change-requests/pending/", CollegeChangeRequestAdminListView.as_view(), name="college-change-request-pending"),
    path("college-change-requests/<int:pk>/admin/", CollegeChangeRequestActionView.as_view(), name="college-change-request-admin"),
]
