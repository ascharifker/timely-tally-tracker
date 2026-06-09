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
      customers: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      date_change_log: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by_peter: boolean
          changed_at: string
          changed_by: string | null
          field: string
          id: string
          job_id: string | null
          new_value: string | null
          old_value: string | null
          po_line_item_id: string | null
          reason: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by_peter?: boolean
          changed_at?: string
          changed_by?: string | null
          field: string
          id?: string
          job_id?: string | null
          new_value?: string | null
          old_value?: string | null
          po_line_item_id?: string | null
          reason?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by_peter?: boolean
          changed_at?: string
          changed_by?: string | null
          field?: string
          id?: string
          job_id?: string | null
          new_value?: string | null
          old_value?: string | null
          po_line_item_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "date_change_log_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "date_change_log_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_current_step"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "date_change_log_po_line_item_id_fkey"
            columns: ["po_line_item_id"]
            isOneToOne: false
            referencedRelation: "po_line_items"
            referencedColumns: ["id"]
          },
        ]
      }
      job_steps: {
        Row: {
          completed_at: string | null
          id: string
          job_id: string
          machine_id: string | null
          note: string | null
          planned_end: string | null
          planned_start: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          step_name: string
          step_order: number
          vendor_id: string | null
        }
        Insert: {
          completed_at?: string | null
          id?: string
          job_id: string
          machine_id?: string | null
          note?: string | null
          planned_end?: string | null
          planned_start?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          step_name: string
          step_order: number
          vendor_id?: string | null
        }
        Update: {
          completed_at?: string | null
          id?: string
          job_id?: string
          machine_id?: string | null
          note?: string | null
          planned_end?: string | null
          planned_start?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          step_name?: string
          step_order?: number
          vendor_id?: string | null
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
            foreignKeyName: "job_steps_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_current_step"
            referencedColumns: ["job_id"]
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
          po_line_item_id: string | null
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
          po_line_item_id?: string | null
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
          po_line_item_id?: string | null
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
          {
            foreignKeyName: "jobs_po_line_item_id_fkey"
            columns: ["po_line_item_id"]
            isOneToOne: false
            referencedRelation: "po_line_items"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_runs: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          job_id: string
          machine_id: string
          notes: string | null
          operator_name: string | null
          pieces_completed: number
          started_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          job_id: string
          machine_id: string
          notes?: string | null
          operator_name?: string | null
          pieces_completed?: number
          started_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          job_id?: string
          machine_id?: string
          notes?: string | null
          operator_name?: string | null
          pieces_completed?: number
          started_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      machines: {
        Row: {
          active_shifts: string[]
          created_at: string
          display_order: number
          hourly_cost: number
          hours_per_shift: number
          id: string
          image_url: string | null
          location: string | null
          model: string | null
          name: string
          notes: string | null
          purchase_date: string | null
          serial_number: string | null
          type: Database["public"]["Enums"]["machine_type"]
          vendor_id: string | null
          year: number | null
        }
        Insert: {
          active_shifts?: string[]
          created_at?: string
          display_order?: number
          hourly_cost?: number
          hours_per_shift?: number
          id?: string
          image_url?: string | null
          location?: string | null
          model?: string | null
          name: string
          notes?: string | null
          purchase_date?: string | null
          serial_number?: string | null
          type?: Database["public"]["Enums"]["machine_type"]
          vendor_id?: string | null
          year?: number | null
        }
        Update: {
          active_shifts?: string[]
          created_at?: string
          display_order?: number
          hourly_cost?: number
          hours_per_shift?: number
          id?: string
          image_url?: string | null
          location?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          purchase_date?: string | null
          serial_number?: string | null
          type?: Database["public"]["Enums"]["machine_type"]
          vendor_id?: string | null
          year?: number | null
        }
        Relationships: []
      }
      odf_sequences: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
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
      po_line_items: {
        Row: {
          committed_date: string | null
          created_at: string
          currency: string | null
          engineering_reviewed_at: string | null
          engineering_reviewed_by: string | null
          export_date: string | null
          flag_reason: string | null
          id: string
          line_number: number
          notes: string | null
          pir: string | null
          purchase_order_id: string
          qty_ordered: number
          status: Database["public"]["Enums"]["po_line_status"]
          tube_spec: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          committed_date?: string | null
          created_at?: string
          currency?: string | null
          engineering_reviewed_at?: string | null
          engineering_reviewed_by?: string | null
          export_date?: string | null
          flag_reason?: string | null
          id?: string
          line_number?: number
          notes?: string | null
          pir?: string | null
          purchase_order_id: string
          qty_ordered?: number
          status?: Database["public"]["Enums"]["po_line_status"]
          tube_spec?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          committed_date?: string | null
          created_at?: string
          currency?: string | null
          engineering_reviewed_at?: string | null
          engineering_reviewed_by?: string | null
          export_date?: string | null
          flag_reason?: string | null
          id?: string
          line_number?: number
          notes?: string | null
          pir?: string | null
          purchase_order_id?: string
          qty_ordered?: number
          status?: Database["public"]["Enums"]["po_line_status"]
          tube_spec?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_line_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          committed_date: string | null
          created_at: string
          customer_id: string
          id: string
          issued_date: string | null
          notes: string | null
          po_number: string
          review_track: Database["public"]["Enums"]["review_track"]
          source_document_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          committed_date?: string | null
          created_at?: string
          customer_id: string
          id?: string
          issued_date?: string | null
          notes?: string | null
          po_number: string
          review_track?: Database["public"]["Enums"]["review_track"]
          source_document_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          committed_date?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          issued_date?: string | null
          notes?: string | null
          po_number?: string
          review_track?: Database["public"]["Enums"]["review_track"]
          source_document_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      review_delegations: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          from_user_id: string
          id: string
          note: string | null
          start_date: string
          to_user_id: string
          track: Database["public"]["Enums"]["review_track"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          from_user_id: string
          id?: string
          note?: string | null
          start_date: string
          to_user_id: string
          track: Database["public"]["Enums"]["review_track"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          from_user_id?: string
          id?: string
          note?: string | null
          start_date?: string
          to_user_id?: string
          track?: Database["public"]["Enums"]["review_track"]
          updated_at?: string
        }
        Relationships: []
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
            foreignKeyName: "shifts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_current_step"
            referencedColumns: ["job_id"]
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
          cost: number | null
          created_at: string
          delay_hours: number | null
          ended_at: string | null
          event_kind: Database["public"]["Enums"]["event_kind"]
          from_status: Database["public"]["Enums"]["job_status"] | null
          id: string
          job_id: string | null
          machine_id: string | null
          reason: string | null
          started_at: string | null
          to_status: Database["public"]["Enums"]["job_status"]
        }
        Insert: {
          cost?: number | null
          created_at?: string
          delay_hours?: number | null
          ended_at?: string | null
          event_kind?: Database["public"]["Enums"]["event_kind"]
          from_status?: Database["public"]["Enums"]["job_status"] | null
          id?: string
          job_id?: string | null
          machine_id?: string | null
          reason?: string | null
          started_at?: string | null
          to_status: Database["public"]["Enums"]["job_status"]
        }
        Update: {
          cost?: number | null
          created_at?: string
          delay_hours?: number | null
          ended_at?: string | null
          event_kind?: Database["public"]["Enums"]["event_kind"]
          from_status?: Database["public"]["Enums"]["job_status"] | null
          id?: string
          job_id?: string | null
          machine_id?: string | null
          reason?: string | null
          started_at?: string | null
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
          {
            foreignKeyName: "status_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_current_step"
            referencedColumns: ["job_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          active: boolean
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          hourly_rate: number
          id: string
          lead_time_days_avg: number | null
          name: string
          notes: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          hourly_rate?: number
          id?: string
          lead_time_days_avg?: number | null
          name: string
          notes?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          hourly_rate?: number
          id?: string
          lead_time_days_avg?: number | null
          name?: string
          notes?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_job_current_step: {
        Row: {
          completed_at: string | null
          job_id: string | null
          machine_id: string | null
          planned_end: string | null
          planned_start: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"] | null
          step_id: string | null
          step_name: string | null
          step_order: number | null
          vendor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_steps_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_user_can_edit_po: { Args: { _po_id: string }; Returns: boolean }
      current_user_can_edit_production: { Args: never; Returns: boolean }
      has_active_delegation: {
        Args: {
          _track: Database["public"]["Enums"]["review_track"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_odf_number: { Args: { p_year: number }; Returns: string }
    }
    Enums: {
      app_role:
        | "admin"
        | "manager"
        | "po_editor"
        | "coe_reviewer"
        | "third_party_reviewer"
        | "production_editor"
        | "viewer"
      event_kind:
        | "delay"
        | "priority_shift"
        | "absence"
        | "change_order"
        | "breakdown"
        | "maintenance_preventive"
        | "maintenance_corrective"
      job_priority: "low" | "normal" | "high" | "urgent"
      job_status:
        | "PLANNED"
        | "MAZAK"
        | "TALLER_EXTERNO"
        | "MAQUINADO_LISTO"
        | "CEMENTACION"
        | "EXPO"
        | "YA_SE_ENVIO"
        | "EN_ESPERA"
        | "ON_HOLD"
        | "MAQYRO"
        | "EN_GEMAK"
        | "CEMENTACION_LISTO"
      machine_type: "internal" | "external_shop"
      po_line_status:
        | "pending_engineering"
        | "engineering_approved"
        | "engineering_flagged"
        | "ready_for_production"
        | "scheduled"
        | "in_progress"
        | "completed"
        | "cancelled"
      review_track: "coe" | "third_party" | "internal"
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
      app_role: [
        "admin",
        "manager",
        "po_editor",
        "coe_reviewer",
        "third_party_reviewer",
        "production_editor",
        "viewer",
      ],
      event_kind: [
        "delay",
        "priority_shift",
        "absence",
        "change_order",
        "breakdown",
        "maintenance_preventive",
        "maintenance_corrective",
      ],
      job_priority: ["low", "normal", "high", "urgent"],
      job_status: [
        "PLANNED",
        "MAZAK",
        "TALLER_EXTERNO",
        "MAQUINADO_LISTO",
        "CEMENTACION",
        "EXPO",
        "YA_SE_ENVIO",
        "EN_ESPERA",
        "ON_HOLD",
        "MAQYRO",
        "EN_GEMAK",
        "CEMENTACION_LISTO",
      ],
      machine_type: ["internal", "external_shop"],
      po_line_status: [
        "pending_engineering",
        "engineering_approved",
        "engineering_flagged",
        "ready_for_production",
        "scheduled",
        "in_progress",
        "completed",
        "cancelled",
      ],
      review_track: ["coe", "third_party", "internal"],
      shift_slot: ["manana", "tarde", "noche"],
    },
  },
} as const
