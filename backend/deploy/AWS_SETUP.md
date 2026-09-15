# AWS setup checklist

What to create in the AWS Console before deploying. Code-side prep (Dockerfile,
docker-compose.yml, nginx.conf, S3/Redis settings support) is already done —
see HANDOVER.md's deployment section. This is the infrastructure half.

## 1. Account + IAM

- Create the AWS account (needs your own billing info — nothing here can do that for you).
- Create an IAM user for deployment (don't use the root account day-to-day).
- Attach a scoped policy for S3 access — see `aws-iam-policy.json` in this folder (swap in your real bucket name once created).

## 2. S3 bucket (media storage)

- Create a bucket, region `ap-south-1` (Mumbai — closest to India, matches the default in `.env.example`).
- Apply the bucket policy in `aws-s3-bucket-policy.json` (swap in your real bucket name) — makes uploaded files publicly readable via their direct URL, same as how review images already work today (not a new exposure, just carrying the existing behavior to S3).
- Note the bucket name and region — go into `backend/.env` as `AWS_STORAGE_BUCKET_NAME` / `AWS_S3_REGION_NAME`.

## 3. RDS (Postgres)

- Create a Postgres instance — `db.t4g.micro` is enough for this scale, ~$12-15/month.
- **Not publicly accessible** — only the EC2 security group should be able to reach it (see step 5).
- Note the endpoint, database name, username, password — go into `.env` as `DB_HOST`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`.

## 4. ElastiCache — skip this

Redis runs as a container alongside the app instead (see `docker-compose.yml`) — no separate AWS service needed, saves the ~$12+/month ElastiCache has no free tier for.

## 5. EC2 instance

- `t3.small` or `t4g.small` is a reasonable starting size (~$12-15/month) — upgrade later if needed, easy to resize.
- Ubuntu 22.04/24.04 LTS.
- Security group: allow inbound 80 (from the ALB, once step 6 exists) and 22 (SSH, ideally locked to your own IP, not `0.0.0.0/0`).
- Install Docker + Docker Compose on the instance (`curl -fsSL https://get.docker.com | sh`, then `apt install docker-compose-plugin`).
- Also add the EC2 instance's security group as an allowed inbound source on the **RDS** security group (port 5432) — otherwise step 3's database is unreachable from here.
- Clone the repo (or copy the `backend/` folder) onto the instance, create a real `.env` from `.env.example` with the values gathered above, generate a real `SECRET_KEY` (don't use the insecure default), then `docker compose up -d --build`.

## 6. TLS — Application Load Balancer + ACM

Don't run certbot/Let's Encrypt inside the nginx container — the standard, low-maintenance AWS pattern is:
- Request a free certificate in ACM (AWS Certificate Manager) for your domain.
- Create an Application Load Balancer in front of the EC2 instance, listening on 443 with that certificate attached, forwarding plain HTTP to the instance's port 80.
- ACM auto-renews the certificate for free — nothing to maintain on the box.
- Point your domain's DNS at the ALB (once you have a domain — not required to get a working `https://` URL first, the ALB gets its own AWS-provided DNS name immediately).

## 7. Point the frontend at it

Once the backend has a real URL (ALB's DNS name, or your domain once attached), set `NEXT_PUBLIC_API_URL` in Vercel's project settings to `https://<that-url>/api/v1`, and add that same origin to `CORS_ALLOWED_ORIGINS`/`CSRF_TRUSTED_ORIGINS` in the backend's `.env`.

## Rough monthly cost at this scale

EC2 (~$12-15) + RDS (~$12-15) + ALB (~$16-20) + S3 (a few cents) ≈ **$40-55/month**, plus SES once real email sending is turned on (~$0.10/1000 emails — negligible at this scale). Vercel's free tier covers the frontend.
