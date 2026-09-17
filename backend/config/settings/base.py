import os
from pathlib import Path
import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(DEBUG=(bool, False))
environ.Env.read_env(os.path.join(BASE_DIR, ".env"))

SECRET_KEY = env("SECRET_KEY", default="django-insecure-change-this-in-production-!!!")

DEBUG = env("DEBUG", default=False)

ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["*"])

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "storages",
]

LOCAL_APPS = [
    "modules.accounts",
    "modules.authentication",
    "modules.colleges",
    "modules.about",
    "modules.communities",
    "modules.notifications",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

_DB_OPTIONS = {"connect_timeout": 10}
# Required by Neon (and most managed Postgres providers) — never needed for
# local Postgres, so both are only added when actually set. sslmode=require
# encrypts the connection; channel_binding=require additionally stops a
# man-in-the-middle from replaying stolen SCRAM credentials even over TLS —
# Neon's own connection strings include both, so both are honored here.
_DB_SSLMODE = env("DB_SSLMODE", default="")
if _DB_SSLMODE:
    _DB_OPTIONS["sslmode"] = _DB_SSLMODE
_DB_CHANNEL_BINDING = env("DB_CHANNEL_BINDING", default="")
if _DB_CHANNEL_BINDING:
    _DB_OPTIONS["channel_binding"] = _DB_CHANNEL_BINDING

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("DB_NAME", default="darkdoctor"),
        "USER": env("DB_USER", default="postgres"),
        "PASSWORD": env("DB_PASSWORD", default=""),
        "HOST": env("DB_HOST", default="localhost"),
        "PORT": env("DB_PORT", default="5432"),
        "CONN_MAX_AGE": 60,
        "OPTIONS": _DB_OPTIONS,
    }
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Django's own built-in default logging config only prints request errors
# (django.request, e.g. an unhandled 500) to console when DEBUG=True, and
# tries to email ADMINS (unconfigured here) when DEBUG=False — meaning a
# production 500 currently produces zero log output anywhere, silently.
# This overrides that: always print to stdout, which is exactly what
# `docker compose logs` / `journalctl` / any container log driver already
# captures — no extra log-shipping setup needed to at least see the error.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name}: {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        # Unhandled view exceptions (500s) — always logged with a full
        # traceback, regardless of DEBUG.
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
    },
}

from datetime import timedelta

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        # OptionalJWTAuthentication degrades an invalid/expired token to anonymous
        # instead of raising 401. This allows AllowAny public endpoints (e.g.
        # GET /colleges/) to work even when the client holds a stale token.
        # Protected endpoints still reject unauthenticated users with 403.
        "modules.authentication.backends.OptionalJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_RENDERER_CLASSES": ("rest_framework.renderers.JSONRenderer",),
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "1000/hour",
        # Login/register/password-reset — see modules.authentication.throttles.
        # Deliberately much tighter than the generic anon rate: those
        # endpoints are exactly where a brute-force/credential-stuffing
        # attempt would actually target.
        "auth": "10/min",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "ALGORITHM": "HS256",
    "AUTH_HEADER_TYPES": ("Bearer",),
}

CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=["http://localhost:3000"],
)
CORS_ALLOW_CREDENTIALS = True

# Needed the moment frontend and backend live on different domains (e.g.
# Vercel + EC2) — Django 4+ rejects a cross-origin POST otherwise, even with
# CORS configured, since CSRF and CORS are checked separately. Reuses the
# same origin list as CORS since in this app they're always the same set.
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=CORS_ALLOWED_ORIGINS)

# Cache — used for OTP codes (email verification, password reset). Plain
# LocMemCache (Django's default) is per-process memory, which silently
# breaks OTPs the moment more than one gunicorn worker is running: a code
# generated by worker A is invisible to worker B. Set REDIS_URL in
# production (gunicorn there runs multiple workers) to fix this for real;
# local dev's single `runserver` process never needed it, so it's left
# unset there and Django's default in-memory cache applies.
REDIS_URL = env("REDIS_URL", default="")
if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": REDIS_URL,
            "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
        }
    }

# Media storage — S3 in production. EC2's own disk is wiped/replaced on
# redeploy, so review images and college-change-request proof documents
# can't live there long-term. Falls back to local disk (the existing
# MEDIA_ROOT below) when no bucket is configured, so local dev is unchanged.
AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME", default="")
if AWS_STORAGE_BUCKET_NAME:
    AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID", default="")
    AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY", default="")
    AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default="ap-south-1")
    # Set only for a non-native-AWS S3-compatible provider (e.g. Supabase
    # Storage's S3 protocol endpoint). Leave unset for real AWS S3, where
    # django-storages' own default (AWS's regional endpoint) is correct.
    AWS_S3_ENDPOINT_URL = env("AWS_S3_ENDPOINT_URL", default="")
    if AWS_S3_ENDPOINT_URL:
        AWS_S3_ADDRESSING_STYLE = "path"
    # Public read/serving domain for generated file URLs. Defaults to AWS's
    # own bucket domain; a non-AWS provider must set this explicitly to its
    # own public-object URL pattern (for Supabase:
    # "<project-ref>.supabase.co/storage/v1/object/public/<bucket>").
    AWS_S3_CUSTOM_DOMAIN = env("AWS_S3_CUSTOM_DOMAIN", default=f"{AWS_STORAGE_BUCKET_NAME}.s3.{AWS_S3_REGION_NAME}.amazonaws.com")
    AWS_DEFAULT_ACL = None  # bucket policy controls access, not per-object ACLs (buckets created after 2023 block ACLs by default)
    AWS_S3_OBJECT_PARAMETERS = {"CacheControl": "max-age=86400"}
    STORAGES = {
        "default": {"BACKEND": "storages.backends.s3.S3Storage"},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }

SUPERADMIN_EMAIL = env("SUPERADMIN_EMAIL", default="dark@gmail.com")
SUPERADMIN_PASSWORD = env("SUPERADMIN_PASSWORD", default="000346")

# Email sending, used for email verification (and, going forward, password reset).
# Works with any SMTP provider (Gmail, SendGrid, Amazon SES, Mailgun, etc.), just
# set these env vars. With EMAIL_HOST unset (e.g. local dev with no provider chosen
# yet), it falls back to printing the email to the server console instead of
# actually sending it, so the whole flow still works end to end without a real inbox.
EMAIL_HOST = env("EMAIL_HOST", default="")
if EMAIL_HOST:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_PORT = env.int("EMAIL_PORT", default=587)
    EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
    EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
    EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="Darkdoctor <no-reply@darkdoctor.app>")

# Error tracking. Optional — leave SENTRY_DSN blank (e.g. local dev, or
# before a Sentry project exists yet) and this is a complete no-op; nothing
# imports the sentry_sdk package at all unless it's set, same fallback
# pattern as REDIS_URL/AWS_STORAGE_BUCKET_NAME/EMAIL_HOST above. Without
# this, a production error is only ever visible via container/journal logs
# (see LOGGING above) — someone has to go looking for it; Sentry surfaces
# it proactively instead.
SENTRY_DSN = env("SENTRY_DSN", default="")
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        traces_sample_rate=0.1,
        send_default_pii=False,  # never forward request bodies/user PII to Sentry
        environment=env("SENTRY_ENVIRONMENT", default="production"),
    )
