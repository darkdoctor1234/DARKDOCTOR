# AWS setup checklist

What to do to get the backend running for real on EC2. No Docker — the app
runs directly on the instance (a venv + gunicorn managed by systemd + nginx),
which is simpler to operate for a single small instance than containers are.
The database (Neon) and media storage (Supabase) are already set up and
already in `backend/.env` — this checklist only covers the compute side.

## 1. Account + IAM

- Create the AWS account (needs your own billing info — nothing here can do that for you).
- Create an IAM user for deployment (don't use the root account day-to-day). No S3/bucket-policy IAM work needed here — media storage is Supabase, not native AWS S3, so it's managed entirely from Supabase's own dashboard, not AWS IAM.

## 2. EC2 instance

- `t3.small` or `t4g.small` is a reasonable starting size (~$12-15/month) — upgrade later if needed, easy to resize.
- Ubuntu 22.04/24.04 LTS.
- Security group: allow inbound 80 (from the ALB, once step 5 exists) and 22 (SSH, ideally locked to your own IP, not `0.0.0.0/0`).
- Neon and Supabase are both reached over the public internet (already SSL-required in `.env`), so there's no security-group peering to set up for them — unlike the old RDS plan, nothing here needs to know the EC2 instance's IP in advance.

## 3. Install the app directly on the instance

```bash
# System packages
sudo apt update
sudo apt install -y python3.13 python3.13-venv python3-pip redis-server nginx git

# Clone the repo
git clone https://github.com/darkdoctor1234/DARKDOCTOR.git
cd DARKDOCTOR/backend

# Virtualenv + dependencies
python3.13 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Real .env — copy the template and fill in actual values (see below)
cp .env.example .env
nano .env
```

Fill in `.env` with:
- A freshly generated `SECRET_KEY` (**never** the insecure default — generate one with `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`).
- `ALLOWED_HOSTS` — the ALB's DNS name (step 5) or your real domain once attached, not `*`.
- The real `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` — not the `dark@gmail.com` / `000346` placeholder default in `config/settings/base.py`. Whatever you set here is what `manage.py seed_superadmin` creates.
- `DB_*` — already have these from the Neon migration (pooled connection, `DB_SSLMODE=require`, `DB_CHANNEL_BINDING=require`).
- `AWS_STORAGE_BUCKET_NAME`/`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_S3_REGION_NAME`/`AWS_S3_ENDPOINT_URL`/`AWS_S3_CUSTOM_DOMAIN` — already have these from the Supabase migration.
- `REDIS_URL=redis://localhost:6379/0` — Redis now runs directly on the box (installed above via `apt`), not as a sibling container, so it's always `localhost`.
- `CORS_ALLOWED_ORIGINS`/`CSRF_TRUSTED_ORIGINS` — the real Vercel URL (see step 6).

Then:

```bash
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py seed_superadmin   # only creates one if SUPERADMIN_EMAIL doesn't already exist
deactivate
```

## 4. Run it as a service (gunicorn via systemd)

```bash
sudo cp deploy/darkdoctor.service /etc/systemd/system/darkdoctor.service
# Edit it first if the repo isn't cloned to /home/ubuntu/DARKDOCTOR
sudo systemctl daemon-reload
sudo systemctl enable --now darkdoctor
sudo systemctl status darkdoctor   # confirm it's actually running before moving on
```

Then nginx, in front of it:

```bash
sudo cp nginx.conf /etc/nginx/sites-available/darkdoctor
sudo ln -s /etc/nginx/sites-available/darkdoctor /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

At this point `curl http://<ec2-public-ip>/api/v1/colleges/` should return real data.

## 5. TLS — Application Load Balancer + ACM

Don't run certbot/Let's Encrypt directly on the box — the standard, low-maintenance AWS pattern is:
- Request a free certificate in ACM (AWS Certificate Manager) for your domain.
- Create an Application Load Balancer in front of the EC2 instance, listening on 443 with that certificate attached, forwarding plain HTTP to the instance's port 80.
- ACM auto-renews the certificate for free — nothing to maintain on the box.
- Point your domain's DNS at the ALB (once you have a domain — not required to get a working `https://` URL first, the ALB gets its own AWS-provided DNS name immediately).

## 6. Point the frontend at it

Once the backend has a real URL (ALB's DNS name, or your domain once attached), set `NEXT_PUBLIC_API_URL` in Vercel's project settings to `https://<that-url>/api/v1`, and add that same origin to `CORS_ALLOWED_ORIGINS`/`CSRF_TRUSTED_ORIGINS` in the backend's `.env` (then `sudo systemctl restart darkdoctor` to pick it up).

## Redeploying after a code change

```bash
cd DARKDOCTOR
git pull origin master
cd backend
source venv/bin/activate
pip install -r requirements.txt   # only does anything if requirements changed
python manage.py migrate          # only does anything if there are new migrations
python manage.py collectstatic --noinput
deactivate
sudo systemctl restart darkdoctor
```

## Rough monthly cost at this scale

EC2 (~$12-15) + ALB (~$16-20) ≈ **$30-35/month**. Neon and Supabase both have usable free tiers at this scale (upgrade either if usage grows). Vercel's free tier covers the frontend. SES/real email sending, once turned on, is ~$0.10/1000 emails — negligible.
