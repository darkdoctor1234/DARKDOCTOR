#!/usr/bin/env bash
# Run this ON the EC2 instance, from inside DARKDOCTOR/backend, to deploy a
# new version of the code that's already on `master`. Scripts the exact
# steps documented in AWS_SETUP.md's "Redeploying after a code change" —
# use this instead of typing them by hand each time.
#
# Usage: ./deploy/deploy.sh

set -euo pipefail

# Everything lives inside main(), called only at the very end. This script
# itself lives in the repo that `git pull` below updates — without this
# wrapper, bash (which reads a running script by byte offset, not all at
# once) can read corrupted or truncated lines for anything after the pull
# if this file's own content/length changes mid-run. Wrapping the body in a
# function forces bash to parse it in full before execution ever starts.
main() {
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

  echo "==> Restarting nginx (it resolves the app container's IP once at startup,"
  echo "    and 'docker compose up' above recreated app with a new IP)"
  docker compose restart nginx

  echo "==> Verifying the deployed instance is actually healthy"
  if ! curl -sf http://localhost/health/ >/dev/null; then
    echo "Deploy finished but /health/ isn't returning healthy — check 'docker compose logs app' and 'docker compose logs nginx'." >&2
    exit 1
  fi

  echo "==> Deploy complete and healthy."
}

main "$@"
