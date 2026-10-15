# Production Deployment & Hosting Guide — Exam Monitor

This guide explains how to deploy Exam Monitor to production without Docker, container orchestration, or self-hosted databases.

---

## 🏗️ Architecture & Hosting Strategy

The application is deployed across three specialized managed cloud providers:

1. **Frontend**: Next.js 15 deployed on **Vercel** (Global Edge CDN, serverless rendering).
2. **Backend API & Polling Worker**: Fastify API and background worker deployed on **Render** (or Railway / Fly.io) as native Node.js processes.
3. **Database & Authentication**: **Supabase** managed PostgreSQL and Supabase Auth.

---

## 1. Step-by-Step Setup: Supabase Project

1. Log in to [Supabase](https://supabase.com) and click **"New Project"**.
2. Select your organization, name the project `exam-monitor`, choose a secure database password, and select the region geographically closest to your exam booking server.
3. Once provisioned, navigate to **Project Settings -> API**:
   - Copy the **Project URL** (`https://<project-ref>.supabase.co`).
   - Copy the **anon public key** (`eyJhbGci...`).
   - Copy the **service_role secret key** (`eyJhbGci...`).
4. Navigate to **Project Settings -> Database -> Connection string**:
   - Copy the **Connection pooling (Transaction mode)** URL (`postgres://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true`).
   - Copy the **Direct connection** URL (`postgres://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`).
5. Configure Authentication Redirects:
   - Go to **Authentication -> URL Configuration**.
   - Set **Site URL** to your frontend URL (e.g. `https://exam-monitor.vercel.app`).
   - Add Redirect URLs: `https://exam-monitor.vercel.app/**` and `https://*.vercel.app/**`.
6. Apply database migrations:
   ```bash
   DATABASE_URL="<YOUR_SUPABASE_DIRECT_CONNECTION_URL>" pnpm db:migrate
   ```
7. Initial Administrator Provisioning:
   - The database trigger `handle_new_user()` is configured in migration `0001_rls_and_security_policies.sql`.
   - The **very first user** to sign up on your instance is automatically granted the `admin` role.
   - All subsequent users can register only if an administrator sends them an invitation link from the dashboard.

---

## 2. Deploying the Frontend to Vercel

1. Push your repository to GitHub.
2. In [Vercel](https://vercel.com), click **"Add New Project"** and import your repository.
3. In Project Settings:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `apps/web` (or leave root with `vercel.json` autodetect)
   - **Build Command**: `pnpm --filter=@exam-monitor/web build`
   - **Output Directory**: `.next`
4. Configure Environment Variables in Vercel:
   - `NEXT_PUBLIC_APP_URL`: `https://your-app.vercel.app`
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://your-project.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `your-anon-public-key`
   - `NEXT_PUBLIC_API_BASE_URL`: `https://api.your-domain.com` (your Fastify API URL)
5. Click **Deploy**.

---

## 3. Deploying the Backend API & Worker to Render

We provide a zero-Docker infrastructure blueprint in `render.yaml`.

1. Log in to [Render](https://render.com) and click **"New -> Blueprint"**.
2. Connect your GitHub repository. Render will automatically detect `render.yaml` and configure two services:
   - `exam-monitor-api`: Web service running Fastify on port 10000.
   - `exam-monitor-worker`: Continuous background worker running the poller.
3. Populate the secret environment variables in Render's dashboard for both services:
   - `NODE_ENV`: `production`
   - `SUPABASE_URL`: `https://your-project.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: `your-service-role-key`
   - `DATABASE_URL`: `your-supabase-pgbouncer-connection-url`
   - `DATABASE_DIRECT_URL`: `your-supabase-direct-connection-url`
   - `EXAM_API_ENDPOINT`: `https://exam-booking.sa.gov.ge/practical/dates?CategoryCode=4&CenterId=7&isFirstAttempt=0`
   - `ALLOWED_EXAM_HOSTS`: `exam-booking.sa.gov.ge`
   - `POLL_INTERVAL_SECONDS`: `60`
   - `MIN_POLL_INTERVAL_SECONDS`: `30`
   - `TELEGRAM_BOT_TOKEN`: `your-telegram-bot-token`
   - `TELEGRAM_BOT_USERNAME`: `YourBotUsername`
   - `TELEGRAM_MODE`: `webhook`
   - `TELEGRAM_WEBHOOK_URL`: `https://<YOUR_API_RENDER_URL>/api/v1/telegram/webhook`
   - `TELEGRAM_WEBHOOK_SECRET`: `generate-a-random-32-byte-hex-string`
4. Click **Apply Changes**.

---

## 4. Registering the Telegram Webhook

Once the API service is live on Render, register your webhook with Telegram:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<YOUR_API_URL>/api/v1/telegram/webhook",
    "secret_token": "<YOUR_TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["message"]
  }'
```

Verify webhook registration:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

---

## 5. Adding the Second User (Your Friend)

1. Log in to the deployed frontend dashboard as the administrator.
2. In the right-hand panel under **"Invite User"**, enter your friend's email address and click **"Generate Invite Link"**.
3. Copy the single-use invitation URL (`https://your-app.vercel.app/register?token=...&email=...`) and send it to your friend.
4. Your friend opens the link, sets their name and password, and logs in.
5. In their dashboard, your friend clicks **"Connect Telegram"**, which opens the bot with their account's unique single-use linking token.
6. Once connected, both of you will receive instant Telegram notifications whenever new exam slots are detected!

---

## 6. Hosting Limitations & Realistic Cost Breakdown

| Platform | Tier | Capabilities & Constraints | Monthly Cost |
|---|---|---|---|
| **Vercel** | Hobby (Free) | Global CDN edge network, 100GB bandwidth, fast serverless cold starts. | $0.00 |
| **Supabase** | Free Tier | 500MB PostgreSQL storage, 50,000 monthly active users. *Note: Inactive free projects pause after 7 days; however, because Exam Monitor polls every 60s and updates leases, your project remains continuously active.* | $0.00 |
| **Render** | Web (Free / Starter) | Free web instances spin down after 15 minutes of inactivity. For continuous 24/7 background worker execution without sleep, a Starter plan is required. | ~$7.00 / mo |
| **Telegram** | Official API | Free, unlimited message deliveries within standard rate limits (30 msg/sec). | $0.00 |
| **Total** | | **Production-grade 24/7 dual-user monitoring** | **~$7.00 / month** |

---

## 7. Post-Deployment Verification Checklist

- [ ] Fastify health endpoint returns `{"status": "ok"}` at `/health`.
- [ ] Fastify database readiness endpoint returns `{"status": "ready"}` at `/ready`.
- [ ] OpenAPI Swagger documentation renders at `/docs`.
- [ ] Initial administrator can register, log in, and view dashboard.
- [ ] Telegram bot replies to `/help` and `/status`.
- [ ] "Connect Telegram" deep link successfully links private chat.
- [ ] "Send Test Alert" delivers notification to user's Telegram within 2 seconds.
- [ ] Worker logs show periodic polling (`ExamProvider: checking availability`) with active distributed lease.
- [ ] When a test date is simulated or appears, both authorized users receive the notification.
