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
      briefings: {
        Row: {
          briefing_date: string
          content: string
          created_at: string
          id: string
          kind: string
          source_snapshot: Json | null
        }
        Insert: {
          briefing_date: string
          content: string
          created_at?: string
          id?: string
          kind: string
          source_snapshot?: Json | null
        }
        Update: {
          briefing_date?: string
          content?: string
          created_at?: string
          id?: string
          kind?: string
          source_snapshot?: Json | null
        }
        Relationships: []
      }
      job_steps: {
        Row: {
          completed_at: string | null
          id: string
          job_id: string
          machine_id: string | null
          note: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          step_name: string
          step_order: number
        }
        Insert: {
          completed_at?: string | null
          id?: string
          job_id: string
          machine_id?: string | null
          note?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          step_name: string
          step_order: number
        }
        Update: {
          completed_at?: string | null
          id?: string
          job_id?: string
          machine_id?: string | null
          note?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          step_name?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_steps_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_steps_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          created_at: string
          customer_date: string | null
          export_date: string | null
          hours_override: number | null
          id: string
          machine_id: string | null
          notes: string | null
          odf: string
          operator_name: string | null
          pir: string | null
          planned_end: string | null
          planned_start: string | null
          po_halliburton: string | null
          po_musa: string | null
          priority: Database["public"]["Enums"]["job_priority"]
          qty: number
          status: Database["public"]["Enums"]["job_status"]
          tube_spec: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_date?: string | null
          export_date?: string | null
          hours_override?: number | null
          id?: string
          machine_id?: string | null
          notes?: string | null
          odf: string
          operator_name?: string | null
          pir?: string | null
          planned_end?: string | null
          planned_start?: string | null
          po_halliburton?: string | null
          po_musa?: string | null
          priority?: Database["public"]["Enums"]["job_priority"]
          qty?: number
          status?: Database["public"]["Enums"]["job_status"]
          tube_spec?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_date?: string | null
          export_date?: string | null
          hours_override?: number | null
          id?: string
          machine_id?: string | null
          notes?: string | null
          odf?: string
          operator_name?: string | null
          pir?: string | null
          planned_end?: string | null
          planned_start?: string | null
          po_halliburton?: string | null
          po_musa?: string | null
          priority?: Database["public"]["Enums"]["job_priority"]
          qty?: number
          status?: Database["public"]["Enums"]["job_status"]
          tube_spec?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          active_shifts: string[]
          created_at: string
          display_order: number
          hours_per_shift: number
          id: string
          name: string
          type: Database["public"]["Enums"]["machine_type"]
        }
        Insert: {
          active_shifts?: string[]
          created_at?: string
          display_order?: number
          hours_per_shift?: number
          id?: string
          name: string
          type?: Database["public"]["Enums"]["machine_type"]
        }
        Update: {
          active_shifts?: string[]
          created_at?: string
          display_order?: number
          hours_per_shift?: number
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["machine_type"]
        }
        Relationships: []
      }
      part_times: {
        Row: {
          created_at: string
          hours_per_piece: number
          id: string
          machine_id: string
          pir: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hours_per_piece: number
          id?: string
          machine_id: string
          pir: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hours_per_piece?: number
          id?: string
          machine_id?: string
          pir?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "part_times_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          available: boolean
          created_at: string
          date: string
          id: string
          job_id: string | null
          machine_id: string
          note: string | null
          slot: Database["public"]["Enums"]["shift_slot"]
        }
        Insert: {
          available?: boolean
          created_at?: string
          date: string
          id?: string
          job_id?: string | null
          machine_id: string
          note?: string | null
          slot: Database["public"]["Enums"]["shift_slot"]
        }
        Update: {
          available?: boolean
          created_at?: string
          date?: string
          id?: string
          job_id?: string | null
          machine_id?: string
          note?: string | null
          slot?: Database["public"]["Enums"]["shift_slot"]
        }
        Relationships: [
          {
            foreignKeyName: "shifts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      status_events: {
        Row: {
          created_at: string
          delay_hours: number | null
          event_kind: Database["public"]["Enums"]["event_kind"]
          from_status: Database["public"]["Enums"]["job_status"] | null
          id: string
          job_id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["job_status"]
        }
        Insert: {
          created_at?: string
          delay_hours?: number | null
          event_kind?: Database["public"]["Enums"]["event_kind"]
          from_status?: Database["public"]["Enums"]["job_status"] | null
          id?: string
          job_id: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["job_status"]
        }
        Update: {
          created_at?: string
          delay_hours?: number | null
          event_kind?: Database["public"]["Enums"]["event_kind"]
          from_status?: Database["public"]["Enums"]["job_status"] | null
          id?: string
          job_id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "status_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      event_kind:
        | "delay"
        | "priority_shift"
        | "absence"
        | "change_order"
        | "breakdown"
      job_priority: "low" | "normal" | "high" | "urgent"
      job_status:
        | "PLANNED"
        | "MAZAK"
        | "MAQUINADO_LISTO"
        | "CEMENTACION"
        | "EXPO"
        | "YA_SE_ENVIO"
      machine_type: "internal" | "external_shop"
      shift_slot: "manana" | "tarde" | "noche"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      event_kind: [
        "delay",
        "priority_shift",
        "absence",
        "change_order",
        "breakdown",
      ],
      job_priority: ["low", "normal", "high", "urgent"],
      job_status: [
        "PLANNED",
        "MAZAK",
        "MAQUINADO_LISTO",
        "CEMENTACION",
        "EXPO",
        "YA_SE_ENVIO",
      ],
      machine_type: ["internal", "external_shop"],
      shift_slot: ["manana", "tarde", "noche"],
    },
  },
} as const
