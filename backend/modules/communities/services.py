from django.db import transaction
from .models import Community, CommunityMembership

AUTO_HIDE_THRESHOLD = 5  # same convention as colleges.Review


def get_or_create_national_overall() -> Community:
    community, _ = Community.objects.get_or_create(
        type=Community.Type.NATIONAL_OVERALL, department="", state="",
    )
    return community


def get_or_create_department_national(department: str) -> Community:
    community, _ = Community.objects.get_or_create(
        type=Community.Type.DEPARTMENT_NATIONAL, department=department, state="",
    )
    return community


def get_or_create_department_state(department: str, state: str) -> Community:
    community, _ = Community.objects.get_or_create(
        type=Community.Type.DEPARTMENT_STATE, department=department, state=state,
    )
    return community


def eligible_communities_for(profile) -> list[Community]:
    """The (up to 3) communities this profile currently qualifies for. Does
    NOT touch membership — see sync_memberships for that."""
    if not profile.is_community_eligible:
        return []

    communities = [get_or_create_national_overall()]

    if profile.pg_department:
        communities.append(get_or_create_department_national(profile.pg_department))
        state = profile.pg_college.state if profile.pg_college else ""
        if state:
            communities.append(get_or_create_department_state(profile.pg_department, state))

    return communities


@transaction.atomic
def sync_memberships(profile) -> list[Community]:
    """
    Ensure `profile.user` has an active membership in every community
    they're currently eligible for. Never touches a membership the user has
    explicitly exited (is_active=False) — only creates brand-new rows for
    communities they've never had a membership in before. Called after every
    profile save (see accounts/views.py ProfileMeView).
    """
    user = profile.user
    eligible = eligible_communities_for(profile)
    if not eligible:
        return eligible

    existing_ids = set(
        CommunityMembership.objects.filter(user=user).values_list("community_id", flat=True)
    )
    new_memberships = [
        CommunityMembership(user=user, community=c)
        for c in eligible
        if c.id not in existing_ids
    ]
    if new_memberships:
        CommunityMembership.objects.bulk_create(new_memberships)

    return eligible
