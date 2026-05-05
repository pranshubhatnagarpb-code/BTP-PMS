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
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          appointment_type: string
          client_id: string
          created_at: string
          google_event_id: string | null
          google_synced_at: string | null
          id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          appointment_type?: string
          client_id: string
          created_at?: string
          google_event_id?: string | null
          google_synced_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          appointment_type?: string
          client_id?: string
          created_at?: string
          google_event_id?: string | null
          google_synced_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      blood_report_values: {
        Row: {
          calcium: number | null
          created_at: string
          creatinine: number | null
          fasting_blood_sugar: number | null
          ferritin: number | null
          hba1c: number | null
          hdl: number | null
          hemoglobin: number | null
          id: string
          iron: number | null
          ldl: number | null
          notes: string | null
          postprandial_blood_sugar: number | null
          report_id: string
          total_cholesterol: number | null
          triglycerides: number | null
          tsh: number | null
          updated_at: string
          uric_acid: number | null
          vitamin_b12: number | null
          vitamin_d: number | null
          vldl: number | null
        }
        Insert: {
          calcium?: number | null
          created_at?: string
          creatinine?: number | null
          fasting_blood_sugar?: number | null
          ferritin?: number | null
          hba1c?: number | null
          hdl?: number | null
          hemoglobin?: number | null
          id?: string
          iron?: number | null
          ldl?: number | null
          notes?: string | null
          postprandial_blood_sugar?: number | null
          report_id: string
          total_cholesterol?: number | null
          triglycerides?: number | null
          tsh?: number | null
          updated_at?: string
          uric_acid?: number | null
          vitamin_b12?: number | null
          vitamin_d?: number | null
          vldl?: number | null
        }
        Update: {
          calcium?: number | null
          created_at?: string
          creatinine?: number | null
          fasting_blood_sugar?: number | null
          ferritin?: number | null
          hba1c?: number | null
          hdl?: number | null
          hemoglobin?: number | null
          id?: string
          iron?: number | null
          ldl?: number | null
          notes?: string | null
          postprandial_blood_sugar?: number | null
          report_id?: string
          total_cholesterol?: number | null
          triglycerides?: number | null
          tsh?: number | null
          updated_at?: string
          uric_acid?: number | null
          vitamin_b12?: number | null
          vitamin_d?: number | null
          vldl?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blood_report_values_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "blood_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      blood_reports: {
        Row: {
          client_id: string
          created_at: string
          id: string
          lab_name: string | null
          notes: string | null
          report_date: string
          source_file_name: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          lab_name?: string | null
          notes?: string | null
          report_date: string
          source_file_name?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          lab_name?: string | null
          notes?: string | null
          report_date?: string
          source_file_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blood_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      body_measurements: {
        Row: {
          arm: number | null
          bmi: number | null
          body_fat_percent: number | null
          calf: number | null
          chest: number | null
          client_id: string
          created_at: string
          hip: number | null
          id: string
          measurement_date: string
          neck: number | null
          notes: string | null
          thigh: number | null
          updated_at: string
          waist: number | null
          weight: number | null
        }
        Insert: {
          arm?: number | null
          bmi?: number | null
          body_fat_percent?: number | null
          calf?: number | null
          chest?: number | null
          client_id: string
          created_at?: string
          hip?: number | null
          id?: string
          measurement_date: string
          neck?: number | null
          notes?: string | null
          thigh?: number | null
          updated_at?: string
          waist?: number | null
          weight?: number | null
        }
        Update: {
          arm?: number | null
          bmi?: number | null
          body_fat_percent?: number | null
          calf?: number | null
          chest?: number | null
          client_id?: string
          created_at?: string
          hip?: number | null
          id?: string
          measurement_date?: string
          neck?: number | null
          notes?: string | null
          thigh?: number | null
          updated_at?: string
          waist?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "body_measurements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          anniversary_date: string | null
          created_at: string
          date_of_birth: string | null
          diet_preference: string | null
          email: string | null
          employee_id: string | null
          gender: string | null
          goal: string | null
          hair_type: string | null
          health_conditions: string[] | null
          height: number | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          number_of_diet_charts: number | null
          pause_end_date: string | null
          pause_start_date: string | null
          phone: string | null
          service_duration_months: number | null
          service_paused_days: number
          service_start_date: string | null
          skin_type: string | null
          supplements: string | null
          total_fees: number | null
          total_receivables: number | null
          updated_at: string
          weight: number | null
        }
        Insert: {
          address?: string | null
          anniversary_date?: string | null
          created_at?: string
          date_of_birth?: string | null
          diet_preference?: string | null
          email?: string | null
          employee_id?: string | null
          gender?: string | null
          goal?: string | null
          hair_type?: string | null
          health_conditions?: string[] | null
          height?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          number_of_diet_charts?: number | null
          pause_end_date?: string | null
          pause_start_date?: string | null
          phone?: string | null
          service_duration_months?: number | null
          service_paused_days?: number
          service_start_date?: string | null
          skin_type?: string | null
          supplements?: string | null
          total_fees?: number | null
          total_receivables?: number | null
          updated_at?: string
          weight?: number | null
        }
        Update: {
          address?: string | null
          anniversary_date?: string | null
          created_at?: string
          date_of_birth?: string | null
          diet_preference?: string | null
          email?: string | null
          employee_id?: string | null
          gender?: string | null
          goal?: string | null
          hair_type?: string | null
          health_conditions?: string[] | null
          height?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          number_of_diet_charts?: number | null
          pause_end_date?: string | null
          pause_start_date?: string | null
          phone?: string | null
          service_duration_months?: number | null
          service_paused_days?: number
          service_start_date?: string | null
          skin_type?: string | null
          supplements?: string | null
          total_fees?: number | null
          total_receivables?: number | null
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_chart_templates: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          instructions: string | null
          name: string
          template_data: Json
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          instructions?: string | null
          name: string
          template_data?: Json
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          instructions?: string | null
          name?: string
          template_data?: Json
          updated_at?: string
        }
        Relationships: []
      }
      diet_options: {
        Row: {
          calories: number
          category: string
          created_at: string
          description: string | null
          id: string
          is_vegetarian: boolean
          meal_type: string
          name: string
        }
        Insert: {
          calories?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_vegetarian?: boolean
          meal_type: string
          name: string
        }
        Update: {
          calories?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_vegetarian?: boolean
          meal_type?: string
          name?: string
        }
        Relationships: []
      }
      diet_plan_days: {
        Row: {
          breakfast_option_id: string | null
          created_at: string
          day_label: string
          diet_plan_id: string
          dinner_option_id: string | null
          id: string
          lunch_option_id: string | null
          notes: string | null
          snacks_option_id: string | null
          sort_order: number | null
          total_calories: number | null
        }
        Insert: {
          breakfast_option_id?: string | null
          created_at?: string
          day_label: string
          diet_plan_id: string
          dinner_option_id?: string | null
          id?: string
          lunch_option_id?: string | null
          notes?: string | null
          snacks_option_id?: string | null
          sort_order?: number | null
          total_calories?: number | null
        }
        Update: {
          breakfast_option_id?: string | null
          created_at?: string
          day_label?: string
          diet_plan_id?: string
          dinner_option_id?: string | null
          id?: string
          lunch_option_id?: string | null
          notes?: string | null
          snacks_option_id?: string | null
          sort_order?: number | null
          total_calories?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "diet_plan_days_breakfast_option_id_fkey"
            columns: ["breakfast_option_id"]
            isOneToOne: false
            referencedRelation: "diet_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diet_plan_days_diet_plan_id_fkey"
            columns: ["diet_plan_id"]
            isOneToOne: false
            referencedRelation: "diet_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diet_plan_days_dinner_option_id_fkey"
            columns: ["dinner_option_id"]
            isOneToOne: false
            referencedRelation: "diet_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diet_plan_days_lunch_option_id_fkey"
            columns: ["lunch_option_id"]
            isOneToOne: false
            referencedRelation: "diet_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diet_plan_days_snacks_option_id_fkey"
            columns: ["snacks_option_id"]
            isOneToOne: false
            referencedRelation: "diet_options"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_plans: {
        Row: {
          ai_plan_data: Json | null
          client_id: string
          created_at: string
          custom_title: string | null
          end_date: string | null
          id: string
          instructions: string | null
          is_ai_generated: boolean | null
          plan_name: string
          start_date: string | null
          status: string
          updated_at: string
          week_number: number | null
        }
        Insert: {
          ai_plan_data?: Json | null
          client_id: string
          created_at?: string
          custom_title?: string | null
          end_date?: string | null
          id?: string
          instructions?: string | null
          is_ai_generated?: boolean | null
          plan_name: string
          start_date?: string | null
          status?: string
          updated_at?: string
          week_number?: number | null
        }
        Update: {
          ai_plan_data?: Json | null
          client_id?: string
          created_at?: string
          custom_title?: string | null
          end_date?: string | null
          id?: string
          instructions?: string | null
          is_ai_generated?: boolean | null
          plan_name?: string
          start_date?: string | null
          status?: string
          updated_at?: string
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "diet_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          department: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_followups: {
        Row: {
          client_id: string | null
          created_at: string
          email: string | null
          followup_date: string
          followup_time: string | null
          id: string
          lead_name: string
          notes: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          email?: string | null
          followup_date: string
          followup_time?: string | null
          id?: string
          lead_name: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          email?: string | null
          followup_date?: string
          followup_time?: string | null
          id?: string
          lead_name?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_followups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      receivables: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          due_date: string
          id: string
          notes: string | null
          paid_amount: number | null
          service_name: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          due_date: string
          id?: string
          notes?: string | null
          paid_amount?: number | null
          service_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_amount?: number | null
          service_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivables_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
    Enums: {},
  },
} as const
