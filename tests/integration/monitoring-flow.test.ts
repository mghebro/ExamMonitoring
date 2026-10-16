import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeSlotTransition, createEventFromTransition } from "@exam-monitor/exam-provider";
import { TelegramCommandRouter, TelegramBotClient, TelegramLinkingService } from "@exam-monitor/notifications";
import { ExamSlot } from "@exam-monitor/shared";

describe("End-to-End Monitoring & Alerting Flow", () => {
  let sentMessages: Array<{ chatId: number; text: string }> = [];
  let botClientMock: any;
  let linkingServiceMock: any;
  let router: TelegramCommandRouter;

  beforeEach(() => {
    sentMessages = [];

    botClientMock = {
      sendMessage: vi.fn().mockImplementation((chatId: number, text: string) => {
        sentMessages.push({ chatId, text });
        return Promise.resolve({ messageId: 100 + sentMessages.length });
      }),
    };

    linkingServiceMock = {
      verifyAndConsumeToken: vi.fn().mockResolvedValue({
        success: true,
        userId: "user-alice",
      }),
    };

    router = new TelegramCommandRouter(
      botClientMock as unknown as TelegramBotClient,
      linkingServiceMock as unknown as TelegramLinkingService
    );
  });

  it("orchestrates detection of new dates, event generation, and alert delivery", async () => {
    // Step 1: Initial check finds no slots
    const initialSlots: ExamSlot[] = [];

    // Step 2: Next check discovers 2 newly opened dates
    const newlyDetectedSlots: ExamSlot[] = [
      { bookingDate: "14-11-2026", bookingDateStatus: 1 },
      { bookingDate: "21-11-2026", bookingDateStatus: 1 },
    ];

    const transition = computeSlotTransition({
      targetId: "target-456",
      previousStatus: "UNAVAILABLE",
      currentStatus: "AVAILABLE",
      previousSlots: initialSlots,
      currentSlots: newlyDetectedSlots,
    });

    expect(transition.hasChanged).toBe(true);
    expect(transition.newSlots).toHaveLength(2);

    // Step 3: Event payload generation
    const bookingUrl = "https://exam-booking.sa.gov.ge/practical-exam";
    const event = createEventFromTransition(transition, bookingUrl);

    expect(event).not.toBeNull();
    expect(event?.eventType).toBe("NEW_SLOTS_DETECTED");
    expect(event?.availableDates).toEqual(["14-11-2026", "21-11-2026"]);

    // Step 4: Dispatch alert message to subscribed user
    const alertMessage = [
      `🔔 *${event?.title}*`,
      ``,
      `${event?.message}`,
      ``,
      `🔗 [Official Booking Link](${event?.bookingUrl})`,
      ``,
      `⚠️ _Note: Slots may be claimed quickly. Complete booking on the official portal immediately._`,
    ].join("\n");

    const deliveryResult = await botClientMock.sendMessage(999888, alertMessage);
    expect(deliveryResult.messageId).toBeGreaterThan(0);
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].text).toContain("14-11-2026, 21-11-2026");

    // Step 5: Third check returns the same slots - verified duplicate suppression
    const subsequentTransition = computeSlotTransition({
      targetId: "target-456",
      previousStatus: "AVAILABLE",
      currentStatus: "AVAILABLE",
      previousSlots: newlyDetectedSlots,
      currentSlots: newlyDetectedSlots,
    });

    expect(subsequentTransition.hasChanged).toBe(false);
    expect(subsequentTransition.newSlots).toHaveLength(0);

    const duplicateEvent = createEventFromTransition(subsequentTransition, bookingUrl);
    expect(duplicateEvent).toBeNull(); // No duplicate notification created!
  });
});
