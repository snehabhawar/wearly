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
      absences: {
        Row: {
          classification: string
          closet_id: string
          garment_id: string | null
          hanger_id: string
          id: string
          left_at: string
          outfit_id: string | null
          returned_at: string | null
        }
        Insert: {
          classification?: string
          closet_id: string
          garment_id?: string | null
          hanger_id: string
          id?: string
          left_at: string
          outfit_id?: string | null
          returned_at?: string | null
        }
        Update: {
          classification?: string
          closet_id?: string
          garment_id?: string | null
          hanger_id?: string
          id?: string
          left_at?: string
          outfit_id?: string | null
          returned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "absences_closet_id_fkey"
            columns: ["closet_id"]
            isOneToOne: false
            referencedRelation: "closet_summary"
            referencedColumns: ["closet_id"]
          },
          {
            foreignKeyName: "absences_closet_id_fkey"
            columns: ["closet_id"]
            isOneToOne: false
            referencedRelation: "closets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_garment_id_fkey"
            columns: ["garment_id"]
            isOneToOne: false
            referencedRelation: "garment_stats"
            referencedColumns: ["garment_id"]
          },
          {
            foreignKeyName: "absences_garment_id_fkey"
            columns: ["garment_id"]
            isOneToOne: false
            referencedRelation: "garments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_hanger_id_fkey"
            columns: ["hanger_id"]
            isOneToOne: false
            referencedRelation: "hangers"
            referencedColumns: ["id"]
          },
        ]
      }
      closets: {
        Row: {
          created_at: string
          id: string
          last_swept_at: string | null
          latitude: number | null
          longitude: number | null
          name: string
          owner_id: string
          timezone: string
          wear_profile: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_swept_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          owner_id: string
          timezone?: string
          wear_profile?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_swept_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          owner_id?: string
          timezone?: string
          wear_profile?: string
        }
        Relationships: []
      }
      commands: {
        Row: {
          acked_at: string | null
          closet_id: string
          color: string
          created_at: string
          expires_at: string
          hanger_id: string
          id: number
          pattern: string
          reason: string | null
        }
        Insert: {
          acked_at?: string | null
          closet_id: string
          color: string
          created_at?: string
          expires_at?: string
          hanger_id: string
          id?: never
          pattern: string
          reason?: string | null
        }
        Update: {
          acked_at?: string | null
          closet_id?: string
          color?: string
          created_at?: string
          expires_at?: string
          hanger_id?: string
          id?: never
          pattern?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commands_closet_id_fkey"
            columns: ["closet_id"]
            isOneToOne: false
            referencedRelation: "closet_summary"
            referencedColumns: ["closet_id"]
          },
          {
            foreignKeyName: "commands_closet_id_fkey"
            columns: ["closet_id"]
            isOneToOne: false
            referencedRelation: "closets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commands_hanger_id_fkey"
            columns: ["hanger_id"]
            isOneToOne: false
            referencedRelation: "hangers"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          closet_id: string
          created_at: string
          id: string
          kind: string
          last_seen_at: string | null
          name: string
          secret_hash: string
        }
        Insert: {
          closet_id: string
          created_at?: string
          id?: string
          kind?: string
          last_seen_at?: string | null
          name?: string
          secret_hash: string
        }
        Update: {
          closet_id?: string
          created_at?: string
          id?: string
          kind?: string
          last_seen_at?: string | null
          name?: string
          secret_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_closet_id_fkey"
            columns: ["closet_id"]
            isOneToOne: false
            referencedRelation: "closet_summary"
            referencedColumns: ["closet_id"]
          },
          {
            foreignKeyName: "devices_closet_id_fkey"
            columns: ["closet_id"]
            isOneToOne: false
            referencedRelation: "closets"
            referencedColumns: ["id"]
          },
        ]
      }
      garments: {
        Row: {
          category: string | null
          closet_id: string
          color: string | null
          created_at: string
          cutout_path: string | null
          formality: number | null
          id: string
          name: string | null
          photo_path: string | null
          price_cents: number | null
          seasons: string[] | null
          status: string
          tags_source: string | null
        }
        Insert: {
          category?: string | null
          closet_id: string
          color?: string | null
          created_at?: string
          cutout_path?: string | null
          formality?: number | null
          id?: string
          name?: string | null
          photo_path?: string | null
          price_cents?: number | null
          seasons?: string[] | null
          status?: string
          tags_source?: string | null
        }
        Update: {
          category?: string | null
          closet_id?: string
          color?: string | null
          created_at?: string
          cutout_path?: string | null
          formality?: number | null
          id?: string
          name?: string | null
          photo_path?: string | null
          price_cents?: number | null
          seasons?: string[] | null
          status?: string
          tags_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garments_closet_id_fkey"
            columns: ["closet_id"]
            isOneToOne: false
            referencedRelation: "closet_summary"
            referencedColumns: ["closet_id"]
          },
          {
            foreignKeyName: "garments_closet_id_fkey"
            columns: ["closet_id"]
            isOneToOne: false
            referencedRelation: "closets"
            referencedColumns: ["id"]
          },
        ]
      }
      hanger_assignments: {
        Row: {
          ended_at: string | null
          garment_id: string
          hanger_id: string
          id: string
          started_at: string
        }
        Insert: {
          ended_at?: string | null
          garment_id: string
          hanger_id: string
          id?: string
          started_at?: string
        }
        Update: {
          ended_at?: string | null
          garment_id?: string
          hanger_id?: string
          id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hanger_assignments_garment_id_fkey"
            columns: ["garment_id"]
            isOneToOne: false
            referencedRelation: "garment_stats"
            referencedColumns: ["garment_id"]
          },
          {
            foreignKeyName: "hanger_assignments_garment_id_fkey"
            columns: ["garment_id"]
            isOneToOne: false
            referencedRelation: "garments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hanger_assignments_hanger_id_fkey"
            columns: ["hanger_id"]
            isOneToOne: false
            referencedRelation: "hangers"
            referencedColumns: ["id"]
          },
        ]
      }
      hangers: {
        Row: {
          closet_id: string
          created_at: string
          garment_on: boolean
          id: string
          led_color: string
          led_pattern: string
          number: number
          on_rail: boolean
          state_changed_at: string
        }
        Insert: {
          closet_id: string
          created_at?: string
          garment_on?: boolean
          id?: string
          led_color?: string
          led_pattern?: string
          number: number
          on_rail?: boolean
          state_changed_at?: string
        }
        Update: {
          closet_id?: string
          created_at?: string
          garment_on?: boolean
          id?: string
          led_color?: string
          led_pattern?: string
          number?: number
          on_rail?: boolean
          state_changed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hangers_closet_id_fkey"
            columns: ["closet_id"]
            isOneToOne: false
            referencedRelation: "closet_summary"
            referencedColumns: ["closet_id"]
          },
          {
            foreignKeyName: "hangers_closet_id_fkey"
            columns: ["closet_id"]
            isOneToOne: false
            referencedRelation: "closets"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_items: {
        Row: {
          day: string
          garment_id: string | null
          hanger_id: string | null
          id: string
          plan_id: string
          reason: string | null
          slot: string
          status: string
        }
        Insert: {
          day: string
          garment_id?: string | null
          hanger_id?: string | null
          id?: string
          plan_id: string
          reason?: string | null
          slot: string
          status?: string
        }
        Update: {
          day?: string
          garment_id?: string | null
          hanger_id?: string | null
          id?: string
          plan_id?: string
          reason?: string | null
          slot?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_items_garment_id_fkey"
            columns: ["garment_id"]
            isOneToOne: false
            referencedRelation: "garment_stats"
            referencedColumns: ["garment_id"]
          },
          {
            foreignKeyName: "plan_items_garment_id_fkey"
            columns: ["garment_id"]
            isOneToOne: false
            referencedRelation: "garments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_items_hanger_id_fkey"
            columns: ["hanger_id"]
            isOneToOne: false
            referencedRelation: "hangers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          closet_id: string
          forecast: Json | null
          generated_at: string
          id: string
          week_start: string
        }
        Insert: {
          closet_id: string
          forecast?: Json | null
          generated_at?: string
          id?: string
          week_start: string
        }
        Update: {
          closet_id?: string
          forecast?: Json | null
          generated_at?: string
          id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_closet_id_fkey"
            columns: ["closet_id"]
            isOneToOne: false
            referencedRelation: "closet_summary"
            referencedColumns: ["closet_id"]
          },
          {
            foreignKeyName: "plans_closet_id_fkey"
            columns: ["closet_id"]
            isOneToOne: false
            referencedRelation: "closets"
            referencedColumns: ["id"]
          },
        ]
      }
      sensor_events: {
        Row: {
          closet_id: string
          device_id: string | null
          garment_on: boolean
          hanger_id: string
          id: number
          occurred_at: string
          on_rail: boolean
          received_at: string
          seq: number | null
        }
        Insert: {
          closet_id: string
          device_id?: string | null
          garment_on: boolean
          hanger_id: string
          id?: never
          occurred_at: string
          on_rail: boolean
          received_at?: string
          seq?: number | null
        }
        Update: {
          closet_id?: string
          device_id?: string | null
          garment_on?: boolean
          hanger_id?: string
          id?: never
          occurred_at?: string
          on_rail?: boolean
          received_at?: string
          seq?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sensor_events_closet_id_fkey"
            columns: ["closet_id"]
            isOneToOne: false
            referencedRelation: "closet_summary"
            referencedColumns: ["closet_id"]
          },
          {
            foreignKeyName: "sensor_events_closet_id_fkey"
            columns: ["closet_id"]
            isOneToOne: false
            referencedRelation: "closets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensor_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensor_events_hanger_id_fkey"
            columns: ["hanger_id"]
            isOneToOne: false
            referencedRelation: "hangers"
            referencedColumns: ["id"]
          },
        ]
      }
      swipe_decisions: {
        Row: {
          challenge_until: string | null
          decided_at: string
          decision: string
          garment_id: string
          id: string
          route: string | null
        }
        Insert: {
          challenge_until?: string | null
          decided_at?: string
          decision: string
          garment_id: string
          id?: string
          route?: string | null
        }
        Update: {
          challenge_until?: string | null
          decided_at?: string
          decision?: string
          garment_id?: string
          id?: string
          route?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "swipe_decisions_garment_id_fkey"
            columns: ["garment_id"]
            isOneToOne: false
            referencedRelation: "garment_stats"
            referencedColumns: ["garment_id"]
          },
          {
            foreignKeyName: "swipe_decisions_garment_id_fkey"
            columns: ["garment_id"]
            isOneToOne: false
            referencedRelation: "garments"
            referencedColumns: ["id"]
          },
        ]
      }
      wears: {
        Row: {
          absence_id: string | null
          closet_id: string
          created_at: string
          garment_id: string
          id: string
          outfit_id: string | null
          source: string
          worn_on: string
        }
        Insert: {
          absence_id?: string | null
          closet_id: string
          created_at?: string
          garment_id: string
          id?: string
          outfit_id?: string | null
          source?: string
          worn_on: string
        }
        Update: {
          absence_id?: string | null
          closet_id?: string
          created_at?: string
          garment_id?: string
          id?: string
          outfit_id?: string | null
          source?: string
          worn_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "wears_absence_id_fkey"
            columns: ["absence_id"]
            isOneToOne: false
            referencedRelation: "absences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wears_closet_id_fkey"
            columns: ["closet_id"]
            isOneToOne: false
            referencedRelation: "closet_summary"
            referencedColumns: ["closet_id"]
          },
          {
            foreignKeyName: "wears_closet_id_fkey"
            columns: ["closet_id"]
            isOneToOne: false
            referencedRelation: "closets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wears_garment_id_fkey"
            columns: ["garment_id"]
            isOneToOne: false
            referencedRelation: "garment_stats"
            referencedColumns: ["garment_id"]
          },
          {
            foreignKeyName: "wears_garment_id_fkey"
            columns: ["garment_id"]
            isOneToOne: false
            referencedRelation: "garments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      closet_summary: {
        Row: {
          closet_id: string | null
          hanger_count: number | null
          photographed_count: number | null
          rehomed_this_year: number | null
          worn_90d_pct: number | null
        }
        Insert: {
          closet_id?: string | null
          hanger_count?: never
          photographed_count?: never
          rehomed_this_year?: never
          worn_90d_pct?: never
        }
        Update: {
          closet_id?: string | null
          hanger_count?: never
          photographed_count?: never
          rehomed_this_year?: never
          worn_90d_pct?: never
        }
        Relationships: []
      }
      garment_stats: {
        Row: {
          browsed_count: number | null
          closet_id: string | null
          cost_per_wear: number | null
          garment_id: string | null
          idle_days_in_season: number | null
          last_worn_on: string | null
          wears_90d: number | null
          wears_ytd: number | null
        }
        Relationships: [
          {
            foreignKeyName: "garments_closet_id_fkey"
            columns: ["closet_id"]
            isOneToOne: false
            referencedRelation: "closet_summary"
            referencedColumns: ["closet_id"]
          },
          {
            foreignKeyName: "garments_closet_id_fkey"
            columns: ["closet_id"]
            isOneToOne: false
            referencedRelation: "closets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      owns_closet: { Args: { target_closet_id: string }; Returns: boolean }
      season_of: { Args: { d: string }; Returns: string }
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
