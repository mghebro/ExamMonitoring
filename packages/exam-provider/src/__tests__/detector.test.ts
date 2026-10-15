import { describe, it, expect } from "vitest";
import { ExamSlot } from "@exam-monitor/shared";
import { computeSlotTransition, createEventFromTransition } from "../index.js";

describe("Availability Detection & Transition Engine", () => {
  const targetId = "target-123";
  const bookingUrl = "https://exam-booking.sa.gov.ge";

  it("detects transition from UNAVAILABLE to AVAILABLE with new slots", () => {
    const previousSlots: ExamSlot[] = [];
    const currentSlots: ExamSlot[] = [
      { bookingDate: "14-11-2026", bookingDateStatus: 1 },
      { bookingDate: "21-11-2026", bookingDateStatus: 1 },
    ];

    const transition = computeSlotTransition({
      targetId,
      previousStatus: "UNAVAILABLE",
      currentStatus: "AVAILABLE",
      previousSlots,
      currentSlots,
    });

    expect(transition.hasChanged).toBe(true);
    expect(transition.newSlots).toHaveLength(2);
    expect(transition.removedSlots).toHaveLength(0);

    const event = createEventFromTransition(transition, bookingUrl);
    expect(event).not.toBeNull();
    expect(event?.eventType).toBe("NEW_SLOTS_DETECTED");
    expect(event?.availableDates).toEqual(["14-11-2026", "21-11-2026"]);
  });

  it("detects no change when identical slots are observed", () => {
    const slots = [{ bookingDate: "14-11-2026", bookingDateStatus: 1 }];

    const transition = computeSlotTransition({
      targetId,
      previousStatus: "AVAILABLE",
      currentStatus: "AVAILABLE",
      previousSlots: slots,
      currentSlots: slots,
    });

    expect(transition.hasChanged).toBe(false);
    expect(transition.newSlots).toHaveLength(0);
    expect(transition.removedSlots).toHaveLength(0);

    const event = createEventFromTransition(transition, bookingUrl);
    expect(event).toBeNull(); // No duplicate alert should be sent!
  });

  it("detects incremental new slot when one date is added to existing dates", () => {
    const previousSlots = [{ bookingDate: "14-11-2026", bookingDateStatus: 1 }];
    const currentSlots = [
      { bookingDate: "14-11-2026", bookingDateStatus: 1 },
      { bookingDate: "28-11-2026", bookingDateStatus: 1 },
    ];

    const transition = computeSlotTransition({
      targetId,
      previousStatus: "AVAILABLE",
      currentStatus: "AVAILABLE",
      previousSlots,
      currentSlots,
    });

    expect(transition.hasChanged).toBe(true);
    expect(transition.newSlots).toHaveLength(1);
    expect(transition.newSlots[0].bookingDate).toBe("28-11-2026");

    const event = createEventFromTransition(transition, bookingUrl);
    expect(event?.eventType).toBe("NEW_SLOTS_DETECTED");
    expect(event?.availableDates).toEqual(["28-11-2026"]);
  });

  it("detects when all slots are booked or removed", () => {
    const previousSlots = [{ bookingDate: "14-11-2026", bookingDateStatus: 1 }];
    const currentSlots: ExamSlot[] = [];

    const transition = computeSlotTransition({
      targetId,
      previousStatus: "AVAILABLE",
      currentStatus: "UNAVAILABLE",
      previousSlots,
      currentSlots,
    });

    expect(transition.hasChanged).toBe(true);
    expect(transition.removedSlots).toHaveLength(1);

    const event = createEventFromTransition(transition, bookingUrl);
    expect(event?.eventType).toBe("ALL_SLOTS_REMOVED");
  });
});
