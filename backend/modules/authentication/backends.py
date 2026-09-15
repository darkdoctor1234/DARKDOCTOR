"""
Custom authentication backends.
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class OptionalJWTAuthentication(JWTAuthentication):
    """
    Drop-in replacement for JWTAuthentication that treats an invalid or expired
    token as an anonymous (unauthenticated) request instead of raising a 401.

    Why this is needed
    ------------------
    DRF runs authentication BEFORE permission checks. With the default
    JWTAuthentication, if the client sends an expired token to a public endpoint
    (AllowAny), the authenticator raises AuthenticationFailed (HTTP 401) before
    AllowAny ever runs — making the endpoint unreachable with a stale token.

    With this class:
      • Valid token          → user is authenticated         (same as before)
      • No token             → user is anonymous             (same as before)
      • Expired / bad token  → user is anonymous, no error   (fixed behaviour)

    Protected endpoints (IsAuthenticated / IsSuperAdmin) still correctly reject
    anonymous users with HTTP 403. The client should detect 401 / 403 on write
    operations, clear its local session, and redirect to login.
    """

    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except (InvalidToken, TokenError):
            # Token is present but invalid/expired — degrade silently to anonymous
            return None
