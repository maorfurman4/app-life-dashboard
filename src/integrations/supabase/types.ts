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
      achievements: {
        Row: {
          achieved_at: string
          achievement_key: string
          id: string
          user_id: string
          xp_earned: number
        }
        Insert: {
          achieved_at?: string
          achievement_key: string
          id?: string
          user_id: string
          xp_earned?: number
        }
        Update: {
          achieved_at?: string
          achievement_key?: string
          id?: string
          user_id?: string
          xp_earned?: number
        }
        Relationships: []
      }
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      body_progress: {
        Row: {
          angle: string | null
          created_at: string
          date: string
          id: string
          notes: string | null
          photo_url: string
          user_id: string
        }
        Insert: {
          angle?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          photo_url: string
          user_id: string
        }
        Update: {
          angle?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          photo_url?: string
          user_id?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          barcode: string | null
          category: string | null
          code: string | null
          created_at: string | null
          discount_amount: number | null
          discount_percent: number | null
          expiry_date: string | null
          id: string
          image_url: string | null
          is_used: boolean | null
          notes: string | null
          store: string | null
          title: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          barcode?: string | null
          category?: string | null
          code?: string | null
          created_at?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_used?: boolean | null
          notes?: string | null
          store?: string | null
          title: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          barcode?: string | null
          category?: string | null
          code?: string | null
          created_at?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_used?: boolean | null
          notes?: string | null
          store?: string | null
          title?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      debts: {
        Row: {
          annual_interest_rate: number
          created_at: string
          id: string
          is_active: boolean
          monthly_payment: number
          months_elapsed: number
          name: string
          principal: number
          type: string
          user_id: string
        }
        Insert: {
          annual_interest_rate?: number
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_payment?: number
          months_elapsed?: number
          name: string
          principal?: number
          type?: string
          user_id: string
        }
        Update: {
          annual_interest_rate?: number
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_payment?: number
          months_elapsed?: number
          name?: string
          principal?: number
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          budget_limit: number | null
          created_at: string
          icon: string | null
          id: string
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          budget_limit?: number | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          budget_limit?: number | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      expense_entries: {
        Row: {
          amount: number
          category: string
          created_at: string
          currency: string | null
          date: string
          description: string | null
          exchange_rate: number | null
          expense_type: string
          id: string
          is_recurring: boolean
          needs_review: boolean
          original_amount: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          currency?: string | null
          date?: string
          description?: string | null
          exchange_rate?: number | null
          expense_type?: string
          id?: string
          is_recurring?: boolean
          needs_review?: boolean
          original_amount?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          currency?: string | null
          date?: string
          description?: string | null
          exchange_rate?: number | null
          expense_type?: string
          id?: string
          is_recurring?: boolean
          needs_review?: boolean
          original_amount?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expense_splits: {
        Row: {
          created_at: string | null
          currency: string
          description: string
          id: string
          participants: Json
          total_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          currency?: string
          description: string
          id?: string
          participants?: Json
          total_amount: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          currency?: string
          description?: string
          id?: string
          participants?: Json
          total_amount?: number
          user_id?: string
        }
        Relationships: []
      }
      favorite_meals: {
        Row: {
          calories: number | null
          carbs_g: number | null
          created_at: string
          fat_g: number | null
          id: string
          name: string
          protein_g: number | null
          user_id: string
        }
        Insert: {
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          fat_g?: number | null
          id?: string
          name: string
          protein_g?: number | null
          user_id: string
        }
        Update: {
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          fat_g?: number | null
          id?: string
          name?: string
          protein_g?: number | null
          user_id?: string
        }
        Relationships: []
      }
      fixed_expenses: {
        Row: {
          amount: number
          category: string
          charge_day: number
          created_at: string
          due_day: number | null
          id: string
          is_active: boolean
          is_recurring: boolean
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string
          charge_day?: number
          created_at?: string
          due_day?: number | null
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          charge_day?: number
          created_at?: string
          due_day?: number | null
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fixed_income: {
        Row: {
          amount: number
          category: string
          created_at: string
          day_of_month: number
          id: string
          is_active: boolean
          name: string
          notes: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          day_of_month?: number
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          day_of_month?: number
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      grocery_items: {
        Row: {
          barcode: string | null
          created_at: string | null
          id: string
          is_checked: boolean | null
          list_id: string | null
          name: string
          quantity: number | null
          unit: string | null
          user_id: string
        }
        Insert: {
          barcode?: string | null
          created_at?: string | null
          id?: string
          is_checked?: boolean | null
          list_id?: string | null
          name: string
          quantity?: number | null
          unit?: string | null
          user_id: string
        }
        Update: {
          barcode?: string | null
          created_at?: string | null
          id?: string
          is_checked?: boolean | null
          list_id?: string | null
          name?: string
          quantity?: number | null
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grocery_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "grocery_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      grocery_lists: {
        Row: {
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      income_entries: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string | null
          id: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      market_alerts: {
        Row: {
          created_at: string | null
          direction: string
          id: string
          is_triggered: boolean
          symbol: string
          target_price: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          direction: string
          id?: string
          is_triggered?: boolean
          symbol: string
          target_price: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          direction?: string
          id?: string
          is_triggered?: boolean
          symbol?: string
          target_price?: number
          user_id?: string
        }
        Relationships: []
      }
      market_watchlist: {
        Row: {
          created_at: string | null
          id: string
          symbol: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          symbol: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_plan_templates: {
        Row: {
          created_at: string
          diet_type: string | null
          id: string
          name: string
          plan_data: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          diet_type?: string | null
          id?: string
          name: string
          plan_data: Json
          user_id: string
        }
        Update: {
          created_at?: string
          diet_type?: string | null
          id?: string
          name?: string
          plan_data?: Json
          user_id?: string
        }
        Relationships: []
      }
      monthly_snapshots: {
        Row: {
          balance: number
          category_breakdown: Json | null
          created_at: string | null
          id: string
          month: number
          savings_pct: number
          snapshot_data: Json | null
          total_expenses: number
          total_income: number
          user_id: string
          year: number
        }
        Insert: {
          balance?: number
          category_breakdown?: Json | null
          created_at?: string | null
          id?: string
          month: number
          savings_pct?: number
          snapshot_data?: Json | null
          total_expenses?: number
          total_income?: number
          user_id: string
          year: number
        }
        Update: {
          balance?: number
          category_breakdown?: Json | null
          created_at?: string | null
          id?: string
          month?: number
          savings_pct?: number
          snapshot_data?: Json | null
          total_expenses?: number
          total_income?: number
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          budget_alerts: boolean
          nutrition_reminder: boolean
          streak_alerts: boolean
          user_id: string
          workout_reminder: boolean
          workout_reminder_time: string
        }
        Insert: {
          budget_alerts?: boolean
          nutrition_reminder?: boolean
          streak_alerts?: boolean
          user_id: string
          workout_reminder?: boolean
          workout_reminder_time?: string
        }
        Update: {
          budget_alerts?: boolean
          nutrition_reminder?: boolean
          streak_alerts?: boolean
          user_id?: string
          workout_reminder?: boolean
          workout_reminder_time?: string
        }
        Relationships: []
      }
      nutrition_entries: {
        Row: {
          calories: number | null
          carbs_g: number | null
          created_at: string
          date: string
          fat_g: number | null
          id: string
          meal_type: string
          name: string
          notes: string | null
          protein_g: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          date?: string
          fat_g?: number | null
          id?: string
          meal_type: string
          name: string
          notes?: string | null
          protein_g?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          date?: string
          fat_g?: number | null
          id?: string
          meal_type?: string
          name?: string
          notes?: string | null
          protein_g?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payslip_uploads: {
        Row: {
          created_at: string | null
          extracted_data: Json | null
          file_name: string | null
          file_url: string
          id: string
          upload_month: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          extracted_data?: Json | null
          file_name?: string | null
          file_url: string
          id?: string
          upload_month?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          extracted_data?: Json | null
          file_name?: string | null
          file_url?: string
          id?: string
          upload_month?: string | null
          user_id?: string
        }
        Relationships: []
      }
      personal_records: {
        Row: {
          category: string
          created_at: string
          date: string
          exercise_name: string
          id: string
          notes: string | null
          unit: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          category?: string
          created_at?: string
          date?: string
          exercise_name: string
          id?: string
          notes?: string | null
          unit?: string
          updated_at?: string
          user_id: string
          value: number
        }
        Update: {
          category?: string
          created_at?: string
          date?: string
          exercise_name?: string
          id?: string
          notes?: string | null
          unit?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          keys: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          keys: Json
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          keys?: Json
          user_id?: string
        }
        Relationships: []
      }
      savings_goals: {
        Row: {
          created_at: string | null
          current_amount: number
          deadline: string | null
          emoji: string | null
          id: string
          target_amount: number
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_amount?: number
          deadline?: string | null
          emoji?: string | null
          id?: string
          target_amount: number
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_amount?: number
          deadline?: string | null
          emoji?: string | null
          id?: string
          target_amount?: number
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      stock_holdings: {
        Row: {
          avg_price: number
          created_at: string
          currency: string
          id: string
          name: string | null
          shares: number
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_price: number
          created_at?: string
          currency?: string
          id?: string
          name?: string | null
          shares: number
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_price?: number
          created_at?: string
          currency?: string
          id?: string
          name?: string | null
          shares?: number
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_projects: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          project_id: string | null
          sort_order: number | null
          status: string | null
          title: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          project_id?: string | null
          sort_order?: number | null
          status?: string | null
          title: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          project_id?: string | null
          sort_order?: number | null
          status?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "task_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tdee_history: {
        Row: {
          carbs: number | null
          created_at: string | null
          deficit_kcal: number | null
          fat: number | null
          id: string
          protein: number | null
          target_calories: number | null
          tdee: number | null
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          carbs?: number | null
          created_at?: string | null
          deficit_kcal?: number | null
          fat?: number | null
          id?: string
          protein?: number | null
          target_calories?: number | null
          tdee?: number | null
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          carbs?: number | null
          created_at?: string | null
          deficit_kcal?: number | null
          fat?: number | null
          id?: string
          protein?: number | null
          target_calories?: number | null
          tdee?: number | null
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      user_fitness_profile: {
        Row: {
          age: number | null
          avoided_muscles: string[] | null
          blacklisted_exercises: string[] | null
          favorite_exercises: string[] | null
          fitness_level: string | null
          gender: string | null
          preferred_muscles: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          age?: number | null
          avoided_muscles?: string[] | null
          blacklisted_exercises?: string[] | null
          favorite_exercises?: string[] | null
          fitness_level?: string | null
          gender?: string | null
          preferred_muscles?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          age?: number | null
          avoided_muscles?: string[] | null
          blacklisted_exercises?: string[] | null
          favorite_exercises?: string[] | null
          fitness_level?: string | null
          gender?: string | null
          preferred_muscles?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_profile: {
        Row: {
          age: number | null
          city: string | null
          created_at: string | null
          diet_type: string | null
          food_allergies: string[] | null
          full_name: string | null
          gender: string | null
          height_cm: number | null
          id: string
          interest_topics: string[] | null
          investment_level: string | null
          investment_types: string[] | null
          invests_in_market: boolean | null
          macro_preference: string | null
          monthly_budget: number | null
          monthly_income: number | null
          muscle_focus: string[] | null
          onboarding_completed: boolean | null
          physical_limitations: string[] | null
          savings_goal_percent: number | null
          sport_frequency: string | null
          sport_goals: string[] | null
          sport_level: string | null
          sport_location: string | null
          sport_types: string[] | null
          target_weight_kg: number | null
          updated_at: string | null
          weight_kg: number | null
        }
        Insert: {
          age?: number | null
          city?: string | null
          created_at?: string | null
          diet_type?: string | null
          food_allergies?: string[] | null
          full_name?: string | null
          gender?: string | null
          height_cm?: number | null
          id: string
          interest_topics?: string[] | null
          investment_level?: string | null
          investment_types?: string[] | null
          invests_in_market?: boolean | null
          macro_preference?: string | null
          monthly_budget?: number | null
          monthly_income?: number | null
          muscle_focus?: string[] | null
          onboarding_completed?: boolean | null
          physical_limitations?: string[] | null
          savings_goal_percent?: number | null
          sport_frequency?: string | null
          sport_goals?: string[] | null
          sport_level?: string | null
          sport_location?: string | null
          sport_types?: string[] | null
          target_weight_kg?: number | null
          updated_at?: string | null
          weight_kg?: number | null
        }
        Update: {
          age?: number | null
          city?: string | null
          created_at?: string | null
          diet_type?: string | null
          food_allergies?: string[] | null
          full_name?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          interest_topics?: string[] | null
          investment_level?: string | null
          investment_types?: string[] | null
          invests_in_market?: boolean | null
          macro_preference?: string | null
          monthly_budget?: number | null
          monthly_income?: number | null
          muscle_focus?: string[] | null
          onboarding_completed?: boolean | null
          physical_limitations?: string[] | null
          savings_goal_percent?: number | null
          sport_frequency?: string | null
          sport_goals?: string[] | null
          sport_level?: string | null
          sport_location?: string | null
          sport_types?: string[] | null
          target_weight_kg?: number | null
          updated_at?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          alt_hourly_rate: number | null
          base_hourly_rate: number | null
          briefing_allowance: number | null
          briefing_per_shift: number | null
          created_at: string
          daily_calories_goal: number | null
          daily_carbs_goal: number | null
          daily_fat_goal: number | null
          daily_protein_goal: number | null
          daily_water_glasses_goal: number | null
          daily_water_ml: number | null
          date_of_birth: string | null
          education_fund_pct: number | null
          excellence_per_hour: number | null
          extra_harel_pct: number | null
          favorite_exercises: string[]
          full_name: string | null
          google_calendar_token: string | null
          harel_savings_pct: number | null
          harel_study_pct: number | null
          harel_travel_pct: number | null
          health_insurance_pct: number | null
          height_cm: number | null
          hidden_exercises: string[]
          hidden_modules: Json | null
          hourly_rate: number | null
          id: string
          income_sync_mode: string | null
          lunch_deduction: number | null
          national_insurance_pct: number | null
          overtime_enabled: boolean | null
          pension_deduction_pct: number | null
          preferred_language: string | null
          recovery_per_hour: number | null
          savings_goal_amount: number | null
          savings_goal_pct: number | null
          shabbat_holiday_multiplier: number | null
          shabbat_hourly_rate: number | null
          shift_manager_rate: number | null
          shoulder_sensitivity: boolean | null
          sport_favorites: Json | null
          training_day_calories: number | null
          training_day_protein: number | null
          travel_allowance: number | null
          travel_per_shift: number | null
          union_deduction_pct: number | null
          union_national_deduction: number | null
          updated_at: string
          user_id: string
          weekly_calories_burn_goal: number | null
          weekly_minutes_goal: number | null
          weekly_workouts_goal: number | null
          weight_kg: number | null
          work_role: string | null
        }
        Insert: {
          alt_hourly_rate?: number | null
          base_hourly_rate?: number | null
          briefing_allowance?: number | null
          briefing_per_shift?: number | null
          created_at?: string
          daily_calories_goal?: number | null
          daily_carbs_goal?: number | null
          daily_fat_goal?: number | null
          daily_protein_goal?: number | null
          daily_water_glasses_goal?: number | null
          daily_water_ml?: number | null
          date_of_birth?: string | null
          education_fund_pct?: number | null
          excellence_per_hour?: number | null
          extra_harel_pct?: number | null
          favorite_exercises?: string[]
          full_name?: string | null
          google_calendar_token?: string | null
          harel_savings_pct?: number | null
          harel_study_pct?: number | null
          harel_travel_pct?: number | null
          health_insurance_pct?: number | null
          height_cm?: number | null
          hidden_exercises?: string[]
          hidden_modules?: Json | null
          hourly_rate?: number | null
          id?: string
          income_sync_mode?: string | null
          lunch_deduction?: number | null
          national_insurance_pct?: number | null
          overtime_enabled?: boolean | null
          pension_deduction_pct?: number | null
          preferred_language?: string | null
          recovery_per_hour?: number | null
          savings_goal_amount?: number | null
          savings_goal_pct?: number | null
          shabbat_holiday_multiplier?: number | null
          shabbat_hourly_rate?: number | null
          shift_manager_rate?: number | null
          shoulder_sensitivity?: boolean | null
          sport_favorites?: Json | null
          training_day_calories?: number | null
          training_day_protein?: number | null
          travel_allowance?: number | null
          travel_per_shift?: number | null
          union_deduction_pct?: number | null
          union_national_deduction?: number | null
          updated_at?: string
          user_id: string
          weekly_calories_burn_goal?: number | null
          weekly_minutes_goal?: number | null
          weekly_workouts_goal?: number | null
          weight_kg?: number | null
          work_role?: string | null
        }
        Update: {
          alt_hourly_rate?: number | null
          base_hourly_rate?: number | null
          briefing_allowance?: number | null
          briefing_per_shift?: number | null
          created_at?: string
          daily_calories_goal?: number | null
          daily_carbs_goal?: number | null
          daily_fat_goal?: number | null
          daily_protein_goal?: number | null
          daily_water_glasses_goal?: number | null
          daily_water_ml?: number | null
          date_of_birth?: string | null
          education_fund_pct?: number | null
          excellence_per_hour?: number | null
          extra_harel_pct?: number | null
          favorite_exercises?: string[]
          full_name?: string | null
          google_calendar_token?: string | null
          harel_savings_pct?: number | null
          harel_study_pct?: number | null
          harel_travel_pct?: number | null
          health_insurance_pct?: number | null
          height_cm?: number | null
          hidden_exercises?: string[]
          hidden_modules?: Json | null
          hourly_rate?: number | null
          id?: string
          income_sync_mode?: string | null
          lunch_deduction?: number | null
          national_insurance_pct?: number | null
          overtime_enabled?: boolean | null
          pension_deduction_pct?: number | null
          preferred_language?: string | null
          recovery_per_hour?: number | null
          savings_goal_amount?: number | null
          savings_goal_pct?: number | null
          shabbat_holiday_multiplier?: number | null
          shabbat_hourly_rate?: number | null
          shift_manager_rate?: number | null
          shoulder_sensitivity?: boolean | null
          sport_favorites?: Json | null
          training_day_calories?: number | null
          training_day_protein?: number | null
          travel_allowance?: number | null
          travel_per_shift?: number | null
          union_deduction_pct?: number | null
          union_national_deduction?: number | null
          updated_at?: string
          user_id?: string
          weekly_calories_burn_goal?: number | null
          weekly_minutes_goal?: number | null
          weekly_workouts_goal?: number | null
          weight_kg?: number | null
          work_role?: string | null
        }
        Relationships: []
      }
      user_streaks: {
        Row: {
          current_streak: number
          id: string
          last_activity_date: string | null
          longest_streak: number
          streak_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          streak_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          streak_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_xp: {
        Row: {
          id: string
          level: number
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          level?: number
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          level?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      water_entries: {
        Row: {
          created_at: string
          date: string
          glasses: number
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          glasses?: number
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          glasses?: number
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      weight_entries: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          user_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          user_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          user_id?: string
          weight_kg?: number
        }
        Relationships: []
      }
      work_monthly_history: {
        Row: {
          breakdown_by_type: Json | null
          created_at: string | null
          id: string
          month: number
          shifts_snapshot: Json | null
          total_gross_pay: number
          total_hours: number
          total_shifts: number
          user_id: string
          year: number
        }
        Insert: {
          breakdown_by_type?: Json | null
          created_at?: string | null
          id?: string
          month: number
          shifts_snapshot?: Json | null
          total_gross_pay?: number
          total_hours?: number
          total_shifts?: number
          user_id: string
          year: number
        }
        Update: {
          breakdown_by_type?: Json | null
          created_at?: string | null
          id?: string
          month?: number
          shifts_snapshot?: Json | null
          total_gross_pay?: number
          total_hours?: number
          total_shifts?: number
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      work_shifts: {
        Row: {
          actual_salary: number | null
          created_at: string
          date: string
          end_time: string | null
          has_briefing: boolean
          hours: number | null
          id: string
          is_shabbat_holiday: boolean
          notes: string | null
          role: string
          start_time: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_salary?: number | null
          created_at?: string
          date?: string
          end_time?: string | null
          has_briefing?: boolean
          hours?: number | null
          id?: string
          is_shabbat_holiday?: boolean
          notes?: string | null
          role?: string
          start_time?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_salary?: number | null
          created_at?: string
          date?: string
          end_time?: string | null
          has_briefing?: boolean
          hours?: number | null
          id?: string
          is_shabbat_holiday?: boolean
          notes?: string | null
          role?: string
          start_time?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_exercises: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          is_warmup: boolean
          name: string
          notes: string | null
          reps: number | null
          sets: number | null
          sets_data: Json | null
          user_id: string
          weight_kg: number | null
          workout_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_warmup?: boolean
          name: string
          notes?: string | null
          reps?: number | null
          sets?: number | null
          sets_data?: Json | null
          user_id: string
          weight_kg?: number | null
          workout_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_warmup?: boolean
          name?: string
          notes?: string | null
          reps?: number | null
          sets?: number | null
          sets_data?: Json | null
          user_id?: string
          weight_kg?: number | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plans: {
        Row: {
          created_at: string | null
          deload_week: Json | null
          goal: string | null
          id: string
          level: string | null
          name: string
          split_type: string | null
          tips: string[] | null
          user_id: string
          weeks: Json
        }
        Insert: {
          created_at?: string | null
          deload_week?: Json | null
          goal?: string | null
          id?: string
          level?: string | null
          name: string
          split_type?: string | null
          tips?: string[] | null
          user_id: string
          weeks?: Json
        }
        Update: {
          created_at?: string | null
          deload_week?: Json | null
          goal?: string | null
          id?: string
          level?: string | null
          name?: string
          split_type?: string | null
          tips?: string[] | null
          user_id?: string
          weeks?: Json
        }
        Relationships: []
      }
      workout_runs: {
        Row: {
          created_at: string
          distance_km: number | null
          duration_minutes: number | null
          id: string
          notes: string | null
          pace_per_km: number | null
          user_id: string
          workout_id: string
        }
        Insert: {
          created_at?: string
          distance_km?: number | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          pace_per_km?: number | null
          user_id: string
          workout_id: string
        }
        Update: {
          created_at?: string
          distance_km?: number | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          pace_per_km?: number | null
          user_id?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_runs_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_templates: {
        Row: {
          category: string
          created_at: string
          estimated_calories: number | null
          estimated_duration_minutes: number | null
          exercises: Json
          id: string
          is_system: boolean
          name: string
          notes: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          estimated_calories?: number | null
          estimated_duration_minutes?: number | null
          exercises?: Json
          id?: string
          is_system?: boolean
          name: string
          notes?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          estimated_calories?: number | null
          estimated_duration_minutes?: number | null
          exercises?: Json
          id?: string
          is_system?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      workouts: {
        Row: {
          calories_burned: number | null
          category: string
          created_at: string
          date: string
          duration_minutes: number | null
          id: string
          notes: string | null
          template_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          calories_burned?: number | null
          category: string
          created_at?: string
          date?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          template_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          calories_burned?: number | null
          category?: string
          created_at?: string
          date?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
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

