# Database Backup & Restore Guide — Exam Monitor

This guide covers operational backup and disaster recovery procedures for your managed Supabase PostgreSQL database.

---

## 1. Automated Supabase Backups

Supabase automatically manages infrastructure-level backups for all projects:
- **Free Tier**: Daily backups with 7-day retention.
- **Pro Tier**: Point-In-Time Recovery (PITR) allowing rollback to any specific second within the last 7 to 30 days.

Automated snapshots can be reviewed in the **Supabase Dashboard -> Project Settings -> Database -> Backups**.

---

## 2. Creating Manual Logical Backups via `pg_dump`

Before applying major schema migrations or performing maintenance, create a local SQL backup:

```bash
# Set your direct connection URL
export DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"

# Dump entire public schema and data into a compressed archive
pg_dump "$DATABASE_URL" \
  --schema=public \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="backup_exam_monitor_$(date +%Y%m%d_%H%M%S).dump"
```

To create a readable plaintext SQL dump:

```bash
pg_dump "$DATABASE_URL" \
  --schema=public \
  --format=plain \
  --no-owner \
  --file="backup_exam_monitor_$(date +%Y%m%d_%H%M%S).sql"
```

---

## 3. Restoring from a Backup

To restore data into a fresh Supabase database or disaster recovery instance:

```bash
# Restore from custom archive
pg_restore \
  --dbname="$DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  "backup_exam_monitor_YYYYMMDD_HHMMSS.dump"
```

Or for plaintext SQL:

```bash
psql "$DATABASE_URL" -f "backup_exam_monitor_YYYYMMDD_HHMMSS.sql"
```

---

## 4. Migration Rollback Strategy

All schema changes in Exam Monitor are versioned in `supabase/migrations/`:
- `0000_nice_xavin.sql`: Base tables and foreign key constraints.
- `0001_rls_and_security_policies.sql`: Row Level Security policies, admin functions, and triggers.

To roll back a problematic migration in emergency scenarios:
1. Identify the previous stable snapshot in `supabase/migrations/meta/`.
2. Generate an inverse migration script or execute table rollbacks.
3. Update `_migrations_history` tracking table to record the rollback state.
