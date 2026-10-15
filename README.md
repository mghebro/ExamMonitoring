# Exam Monitor

A production-grade, distributed driving test availability monitoring and alerting platform. **Exam Monitor** continuously tracks practical driving exam appointments (such as Georgia Service Agency booking systems), detects newly opened test dates and cancellation slots the second they appear, and dispatches instant real-time alerts via Telegram.

---

## Table of Contents

- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Monorepo Workspace Structure](#monorepo-workspace-structure)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [1. Clone and Install](#1-clone-and-install)
  - [2. Environment Configuration](#2-environment-configuration)
  - [3. Database Setup and Migrations](#3-database-setup-and-migrations)
  - [4. Running the Application](#4-running-the-application)
- [Telegram Bot Integration](#telegram-bot-integration)
  - [Bot Setup with @BotFather](#bot-setup-with-botfather)
  - [Secure Deep-Link Account Pairing](#secure-deep-link-account-pairing)
  - [Telegram Bot Commands](#telegram-bot-commands)
- [REST API Reference](#rest-api-reference)
- [Benchmarking & Simulation](#benchmarking--simulation)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Security Architecture](#security-architecture)
- [License](#license)

---

## Key Features

- **Instant Slot Detection & Diffing**: Compares consecutive availability snapshots to identify newly added, retained, and revoked exam slots with millisecond timestamps.
- **Multi-Layer SSRF Defense**: Strict URL validation, DNS resolution checks, private/internal IP blocking (RFC 1918, loopbacks, link-local), and host allowlisting prevent outbound request forgery.
- **Centralized Distributed Worker**: Coordinated background polling engine equipped with database-backed distributed leases, jittered exponential backoff, and HTTP 429 rate-limit awareness.
- **Secure Telegram Deep Linking**: Zero-friction 1-click account linking using cryptographically hashed, single-use, time-limited tokens (`/start <token>`), eliminating manual chat ID entries.
- **Reliable Notification Outbox**: Database-backed transactional outbox queue with automated retries, exponential backoff, and dead-letter handling.
- **Enterprise Authentication & RBAC**: Supabase Auth with JWT verification, user profiles, and invitation-only role-based access control (`admin` vs. `user`).
- **Polling Benchmark & Simulation Suite**: Built-in mock simulation engine and benchmark runner to determine optimal polling intervals without hammering target endpoints.
- **Interactive API Documentation**: Auto-generated Swagger / OpenAPI 3.0 UI served directly at `/documentation`.

---

## System Architecture

```text
                                  +---------------------------+
                                  |   Official Exam Booking   |
                                  |  (exam-booking.sa.gov.ge) |
                                  +-------------+-------------+
                                                ^
                                                | HTTP GET (SSRF Protected)
                                                |
+-------------------+             +-------------+-------------+
|    Web Dashboard  | <---------+ |  Centralized Poller Worker|
|  (Next.js / UI)   |  Supabase |   (apps/worker)             |
+---------+---------+   Auth    +-------------+---------------+
          |                                   | Writes Snapshots & Events
          | REST API (JWT)                    v
          v                       +---------------------------+
+-------------------+  Poll /     |    PostgreSQL Database    |
|   Fastify REST    |  Webhook    |    (Drizzle ORM Schema)   |
|     (apps/api)    +-----------> |  - exam_targets           |
+---------+---------+             |  - availability_snapshots |
          |                       |  - monitoring_events      |
          | Telegram Bot API      |  - telegram_links         |
          v                       |  - notification_outbox    |
+-------------------+             +-------------+-------------+
|   Telegram User   | <-------------------------+
| (Real-time Alert) |
+-------------------+
```

---

## Monorepo Workspace Structure

Exam Monitor is structured as a high-performance **pnpm monorepo**:

```text
ExamMonitoring/
├── apps/
│   ├── api/                     # Fastify REST API service & Webhook receiver
│   │   ├── src/
│   │   │   ├── plugins/         # Fastify plugins (Auth, Swagger, Helmet, Rate-limit)
│   │   │   ├── routes/          # REST endpoints (auth, health, telegram, webhooks)
│   │   │   ├── app.ts           # Fastify server instance builder
│   │   │   └── index.ts         # Server entrypoint
│   │   └── package.json
│   ├── worker/                  # Background monitoring worker service
│   │   ├── src/
│   │   │   ├── poller.ts        # Target polling execution logic
│   │   │   ├── scheduler.ts     # Multi-target polling scheduler
│   │   │   ├── lease.ts         # Distributed lease coordination
│   │   │   ├── backoff.ts       # Adaptive exponential backoff with jitter
│   │   │   └── index.ts         # Worker process entrypoint
│   │   └── package.json
│   └── web/                     # Web dashboard frontend application
│
├── packages/
│   ├── config/                  # Validated Zod environment schemas & loaders
│   ├── database/                # Drizzle ORM schema, migrations, and PostgreSQL client
│   ├── exam-provider/           # Exam endpoint fetcher, SSRF barrier, slot diff detector & benchmark
│   ├── notifications/           # Telegram bot client, deep-link service, command router & outbox
│   └── shared/                  # Shared logger, cryptographic helpers, errors, and domain types
│
├── supabase/
│   └── migrations/              # SQL schema migration files
├── tests/                       # Global integration & end-to-end tests
├── .env.example                 # Environment configuration template
├── package.json                 # Monorepo root scripts & devDependencies
├── pnpm-workspace.yaml          # Workspace definitions
└── tsconfig.base.json           # Shared TypeScript configuration
```

---

## Technology Stack

| Domain | Technology |
|---|---|
| **Runtime & Language** | [Node.js](https://nodejs.org/) (ES Modules) & [TypeScript](https://www.typescriptlang.org/) |
| **Package Manager** | [pnpm](https://pnpm.io/) (Workspaces) |
| **API Server** | [Fastify](https://fastify.dev/) v5 with Helmet, CORS, and Rate-Limiting |
| **Database & ORM** | [PostgreSQL](https://www.postgresql.org/) via [Supabase](https://supabase.com/) & [Drizzle ORM](https://orm.drizzle.team/) |
| **Authentication** | Supabase Auth (JWT bearer verification & role claims) |
| **Telegram Bot** | Telegram Bot API client with deep-linking & command router |
| **Schema Validation** | [Zod](https://zod.dev/) |
| **Testing** | [Vitest](https://vitest.dev/) with coverage support |

---

## Prerequisites

Before setting up Exam Monitor, ensure you have installed:

- **Node.js**: `v20.0.0` or higher
- **pnpm**: `v9.0.0` or higher (`corepack enable pnpm`)
- **PostgreSQL Database** or a [Supabase Project](https://supabase.com/)
- **Telegram Bot Token** (from [@BotFather](https://t.me/BotFather))

---

## Getting Started

### 1. Clone and Install

```bash
# Clone repository
git clone https://github.com/mghebro/ExamMonitoring.git
cd ExamMonitoring

# Install monorepo dependencies
pnpm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env` in the root directory:

```bash
cp .env.example .env
```

Update `.env` with your credentials:

```dotenv
# Environment
NODE_ENV=development
PORT=3001
HOST=0.0.0.0
WEB_PORT=3000
API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase Auth & Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
DATABASE_URL=postgresql://postgres:password@localhost:5432/postgres

# Target Exam Provider
EXAM_API_ENDPOINT=https://exam-booking.sa.gov.ge/practical/dates?CategoryCode=4&CenterId=7&isFirstAttempt=0
ALLOWED_EXAM_HOSTS=exam-booking.sa.gov.ge,localhost,127.0.0.1
POLL_INTERVAL_SECONDS=60
MIN_POLL_INTERVAL_SECONDS=30
REQUEST_TIMEOUT_MS=10000
MAX_BACKOFF_SECONDS=300
WORKER_LEASE_DURATION_SECONDS=30

# Telegram Bot
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
TELEGRAM_BOT_USERNAME=YourExamMonitorBot
TELEGRAM_MODE=polling # 'polling' for local dev, 'webhook' for production
TELEGRAM_WEBHOOK_URL=https://your-domain.com/api/v1/telegram/webhook
TELEGRAM_WEBHOOK_SECRET=your-random-crypto-secret
TELEGRAM_LINKING_TOKEN_TTL_SECONDS=600
```

### 3. Database Setup and Migrations

Generate and run Drizzle database migrations:

```bash
# Generate migration files from schema
pnpm db:generate

# Apply migrations to PostgreSQL
pnpm db:migrate
```

### 4. Running the Application

You can run individual services or all components concurrently:

```bash
# Run both API and Worker concurrently
pnpm dev

# Run only the Fastify REST API (default port: 3001)
pnpm dev:api

# Run only the Poller Background Worker
pnpm dev:worker
```

---

## Telegram Bot Integration

### Bot Setup with @BotFather

1. Open Telegram and message [@BotFather](https://t.me/BotFather).
2. Run `/newbot` and follow the prompts to choose a bot name and username (e.g. `MyExamMonitorBot`).
3. Copy the HTTP API token into `TELEGRAM_BOT_TOKEN` in your `.env`.
4. Set the bot commands in BotFather via `/setcommands`:
   ```text
   status - Check monitoring and link status
   subscribe - Enable exam alerts
   unsubscribe - Temporarily pause exam alerts
   test - Send a test alert notification
   settings - View notification settings
   help - Show help and usage guide
   ```

### Secure Deep-Link Account Pairing

Rather than asking users to locate and paste their raw Telegram numeric Chat ID, Exam Monitor utilizes single-use cryptographic deep links:

1. User logs in to the dashboard and clicks **"Connect Telegram"**.
2. API calls `POST /api/v1/telegram/link-token`, generating a secure high-entropy token stored as a SHA-256 hash with a 10-minute expiry.
3. The frontend displays a link: `https://t.me/<BotUsername>?start=<token>`.
4. When the user taps the link, Telegram opens the chat and executes `/start <token>`.
5. The bot verifies the token hash against the database, links the Telegram user and chat ID to the authenticated profile, and activates alerts.

### Telegram Bot Commands

| Command | Description |
|---|---|
| `/start [token]` | Links account via token, or displays introduction |
| `/status` | Displays connection status and active monitored targets |
| `/subscribe` | Resumes instant notifications |
| `/unsubscribe` | Temporarily mutes instant notifications |
| `/test` | Sends an immediate test notification to confirm delivery |
| `/settings` | Displays user notification preferences and quiet hours |
| `/help` | Displays available bot commands and documentation |

---

## REST API Reference

The Fastify REST API includes interactive OpenAPI / Swagger documentation accessible in your browser at:
`http://localhost:3001/documentation`

### Health & Liveness

- `GET /health`: Liveness probe returning process uptime and timestamp.
- `GET /ready`: Readiness probe verifying active PostgreSQL database connectivity.

### Authentication & Profiles

- `GET /api/v1/auth/me`: Retrieves current authenticated user profile, linked Telegram info, and preferences. *(Requires JWT Bearer token)*
- `POST /api/v1/invitations`: Generates an invitation token for user registration. *(Requires Admin role)*

### Telegram Integration

- `POST /api/v1/telegram/link-token`: Creates a time-limited single-use deep link token for account pairing. *(Requires JWT Bearer token)*
- `POST /api/v1/telegram/unlink`: Unlinks the user's connected Telegram account. *(Requires JWT Bearer token)*
- `POST /api/v1/telegram/webhook`: Webhook endpoint receiving Telegram updates. *(Protected by secret token validation)*

---

## Benchmarking & Simulation

To safely measure latency, assess rate limits, and test provider reliability without spamming third-party government servers, Exam Monitor includes a built-in simulation engine and sequential benchmark runner:

```typescript
import { SimulationExamProvider, BenchmarkRunner } from "@exam-monitor/exam-provider";

// Simulate latency and occasional 429 rate-limit responses
const simulatedProvider = new SimulationExamProvider({
  baseLatencyMs: 120,
  rateLimitProbability: 0.1,
});

const runner = new BenchmarkRunner(simulatedProvider);
const report = await runner.runSequentialBenchmark({
  targetEndpoint: "https://example.com/practical/dates",
  intervalSeconds: 60,
  maxRequests: 10,
  isSimulation: true,
});

console.log(report.recommendedIntervalSeconds); // Safely recommended poll interval
```

---

## Testing & Quality Assurance

Exam Monitor maintains a comprehensive test suite covering unit tests, SSRF defenses, Drizzle migrations, token linking cryptography, and command routing.

```bash
# Run all Vitest test suites
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate test coverage report
pnpm test:coverage

# Run TypeScript typechecks across all packages
pnpm typecheck

# Run linter
pnpm lint
```

---

## Security Architecture

- **SSRF Hardening**:
  - Outbound requests validate DNS resolution using Node `dns.lookup`.
  - Rejects private IPv4/IPv6 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`, `::1`, `fc00::/7`).
  - Restricts protocols to `https:` (with opt-in `http:` allowed solely in automated test environments).
  - Validates request hosts against an explicit whitelist (`ALLOWED_EXAM_HOSTS`).
- **Cryptographic Token Storage**:
  - Deep-linking tokens are never persisted in plaintext; only `crypto.createHash("sha256")` digests are stored in the database.
- **Idempotency & Deduplication**:
  - Incoming Telegram `update_id` values are tracked in a dedicated deduplication table to eliminate duplicate command processing.
- **Rate-Limiting & Protection**:
  - Fastify API is protected by `@fastify/rate-limit` (100 req/min per IP) and `@fastify/helmet` security headers.

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](./LICENSE) file for full details.

```text
Copyright (c) 2026 Giorgi Mgebrishvili (mghebro)
```
