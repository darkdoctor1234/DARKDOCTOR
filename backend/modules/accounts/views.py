import csv
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import User, UserProfile, CollegeChangeRequest
from .serializers import (
    UserSerializer, CreateAdminSerializer, UpdateAdminSerializer,
    UserProfileSerializer, LeadSerializer,
    CollegeChangeRequestCreateSerializer, CollegeChangeRequestSerializer,
)
from modules.authentication.permissions import IsSuperAdmin, IsAdmin
from modules.notifications.services import notify


def _sync_community_memberships(profile):
    """Best-effort — a Community sync failure should never block saving a
    profile. See modules.communities.services.sync_memberships."""
    try:
        from modules.communities.services import sync_memberships
        sync_memberships(profile)
    except Exception:
        pass


_COLLEGE_FIELD_LABEL = {"ug_college": "UG college", "pg_college": "PG college"}


def _check_college_lock(profile: UserProfile, data) -> dict:
    """Returns a dict of field -> error message for any ug_college/pg_college
    change in `data` that's blocked by UserProfile.is_college_locked. Empty
    dict means the request is clear to proceed."""
    errors = {}
    for field in ("ug_college", "pg_college"):
        if field not in data:
            continue
        raw = data.get(field)
        new_id = int(raw) if raw not in (None, "") else None
        if new_id == getattr(profile, f"{field}_id"):
            continue
        if profile.is_college_locked(field):
            label = _COLLEGE_FIELD_LABEL[field]
            errors[field] = (
                f"Your {label} is locked. Request a change with proof from your profile."
            )
    return errors


def _bump_college_set_at(profile: UserProfile, old_ug: int | None, old_pg: int | None):
    """Call right after saving a profile update — starts a fresh grace window
    for any college field that actually changed."""
    update_fields = []
    if profile.ug_college_id != old_ug:
        profile.ug_college_set_at = timezone.now()
        update_fields.append("ug_college_set_at")
    if profile.pg_college_id != old_pg:
        profile.pg_college_set_at = timezone.now()
        update_fields.append("pg_college_set_at")
    if update_fields:
        profile.save(update_fields=update_fields)


def _profile_data(profile: UserProfile, user: User) -> dict:
    """Build the full profile response dict (adds full_name + has_profile flag)."""
    data = UserProfileSerializer(profile).data
    data["full_name"] = user.full_name
    data["has_profile"] = True
    data["email_verified"] = user.email_verified
    return data


class AdminListCreateView(generics.ListCreateAPIView):
    """Super admin: list all admins or create a new admin."""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CreateAdminSerializer
        return UserSerializer

    def get_queryset(self):
        # Includes super admins too, so a newly-created one is visible here —
        # but edit/toggle/delete below deliberately stay scoped to ADMIN only
        # (see AdminDetailView/AdminToggleActiveView), so this list is
        # read-only for super-admin rows for now, to avoid a self-lockout
        # footgun (e.g. deactivating the only other super admin by accident).
        return User.objects.filter(
            role__in=[User.Role.ADMIN, User.Role.SUPER_ADMIN]
        ).order_by("-created_at")


class AdminDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Super admin: view, update, or delete a specific admin."""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def get_serializer_class(self):
        if self.request.method in ["PATCH", "PUT"]:
            return UpdateAdminSerializer
        return UserSerializer

    def get_queryset(self):
        return User.objects.filter(role=User.Role.ADMIN)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response({"detail": "Admin deleted successfully."}, status=status.HTTP_200_OK)


class AdminToggleActiveView(APIView):
    """Super admin: toggle admin active/inactive status."""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def patch(self, request, pk):
        try:
            admin = User.objects.get(pk=pk, role=User.Role.ADMIN)
        except User.DoesNotExist:
            return Response({"detail": "Admin not found."}, status=status.HTTP_404_NOT_FOUND)
        admin.is_active = not admin.is_active
        admin.save(update_fields=["is_active"])
        return Response(UserSerializer(admin).data)


class ProfileMeView(APIView):
    """Authenticated user: get/create/update their own profile."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            profile = request.user.profile
            return Response(_profile_data(profile, request.user))
        except UserProfile.DoesNotExist:
            return Response({
                "has_profile":    False,
                "email":          request.user.email,
                "email_verified": request.user.email_verified,
                "full_name":      request.user.full_name,
            })

    def post(self, request):
        if hasattr(request.user, "profile"):
            return Response({"detail": "Profile already exists. Use PATCH to update."}, status=400)

        full_name = request.data.get("full_name", "").strip()
        new_email = request.data.get("email", "").strip().lower()

        # Validate email uniqueness before saving
        if new_email and new_email != request.user.email:
            if User.objects.filter(email=new_email).exclude(pk=request.user.pk).exists():
                return Response({"email": "This email is already in use."}, status=400)

        serializer = UserProfileSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        profile = serializer.save(user=request.user)
        _bump_college_set_at(profile, old_ug=None, old_pg=None)
        _sync_community_memberships(profile)

        user_fields = []
        if full_name:
            request.user.full_name = full_name
            user_fields.append("full_name")
        if new_email and new_email != request.user.email:
            request.user.email = new_email
            # A changed email hasn't been proven yet, so it goes back to unverified.
            request.user.email_verified = False
            user_fields += ["email", "email_verified"]
        if user_fields:
            request.user.save(update_fields=user_fields)

        return Response(_profile_data(profile, request.user), status=201)

    def patch(self, request):
        try:
            profile = request.user.profile
        except UserProfile.DoesNotExist:
            return Response({"detail": "Profile not found. Use POST to create."}, status=404)

        full_name = request.data.get("full_name")
        new_email = request.data.get("email", "").strip().lower() if request.data.get("email") else None

        # Validate email uniqueness before saving
        if new_email and new_email != request.user.email:
            if User.objects.filter(email=new_email).exclude(pk=request.user.pk).exists():
                return Response({"email": "This email is already in use."}, status=400)

        lock_errors = _check_college_lock(profile, request.data)
        if lock_errors:
            return Response(lock_errors, status=403)

        serializer = UserProfileSerializer(profile, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        old_ug, old_pg = profile.ug_college_id, profile.pg_college_id
        profile = serializer.save()
        _bump_college_set_at(profile, old_ug, old_pg)
        _sync_community_memberships(profile)

        user_fields = []
        if full_name is not None:
            request.user.full_name = full_name.strip()
            user_fields.append("full_name")
        if new_email and new_email != request.user.email:
            request.user.email = new_email
            # A changed email hasn't been proven yet, so it goes back to unverified.
            request.user.email_verified = False
            user_fields += ["email", "email_verified"]
        if user_fields:
            request.user.save(update_fields=user_fields)

        return Response(_profile_data(profile, request.user))


# ── College change requests ─────────────────────────────────────────────────

class CollegeChangeRequestCreateView(APIView):
    """POST /accounts/college-change-requests/ — submit a new request (multipart, needs proof)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            profile = request.user.profile
        except UserProfile.DoesNotExist:
            return Response({"detail": "Complete your profile first."}, status=400)

        field = request.data.get("field")
        if field not in (CollegeChangeRequest.Field.UG, CollegeChangeRequest.Field.PG):
            return Response({"field": "Must be 'ug_college' or 'pg_college'."}, status=400)

        if CollegeChangeRequest.objects.filter(
            user=request.user, field=field, status=CollegeChangeRequest.Status.PENDING
        ).exists():
            return Response(
                {"detail": "You already have a pending request for this field. Wait for it to be resolved."},
                status=400,
            )

        serializer = CollegeChangeRequestCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        change_request = serializer.save(
            user=request.user,
            current_college_id=getattr(profile, f"{field}_id"),
        )
        return Response(CollegeChangeRequestSerializer(change_request).data, status=201)


class MyCollegeChangeRequestsView(generics.ListAPIView):
    """GET /accounts/college-change-requests/mine/ — so Settings can show a
    pending/rejected state instead of just a locked field."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class    = CollegeChangeRequestSerializer

    def get_queryset(self):
        return CollegeChangeRequest.objects.filter(user=self.request.user).select_related(
            "current_college", "requested_college", "resolved_by"
        )


class CollegeChangeRequestAdminListView(generics.ListAPIView):
    """GET /accounts/college-change-requests/pending/ — admin queue."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    serializer_class    = CollegeChangeRequestSerializer

    def get_queryset(self):
        return CollegeChangeRequest.objects.filter(
            status=CollegeChangeRequest.Status.PENDING
        ).select_related("user", "current_college", "requested_college")


class CollegeChangeRequestActionView(APIView):
    """PATCH /accounts/college-change-requests/{pk}/admin/ — approve or reject."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def patch(self, request, pk):
        change_request = get_object_or_404(CollegeChangeRequest, pk=pk, status=CollegeChangeRequest.Status.PENDING)
        action = request.data.get("action")  # "approve" or "reject"
        field = change_request.field
        label = _COLLEGE_FIELD_LABEL[field]

        if action == "approve":
            try:
                profile = change_request.user.profile
            except UserProfile.DoesNotExist:
                return Response({"detail": "That user no longer has a profile."}, status=400)

            setattr(profile, field, change_request.requested_college)
            setattr(profile, f"{field}_set_at", timezone.now())
            profile.save(update_fields=[field, f"{field}_set_at"])
            _sync_community_memberships(profile)

            change_request.status = CollegeChangeRequest.Status.APPROVED
            change_request.resolved_by = request.user
            change_request.resolved_at = timezone.now()
            change_request.save(update_fields=["status", "resolved_by", "resolved_at"])

            notify(
                change_request.user, "college_change_approved",
                f"Your {label} change to {change_request.requested_college.name} was approved.",
                url="/settings", actor=request.user,
            )
            return Response({"detail": "Request approved."})

        elif action == "reject":
            reason = (request.data.get("reason") or "").strip()
            if not reason:
                return Response({"detail": "A rejection reason is required."}, status=400)

            change_request.status = CollegeChangeRequest.Status.REJECTED
            change_request.rejection_reason = reason
            change_request.resolved_by = request.user
            change_request.resolved_at = timezone.now()
            change_request.save(update_fields=["status", "rejection_reason", "resolved_by", "resolved_at"])

            notify(
                change_request.user, "college_change_rejected",
                f"Your {label} change request was rejected: {reason}",
                url="/settings", actor=request.user,
            )
            return Response({"detail": "Request rejected."})

        return Response({"detail": "action must be 'approve' or 'reject'."}, status=400)


# ── Leads ────────────────────────────────────────────────────────────────────

def _leads_qs(request):
    """Shared queryset for leads list and export — supports search, status,
    state, college, and highest-education filters. The list view itself
    fetches everything and filters/sorts client-side (see the frontend), but
    export needs these server-side too so the downloaded CSV matches
    whatever's filtered on screen."""
    qs = (
        UserProfile.objects
        .select_related("user", "ug_college", "pg_college")
        .order_by("-created_at")
    )
    search = request.query_params.get("search", "").strip()
    if search:
        qs = qs.filter(
            Q(user__full_name__icontains=search) | Q(user__email__icontains=search)
        )
    status_param = request.query_params.get("status", "").strip()
    if status_param:
        qs = qs.filter(current_status=status_param)
    education = request.query_params.get("education", "").strip()
    if education:
        qs = qs.filter(highest_education=education)
    state = request.query_params.get("state", "").strip()
    if state:
        qs = qs.filter(Q(ug_college__state=state) | Q(pg_college__state=state))
    college_id = request.query_params.get("college", "").strip()
    if college_id:
        qs = qs.filter(Q(ug_college_id=college_id) | Q(pg_college_id=college_id))
    return qs


class LeadsListView(generics.ListAPIView):
    """Super admin: list of all user profiles (leads)."""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]
    serializer_class = LeadSerializer

    def get_queryset(self):
        return _leads_qs(self.request)


class LeadsExportView(APIView):
    """Super admin: download all leads (optionally filtered) as CSV."""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        profiles = _leads_qs(request)

        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="darkdoctor_leads.csv"'

        writer = csv.writer(response)
        writer.writerow([
            "Name", "Email", "Status", "Highest Education",
            "UG College", "PG College",
            "Phone", "Address / Location",
            "Profile Created", "Registered On",
        ])
        for p in profiles:
            writer.writerow([
                p.user.full_name,
                p.user.email,
                p.get_current_status_display() if p.current_status else "",
                p.get_highest_education_display() if p.highest_education else "",
                p.ug_college.name if p.ug_college else "",
                p.pg_college.name if p.pg_college else "",
                p.phone,
                p.address,
                p.created_at.strftime("%Y-%m-%d %H:%M"),
                p.user.created_at.strftime("%Y-%m-%d %H:%M"),
            ])
        return response
