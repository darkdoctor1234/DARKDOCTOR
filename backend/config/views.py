from django.db import connection
from django.db.utils import OperationalError
from django.http import JsonResponse


def health_check(request):
    """GET /health/ — for the ALB target group (and anyone else) to check
    this instance is actually able to serve real requests, not just that
    the process is alive. Deliberately does a real DB round-trip: a Python
    process can be "up" while its only real job (talking to Neon) is
    broken, and that's exactly the state that should pull an instance out
    of rotation. Plain Django view, not DRF — no auth, no throttling, no
    JSON-body parsing overhead for what's meant to be hit every ~30s.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except OperationalError as exc:
        return JsonResponse({"status": "unhealthy", "detail": str(exc)}, status=503)
    return JsonResponse({"status": "healthy"})
