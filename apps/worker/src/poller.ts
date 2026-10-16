import { eq, and, sql } from "drizzle-orm";
import {
  getDb,
  examTargets,
  monitoringState,
  availabilitySnapshots,
  availableSlots,
  monitoringEvents,
  telegramLinks,
  notificationOutbox,
} from "@exam-monitor/database";
import {
  ExamProvider,
  computeSlotTransition,
  createEventFromTransition,
} from "@exam-monitor/exam-provider";
import { ExamSlot, AvailabilityStatus, logger } from "@exam-monitor/shared";
import { LeaseManager } from "./lease.js";
import { computeBackoffDelay } from "./backoff.js";

export interface TargetPollerConfig {
  workerId: string;
  leaseManager: LeaseManager;
  examProvider: ExamProvider;
  minPollIntervalSeconds: number;
  maxBackoffSeconds: number;
  leaseDurationSeconds: number;
}

export class TargetPoller {
  private log = logger.child("TargetPoller");
  private isPolling = false;

  constructor(private config: TargetPollerConfig) {}

  /**
   * Run a single poll check for an exam target.
   * Enforces:
   * 1. Single in-flight request protection
   * 2. Distributed lease acquisition
   * 3. Snapshot recording and availability diffing
   * 4. Notification outbox queuing
   */
  async pollTarget(targetId: string): Promise<{ nextDelaySeconds: number; success: boolean }> {
    if (this.isPolling) {
      this.log.warn(`Poll already in progress for target ${targetId}. Skipping overlapping run.`);
      return { nextDelaySeconds: this.config.minPollIntervalSeconds, success: false };
    }

    this.isPolling = true;

    try {
      // 1. Acquire distributed lease
      const hasLease = await this.config.leaseManager.acquireOrRenewLease(
        targetId,
        this.config.workerId,
        this.config.leaseDurationSeconds
      );

      if (!hasLease) {
        this.log.debug(`Could not acquire lease for target ${targetId}. Another worker is active.`);
        return { nextDelaySeconds: this.config.minPollIntervalSeconds, success: false };
      }

      const db = getDb();

      // 2. Load target details from database
      const [target] = await db
        .select()
        .from(examTargets)
        .where(eq(examTargets.id, targetId))
        .limit(1);

      if (!target || !target.isActive) {
        this.log.info(`Target ${targetId} is missing or inactive.`);
        return { nextDelaySeconds: 60, success: false };
      }

      const effectiveInterval = Math.max(
        target.pollIntervalSeconds,
        this.config.minPollIntervalSeconds
      );

      // 3. Load previous monitoring state & active slots
      const [state] = await db
        .select()
        .from(monitoringState)
        .where(eq(monitoringState.targetId, targetId))
        .limit(1);

      const previousSlotsRecords = await db
        .select()
        .from(availableSlots)
        .where(and(eq(availableSlots.targetId, targetId), eq(availableSlots.isAvailable, true)));

      const previousSlots: ExamSlot[] = previousSlotsRecords.map((r) => ({
        bookingDate: r.bookingDate,
        bookingDateStatus: r.bookingDateStatus ?? undefined,
        timeSlot: r.timeSlot,
      }));

      const previousStatus = (state?.lastStatus || "UNKNOWN") as AvailabilityStatus;

      // 4. Fetch availability from the remote provider
      const fetchResult = await this.config.examProvider.fetchAvailability(target.endpointUrl);

      // 5. Diff slots and evaluate state transitions
      const transition = computeSlotTransition({
        targetId,
        previousStatus,
        currentStatus: fetchResult.status,
        previousSlots,
        currentSlots: fetchResult.slots,
      });

      const isSuccess = fetchResult.httpStatus >= 200 && fetchResult.httpStatus < 400;
      const consecutiveFailures = isSuccess ? 0 : (state?.consecutiveFailures ?? 0) + 1;

      // 6. Persist results in atomic transaction
      await db.transaction(async (tx) => {
        // Record snapshot
        await tx.insert(availabilitySnapshots).values({
          targetId,
          status: fetchResult.status,
          slotCount: fetchResult.slotCount,
          responseLatencyMs: fetchResult.latencyMs,
          httpStatus: fetchResult.httpStatus,
          errorMessage: fetchResult.errorMessage,
          rawResponseSnippet: fetchResult.rawSnippet,
          checkedAt: new Date(fetchResult.checkedAt),
        });

        // Upsert newly detected or verified active slots
        for (const slot of fetchResult.slots) {
          await tx
            .insert(availableSlots)
            .values({
              targetId,
              bookingDate: slot.bookingDate,
              bookingDateStatus: slot.bookingDateStatus ?? 1,
              timeSlot: slot.timeSlot,
              isAvailable: true,
              firstSeenAt: new Date(),
              lastSeenAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [availableSlots.targetId, availableSlots.bookingDate],
              set: {
                isAvailable: true,
                lastSeenAt: new Date(),
              },
            });
        }

        // Mark removed slots as unavailable
        for (const removed of transition.removedSlots) {
          await tx
            .update(availableSlots)
            .set({ isAvailable: false, lastSeenAt: new Date() })
            .where(
              and(
                eq(availableSlots.targetId, targetId),
                eq(availableSlots.bookingDate, removed.bookingDate)
              )
            );
        }

        // Update monitoring state
        await tx
          .insert(monitoringState)
          .values({
            targetId,
            state: isSuccess ? "Running" : "Error",
            lastStatus: fetchResult.status,
            lastCheckedAt: new Date(fetchResult.checkedAt),
            lastSuccessAt: isSuccess ? new Date() : state?.lastSuccessAt,
            lastChangedAt: transition.hasChanged ? new Date() : state?.lastChangedAt,
            consecutiveFailures,
            lastError: fetchResult.errorMessage,
            lastLatencyMs: fetchResult.latencyMs,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [monitoringState.targetId],
            set: {
              state: isSuccess ? "Running" : "Error",
              lastStatus: fetchResult.status,
              lastCheckedAt: new Date(fetchResult.checkedAt),
              lastSuccessAt: isSuccess ? new Date() : state?.lastSuccessAt,
              lastChangedAt: transition.hasChanged ? new Date() : state?.lastChangedAt,
              consecutiveFailures,
              lastError: fetchResult.errorMessage,
              lastLatencyMs: fetchResult.latencyMs,
              updatedAt: new Date(),
            },
          });

        // 7. If slots changed, create monitoring event & enqueue notifications
        const bookingUrl = process.env.EXAM_BOOKING_URL || "https://exam-booking.sa.gov.ge/practical-exam";
        const eventPayload = createEventFromTransition(transition, bookingUrl);
        if (eventPayload) {
          const [createdEvent] = await tx
            .insert(monitoringEvents)
            .values({
              targetId,
              eventType: eventPayload.eventType,
              title: eventPayload.title,
              message: eventPayload.message,
              availableDates: eventPayload.availableDates,
              bookingUrl: eventPayload.bookingUrl,
            })
            .returning();

          // Queue outbox messages for all subscribed Telegram users
          const subscribers = await tx
            .select()
            .from(telegramLinks)
            .where(eq(telegramLinks.isSubscribed, true));

          for (const sub of subscribers) {
            const fullMessage = [
              `🔔 *${eventPayload.title}*`,
              ``,
              `${eventPayload.message}`,
              ``,
              `🔗 [Official Booking Link](${eventPayload.bookingUrl})`,
              ``,
              `⚠️ _Note: Slots may be claimed quickly. This monitor alerts you to check the official portal immediately._`,
            ].join("\n");

            await tx.insert(notificationOutbox).values({
              eventId: createdEvent.id,
              userId: sub.userId,
              telegramChatId: sub.telegramChatId,
              messageText: fullMessage,
              status: "PENDING",
            });
          }
        }
      });

      // 8. Compute next delay with exponential backoff if error
      const nextDelay = computeBackoffDelay({
        consecutiveFailures,
        baseIntervalSeconds: effectiveInterval,
        maxBackoffSeconds: this.config.maxBackoffSeconds,
        retryAfterSeconds: fetchResult.retryAfterSeconds,
      });

      return { nextDelaySeconds: nextDelay, success: isSuccess };
    } catch (err: unknown) {
      this.log.error(`Unhandled error during poll for target ${targetId}`, {
        error: String(err),
      });
      return {
        nextDelaySeconds: this.config.minPollIntervalSeconds * 2,
        success: false,
      };
    } finally {
      this.isPolling = false;
    }
  }
}
