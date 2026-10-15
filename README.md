# 🚗 Exam Monitor — Production Driving Exam Availability Monitor

[![CI Quality Gates](https://github.com/mghebro/ExamMonitoring/actions/workflows/ci.yml/badge.svg)](https://github.com/mghebro/ExamMonitoring/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5-black.svg)](https://fastify.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Managed%20Postgres-3ecf8e.svg)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Exam Monitor is a generic, production-ready driving exam availability monitoring application built from scratch to detect newly opened driving exam dates and notify authorized users through Telegram within seconds.

Initially designed to serve two authorized users (you and your friend) from different devices, Exam Monitor is fully configurable, generic, and backed by **Supabase** (managed PostgreSQL & Auth) and **Telegram**.

---

## 📑 Table of Contents

- [Core Capabilities](#-core-capabilities)
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Monorepo Workspace Structure](#-monorepo-workspace-structure)
- [Quick Start Guide](#-quick-start-guide)
- [Telegram Bot Pairing Flow](#-telegram-bot-pairing-flow)
- [Benchmarking & Safety Policies](#-benchmarking--safety-policies)
- [Row Level Security & Database](#-row-level-security--database)
- [Zero-Docker Deployment](#-zero-docker-deployment)
- [Documentation Index](#-documentation-index)
- [License](#-license)

---

## ⚡ Core Capabilities

- **Generic Exam Endpoint**: Configurable exam center, category code, and attempt type. No city or center is hardcoded.
- **Real-Time Telegram Alerts**: Instant push alerts with deep links, official booking links, and detection timestamps.
- **Cryptographic Account Pairing**: Single-use high-entropy tokens (10-minute expiry); users connect with one tap.
- **Centralized Scheduler with Distributed Locking**: Database-backed leases (`worker_leases`) prevent overlapping checks and duplicate alerts.
- **Transactional Outbox**: Guarantees zero lost alerts during restarts, with bounded exponential backoff and rate-limit handling.
- **Safe Polling Benchmark**: Sequential live tester and local mock simulation engine to measure latency and verify rate-limit policies safely.
- **Responsive Dashboard**: Built with Next.js 15, Tailwind CSS, and Supabase Auth with real-time status badges (`Running`, `Paused`, `Error`, `Stale`, `Unknown`).
- **Two Authorized Accounts**: Administrator bootstrap with secure role-based invitation system for the second user.
- **Zero Docker**: Runs natively on Node.js 22 LTS across Vercel, Render, Railway, and Supabase.

---

## 🏗️ Architecture & Tech Stack

```text
Next.js 15 (Web Dashboard on Vercel)
         │
         ▼
Fastify 5 REST API (Render / Node.js) ◄───► Supabase Managed PostgreSQL & Auth
         ▲                                                 ▲
         │                                                 │
Continuous Polling Worker (Lease Coordinator) ─────────────┘
         │
         ├─► Official Exam Availability Endpoint (HTTPS + SSRF Protection)
         └─► Telegram Bot API (Transactional Outbox Dispatcher)
```

| Component | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 15, React 19, Tailwind CSS | Responsive user dashboard & settings |
| **Backend API** | Fastify 5, Zod, OpenAPI (Swagger) | High-throughput REST API & webhook handler |
| **Worker** | Node.js 22, TypeScript | Continuous background poller & outbox dispatcher |
| **Database & Auth** | Supabase (PostgreSQL 15 + Supabase Auth) | Managed DB, sessions, RLS security policies |
| **ORM & Migrations** | Drizzle ORM | Type-safe schema definitions and versioned SQL migrations |
| **Messaging** | Telegram Bot API | Instant notification delivery & bot commands |
| **Testing** | Vitest, Playwright | Unit, integration, and end-to-end testing |

---

## 📁 Monorepo Workspace Structure

```text
exam-monitor/
├── apps/
│   ├── web/                    # Next.js 15 frontend application
│   ├── api/                    # Fastify 5 REST API application
│   └── worker/                 # Continuous background worker process
├── packages/
│   ├── config/                 # Zod environment schemas & validation
│   ├── database/               # Drizzle ORM schema, client connection, migrations
│   ├── exam-provider/          # SSRF defenses, URL validation, parser, benchmark runner
│   ├── notifications/          # Telegram Bot API client, command router, outbox dispatcher
│   └── shared/                 # Domain types, crypto helpers, redacting logger
├── supabase/
│   ├── config.toml             # Supabase project configuration
│   ├── migrations/             # Versioned SQL migrations & RLS policies
│   └── seed.sql                # Seed fixtures
├── tests/
│   ├── integration/            # End-to-end flow integration tests
│   └── e2e/                    # Playwright browser specs
└── docs/                       # Comprehensive architectural & operational guides
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: `v20.0.0` or higher (Node 22 LTS recommended)
- **pnpm**: `v12.0.0` or higher
- **Supabase Project**: Free cloud project at [supabase.com](https://supabase.com)
- **Telegram Bot**: Created via [@BotFather](https://t.me/BotFather)

### 2. Installation
```bash
git clone https://github.com/mghebro/ExamMonitoring.git
cd ExamMonitoring
pnpm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Populate `.env` with your Supabase credentials, Telegram bot token, and database connection strings.

### 4. Apply Database Migrations
```bash
pnpm db:migrate
```

### 5. Start Development Services
```bash
# Start all services concurrently
pnpm dev

# Or run individual workspaces:
pnpm dev:api      # REST API on http://localhost:3001
pnpm dev:worker   # Continuous poller & outbox dispatcher
pnpm dev:web      # Next.js dashboard on http://localhost:3000
```

---

## 🤖 Telegram Bot Pairing Flow

1. Log in to the dashboard and click **"Connect Telegram"**.
2. The backend creates a single-use, 32-byte cryptographically secure linking token valid for 10 minutes (stored as a SHA-256 hash).
3. Tap the link to open your bot: `https://t.me/<YourBotUsername>?start=<token>`.
4. The bot validates the token, links your chat ID to your user profile, and sends an activation confirmation.

### Bot Commands
- `/status` — View active monitoring status and alert subscription.
- `/subscribe` — Enable instant alerts.
- `/unsubscribe` — Temporarily mute notifications.
- `/test` — Send an immediate test notification.
- `/settings` — Display notification preferences.
- `/help` — View available commands.

---

## 🔒 Row Level Security & Database

All database access is protected by Supabase Row Level Security:
- Users can view and modify only their own profile and notifications.
- The first registered user is automatically provisioned as `admin` via the `handle_new_user()` database trigger.
- Only administrators can manage exam targets or create invitations for the second user.
- Internal worker tables (`worker_leases`, `telegram_linking_tokens`) reject all public client access.

---

## 🌐 Zero-Docker Deployment

- **Next.js Frontend**: Deploy to **Vercel** (`pnpm --filter=@exam-monitor/web build`).
- **Fastify API & Worker**: Deploy to **Render** using native Node.js environments (`render.yaml`).
- **Database & Auth**: Managed by **Supabase**.

See the [Deployment Guide](./docs/deployment.md) for step-by-step setup and free-tier limitations.

---

## 📚 Documentation Index

Detailed guides are located in the [`docs/`](./docs) directory:

- [System Architecture](./docs/architecture.md) — Monorepo design, state transitions, distributed leases.
- [Telegram Bot Setup](./docs/telegram-setup.md) — BotFather guide, webhook configuration, token rotation.
- [Local Development](./docs/local-development.md) — Setup, local workflows, running tests.
- [Production Deployment](./docs/deployment.md) — Vercel, Render, and Supabase step-by-step deployment.
- [Security & Compliance](./docs/security.md) — SSRF hardening, RLS policies, credential redaction.
- [Polling Benchmark & Simulation](./docs/polling-benchmark.md) — Sequential benchmarking and simulation engine.
- [Database Backup & Restore](./docs/database-backup-restore.md) — `pg_dump`, PITR, disaster recovery.
- [Troubleshooting & Incident Response](./docs/troubleshooting.md) — Error resolution and FAQs.

---

## 🧪 Testing

```bash
# Run all 53 automated Vitest unit and integration tests
pnpm test

# Run tests in interactive watch mode
pnpm test:watch

# Generate coverage report
pnpm test:coverage

# Run TypeScript typechecks across all workspaces
pnpm typecheck
```

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](./LICENSE) file for details.
