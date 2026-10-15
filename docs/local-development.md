# Local Development Guide — Exam Monitor

This document outlines how to set up, configure, and develop Exam Monitor locally on your machine without Docker or self-hosted databases.

---

## 1. Prerequisites

Ensure your system meets the following requirements:

- **Node.js**: `v20.0.0` or higher (Node 22 LTS recommended)
- **pnpm**: `v12.0.0` or higher
- **Git**: Installed and configured
- **Supabase Project**: Free-tier cloud project at [supabase.com](https://supabase.com) (or Supabase CLI)

Verify tool versions:

```bash
node -v
pnpm -v
git --version
```

---

## 2. Repository Installation

Clone the repository and install workspace dependencies:

```bash
git clone https://github.com/mghebro/ExamMonitoring.git
cd ExamMonitoring
pnpm install
```

---

## 3. Environment Variables Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configure your `.env` file with your Supabase and Telegram settings:

```dotenv
NODE_ENV=development
PORT=3001
HOST=0.0.0.0
WEB_PORT=3000
API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase Settings (from Supabase Dashboard -> Project Settings -> API & Database)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres.your-project-ref:your-db-password@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true
DATABASE_DIRECT_URL=postgresql://postgres.your-project-ref:your-db-password@aws-0-region.pooler.supabase.com:5432/postgres

# Monitoring Target
EXAM_API_ENDPOINT=https://exam-booking.sa.gov.ge/practical/dates?CategoryCode=4&CenterId=7&isFirstAttempt=0
ALLOWED_EXAM_HOSTS=exam-booking.sa.gov.ge,localhost,127.0.0.1
POLL_INTERVAL_SECONDS=60
MIN_POLL_INTERVAL_SECONDS=30
REQUEST_TIMEOUT_MS=10000

# Telegram Settings
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_BOT_USERNAME=YourBotUsername
TELEGRAM_MODE=polling # Local dev uses long polling
TELEGRAM_LINKING_TOKEN_TTL_SECONDS=600
```

---

## 4. Applying Database Migrations

Apply the versioned Drizzle SQL migrations and Row Level Security policies directly to your Supabase PostgreSQL database:

```bash
# Apply versioned migrations from supabase/migrations/
pnpm db:migrate
```

To seed initial default monitoring targets:

```bash
# In Supabase SQL Editor or using psql:
# Execute the contents of supabase/seed.sql
```

---

## 5. Starting Local Development Services

Run individual components or all services concurrently:

### Option A: Run everything concurrently

```bash
pnpm dev
```

### Option B: Run services individually

```bash
# Terminal 1: Fastify REST API (Port 3001)
pnpm dev:api

# Terminal 2: Continuous Background Polling Worker
pnpm dev:worker

# Terminal 3: Next.js Frontend Dashboard (Port 3000)
pnpm dev:web
```

---

## 6. Accessing Local Interfaces

- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **API Swagger Documentation**: [http://localhost:3001/docs](http://localhost:3001/docs)
- **API Health Check**: [http://localhost:3001/health](http://localhost:3001/health)
- **API Database Readiness Check**: [http://localhost:3001/ready](http://localhost:3001/ready)

---

## 7. Running Automated Test Suites

```bash
# Run all unit and integration test suites
pnpm test

# Run tests in interactive watch mode
pnpm test:watch

# Run tests with code coverage analysis
pnpm test:coverage

# Run TypeScript typechecks across all monorepo packages
pnpm typecheck
```
