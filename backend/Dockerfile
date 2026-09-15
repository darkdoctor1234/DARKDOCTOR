FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Collect static files at build time, not on every container start — the
# image is immutable, so this only needs to happen once. collectstatic
# never touches the database, so this is safe to run with no other env
# vars set (SECRET_KEY/DB settings all have defaults in base.py).
RUN DJANGO_SETTINGS_MODULE=config.settings.production python manage.py collectstatic --noinput

EXPOSE 8000

# Workers/threads chosen per HANDOVER.md's deployment section — 3 workers
# is enough concurrency for a single small EC2 instance without being
# wasteful; threads soften I/O waits (most request time is the DB).
# Requires REDIS_URL to be set (see config/settings/base.py) — without it,
# OTP codes will intermittently fail to verify across the 3 worker processes.
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--threads", "2"]
