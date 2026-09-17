FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Collect static files at build time, not on every container start — the
# image is immutable, so this only needs to happen once. collectstatic
# never touches the database or anything security-sensitive, so it uses
# config.settings.base directly rather than .production — the real .env
# (with a real SECRET_KEY etc.) doesn't exist yet at image-build time, and
# .production now deliberately refuses to import at all without one (see
# its own comment) — correct for the real runtime boot below, but this
# step needs none of that.
RUN DJANGO_SETTINGS_MODULE=config.settings.base python manage.py collectstatic --noinput

EXPOSE 8000

# Workers/threads chosen per HANDOVER.md's deployment section — 3 workers
# is enough concurrency for a single small EC2 instance without being
# wasteful; threads soften I/O waits (most request time is the DB).
# Requires REDIS_URL to be set (see config/settings/base.py) — without it,
# OTP codes will intermittently fail to verify across the 3 worker processes.
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--threads", "2"]
