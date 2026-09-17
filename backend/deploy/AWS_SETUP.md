# AWS setup checklist

What to create in the AWS Console before deploying. Code-side prep
(`Dockerfile`, `docker-compose.yml`, `nginx.conf`, Redis/S3-compatible
storage settings support) is already done — see HANDOVER.md's deployment
section. This is the infrastructure half. The database (Neon) and media
storage (Supabase) are already set up and already in `backend/.env` —
this checklist only covers the compute side (EC2).

## 1. Account + IAM

- Create the AWS account (needs your own billing info — nothing here can do that for you).
- Create an IAM user for deployment (don't use the root account day-to-day). No S3/bucket-policy IAM work needed — media storage is Supabase, not native AWS S3, so it's managed entirely from Supabase's own dashboard.

## 2. EC2 instance

- `t3.small` or `t4g.small` is a reasonable starting size (~$12-15/month) — upgrade later if needed, easy to resize.
- Ubuntu 22.04/24.04 LTS.
- Security group: allow inbound 80 (from the ALB, once step 5 exists) and 22 (SSH, ideally locked to your own IP, not `0.0.0.0/0`).
- Neon and Supabase are both reached over the public internet (already SSL-required in `.env`), so there's no security-group peering needed for them.
- Install Docker + Docker Compose on the instance:
  ```bash
  curl -fsSL https://get.docker.com | sh
  sudo apt install docker-compose-plugin
  ```

## 3. Deploy the app

```bash
git clone https://github.com/darkdoctor1234/DARKDOCTOR.git
cd DARKDOCTOR/backend
cp .env.example .env
nano .env
```

Fill in `.env` with:
- A freshly generated `SECRET_KEY` (**never** the insecure default — generate one with `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`).
- `ALLOWED_HOSTS` — the ALB's DNS name (step 4) or your real domain once attached, not `*`.
- The real `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` — not the `dark@gmail.com` / `000346` placeholder default in `config/settings/base.py`. Whatever you set here is what `manage.py seed_superadmin` creates.
- `DB_*` — already have these from the Neon migration (pooled connection, `DB_SSLMODE=require`, `DB_CHANNEL_BINDING=require`).
- `AWS_STORAGE_BUCKET_NAME`/`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_S3_REGION_NAME`/`AWS_S3_ENDPOINT_URL`/`AWS_S3_CUSTOM_DOMAIN` — already have these from the Supabase migration.
- Leave `REDIS_URL` blank in `.env` itself — `docker-compose.yml` sets it for you (`redis://redis:6379/0`, the sibling Redis container, reached by service name over the compose network).
- `CORS_ALLOWED_ORIGINS`/`CSRF_TRUSTED_ORIGINS` — the real Vercel URL (see step 6).
- `SENTRY_DSN` — optional, but worth setting (see `.env.example`'s comment) so a production error surfaces proactively instead of only being visible via `docker compose logs`.

**The first four above aren't just a suggestion — `config/settings/production.py` refuses to start at all if `SECRET_KEY`, `ALLOWED_HOSTS`, `SUPERADMIN_EMAIL`, or `SUPERADMIN_PASSWORD` are still at their insecure defaults.** If `docker compose up` immediately shows the `app` container exiting/restarting, `docker compose logs app` will name exactly which one was missed.

Then:

```bash
docker compose up -d --build
docker compose exec app python manage.py migrate
docker compose exec app python manage.py seed_superadmin   # only creates one if SUPERADMIN_EMAIL doesn't already exist
```

`collectstatic` already runs automatically at image build time (see `Dockerfile`) — no separate step needed for that.

At this point `curl http://<ec2-public-ip>/api/v1/colleges/` should return real data.

## 4. TLS — Application Load Balancer + ACM

Don't run certbot/Let's Encrypt inside the nginx container — the standard, low-maintenance AWS pattern is:
- Request a free certificate in ACM (AWS Certificate Manager) for your domain.
- Create an Application Load Balancer in front of the EC2 instance, listening on 443 with that certificate attached, forwarding plain HTTP to the instance's port 80.
- **Target group health check: path `/health/`, on port 80.** It does a real DB round-trip against Neon (see `config/views.py`), so it correctly reports unhealthy — and pulls the instance out of rotation — if the database itself is unreachable, not just if the process happens to be alive.
- ACM auto-renews the certificate for free — nothing to maintain on the box.
- Point your domain's DNS at the ALB (once you have a domain — not required to get a working `https://` URL first, the ALB gets its own AWS-provided DNS name immediately).

## 5. Point the frontend at it

Once the backend has a real URL (ALB's DNS name, or your domain once attached), set `NEXT_PUBLIC_API_URL` in Vercel's project settings to `https://<that-url>/api/v1`, and add that same origin to `CORS_ALLOWED_ORIGINS`/`CSRF_TRUSTED_ORIGINS` in the backend's `.env` (then `docker compose up -d --build` again to pick it up).

## Redeploying after a code change

```bash
cd DARKDOCTOR/backend
./deploy/deploy.sh
```

Scripts exactly what used to be manual steps here — pulls `master`, rebuilds and restarts the containers, waits for the app to actually be ready (not just "container started"), runs migrations, then curls `/health/` and fails loudly if it isn't reporting healthy. If you'd rather run the steps by hand: `git pull origin master`, `docker compose up -d --build`, `docker compose exec app python manage.py migrate`.

## Testing this locally first (optional but recommended)

The exact same `docker-compose.yml` runs on a laptop with Docker Desktop —
Neon/Supabase are reached over the internet either way, so there's nothing
EC2-specific about it. From `backend/`, with your existing local `.env`:

```bash
docker compose up -d --build
curl http://localhost/api/v1/colleges/
docker compose logs -f app   # watch for startup errors
docker compose down          # tear it down when done
```

## Rough monthly cost at this scale

EC2 (~$12-15) + ALB (~$16-20) ≈ **$30-35/month**. Neon and Supabase both have usable free tiers at this scale (upgrade either if usage grows). Vercel's free tier covers the frontend. SES/real email sending, once turned on, is ~$0.10/1000 emails — negligible.
