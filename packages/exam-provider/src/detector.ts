import { AvailabilityStatus, ExamSlot, SlotTransition } from "@exam-monitor/shared";

export interface ComputeTransitionOptions {
  targetId: string;
  previousStatus: AvailabilityStatus;
  currentStatus: AvailabilityStatus;
  previousSlots: ExamSlot[];
  currentSlots: ExamSlot[];
  detectedAt?: string;
}

/**
 * Compute the slot transition between two consecutive checks.
 * Determines newly added slots, removed slots, and whether availability changed.
 */
export function computeSlotTransition(options: ComputeTransitionOptions): SlotTransition {
  const {
    targetId,
    previousStatus,
    currentStatus,
    previousSlots,
    currentSlots,
    detectedAt = new Date().toISOString(),
  } = options;

  const previousDateSet = new Set(previousSlots.map((s) => s.bookingDate));
  const currentDateSet = new Set(currentSlots.map((s) => s.bookingDate));

  // Newly appeared slots: present in current but not in previous
  const newSlots = currentSlots.filter((slot) => !previousDateSet.has(slot.bookingDate));

  // Removed slots: present in previous but not in current
  const removedSlots = previousSlots.filter((slot) => !currentDateSet.has(slot.bookingDate));

  // Status transition or slot changes
  const statusChanged = previousStatus !== currentStatus;
  const slotsChanged = newSlots.length > 0 || removedSlots.length > 0;
  const hasChanged = statusChanged || slotsChanged;

  return {
    targetId,
    previousStatus,
    currentStatus,
    newSlots,
    removedSlots,
    allSlots: currentSlots,
    hasChanged,
    detectedAt,
  };
}

export interface MonitoringEventPayload {
  targetId: string;
  eventType: "NEW_SLOTS_DETECTED" | "ALL_SLOTS_REMOVED" | "STATUS_CHANGED";
  title: string;
  message: string;
  availableDates: string[];
  bookingUrl: string;
}

/**
 * Determine if a notification event should be triggered from a slot transition.
 */
export function createEventFromTransition(
  transition: SlotTransition,
  bookingUrl: string
): MonitoringEventPayload | null {
  if (transition.newSlots.length > 0) {
    const dates = transition.newSlots.map((s) => s.bookingDate);
    return {
      targetId: transition.targetId,
      eventType: "NEW_SLOTS_DETECTED",
      title: `⚡ New Driving Exam Slots Available! (${dates.length} date${dates.length > 1 ? "s" : ""})`,
      message: `Newly available dates detected: ${dates.join(", ")}.`,
      availableDates: dates,
      bookingUrl,
    };
  }

  if (transition.previousStatus === "AVAILABLE" && transition.currentStatus === "UNAVAILABLE") {
    return {
      targetId: transition.targetId,
      eventType: "ALL_SLOTS_REMOVED",
      title: "ℹ️ Exam Slots No Longer Available",
      message: "All previously available exam slots have been booked or removed.",
      availableDates: [],
      bookingUrl,
    };
  }

  return null;
}
