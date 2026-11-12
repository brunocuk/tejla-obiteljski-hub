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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          data_cleared_at: string | null
          id: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          data_cleared_at?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          data_cleared_at?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      app_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      beta_invites: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          label: string
          status: string
          token: string
          updated_at: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          label?: string
          status?: string
          token: string
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          label?: string
          status?: string
          token?: string
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      device_push_tokens: {
        Row: {
          app_version: string | null
          created_at: string
          disabled_at: string | null
          id: string
          last_seen_at: string
          platform: string
          provider: string
          token: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          disabled_at?: string | null
          id?: string
          last_seen_at?: string
          platform: string
          provider?: string
          token: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          disabled_at?: string | null
          id?: string
          last_seen_at?: string
          platform?: string
          provider?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      event_members: {
        Row: {
          created_at: string
          event_id: string
          family_member_id: string
          id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          family_member_id: string
          id?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          family_member_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_members_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "family_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_members_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      event_occurrence_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          effective_date: string | null
          end_time: string | null
          event_id: string
          id: string
          location: string | null
          notes: string | null
          original_occurrence_date: string
          start_time: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          end_time?: string | null
          event_id: string
          id?: string
          location?: string | null
          notes?: string | null
          original_occurrence_date: string
          start_time?: string | null
          status: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          end_time?: string | null
          event_id?: string
          id?: string
          location?: string | null
          notes?: string | null
          original_occurrence_date?: string
          start_time?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_occurrence_overrides_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "family_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reminders: {
        Row: {
          at_time: string | null
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          days_before: number | null
          event_id: string
          id: string
          is_recurring: boolean
          offset_kind: string
          offset_minutes: number | null
          pattern: string
          recipient_mode: string
          recipient_user_ids: string[]
          remind_at: string
          sent_at: string | null
          series_id: string | null
        }
        Insert: {
          at_time?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          days_before?: number | null
          event_id: string
          id?: string
          is_recurring?: boolean
          offset_kind?: string
          offset_minutes?: number | null
          pattern?: string
          recipient_mode?: string
          recipient_user_ids?: string[]
          remind_at: string
          sent_at?: string | null
          series_id?: string | null
        }
        Update: {
          at_time?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          days_before?: number | null
          event_id?: string
          id?: string
          is_recurring?: boolean
          offset_kind?: string
          offset_minutes?: number | null
          pattern?: string
          recipient_mode?: string
          recipient_user_ids?: string[]
          remind_at?: string
          sent_at?: string | null
          series_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "family_events"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_settings: {
        Row: {
          enforced: boolean
          id: boolean
          updated_at: string
        }
        Insert: {
          enforced?: boolean
          id?: boolean
          updated_at?: string
        }
        Update: {
          enforced?: boolean
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      family_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          family_id: string
          price_id: string | null
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string | null
          tos_accepted_at: string | null
          tos_version: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          family_id: string
          price_id?: string | null
          status?: string
          stripe_customer_id: string
          stripe_subscription_id?: string | null
          tos_accepted_at?: string | null
          tos_version?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          family_id?: string
          price_id?: string | null
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string | null
          tos_accepted_at?: string | null
          tos_version?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_subscriptions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: true
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          doc_version: string
          id: string
          method: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          doc_version: string
          id?: string
          method: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          doc_version?: string
          id?: string
          method?: string
          user_id?: string
        }
        Relationships: []
      }
      invoice_jobs: {
        Row: {
          amount_total: number
          attempts: number
          created_at: string
          currency: string
          customer_email: string | null
          family_id: string | null
          fira_document_id: string | null
          id: string
          kind: string
          last_error: string | null
          status: string
          stripe_invoice_id: string
          stripe_refund_id: string | null
          updated_at: string
        }
        Insert: {
          amount_total: number
          attempts?: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          family_id?: string | null
          fira_document_id?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          status?: string
          stripe_invoice_id: string
          stripe_refund_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_total?: number
          attempts?: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          family_id?: string | null
          fira_document_id?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          status?: string
          stripe_invoice_id?: string
          stripe_refund_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_jobs_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          id: string
          received_at: string
          type: string
        }
        Insert: {
          id: string
          received_at?: string
          type: string
        }
        Update: {
          id?: string
          received_at?: string
          type?: string
        }
        Relationships: []
      }
      families: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      family_events: {
        Row: {
          amount: string | null
          category: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          created_by: string | null
          date: string | null
          deadline: string | null
          end_time: string | null
          family_id: string
          id: string
          linked_event_id: string | null
          location: string | null
          notes: string | null
          recurrence_byday: string[]
          recurrence_exclude: string[]
          recurrence_freq: string | null
          recurrence_interval: number
          recurrence_note: string | null
          recurrence_until: string | null
          things_to_bring: Json
          time: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          amount?: string | null
          category?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          date?: string | null
          deadline?: string | null
          end_time?: string | null
          family_id: string
          id?: string
          linked_event_id?: string | null
          location?: string | null
          notes?: string | null
          recurrence_byday?: string[]
          recurrence_exclude?: string[]
          recurrence_freq?: string | null
          recurrence_interval?: number
          recurrence_note?: string | null
          recurrence_until?: string | null
          things_to_bring?: Json
          time?: string | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          amount?: string | null
          category?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          date?: string | null
          deadline?: string | null
          end_time?: string | null
          family_id?: string
          id?: string
          linked_event_id?: string | null
          location?: string | null
          notes?: string | null
          recurrence_byday?: string[]
          recurrence_exclude?: string[]
          recurrence_freq?: string | null
          recurrence_interval?: number
          recurrence_note?: string | null
          recurrence_until?: string | null
          things_to_bring?: Json
          time?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_events_linked_event_id_fkey"
            columns: ["linked_event_id"]
            isOneToOne: false
            referencedRelation: "family_events"
            referencedColumns: ["id"]
          },
        ]
      }
      family_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          family_id: string
          family_member_id: string | null
          id: string
          invited_by: string | null
          role: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          family_id: string
          family_member_id?: string | null
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          family_id?: string
          family_member_id?: string | null
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_invitations_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_invitations_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          archived_at: string | null
          created_at: string
          family_id: string
          id: string
          linked_user_id: string | null
          member_type: string
          name: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          family_id: string
          id?: string
          linked_user_id?: string | null
          member_type?: string
          name?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          family_id?: string
          id?: string
          linked_user_id?: string | null
          member_type?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_users: {
        Row: {
          created_at: string
          family_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_users_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      member_visibility: {
        Row: {
          allowed_member_ids: string[]
          created_at: string
          family_id: string
          family_member_id: string
          id: string
          mode: string
          see_own: boolean
          see_shared: boolean
          updated_at: string
        }
        Insert: {
          allowed_member_ids?: string[]
          created_at?: string
          family_id: string
          family_member_id: string
          id?: string
          mode?: string
          see_own?: boolean
          see_shared?: boolean
          updated_at?: string
        }
        Update: {
          allowed_member_ids?: string[]
          created_at?: string
          family_id?: string
          family_member_id?: string
          id?: string
          mode?: string
          see_own?: boolean
          see_shared?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_visibility_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_visibility_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: true
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          channel: string
          created_at: string
          error: string | null
          id: string
          notification_event_id: string
          sent_at: string | null
          status: string
          target_ref: string
        }
        Insert: {
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          notification_event_id: string
          sent_at?: string | null
          status?: string
          target_ref: string
        }
        Update: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          notification_event_id?: string
          sent_at?: string | null
          status?: string
          target_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_event_id_fkey"
            columns: ["notification_event_id"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          body: string
          created_at: string
          dedupe_key: string
          deep_link: string
          family_id: string
          id: string
          kind: string
          payload: Json
          subject_id: string | null
          subject_type: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          dedupe_key: string
          deep_link?: string
          family_id: string
          id?: string
          kind: string
          payload?: Json
          subject_id?: string | null
          subject_type?: string
          title?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          dedupe_key?: string
          deep_link?: string
          family_id?: string
          id?: string
          kind?: string
          payload?: Json
          subject_id?: string | null
          subject_type?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          email?: string
          id: string
          name?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      reminder_occurrences: {
        Row: {
          cancelled_at: string | null
          created_at: string
          effective_date: string
          id: string
          original_occurrence_date: string
          remind_at: string
          reminder_id: string
          sent_at: string | null
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          effective_date: string
          id?: string
          original_occurrence_date: string
          remind_at: string
          reminder_id: string
          sent_at?: string | null
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          effective_date?: string
          id?: string
          original_occurrence_date?: string
          remind_at?: string
          reminder_id?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_occurrences_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "event_reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      school_breaks: {
        Row: {
          calendar_id: string
          created_at: string
          ends_on: string
          id: string
          label: string
          starts_on: string
          updated_at: string
        }
        Insert: {
          calendar_id: string
          created_at?: string
          ends_on: string
          id?: string
          label: string
          starts_on: string
          updated_at?: string
        }
        Update: {
          calendar_id?: string
          created_at?: string
          ends_on?: string
          id?: string
          label?: string
          starts_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_breaks_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "school_calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      school_calendars: {
        Row: {
          created_at: string
          id: string
          published_at: string | null
          school_year: string
          scope: string
          source_url: string | null
          updated_at: string
          valid_from: string
          valid_to: string
        }
        Insert: {
          created_at?: string
          id?: string
          published_at?: string | null
          school_year: string
          scope?: string
          source_url?: string | null
          updated_at?: string
          valid_from: string
          valid_to: string
        }
        Update: {
          created_at?: string
          id?: string
          published_at?: string | null
          school_year?: string
          scope?: string
          source_url?: string | null
          updated_at?: string
          valid_from?: string
          valid_to?: string
        }
        Relationships: []
      }
      user_notification_prefs: {
        Row: {
          created_at: string
          tejla_messages_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          tejla_messages_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          tejla_messages_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_family_invitation:
        | { Args: never; Returns: string }
        | { Args: { _invitation_id?: string }; Returns: string }
      account_deletion_preview: { Args: never; Returns: Json }
      billing_enforced: { Args: never; Returns: boolean }
      can_access_event: { Args: { _event_id: string }; Returns: boolean }
      family_has_access: { Args: { _family_id: string }; Returns: boolean }
      user_has_access: { Args: { _user_id: string }; Returns: boolean }
      can_edit_event: { Args: { _event_id: string }; Returns: boolean }
      can_edit_event_row: {
        Args: { _event_id: string; _family_id: string }
        Returns: boolean
      }
      can_toggle_event_row: {
        Args: { _event_id: string; _family_id: string }
        Returns: boolean
      }
      can_view_event: { Args: { _event_id: string }; Returns: boolean }
      can_view_event_row: {
        Args: { _event_id: string; _family_id: string }
        Returns: boolean
      }
      claim_due_reminder_occurrences: {
        Args: { _limit?: number }
        Returns: {
          created_by: string
          effective_date: string
          event_id: string
          family_id: string
          occurrence_id: string
          recipient_mode: string
          recipient_user_ids: string[]
          remind_at: string
          reminder_id: string
        }[]
      }
      cleanup_reminder_occurrences: {
        Args: { _horizon_days?: number }
        Returns: number
      }
      create_family: {
        Args: { _family_name: string; _my_name: string }
        Returns: string
      }
      delete_my_account: {
        Args: { _new_owner_user_id?: string }
        Returns: Json
      }
      expand_event_occurrences: {
        Args: { _event_id: string; _from: string; _to: string }
        Returns: {
          effective_date: string
          end_time: string
          event_id: string
          location: string
          notes: string
          original_occurrence_date: string
          start_time: string
          status: string
          title: string
        }[]
      }
      expand_event_occurrences_all: {
        Args: { _event_id: string; _from: string; _to: string }
        Returns: {
          effective_date: string
          end_time: string
          event_id: string
          location: string
          notes: string
          original_occurrence_date: string
          start_time: string
          status: string
          title: string
        }[]
      }
      expand_family_occurrences: {
        Args: { _family_id: string; _from: string; _to: string }
        Returns: {
          effective_date: string
          end_time: string
          event_id: string
          location: string
          notes: string
          original_occurrence_date: string
          start_time: string
          status: string
          title: string
        }[]
      }
      hr_easter_sunday: { Args: { _year: number }; Returns: string }
      hr_public_holiday: {
        Args: { _year: number }
        Returns: {
          day: string
          name: string
        }[]
      }
      is_app_admin: { Args: never; Returns: boolean }
      is_excluded_hr: {
        Args: { _day: string; _kinds: string[] }
        Returns: boolean
      }
      is_family_adult: { Args: { _family_id: string }; Returns: boolean }
      is_family_member: { Args: { _family_id: string }; Returns: boolean }
      is_family_owner: { Args: { _family_id: string }; Returns: boolean }
      materialize_reminder_occurrences: {
        Args: { _horizon_days?: number }
        Returns: number
      }
      member_data_counts: { Args: { _member_id: string }; Returns: Json }
      pending_family_invitation: { Args: never; Returns: Json }
      purge_member_data: {
        Args: { _member_id: string; _scope: string }
        Returns: Json
      }
      remove_family_member: {
        Args: { _member_id: string; _purge?: boolean }
        Returns: Json
      }
      school_calendar_coverage: {
        Args: { _from: string; _to: string }
        Returns: {
          covered: boolean
          gap_from: string
          gap_to: string
          school_year: string
        }[]
      }
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
