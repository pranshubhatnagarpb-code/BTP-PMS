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
      affiliate_products: {
        Row: {
          created_at: string
          id: string
          link: string
          product_name: string
          product_name_normalized: string
        }
        Insert: {
          created_at?: string
          id?: string
          link: string
          product_name: string
          product_name_normalized: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string
          product_name?: string
          product_name_normalized?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          appointment_type: string
          client_id: string
          clinic_location: string | null
          color: string | null
          duration_minutes: number
          title: string | null
          created_at: string
          diet_followup_done_at: string | null
          diet_followup_due_at: string | null
          google_event_id: string | null
          id: string
          meet_link: string | null
          meeting_mode: string
          notes: string | null
          outcome: string | null
          outcome_notes: string | null
          outcome_recorded_at: string | null
          status: string
          updated_at: string
          zoho_calendar_uid: string | null
          zoho_event_uid: string | null
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          appointment_type?: string
          client_id: string
          clinic_location?: string | null
          color?: string | null
          duration_minutes?: number
          title?: string | null
          created_at?: string
          diet_followup_done_at?: string | null
          diet_followup_due_at?: string | null
          google_event_id?: string | null
          id?: string
          meet_link?: string | null
          meeting_mode?: string
          notes?: string | null
          outcome?: string | null
          outcome_notes?: string | null
          outcome_recorded_at?: string | null
          status?: string
          updated_at?: string
          zoho_calendar_uid?: string | null
          zoho_event_uid?: string | null
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          appointment_type?: string
          client_id?: string
          clinic_location?: string | null
          color?: string | null
          duration_minutes?: number
          title?: string | null
          created_at?: string
          diet_followup_done_at?: string | null
          diet_followup_due_at?: string | null
          google_event_id?: string | null
          id?: string
          meet_link?: string | null
          meeting_mode?: string
          notes?: string | null
          outcome?: string | null
          outcome_notes?: string | null
          outcome_recorded_at?: string | null
          status?: string
          updated_at?: string
          zoho_calendar_uid?: string | null
          zoho_event_uid?: string | null
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
      blood_reports: {
        Row: {
          ai_analysis: Json | null
          ai_analysis_generated_at: string | null
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
          ai_analysis?: Json | null
          ai_analysis_generated_at?: string | null
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
          ai_analysis?: Json | null
          ai_analysis_generated_at?: string | null
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
      blood_report_values: {
        Row: {
          calcium: number | null
          creatinine: number | null
          created_at: string
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
          creatinine?: number | null
          created_at?: string
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
          creatinine?: number | null
          created_at?: string
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
      client_feedback: {
        Row: {
          client_id: string
          created_at: string
          feedback_text: string | null
          id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          feedback_text?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          feedback_text?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_feedback_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_users: {
        Row: {
          client_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_progress_entries: {
        Row: {
          acidity_rating: number | null
          activity_level: string | null
          appetite: string | null
          attention_rating: number | null
          blood_parameters: string[] | null
          bloating_rating: number | null
          breastfed: boolean | null
          breastfeeding_duration_months: number | null
          client_id: string
          constipation_rating: number | null
          created_at: string
          digestion_rating: number | null
          energy_rating: number | null
          entry_date: string
          fatigue_rating: number | null
          feeding_difficulties: string | null
          focus_rating: number | null
          formula_fed: boolean | null
          hair_rating: number | null
          height_cm: number | null
          id: string
          inflammation_concerns: boolean | null
          libido_rating: number | null
          meals_per_day: number | null
          medications: Json | null
          memory_rating: number | null
          notes: string | null
          packaged_food_frequency: string | null
          period_flow: string[] | null
          period_pain_severity: number | null
          periods_status: string | null
          pms_symptoms: string[] | null
          screen_time_hrs: number | null
          skin_rating: number | null
          sleep_hours: number | null
          sleep_quality_rating: number | null
          solids_start_age_months: number | null
          stamina_rating: number | null
          stress_rating: number | null
          testosterone_status: string | null
          updated_at: string
          water_intake: string | null
          weight_kg: number | null
        }
        Insert: {
          acidity_rating?: number | null
          activity_level?: string | null
          appetite?: string | null
          attention_rating?: number | null
          blood_parameters?: string[] | null
          bloating_rating?: number | null
          breastfed?: boolean | null
          breastfeeding_duration_months?: number | null
          client_id: string
          constipation_rating?: number | null
          created_at?: string
          digestion_rating?: number | null
          energy_rating?: number | null
          entry_date: string
          fatigue_rating?: number | null
          feeding_difficulties?: string | null
          focus_rating?: number | null
          formula_fed?: boolean | null
          hair_rating?: number | null
          height_cm?: number | null
          id?: string
          inflammation_concerns?: boolean | null
          libido_rating?: number | null
          meals_per_day?: number | null
          medications?: Json | null
          memory_rating?: number | null
          notes?: string | null
          packaged_food_frequency?: string | null
          period_flow?: string[] | null
          period_pain_severity?: number | null
          periods_status?: string | null
          pms_symptoms?: string[] | null
          screen_time_hrs?: number | null
          skin_rating?: number | null
          sleep_hours?: number | null
          sleep_quality_rating?: number | null
          solids_start_age_months?: number | null
          stamina_rating?: number | null
          stress_rating?: number | null
          testosterone_status?: string | null
          updated_at?: string
          water_intake?: string | null
          weight_kg?: number | null
        }
        Update: {
          acidity_rating?: number | null
          activity_level?: string | null
          appetite?: string | null
          attention_rating?: number | null
          blood_parameters?: string[] | null
          bloating_rating?: number | null
          breastfed?: boolean | null
          breastfeeding_duration_months?: number | null
          client_id?: string
          constipation_rating?: number | null
          created_at?: string
          digestion_rating?: number | null
          energy_rating?: number | null
          entry_date?: string
          fatigue_rating?: number | null
          feeding_difficulties?: string | null
          focus_rating?: number | null
          formula_fed?: boolean | null
          hair_rating?: number | null
          height_cm?: number | null
          id?: string
          inflammation_concerns?: boolean | null
          libido_rating?: number | null
          meals_per_day?: number | null
          medications?: Json | null
          memory_rating?: number | null
          notes?: string | null
          packaged_food_frequency?: string | null
          period_flow?: string[] | null
          period_pain_severity?: number | null
          periods_status?: string | null
          pms_symptoms?: string[] | null
          screen_time_hrs?: number | null
          skin_rating?: number | null
          sleep_hours?: number | null
          sleep_quality_rating?: number | null
          solids_start_age_months?: number | null
          stamina_rating?: number | null
          stress_rating?: number | null
          testosterone_status?: string | null
          updated_at?: string
          water_intake?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_progress_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_connections: {
        Row: {
          connected_email: string | null
          created_at: string
          id: string
          refresh_token: string
          updated_at: string
        }
        Insert: {
          connected_email?: string | null
          created_at?: string
          id?: string
          refresh_token: string
          updated_at?: string
        }
        Update: {
          connected_email?: string | null
          created_at?: string
          id?: string
          refresh_token?: string
          updated_at?: string
        }
        Relationships: []
      }
      intake_submissions: {
        Row: {
          age: number | null
          branch: string
          city: string | null
          created_at: string
          dob: string | null
          email: string | null
          full_name: string
          guardian_email: string | null
          guardian_name: string | null
          guardian_phone: string | null
          guardian_relationship: string | null
          id: string
          payload: Json
          phone: string | null
          pms_attempts: number
          pms_error: string | null
          pms_lead_id: string | null
          pms_sent_at: string | null
          pms_status: string
        }
        Insert: {
          age?: number | null
          branch: string
          city?: string | null
          created_at?: string
          dob?: string | null
          email?: string | null
          full_name: string
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_relationship?: string | null
          id?: string
          payload?: Json
          phone?: string | null
          pms_attempts?: number
          pms_error?: string | null
          pms_lead_id?: string | null
          pms_sent_at?: string | null
          pms_status?: string
        }
        Update: {
          age?: number | null
          branch?: string
          city?: string | null
          created_at?: string
          dob?: string | null
          email?: string | null
          full_name?: string
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_relationship?: string | null
          id?: string
          payload?: Json
          phone?: string | null
          pms_attempts?: number
          pms_error?: string | null
          pms_lead_id?: string | null
          pms_sent_at?: string | null
          pms_status?: string
        }
        Relationships: []
      }
      appointment_reschedules: {
        Row: {
          appointment_id: string
          id: string
          new_date: string
          new_time: string
          previous_date: string
          previous_time: string
          rescheduled_at: string
        }
        Insert: {
          appointment_id: string
          id?: string
          new_date: string
          new_time: string
          previous_date: string
          previous_time: string
          rescheduled_at?: string
        }
        Update: {
          appointment_id?: string
          id?: string
          new_date?: string
          new_time?: string
          previous_date?: string
          previous_time?: string
          rescheduled_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reschedules_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          client_id: string
          created_at: string
          id: string
          note: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          note: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address_as: string | null
          address: string | null
          anniversary_date: string | null
          category: string
          client_code: string | null
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
          service_paused_days: number | null
          service_start_date: string | null
          skin_type: string | null
          supplements: string | null
          total_fees: number | null
          total_receivables: number | null
          updated_at: string
          weight: number | null
        }
        Insert: {
          address_as?: string | null
          address?: string | null
          anniversary_date?: string | null
          category?: string
          client_code?: string | null
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
          service_paused_days?: number | null
          service_start_date?: string | null
          skin_type?: string | null
          supplements?: string | null
          total_fees?: number | null
          total_receivables?: number | null
          updated_at?: string
          weight?: number | null
        }
        Update: {
          address_as?: string | null
          address?: string | null
          anniversary_date?: string | null
          category?: string
          client_code?: string | null
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
          service_paused_days?: number | null
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
          reminder_done_day: number | null
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
          reminder_done_day?: number | null
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
          reminder_done_day?: number | null
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
      meal_recipes: {
        Row: {
          created_at: string
          id: string
          Ingredients: string
          Instructions: string
          Meal_name: string
          meal_name_normalized: string
          Remarks: string
          recipe_links: string[]
          category: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          Ingredients?: string
          Instructions: string
          Meal_name: string
          meal_name_normalized: string
          Remarks?: string
          recipe_links?: string[]
          category?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          Ingredients?: string
          Instructions?: string
          Meal_name?: string
          meal_name_normalized?: string
          Remarks?: string
          recipe_links?: string[]
          category?: string | null
        }
        Relationships: []
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
      supplements: {
        Row: {
          created_at: string
          directions: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          directions?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          directions?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      zoho_calendar_connections: {
        Row: {
          calendar_uid: string
          connected_email: string | null
          created_at: string
          id: string
          refresh_token: string
          updated_at: string
        }
        Insert: {
          calendar_uid: string
          connected_email?: string | null
          created_at?: string
          id?: string
          refresh_token: string
          updated_at?: string
        }
        Update: {
          calendar_uid?: string
          connected_email?: string | null
          created_at?: string
          id?: string
          refresh_token?: string
          updated_at?: string
        }
        Relationships: []
      }
      guides: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      guide_sends: {
        Row: {
          channel: string
          client_id: string
          created_at: string
          guide_id: string | null
          guide_title: string
          id: string
          notes: string | null
          sent_on: string
        }
        Insert: {
          channel?: string
          client_id: string
          created_at?: string
          guide_id?: string | null
          guide_title: string
          id?: string
          notes?: string | null
          sent_on?: string
        }
        Update: {
          channel?: string
          client_id?: string
          created_at?: string
          guide_id?: string | null
          guide_title?: string
          id?: string
          notes?: string | null
          sent_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_sends_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_sends_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      normalize_meal_recipe_name: {
        Args: { _meal_name: string }
        Returns: string
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
