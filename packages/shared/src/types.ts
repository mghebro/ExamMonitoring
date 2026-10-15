export type UserRole = "admin" | "user";

export interface UserProfile {
  id: string; // Supabase auth.users UUID
  email: string;
  role: UserRole;
  fullName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AvailabilityStatus = "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";

export type WorkerState = "Running" | "Paused" | "Error" | "Stale" | "Unknown";

export interface ExamSlot {
  bookingDate: string; // e.g. "14-11-2026"
  bookingDateStatus?: number;
  timeSlot?: string | null;
  rawPayload?: Record<string, unknown> | null;
}

export interface MonitoringTarget {
  id: string;
  name: string;
  endpointUrl: string;
  categoryCode: string;
  centerId: string;
  isFirstAttempt: boolean;
  pollIntervalSeconds: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilitySnapshot {
  id: string;
  targetId: string;
  status: AvailabilityStatus;
  slotCount: number;
  responseLatencyMs: number;
  httpStatus: number;
  errorMessage?: string | null;
  rawResponseSnippet?: string | null;
  checkedAt: string;
}

export interface SlotTransition {
  targetId: string;
  previousStatus: AvailabilityStatus;
  currentStatus: AvailabilityStatus;
  newSlots: ExamSlot[];
  removedSlots: ExamSlot[];
  allSlots: ExamSlot[];
  hasChanged: boolean;
  detectedAt: string;
}

export interface TelegramLink {
  id: string;
  userId: string;
  telegramUserId: number;
  telegramChatId: number;
  telegramUsername?: string | null;
  isSubscribed: boolean;
  linkedAt: string;
  updatedAt: string;
}

export interface TelegramLinkingToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt?: string | null;
  createdAt: string;
}

export interface NotificationEvent {
  id: string;
  targetId: string;
  title: string;
  message: string;
  availableDates: string[];
  bookingUrl: string;
  createdAt: string;
}

export interface NotificationOutboxItem {
  id: string;
  eventId: string;
  userId: string;
  telegramChatId: number;
  messageText: string;
  status: "PENDING" | "PROCESSING" | "DELIVERED" | "FAILED" | "EXHAUSTED";
  retryCount: number;
  maxRetries: number;
  nextAttemptAt: string;
  lastError?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
}

export interface WorkerLease {
  targetId: string;
  workerId: string;
  acquiredAt: string;
  expiresAt: string;
  lastHeartbeat: string;
}

export interface PollingBenchmarkRun {
  id: string;
  targetEndpoint: string;
  configuredIntervalSeconds: number;
  actualIntervalMs: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitCount: number;
  medianLatencyMs: number;
  p95LatencyMs: number;
  httpStatusDistribution: Record<string, number>;
  estimatedHourlyRequests: number;
  estimatedDailyRequests: number;
  recommendedIntervalSeconds: number;
  isSimulation: boolean;
  executedAt: string;
}
