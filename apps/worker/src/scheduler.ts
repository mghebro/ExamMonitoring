import { eq } from "drizzle-orm";
import { getDb, examTargets } from "@exam-monitor/database";
import { ExamProvider } from "@exam-monitor/exam-provider";
import { TelegramBotClient, NotificationOutboxDispatcher } from "@exam-monitor/notifications";
import { generateId, logger } from "@exam-monitor/shared";
import { LeaseManager } from "./lease.js";
import { TargetPoller } from "./poller.js";

export interface SchedulerOptions {
  workerId?: string;
  minPollIntervalSeconds?: number;
  maxBackoffSeconds?: number;
  leaseDurationSeconds?: number;
  allowedHosts?: string[];
  allowHttpForTesting?: boolean;
  telegramBotToken?: string;
}

export class WorkerScheduler {
  private log = logger.child("WorkerScheduler");
  private workerId: string;
  private leaseManager: LeaseManager;
  private examProvider: ExamProvider;
  private outboxDispatcher: NotificationOutboxDispatcher | null = null;
  private isRunning = false;
  private pollers = new Map<string, TargetPoller>();
  private activeTimers = new Map<string, NodeJS.Timeout>();
  private targetRefreshInterval: NodeJS.Timeout | null = null;
  private outboxInterval: NodeJS.Timeout | null = null;

  constructor(private options: SchedulerOptions = {}) {
    this.workerId = options.workerId || `worker-${generateId()}`;
    this.leaseManager = new LeaseManager();
    const timeoutMs = process.env.REQUEST_TIMEOUT_MS
      ? parseInt(process.env.REQUEST_TIMEOUT_MS, 10)
      : 25000;
    this.examProvider = new ExamProvider({
      allowedHosts: options.allowedHosts,
      allowHttpForTesting: options.allowHttpForTesting,
      timeoutMs,
    });

    const botToken = options.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    if (botToken) {
      const botClient = new TelegramBotClient(botToken);
      this.outboxDispatcher = new NotificationOutboxDispatcher(botClient);
    }
  }

  getWorkerId(): string {
    return this.workerId;
  }

  /**
   * Start the monitoring worker scheduler.
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.log.info(`Starting WorkerScheduler [${this.workerId}]...`);

    // Initial target load
    await this.refreshTargets();

    // Re-check for new or modified targets every 30 seconds
    this.targetRefreshInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.refreshTargets();
      }
    }, 30000);

    // Continuous outbox delivery loop every 5 seconds
    if (this.outboxDispatcher) {
      this.outboxInterval = setInterval(async () => {
        if (this.isRunning && this.outboxDispatcher) {
          try {
            await this.outboxDispatcher.dispatchPendingOutbox();
          } catch (err: unknown) {
            this.log.error("Outbox dispatch failure", { error: String(err) });
          }
        }
      }, 5000);
    }
  }

  /**
   * Stop the scheduler gracefully.
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.log.info(`Stopping WorkerScheduler [${this.workerId}]...`);
    this.isRunning = false;

    if (this.targetRefreshInterval) {
      clearInterval(this.targetRefreshInterval);
      this.targetRefreshInterval = null;
    }

    if (this.outboxInterval) {
      clearInterval(this.outboxInterval);
      this.outboxInterval = null;
    }

    for (const [targetId, timer] of this.activeTimers.entries()) {
      clearTimeout(timer);
      await this.leaseManager.releaseLease(targetId, this.workerId);
    }

    this.activeTimers.clear();
    this.pollers.clear();
    this.log.info("WorkerScheduler stopped cleanly.");
  }

  /**
   * Refresh targets from database and schedule their polling loops.
   */
  private async refreshTargets(): Promise<void> {
    try {
      const db = getDb();
      const targets = await db
        .select()
        .from(examTargets)
        .where(eq(examTargets.isActive, true));

      const activeTargetIds = new Set(targets.map((t) => t.id));

      // Cancel pollers for deactivated targets
      for (const [id, timer] of this.activeTimers.entries()) {
        if (!activeTargetIds.has(id)) {
          this.log.info(`Target ${id} deactivated. Stopping poller.`);
          clearTimeout(timer);
          this.activeTimers.delete(id);
          this.pollers.delete(id);
          await this.leaseManager.releaseLease(id, this.workerId);
        }
      }

      // Start poller for new targets
      for (const target of targets) {
        if (!this.activeTimers.has(target.id)) {
          this.scheduleNextPoll(target.id, 0); // Start immediately
        }
      }
    } catch (err: unknown) {
      this.log.error("Failed to refresh exam targets from database", { error: String(err) });
    }
  }

  private scheduleNextPoll(targetId: string, delaySeconds: number): void {
    if (!this.isRunning) return;

    if (!this.pollers.has(targetId)) {
      const poller = new TargetPoller({
        workerId: this.workerId,
        leaseManager: this.leaseManager,
        examProvider: this.examProvider,
        minPollIntervalSeconds: this.options.minPollIntervalSeconds ?? 30,
        maxBackoffSeconds: this.options.maxBackoffSeconds ?? 300,
        leaseDurationSeconds: this.options.leaseDurationSeconds ?? 30,
      });
      this.pollers.set(targetId, poller);
    }

    const timer = setTimeout(async () => {
      if (!this.isRunning) return;

      const poller = this.pollers.get(targetId);
      if (poller) {
        const { nextDelaySeconds } = await poller.pollTarget(targetId);
        this.scheduleNextPoll(targetId, nextDelaySeconds);
      }
    }, delaySeconds * 1000);

    this.activeTimers.set(targetId, timer);
  }
}
