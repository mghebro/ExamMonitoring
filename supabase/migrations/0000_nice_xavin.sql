CREATE TABLE "availability_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_id" uuid NOT NULL,
	"status" text NOT NULL,
	"slot_count" integer DEFAULT 0 NOT NULL,
	"response_latency_ms" integer NOT NULL,
	"http_status" integer NOT NULL,
	"error_message" text,
	"raw_response_snippet" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "available_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_id" uuid NOT NULL,
	"booking_date" text NOT NULL,
	"booking_date_status" integer DEFAULT 1,
	"time_slot" text,
	"is_available" boolean DEFAULT true NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"endpoint_url" text NOT NULL,
	"category_code" text NOT NULL,
	"center_id" text NOT NULL,
	"is_first_attempt" boolean DEFAULT false NOT NULL,
	"poll_interval_seconds" integer DEFAULT 60 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"invited_by" uuid,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_email_unique" UNIQUE("email"),
	CONSTRAINT "invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "monitoring_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"available_dates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"booking_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitoring_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_id" uuid NOT NULL,
	"state" text DEFAULT 'Unknown' NOT NULL,
	"last_status" text DEFAULT 'UNKNOWN' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_changed_at" timestamp with time zone,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"last_latency_ms" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monitoring_state_target_id_unique" UNIQUE("target_id")
);
--> statement-breakpoint
CREATE TABLE "notification_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"telegram_chat_id" bigint NOT NULL,
	"message_text" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 5 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"notify_on_available" boolean DEFAULT true NOT NULL,
	"quiet_hours_start" text,
	"quiet_hours_end" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "polling_benchmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_endpoint" text NOT NULL,
	"configured_interval_seconds" integer NOT NULL,
	"actual_interval_ms" integer NOT NULL,
	"total_requests" integer NOT NULL,
	"successful_requests" integer NOT NULL,
	"failed_requests" integer NOT NULL,
	"rate_limit_count" integer NOT NULL,
	"median_latency_ms" integer NOT NULL,
	"p95_latency_ms" integer NOT NULL,
	"http_status_distribution" jsonb NOT NULL,
	"estimated_hourly_requests" integer NOT NULL,
	"estimated_daily_requests" integer NOT NULL,
	"recommended_interval_seconds" integer NOT NULL,
	"is_simulation" boolean DEFAULT false NOT NULL,
	"notes" text,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"full_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "telegram_linking_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_linking_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "telegram_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"telegram_user_id" bigint NOT NULL,
	"telegram_chat_id" bigint NOT NULL,
	"telegram_username" text,
	"is_subscribed" boolean DEFAULT true NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_links_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "telegram_links_telegram_user_id_unique" UNIQUE("telegram_user_id")
);
--> statement-breakpoint
CREATE TABLE "telegram_processed_updates" (
	"update_id" bigint PRIMARY KEY NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_leases" (
	"target_id" uuid PRIMARY KEY NOT NULL,
	"worker_id" text NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_heartbeat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "availability_snapshots" ADD CONSTRAINT "availability_snapshots_target_id_exam_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."exam_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "available_slots" ADD CONSTRAINT "available_slots_target_id_exam_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."exam_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_targets" ADD CONSTRAINT "exam_targets_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_events" ADD CONSTRAINT "monitoring_events_target_id_exam_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."exam_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_state" ADD CONSTRAINT "monitoring_state_target_id_exam_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."exam_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_event_id_monitoring_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."monitoring_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_linking_tokens" ADD CONSTRAINT "telegram_linking_tokens_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_links" ADD CONSTRAINT "telegram_links_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_leases" ADD CONSTRAINT "worker_leases_target_id_exam_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."exam_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_snapshots_target_checked" ON "availability_snapshots" USING btree ("target_id","checked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_slots_target_date" ON "available_slots" USING btree ("target_id","booking_date");--> statement-breakpoint
CREATE INDEX "idx_slots_available" ON "available_slots" USING btree ("target_id","is_available");--> statement-breakpoint
CREATE INDEX "idx_exam_targets_active" ON "exam_targets" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_invitations_token_hash" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_invitations_email" ON "invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_events_target_created" ON "monitoring_events" USING btree ("target_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_monitoring_state_target" ON "monitoring_state" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "idx_outbox_status_next" ON "notification_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "idx_outbox_event_user" ON "notification_outbox" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_notif_pref_user" ON "notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_benchmarks_executed" ON "polling_benchmarks" USING btree ("executed_at");--> statement-breakpoint
CREATE INDEX "idx_profiles_role" ON "profiles" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tg_linking_hash" ON "telegram_linking_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_tg_linking_user" ON "telegram_linking_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_telegram_links_user" ON "telegram_links" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_telegram_links_tg_user" ON "telegram_links" USING btree ("telegram_user_id");--> statement-breakpoint
CREATE INDEX "idx_worker_leases_expires" ON "worker_leases" USING btree ("expires_at");