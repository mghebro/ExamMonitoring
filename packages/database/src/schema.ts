import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  bigint,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * 1. User profiles - linked 1:1 with Supabase Auth auth.users.id
 */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(), // references auth.users(id)
    email: text("email").notNull().unique(),
    role: text("role", { enum: ["admin", "user"] }).default("user").notNull(),
    fullName: text("full_name"),
    preferredCategory: text("preferred_category").default("4").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_profiles_role").on(table.role),
  ]
);

/**
 * 2. Invitations for role-controlled registration
 */
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    role: text("role", { enum: ["admin", "user"] }).default("user").notNull(),
    invitedBy: uuid("invited_by").references(() => profiles.id, { onDelete: "set null" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_invitations_token_hash").on(table.tokenHash),
    index("idx_invitations_email").on(table.email),
  ]
);

/**
 * 3. Exam Targets - configurable endpoints & criteria
 */
export const examTargets = pgTable(
  "exam_targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    endpointUrl: text("endpoint_url").notNull(),
    categoryCode: text("category_code").notNull(),
    centerId: text("center_id").notNull(),
    isFirstAttempt: boolean("is_first_attempt").default(false).notNull(),
    pollIntervalSeconds: integer("poll_interval_seconds").default(60).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_exam_targets_active").on(table.isActive),
  ]
);

/**
 * 4. Monitoring State - persistent state per target
 */
export const monitoringState = pgTable(
  "monitoring_state",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    targetId: uuid("target_id")
      .notNull()
      .unique()
      .references(() => examTargets.id, { onDelete: "cascade" }),
    state: text("state", { enum: ["Running", "Paused", "Error", "Stale", "Unknown"] })
      .default("Unknown")
      .notNull(),
    lastStatus: text("last_status", { enum: ["AVAILABLE", "UNAVAILABLE", "UNKNOWN"] })
      .default("UNKNOWN")
      .notNull(),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastChangedAt: timestamp("last_changed_at", { withTimezone: true }),
    consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
    lastError: text("last_error"),
    lastLatencyMs: integer("last_latency_ms"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_monitoring_state_target").on(table.targetId),
  ]
);

/**
 * 5. Availability Snapshots - historical checks
 */
export const availabilitySnapshots = pgTable(
  "availability_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    targetId: uuid("target_id")
      .notNull()
      .references(() => examTargets.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["AVAILABLE", "UNAVAILABLE", "UNKNOWN"] }).notNull(),
    slotCount: integer("slot_count").default(0).notNull(),
    responseLatencyMs: integer("response_latency_ms").notNull(),
    httpStatus: integer("http_status").notNull(),
    errorMessage: text("error_message"),
    rawResponseSnippet: text("raw_response_snippet"),
    checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_snapshots_target_checked").on(table.targetId, table.checkedAt),
  ]
);

/**
 * 6. Available Slots - currently and historically detected slots
 */
export const availableSlots = pgTable(
  "available_slots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    targetId: uuid("target_id")
      .notNull()
      .references(() => examTargets.id, { onDelete: "cascade" }),
    bookingDate: text("booking_date").notNull(),
    bookingDateStatus: integer("booking_date_status").default(1),
    timeSlot: text("time_slot"),
    isAvailable: boolean("is_available").default(true).notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_slots_target_date").on(table.targetId, table.bookingDate),
    index("idx_slots_available").on(table.targetId, table.isAvailable),
  ]
);

/**
 * 7. Monitoring Events - triggers for alerts
 */
export const monitoringEvents = pgTable(
  "monitoring_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    targetId: uuid("target_id")
      .notNull()
      .references(() => examTargets.id, { onDelete: "cascade" }),
    eventType: text("event_type", {
      enum: ["NEW_SLOTS_DETECTED", "ALL_SLOTS_REMOVED", "STATUS_CHANGED"],
    }).notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    availableDates: jsonb("available_dates").$type<string[]>().default([]).notNull(),
    bookingUrl: text("booking_url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_events_target_created").on(table.targetId, table.createdAt),
  ]
);

/**
 * 8. Telegram Links - verified association between App User and Telegram Chat
 */
export const telegramLinks = pgTable(
  "telegram_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => profiles.id, { onDelete: "cascade" }),
    telegramUserId: bigint("telegram_user_id", { mode: "number" }).notNull().unique(),
    telegramChatId: bigint("telegram_chat_id", { mode: "number" }).notNull(),
    telegramUsername: text("telegram_username"),
    subscribedCategories: text("subscribed_categories"),
    isSubscribed: boolean("is_subscribed").default(true).notNull(),
    linkedAt: timestamp("linked_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_telegram_links_user").on(table.userId),
    uniqueIndex("idx_telegram_links_tg_user").on(table.telegramUserId),
  ]
);

