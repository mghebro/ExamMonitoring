export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      availability_snapshots: {
        Row: {
          checked_at: string
          error_message: string | null
          http_status: number
          id: string
          raw_response_snippet: string | null
          response_latency_ms: number
          slot_count: number
          status: string
          target_id: string
        }
        Insert: {
          checked_at?: string
          error_message?: string | null
          http_status: number
          id?: string
          raw_response_snippet?: string | null
          response_latency_ms: number
          slot_count?: number
          status: string
          target_id: string
        }
        Update: {
          checked_at?: string
          error_message?: string | null
          http_status?: number
          id?: string
          raw_response_snippet?: string | null
          response_latency_ms?: number
          slot_count?: number
          status?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_snapshots_target_id_exam_targets_id_fk"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "exam_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      available_slots: {
        Row: {
          booking_date: string
          booking_date_status: number | null
          first_seen_at: string
          id: string
          is_available: boolean
          last_seen_at: string
          target_id: string
          time_slot: string | null
        }
        Insert: {
          booking_date: string
          booking_date_status?: number | null
          first_seen_at?: string
          id?: string
          is_available?: boolean
          last_seen_at?: string
          target_id: string
          time_slot?: string | null
        }
        Update: {
          booking_date?: string
          booking_date_status?: number | null
          first_seen_at?: string
          id?: string
          is_available?: boolean
          last_seen_at?: string
          target_id?: string
          time_slot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "available_slots_target_id_exam_targets_id_fk"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "exam_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_targets: {
        Row: {
          category_code: string
          center_id: string
          created_at: string
          created_by: string | null
          endpoint_url: string
          id: string
          is_active: boolean
          is_first_attempt: boolean
          name: string
          poll_interval_seconds: number
          updated_at: string
        }
        Insert: {
          category_code: string
          center_id: string
          created_at?: string
          created_by?: string | null
          endpoint_url: string
          id?: string
          is_active?: boolean
          is_first_attempt?: boolean
          name: string
          poll_interval_seconds?: number
          updated_at?: string
        }
        Update: {
          category_code?: string
          center_id?: string
          created_at?: string
          created_by?: string | null
          endpoint_url?: string
          id?: string
          is_active?: boolean
          is_first_attempt?: boolean
          name?: string
          poll_interval_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_targets_created_by_profiles_id_fk"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          role?: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_profiles_id_fk"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_events: {
        Row: {
          available_dates: Json
          booking_url: string
          created_at: string
          event_type: string
          id: string
          message: string
          target_id: string
          title: string
        }
        Insert: {
          available_dates?: Json
          booking_url: string
          created_at?: string
          event_type: string
          id?: string
          message: string
          target_id: string
          title: string
        }
        Update: {
          available_dates?: Json
          booking_url?: string
          created_at?: string
          event_type?: string
          id?: string
          message?: string
          target_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_events_target_id_exam_targets_id_fk"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "exam_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_state: {
        Row: {
          consecutive_failures: number
          id: string
          last_changed_at: string | null
          last_checked_at: string | null
          last_error: string | null
          last_latency_ms: number | null
          last_status: string
          last_success_at: string | null
          state: string
          target_id: string
          updated_at: string
        }
        Insert: {
          consecutive_failures?: number
          id?: string
          last_changed_at?: string | null
          last_checked_at?: string | null
          last_error?: string | null
          last_latency_ms?: number | null
          last_status?: string
          last_success_at?: string | null
          state?: string
          target_id: string
          updated_at?: string
        }
        Update: {
          consecutive_failures?: number
          id?: string
          last_changed_at?: string | null
          last_checked_at?: string | null
          last_error?: string | null
          last_latency_ms?: number | null
          last_status?: string
          last_success_at?: string | null
          state?: string
          target_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_state_target_id_exam_targets_id_fk"
            columns: ["target_id"]
            isOneToOne: true
            referencedRelation: "exam_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          created_at: string
          delivered_at: string | null
          event_id: string
          id: string
          last_error: string | null
          max_retries: number
          message_text: string
          next_attempt_at: string
          retry_count: number
          status: string
          telegram_chat_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          event_id: string
          id?: string
          last_error?: string | null
          max_retries?: number
          message_text: string
          next_attempt_at?: string
          retry_count?: number
          status?: string
          telegram_chat_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          event_id?: string
          id?: string
          last_error?: string | null
          max_retries?: number
          message_text?: string
          next_attempt_at?: string
          retry_count?: number
          status?: string
          telegram_chat_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_event_id_monitoring_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "monitoring_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_user_id_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          id: string
          notify_on_available: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          notify_on_available?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          notify_on_available?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      polling_benchmarks: {
        Row: {
          actual_interval_ms: number
          configured_interval_seconds: number
          estimated_daily_requests: number
          estimated_hourly_requests: number
          executed_at: string
          failed_requests: number
          http_status_distribution: Json
          id: string
          is_simulation: boolean
          median_latency_ms: number
          notes: string | null
          p95_latency_ms: number
          rate_limit_count: number
          recommended_interval_seconds: number
          successful_requests: number
          target_endpoint: string
          total_requests: number
        }
        Insert: {
          actual_interval_ms: number
          configured_interval_seconds: number
          estimated_daily_requests: number
          estimated_hourly_requests: number
          executed_at?: string
          failed_requests: number
          http_status_distribution: Json
          id?: string
          is_simulation?: boolean
          median_latency_ms: number
          notes?: string | null
          p95_latency_ms: number
          rate_limit_count: number
          recommended_interval_seconds: number
          successful_requests: number
          target_endpoint: string
          total_requests: number
        }
        Update: {
          actual_interval_ms?: number
          configured_interval_seconds?: number
          estimated_daily_requests?: number
          estimated_hourly_requests?: number
          executed_at?: string
          failed_requests?: number
          http_status_distribution?: Json
          id?: string
          is_simulation?: boolean
          median_latency_ms?: number
          notes?: string | null
          p95_latency_ms?: number
          rate_limit_count?: number
          recommended_interval_seconds?: number
          successful_requests?: number
          target_endpoint?: string
          total_requests?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      telegram_linking_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_linking_tokens_user_id_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_links: {
        Row: {
          id: string
          is_subscribed: boolean
          linked_at: string
          telegram_chat_id: number
          telegram_user_id: number
          telegram_username: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          is_subscribed?: boolean
          linked_at?: string
          telegram_chat_id: number
          telegram_user_id: number
          telegram_username?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          is_subscribed?: boolean
          linked_at?: string
          telegram_chat_id?: number
          telegram_user_id?: number
          telegram_username?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_links_user_id_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_processed_updates: {
        Row: {
          processed_at: string
          update_id: number
        }
        Insert: {
          processed_at?: string
          update_id: number
        }
        Update: {
          processed_at?: string
          update_id?: number
        }
        Relationships: []
      }
      worker_leases: {
        Row: {
          acquired_at: string
          expires_at: string
          last_heartbeat: string
          target_id: string
          worker_id: string
        }
        Insert: {
          acquired_at?: string
          expires_at: string
          last_heartbeat?: string
          target_id: string
          worker_id: string
        }
        Update: {
          acquired_at?: string
          expires_at?: string
          last_heartbeat?: string
          target_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_leases_target_id_exam_targets_id_fk"
            columns: ["target_id"]
            isOneToOne: true
            referencedRelation: "exam_targets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
