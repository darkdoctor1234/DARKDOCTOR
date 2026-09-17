import logging

from django.db import connection
from django.db.utils import OperationalError
from django.http import JsonResponse

logger = logging.getLogger(__name__)


def health_check(request):
    """GET /health/ — for the ALB target group (and anyone else) to check
    this instance is actually able to serve real requests, not just that
    the process is alive. Deliberately does a real DB round-trip: a Python
    process can be "up" while its only real job (talking to Neon) is
    broken, and that's exactly the state that should pull an instance out
    of rotation. Plain Django view, not DRF — no auth, no throttling, no
    JSON-body parsing overhead for what's meant to be hit every ~30s.

    The failure detail is deliberately logged server-side, not returned in
    the response: this endpoint is public and unauthenticated by design
    (an ALB health check carries no credentials), and a raw DB exception
    can contain the hostname, port, or other connection details — exactly
    the kind of thing that shouldn't be handed to an anonymous caller.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except OperationalError:
        logger.exception("Health check failed: database unreachable")
        return JsonResponse({"status": "unhealthy"}, status=503)
    return JsonResponse({"status": "healthy"})
