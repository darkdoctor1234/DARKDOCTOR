#!/usr/bin/env bash
# Run this ON the EC2 instance, from inside DARKDOCTOR/backend, to deploy a
# new version of the code that's already on `master`. Scripts the exact
# steps documented in AWS_SETUP.md's "Redeploying after a code change" —
# use this instead of typing them by hand each time.
#
# Usage: ./deploy/deploy.sh

set -euo pipefail

cd "$(dirname "$0")/.."  # backend/, regardless of where this was invoked from

if [ ! -f .env ]; then
  echo "backend/.env is missing — see AWS_SETUP.md step 3 before running this." >&2
  exit 1
fi

echo "==> Pulling latest master"
git -C .. pull origin master

echo "==> Rebuilding and restarting containers"
docker compose up -d --build

echo "==> Waiting for the app container to be ready"
for i in $(seq 1 30); do
  if docker compose exec -T app python manage.py check >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "app container did not become ready in time — check 'docker compose logs app'." >&2
    exit 1
  fi
  sleep 2
done

echo "==> Applying migrations (no-op if there are none)"
docker compose exec -T app python manage.py migrate

echo "==> Verifying the deployed instance is actually healthy"
if ! curl -sf http://localhost/health/ >/dev/null; then
  echo "Deploy finished but /health/ isn't returning healthy — check 'docker compose logs app' and 'docker compose logs nginx'." >&2
  exit 1
fi

echo "==> Deploy complete and healthy."