/**
 * 9. Telegram Linking Tokens - single-use, hashed, short-lived tokens
 */
export const telegramLinkingTokens = pgTable(
  "telegram_linking_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    subscribedCategories: text("subscribed_categories"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_tg_linking_hash").on(table.tokenHash),
    index("idx_tg_linking_user").on(table.userId),
  ]
);

/**
 * 10. Telegram Processed Updates - idempotency deduplication
 */
export const telegramProcessedUpdates = pgTable(
  "telegram_processed_updates",
  {
    updateId: bigint("update_id", { mode: "number" }).primaryKey(),
    processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull(),
  }
);

/**
 * 11. Notification Preferences
 */
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => profiles.id, { onDelete: "cascade" }),
    notifyOnAvailable: boolean("notify_on_available").default(true).notNull(),
    quietHoursStart: text("quiet_hours_start"), // e.g. "23:00"
    quietHoursEnd: text("quiet_hours_end"),     // e.g. "07:00"
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_notif_pref_user").on(table.userId),
  ]
);

/**
 * 12. Notification Outbox - reliable persistent delivery queue
 */
export const notificationOutbox = pgTable(
  "notification_outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => monitoringEvents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    telegramChatId: bigint("telegram_chat_id", { mode: "number" }).notNull(),
    messageText: text("message_text").notNull(),
    status: text("status", { enum: ["PENDING", "PROCESSING", "DELIVERED", "FAILED", "EXHAUSTED"] })
      .default("PENDING")
      .notNull(),
    retryCount: integer("retry_count").default(0).notNull(),
    maxRetries: integer("max_retries").default(5).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).defaultNow().notNull(),
    lastError: text("last_error"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_outbox_status_next").on(table.status, table.nextAttemptAt),
    index("idx_outbox_event_user").on(table.eventId, table.userId),
  ]
);

/**
 * 13. Polling Benchmarks
 */
export const pollingBenchmarks = pgTable(
  "polling_benchmarks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    targetEndpoint: text("target_endpoint").notNull(),
    configuredIntervalSeconds: integer("configured_interval_seconds").notNull(),
    actualIntervalMs: integer("actual_interval_ms").notNull(),
    totalRequests: integer("total_requests").notNull(),
    successfulRequests: integer("successful_requests").notNull(),
    failedRequests: integer("failed_requests").notNull(),
    rateLimitCount: integer("rate_limit_count").notNull(),
    medianLatencyMs: integer("median_latency_ms").notNull(),
    p95LatencyMs: integer("p95_latency_ms").notNull(),
    httpStatusDistribution: jsonb("http_status_distribution").$type<Record<string, number>>().notNull(),
    estimatedHourlyRequests: integer("estimated_hourly_requests").notNull(),
    estimatedDailyRequests: integer("estimated_daily_requests").notNull(),
    recommendedIntervalSeconds: integer("recommended_interval_seconds").notNull(),
    isSimulation: boolean("is_simulation").default(false).notNull(),
    notes: text("notes"),
    executedAt: timestamp("executed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_benchmarks_executed").on(table.executedAt),
  ]
);

/**
 * 14. Worker Leases - distributed database lease coordination
 */
export const workerLeases = pgTable(
  "worker_leases",
  {
    targetId: uuid("target_id")
      .primaryKey()
      .references(() => examTargets.id, { onDelete: "cascade" }),
    workerId: text("worker_id").notNull(),
    acquiredAt: timestamp("acquired_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastHeartbeat: timestamp("last_heartbeat", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_worker_leases_expires").on(table.expiresAt),
  ]
);

/**
 * Drizzle Relations
 */
export const profilesRelations = relations(profiles, ({ one, many }) => ({
  telegramLink: one(telegramLinks, {
    fields: [profiles.id],
    references: [telegramLinks.userId],
  }),
  preferences: one(notificationPreferences, {
    fields: [profiles.id],
    references: [notificationPreferences.userId],
  }),
  linkingTokens: many(telegramLinkingTokens),
  outboxDeliveries: many(notificationOutbox),
}));

export const examTargetsRelations = relations(examTargets, ({ one, many }) => ({
  state: one(monitoringState, {
    fields: [examTargets.id],
    references: [monitoringState.targetId],
  }),
  snapshots: many(availabilitySnapshots),
  slots: many(availableSlots),
  events: many(monitoringEvents),
  lease: one(workerLeases, {
    fields: [examTargets.id],
    references: [workerLeases.targetId],
  }),
}));

export const monitoringEventsRelations = relations(monitoringEvents, ({ one, many }) => ({
  target: one(examTargets, {
    fields: [monitoringEvents.targetId],
    references: [examTargets.id],
  }),
  outboxItems: many(notificationOutbox),
}));
