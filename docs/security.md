# Security & Compliance Architecture — Exam Monitor

Exam Monitor is engineered to operate as a secure, non-intrusive availability monitoring system. This document outlines the application's multi-layered security controls.

---

## 1. Server-Side Request Forgery (SSRF) Hardening

Because the monitoring endpoint is administrator-configurable, strict outbound HTTP validation is enforced before any network connection is opened:

1. **Protocol Validation**:
   - The endpoint URL must explicitly utilize the `https:` scheme.
   - Plaintext `http:` is strictly rejected in production environments.

2. **Private Network & Cloud Metadata Protection**:
   - Target hostnames are inspected to ensure they do not resolve or target internal IP address ranges:
     - `127.0.0.0/8` (Loopback)
     - `10.0.0.0/8` (Private RFC 1918)
     - `172.16.0.0/12` (Private RFC 1918)
     - `192.168.0.0/16` (Private RFC 1918)
     - `169.254.0.0/16` (Link-Local & Cloud Metadata e.g. AWS/GCP `169.254.169.254`)
     - `0.0.0.0/8`
     - `::1`, `fc00::/7`, `fe80::/10` (IPv6 Private & Loopback)

3. **Domain Whitelisting**:
   - Outbound requests are restricted to explicitly configured domains via `ALLOWED_EXAM_HOSTS` (e.g. `exam-booking.sa.gov.ge`).

4. **Strict Redirect Rejection**:
   - Outbound requests specify `redirect: "manual"` to prevent open-redirect attacks where an allowed host bounces requests to an internal or private address.

---

## 2. Supabase Row Level Security (RLS)

All database access through client connections is restricted by Row Level Security policies defined in `supabase/migrations/0001_rls_and_security_policies.sql`.

### Administrator Check Function
```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;
```
*Note: The function specifies an explicit, safe `search_path` to prevent search_path injection attacks.*

### Table-by-Table Policy Enforcement
- `profiles`: Users can select and update only their own profile row (`id = auth.uid()`). Normal users cannot escalate privileges or modify the `role` column.
- `invitations`: Accessible and manageable only by administrators (`public.is_admin()`).
- `exam_targets`: Readable by all authenticated users; modifiable only by administrators.
- `telegram_links`: Users can view and manage only their own connected Telegram link.
- `telegram_linking_tokens`: Public client access is completely disabled (`USING (false)`). Tokens are generated and validated exclusively through trusted backend processes.
- `notification_outbox`: Users can query only their own delivery history.
- `worker_leases`: Internal worker access only (`USING (false)` for clients).

---

## 3. Cryptographic Token Storage

To prevent token leakage if read-replicas or database backups are inspected:
- Deep-linking pairing tokens are generated using 32 bytes of cryptographic entropy:
  ```typescript
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  ```
- Only `tokenHash` is persisted in PostgreSQL.
- Tokens expire in 10 minutes and are immediately invalidated on first use.

---

## 4. Log Sanitization & Redaction

The shared logger (`@exam-monitor/shared`) automatically intercepts and redacts sensitive credentials:
- Telegram bot tokens (`123456789:ABC...`) -> `[REDACTED]`
- Supabase personal access tokens (`sbp_...`) -> `[REDACTED]`
- JSON Web Tokens (`eyJ...`) -> `[REDACTED]`
- Passwords, secrets, and authorization headers are recursively sanitized from object payloads before printing.

---

## 5. CAPTCHA Policy & Ethical Monitoring

Exam Monitor is intentionally designed as an **availability monitor**, not an automated booking bot:
- **No CAPTCHA Bypassing**: The application never intercepts, solves, or circumvents official CAPTCHA challenges.
- **No Automated Final Booking**: The application directs the user to the official government booking portal via a direct verified link.
- **User Agency**: The human user manually completes their authentication, solves the official CAPTCHA, and confirms their personal booking details.
