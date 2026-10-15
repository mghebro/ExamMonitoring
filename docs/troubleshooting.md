# Troubleshooting & Incident Response — Exam Monitor

This guide provides diagnostic solutions for common operational issues encountered in development or production.

---

## 1. Authentication & Session Issues

### Error: `401 UNAUTHORIZED: Missing or invalid Bearer token`
- **Cause**: The browser request lacked the `Authorization: Bearer <JWT>` header, or the Supabase session token expired.
- **Solution**:
  - Check browser DevTools Application tab -> Local Storage for active Supabase session.
  - Call `supabase.auth.getSession()` to refresh the active session before dispatching requests.
  - If the session expired, re-authenticate via `/login`.

### Error: `403 FORBIDDEN: Administrator access required`
- **Cause**: The user attempted to access administrator endpoints (`/api/v1/invitations`, `/api/v1/targets` creation) without holding the `admin` role in `profiles`.
- **Solution**:
  - The very first user to register on an instance receives the `admin` role automatically.
  - To inspect or grant admin status manually in Supabase SQL Editor:
    ```sql
    UPDATE public.profiles SET role = 'admin' WHERE email = 'your-email@example.com';
    ```

---

## 2. Telegram Bot Issues

### Error: `This linking token has expired (valid for 10 minutes)`
- **Cause**: The cryptographic linking token exceeded its 10-minute validity window before the user clicked Start in Telegram.
- **Solution**: Return to the dashboard and click **"Connect Telegram"** to generate a fresh token link.

### Error: `Bot was blocked by the user or chat deactivated (HTTP 403)`
- **Cause**: The user clicked "Stop and Block Bot" inside Telegram.
- **Solution**:
  - The outbox dispatcher automatically mutes the user's subscription (`is_subscribed = false`) to avoid spamming the Telegram API.
  - To resume, the user must unblock the bot in Telegram and send `/subscribe` or reconnect from the dashboard.

### Webhook not receiving updates
- **Diagnostic Step**: Check the Telegram webhook status:
  ```bash
  curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
  ```
- **Common Fixes**:
  - Ensure the webhook URL starts with `https://`.
  - Verify that `TELEGRAM_WEBHOOK_SECRET` matches the secret header sent during registration.
  - Confirm the API server port is publicly reachable.

---

## 3. Database & Connection Pooling

### Error: `remaining connection slots are reserved for non-replication superuser connections`
- **Cause**: Direct PostgreSQL connections exceeded Supabase connection quotas.
- **Solution**:
  - In production, configure `DATABASE_URL` to point to the Supabase **Transaction pooler (port 6543)** with `?pgbouncer=true`.
  - The Drizzle database client is configured with `max: 10` connections and `prepare: false` to ensure full compatibility with PgBouncer transaction mode.

---

## 4. Worker & Scheduler Leases

### Issue: Worker logs report `Target is leased by another active worker. Skipping.`
- **Explanation**: This is normal expected behavior! It indicates that another active worker holds the exclusive 30-second lease, preventing concurrent duplicate requests.
- **If a worker crashes**: The lease expires within 30 seconds, after which another worker automatically acquires the lease without manual intervention.
