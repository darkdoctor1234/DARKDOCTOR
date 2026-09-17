from rest_framework.throttling import AnonRateThrottle


class AuthRateThrottle(AnonRateThrottle):
    """Per-IP rate limit specifically for credential-guessing surfaces
    (login, registration, password reset) — the generic "anon" throttle
    (100/hour, see REST_FRAMEWORK settings) is shared across every public
    endpoint and far too loose to meaningfully slow a brute-force attempt
    against a single account. Django's password hasher already adds real
    per-attempt cost, but that alone isn't a substitute for a hard ceiling
    at the app layer.
    """
    scope = "auth"
