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
