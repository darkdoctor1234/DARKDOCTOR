from .base import *

DEBUG = False

SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
X_FRAME_OPTIONS = "DENY"
SECURE_SSL_REDIRECT = True
# TLS is terminated upstream (ALB in front of EC2), so the connection
# gunicorn actually sees is always plain HTTP — without this, Django can
# never tell a request was originally HTTPS and SECURE_SSL_REDIRECT above
# would redirect every single request, forever (the client keeps getting
# sent back to the same https:// URL it already requested). nginx.conf
# already sets X-Forwarded-Proto on every request it proxies; this just
# tells Django to trust and use that header.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# ── Fail loud, fail immediately, if this is about to run insecurely ────────
# base.py's env() calls all have safe-for-local-dev fallback defaults (by
# design — every other conditional feature in this codebase follows that
# same pattern). In production those same fallbacks are actively dangerous:
# a known, public SECRET_KEY (this file's own history is public on GitHub),
# a wildcard ALLOWED_HOSTS, or the literal super-admin credentials sitting
# in base.py's source. A real .env simply not being picked up (wrong path,
# wrong working directory, a typo'd key) must never fail silently into one
# of these — it must refuse to boot at all. This runs at import time, so it
# blocks the actual gunicorn/WSGI boot path directly (Django's `manage.py`
# system-checks framework does NOT run for a plain `config.wsgi:application`
# load, so that alone would not have caught this).
from django.core.exceptions import ImproperlyConfigured

_INSECURE_DEFAULTS = {
    "SECRET_KEY": "django-insecure-change-this-in-production-!!!",
    "SUPERADMIN_EMAIL": "dark@gmail.com",
    "SUPERADMIN_PASSWORD": "000346",
}
for _setting_name, _insecure_value in _INSECURE_DEFAULTS.items():
    if globals().get(_setting_name) == _insecure_value:
        raise ImproperlyConfigured(
            f"{_setting_name} is still at its insecure local-dev default. "
            f"Set a real value in the production .env before starting this service."
        )
if ALLOWED_HOSTS in ([], ["*"]):
    raise ImproperlyConfigured(
        "ALLOWED_HOSTS is empty or a wildcard. Set it to the real ALB/domain "
        "host(s) in the production .env before starting this service."
    )
del _INSECURE_DEFAULTS, _setting_name, _insecure_value
