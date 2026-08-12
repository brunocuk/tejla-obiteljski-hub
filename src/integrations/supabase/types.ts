export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      event_members: {
        Row: {
          created_at: string;
          event_id: string;
          family_member_id: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          family_member_id: string;
          id?: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          family_member_id?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_members_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "family_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_members_family_member_id_fkey";
            columns: ["family_member_id"];
            isOneToOne: false;
            referencedRelation: "family_members";
            referencedColumns: ["id"];
          },
        ];
      };
      event_reminders: {
        Row: {
          created_at: string;
          created_by: string;
          event_id: string;
          id: string;
          recipient_mode: string;
          remind_at: string;
          sent_at: string | null;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          event_id: string;
          id?: string;
          recipient_mode?: string;
          remind_at: string;
          sent_at?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          event_id?: string;
          id?: string;
          recipient_mode?: string;
          remind_at?: string;
          sent_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "event_reminders_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "family_events";
            referencedColumns: ["id"];
          },
        ];
      };
      families: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      family_events: {
        Row: {
          amount: string | null;
          category: string | null;
          created_at: string;
          created_by: string;
          date: string | null;
          deadline: string | null;
          family_id: string;
          id: string;
          location: string | null;
          notes: string | null;
          things_to_bring: Json;
          time: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          amount?: string | null;
          category?: string | null;
          created_at?: string;
          created_by: string;
          date?: string | null;
          deadline?: string | null;
          family_id: string;
          id?: string;
          location?: string | null;
          notes?: string | null;
          things_to_bring?: Json;
          time?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          amount?: string | null;
          category?: string | null;
          created_at?: string;
          created_by?: string;
          date?: string | null;
          deadline?: string | null;
          family_id?: string;
          id?: string;
          location?: string | null;
          notes?: string | null;
          things_to_bring?: Json;
          time?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "family_events_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
        ];
      };
      family_invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string;
          family_id: string;
          family_member_id: string | null;
          id: string;
          invited_by: string | null;
          role: string;
          status: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email: string;
          family_id: string;
          family_member_id?: string | null;
          id?: string;
          invited_by?: string | null;
          role?: string;
          status?: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string;
          family_id?: string;
          family_member_id?: string | null;
          id?: string;
          invited_by?: string | null;
          role?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "family_invitations_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "family_invitations_family_member_id_fkey";
            columns: ["family_member_id"];
            isOneToOne: false;
            referencedRelation: "family_members";
            referencedColumns: ["id"];
          },
        ];
      };
      family_members: {
        Row: {
          created_at: string;
          family_id: string;
          id: string;
          linked_user_id: string | null;
          member_type: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          family_id: string;
          id?: string;
          linked_user_id?: string | null;
          member_type?: string;
          name?: string;
        };
        Update: {
          created_at?: string;
          family_id?: string;
          id?: string;
          linked_user_id?: string | null;
          member_type?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
        ];
      };
      family_users: {
        Row: {
          created_at: string;
          family_id: string;
          id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          family_id: string;
          id?: string;
          role?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          family_id?: string;
          id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "family_users_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
        ];
      };
      member_visibility: {
        Row: {
          allowed_member_ids: string[];
          created_at: string;
          family_id: string;
          family_member_id: string;
          id: string;
          mode: string;
          see_own: boolean;
          see_shared: boolean;
          updated_at: string;
        };
        Insert: {
          allowed_member_ids?: string[];
          created_at?: string;
          family_id: string;
          family_member_id: string;
          id?: string;
          mode?: string;
          see_own?: boolean;
          see_shared?: boolean;
          updated_at?: string;
        };
        Update: {
          allowed_member_ids?: string[];
          created_at?: string;
          family_id?: string;
          family_member_id?: string;
          id?: string;
          mode?: string;
          see_own?: boolean;
          see_shared?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_visibility_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_visibility_family_member_id_fkey";
            columns: ["family_member_id"];
            isOneToOne: true;
            referencedRelation: "family_members";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          email?: string;
          id: string;
          name?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          p256dh: string;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          p256dh: string;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          p256dh?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_family_invitation: { Args: never; Returns: string };
      can_access_event: { Args: { _event_id: string }; Returns: boolean };
      can_view_event: { Args: { _event_id: string }; Returns: boolean };
      create_family: {
        Args: { _family_name: string; _my_name: string };
        Returns: string;
      };
      is_family_adult: { Args: { _family_id: string }; Returns: boolean };
      is_family_member: { Args: { _family_id: string }; Returns: boolean };
      is_family_owner: { Args: { _family_id: string }; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
