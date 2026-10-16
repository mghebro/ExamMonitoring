# Running Exam Monitor on Ubuntu Server (or Lubuntu Laptop)

This guide walks you through using your **Ubuntu Server** (or Lubuntu laptop) as a 24/7 background monitoring server using **PM2**.

---

## 1. Prerequisites on Ubuntu Server

Update packages and install base build tools:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential
```

Install Node.js 22 LTS and pnpm:

```bash
# Install Node.js 22 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Enable pnpm
sudo corepack enable
sudo corepack prepare pnpm@latest --activate

# Verify versions
node -v   # v22.x
pnpm -v
```

---

## 2. *(If running on a physical laptop)* Prevent Sleep on Lid Close

By default, Linux laptops suspend when the lid is closed, which halts monitoring.

1. Edit the systemd logind configuration:
   ```bash
   sudo nano /etc/systemd/logind.conf
   ```
2. Set the following parameters:
   ```ini
   HandleLidSwitch=ignore
   HandleLidSwitchExternalPower=ignore
   HandleLidSwitchDocked=ignore
   ```
3. Save (`Ctrl + O`, `Enter`) and exit (`Ctrl + X`).
4. Apply changes:
   ```bash
   sudo systemctl restart systemd-logind
   ```

---

## 3. Clone and Setup Project

```bash
# Clone the repository
git clone <YOUR_GITHUB_REPO_URL> ExamMonitoring
cd ExamMonitoring

# Configure environment variables
cp .env.example .env
nano .env

# Install dependencies and build TypeScript packages
pnpm install
pnpm build

# Run database migrations
pnpm db:migrate
```

---

## 4. Starting with PM2

The project includes [`ecosystem.config.cjs`](../ecosystem.config.cjs) configured with memory safeguards, crash recovery, and auto-restarts.

### Option A: Run API + Polling Worker (if Frontend is on Vercel)
```bash
pnpm pm2:start:backend
```

### Option B: Run Everything (API + Worker + Next.js Web Frontend)
```bash
pnpm pm2:start
```

---

## 5. Enable PM2 to Auto-Start on System Boot

If your server reboots or recovers from a power outage, PM2 can automatically start all services without logging in:

1. Save the currently running process list:
   ```bash
   npx pm2 save
   ```
2. Generate and configure the system startup hook:
   ```bash
   npx pm2 startup
   ```
   *(PM2 will display a command starting with `sudo env PATH=...`. Copy and run that exact command).*

---

## 6. PM2 Useful Commands

| Task | Command |
| :--- | :--- |
| **Check service status & RAM** | `pnpm pm2:status` |
| **View live logs** | `pnpm pm2:logs` |
| **View worker logs only** | `npx pm2 logs exam-worker` |
| **Restart worker** | `npx pm2 restart exam-worker` |
| **Live interactive dashboard** | `pnpm pm2:monit` |
| **Stop all services** | `pnpm pm2:stop` |

---

## 7. Recommended: Install Log Rotation (Preserves Disk Space)

To prevent logs from accumulating on a server with limited disk storage:

```bash
npx pm2 install pm2-logrotate
npx pm2 set pm2-logrotate:max_size 10M
npx pm2 set pm2-logrotate:retain 7
```
*(This limits log files to 10MB and keeps a maximum of 7 days of logs).*
