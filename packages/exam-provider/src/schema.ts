import { z } from "zod";
import { AvailabilityStatus, ExamSlot } from "@exam-monitor/shared";

/**
 * Validated schema for practical exam booking date response
 * Observed live response: [{"bookingDate":"14-11-2026","bookingDateStatus":1}, ...]
 */
export const PracticalDateItemSchema = z.object({
  bookingDate: z.string().min(1),
  bookingDateStatus: z.number().optional(),
});

export const PracticalDatesArraySchema = z.array(PracticalDateItemSchema);

export interface ParseResult {
  status: AvailabilityStatus;
  slots: ExamSlot[];
  rawSnippet?: string;
  isVerifiedFormat: boolean;
}

/**
 * Common known text responses indicating no spots are available
 */
const NO_SPOTS_PATTERNS = [
  "არჩეულ სერვის ცენტრში არ არის ადგილი", // Georgian: No spots in selected service center
  "არ არის თავისუფალი ადგილი",           // Georgian: No free spots
  "no available spots",
  "no dates available",
  "no places available",
];

export function parseAvailabilityResponse(rawText: string): ParseResult {
  const trimmed = rawText.trim();

  // 1. Check for empty string
  if (trimmed.length === 0) {
    return {
      status: "UNAVAILABLE",
      slots: [],
      rawSnippet: "",
      isVerifiedFormat: true,
    };
  }

  // 2. Check for empty array `[]`
  if (trimmed === "[]") {
    return {
      status: "UNAVAILABLE",
      slots: [],
      rawSnippet: "[]",
      isVerifiedFormat: true,
    };
  }

  // 3. Try to parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // If not valid JSON, check if it's a known no-spots plain string
    const lowerText = trimmed.toLowerCase();
    const isKnownNoSpots = NO_SPOTS_PATTERNS.some((pat) => lowerText.includes(pat.toLowerCase()));

    if (isKnownNoSpots) {
      return {
        status: "UNAVAILABLE",
        slots: [],
        rawSnippet: trimmed.slice(0, 200),
        isVerifiedFormat: true,
      };
    }

    // Unrecognized non-JSON response
    return {
      status: "UNKNOWN",
      slots: [],
      rawSnippet: trimmed.slice(0, 300),
      isVerifiedFormat: false,
    };
  }

  // 4. If JSON is a string (e.g. JSON string containing Georgian no-spots message)
  if (typeof parsed === "string") {
    const isKnownNoSpots = NO_SPOTS_PATTERNS.some((pat) => parsed.includes(pat));
    if (isKnownNoSpots || parsed.trim().length === 0) {
      return {
        status: "UNAVAILABLE",
        slots: [],
        rawSnippet: parsed.slice(0, 200),
        isVerifiedFormat: true,
      };
    }
    return {
      status: "UNKNOWN",
      slots: [],
      rawSnippet: parsed.slice(0, 300),
      isVerifiedFormat: false,
    };
  }

  // 5. If JSON is an array, validate against PracticalDatesArraySchema
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return {
        status: "UNAVAILABLE",
        slots: [],
        rawSnippet: "[]",
        isVerifiedFormat: true,
      };
    }

    const validation = PracticalDatesArraySchema.safeParse(parsed);
    if (validation.success) {
      const slots: ExamSlot[] = validation.data.map((item) => ({
        bookingDate: item.bookingDate,
        bookingDateStatus: item.bookingDateStatus,
      }));

      return {
        status: "AVAILABLE",
        slots,
        rawSnippet: JSON.stringify(validation.data.slice(0, 3)),
        isVerifiedFormat: true,
      };
    }
  }

  // 6. If JSON is an object with custom fields
  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    // Check if wrapped in { dates: [...] } or { data: [...] }
    const candidateArray = obj.dates || obj.data || obj.slots;
    if (Array.isArray(candidateArray)) {
      const subValidation = PracticalDatesArraySchema.safeParse(candidateArray);
      if (subValidation.success && subValidation.data.length > 0) {
        return {
          status: "AVAILABLE",
          slots: subValidation.data.map((item) => ({
            bookingDate: item.bookingDate,
            bookingDateStatus: item.bookingDateStatus,
          })),
          rawSnippet: JSON.stringify(subValidation.data.slice(0, 3)),
          isVerifiedFormat: true,
        };
      }
    }
  }

  // Fallback: If endpoint semantics cannot be verified, report availability as Unknown
  return {
    status: "UNKNOWN",
    slots: [],
    rawSnippet: trimmed.slice(0, 300),
    isVerifiedFormat: false,
  };
}
