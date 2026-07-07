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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity: {
        Row: {
          active_kcal: number | null
          activity_date: string
          created_at: string
          id: string
          source: string
          steps: number | null
          user_id: string
        }
        Insert: {
          active_kcal?: number | null
          activity_date: string
          created_at?: string
          id?: string
          source?: string
          steps?: number | null
          user_id: string
        }
        Update: {
          active_kcal?: number | null
          activity_date?: string
          created_at?: string
          id?: string
          source?: string
          steps?: number | null
          user_id?: string
        }
        Relationships: []
      }
      ai_call_log: {
        Row: {
          called_at: string
          estimated_cost_usd: number | null
          id: string
          meal_log_id: string | null
          model: string
          provider: string
          purpose: string
          user_id: string
        }
        Insert: {
          called_at?: string
          estimated_cost_usd?: number | null
          id?: string
          meal_log_id?: string | null
          model: string
          provider: string
          purpose: string
          user_id: string
        }
        Update: {
          called_at?: string
          estimated_cost_usd?: number | null
          id?: string
          meal_log_id?: string | null
          model?: string
          provider?: string
          purpose?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_call_log_meal_log_id_fkey"
            columns: ["meal_log_id"]
            isOneToOne: false
            referencedRelation: "meal_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      dish_calibration: {
        Row: {
          correction_multiplier: number
          dish_id: string
          sample_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          correction_multiplier?: number
          dish_id: string
          sample_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          correction_multiplier?: number
          dish_id?: string
          sample_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dish_calibration_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: true
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
        ]
      }
      dish_ingredients: {
        Row: {
          created_at: string
          dish_id: string
          grams: number
          id: string
          ingredient_name: string
          source_food_code: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          dish_id: string
          grams: number
          id?: string
          ingredient_name: string
          source_food_code?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          dish_id?: string
          grams?: number
          id?: string
          ingredient_name?: string
          source_food_code?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dish_ingredients_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dish_ingredients_source_food_code_fkey"
            columns: ["source_food_code"]
            isOneToOne: false
            referencedRelation: "wafct_ingredients"
            referencedColumns: ["food_code"]
          },
        ]
      }
      dishes: {
        Row: {
          calories_per_100g: number
          carbs_g_per_100g: number
          created_at: string
          embedding: string | null
          fat_g_per_100g: number
          fiber_g_per_100g: number | null
          id: string
          name: string
          name_local: string | null
          notes: string | null
          protein_g_per_100g: number
          reference_serving_g: number | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calories_per_100g: number
          carbs_g_per_100g?: number
          created_at?: string
          embedding?: string | null
          fat_g_per_100g?: number
          fiber_g_per_100g?: number | null
          id?: string
          name: string
          name_local?: string | null
          notes?: string | null
          protein_g_per_100g?: number
          reference_serving_g?: number | null
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calories_per_100g?: number
          carbs_g_per_100g?: number
          created_at?: string
          embedding?: string | null
          fat_g_per_100g?: number
          fiber_g_per_100g?: number | null
          id?: string
          name?: string
          name_local?: string | null
          notes?: string | null
          protein_g_per_100g?: number
          reference_serving_g?: number | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dishware: {
        Row: {
          created_at: string
          id: string
          name: string
          reference_fill_grams: number | null
          reference_photo_url: string | null
          reference_volume_ml: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          reference_fill_grams?: number | null
          reference_photo_url?: string | null
          reference_volume_ml?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          reference_fill_grams?: number | null
          reference_photo_url?: string | null
          reference_volume_ml?: number | null
          user_id?: string
        }
        Relationships: []
      }
      meal_logs: {
        Row: {
          calories: number
          carbs_g: number | null
          confirmed: boolean
          created_at: string
          dish_id: string | null
          dishware_id: string | null
          fat_g: number | null
          fiber_g: number | null
          id: string
          logged_at: string
          match_confidence: number | null
          photo_url: string | null
          portion_ratio: number | null
          protein_g: number | null
          raw_text_input: string | null
          source: string
          user_id: string
        }
        Insert: {
          calories: number
          carbs_g?: number | null
          confirmed?: boolean
          created_at?: string
          dish_id?: string | null
          dishware_id?: string | null
          fat_g?: number | null
          fiber_g?: number | null
          id?: string
          logged_at?: string
          match_confidence?: number | null
          photo_url?: string | null
          portion_ratio?: number | null
          protein_g?: number | null
          raw_text_input?: string | null
          source?: string
          user_id: string
        }
        Update: {
          calories?: number
          carbs_g?: number | null
          confirmed?: boolean
          created_at?: string
          dish_id?: string | null
          dishware_id?: string | null
          fat_g?: number | null
          fiber_g?: number | null
          id?: string
          logged_at?: string
          match_confidence?: number | null
          photo_url?: string | null
          portion_ratio?: number | null
          protein_g?: number | null
          raw_text_input?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_logs_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_logs_dishware_id_fkey"
            columns: ["dishware_id"]
            isOneToOne: false
            referencedRelation: "dishware"
            referencedColumns: ["id"]
          },
        ]
      }
      measurements: {
        Row: {
          created_at: string
          id: string
          logged_at: string
          measurement_type: string
          user_id: string
          value_cm: number
        }
        Insert: {
          created_at?: string
          id?: string
          logged_at?: string
          measurement_type: string
          user_id: string
          value_cm: number
        }
        Update: {
          created_at?: string
          id?: string
          logged_at?: string
          measurement_type?: string
          user_id?: string
          value_cm?: number
        }
        Relationships: []
      }
      user_profile: {
        Row: {
          activity_multiplier: number
          biological_sex: string | null
          birth_date: string | null
          goal: string | null
          height_cm: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_multiplier?: number
          biological_sex?: string | null
          birth_date?: string | null
          goal?: string | null
          height_cm?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_multiplier?: number
          biological_sex?: string | null
          birth_date?: string | null
          goal?: string | null
          height_cm?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wafct_ingredients: {
        Row: {
          calories_per_100g: number | null
          carbs_g_per_100g: number | null
          fat_g_per_100g: number | null
          fiber_g_per_100g: number | null
          food_code: string
          name_en: string
          name_fr: string | null
          protein_g_per_100g: number | null
        }
        Insert: {
          calories_per_100g?: number | null
          carbs_g_per_100g?: number | null
          fat_g_per_100g?: number | null
          fiber_g_per_100g?: number | null
          food_code: string
          name_en: string
          name_fr?: string | null
          protein_g_per_100g?: number | null
        }
        Update: {
          calories_per_100g?: number | null
          carbs_g_per_100g?: number | null
          fat_g_per_100g?: number | null
          fiber_g_per_100g?: number | null
          food_code?: string
          name_en?: string
          name_fr?: string | null
          protein_g_per_100g?: number | null
        }
        Relationships: []
      }
      water_logs: {
        Row: {
          amount_ml: number
          id: string
          logged_at: string
          user_id: string
        }
        Insert: {
          amount_ml: number
          id?: string
          logged_at?: string
          user_id: string
        }
        Update: {
          amount_ml?: number
          id?: string
          logged_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weigh_ins: {
        Row: {
          created_at: string
          id: string
          logged_at: string
          trend_weight_kg: number | null
          user_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          id?: string
          logged_at?: string
          trend_weight_kg?: number | null
          user_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          id?: string
          logged_at?: string
          trend_weight_kg?: number | null
          user_id?: string
          weight_kg?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_bmr: {
        Args: {
          age_years: number
          body_fat_pct?: number
          height_cm: number
          sex: string
          weight_kg: number
        }
        Returns: number
      }
      daily_nutrition_summary: {
        Args: {
          p_end: string
          p_start: string
          p_tz?: string
          p_user_id: string
        }
        Returns: {
          calories: number
          carbs_g: number
          day: string
          fat_g: number
          fiber_g: number
          meal_count: number
          protein_g: number
        }[]
      }
      estimate_body_fat_navy: {
        Args: {
          height_cm: number
          hip_cm?: number
          neck_cm: number
          sex?: string
          waist_cm: number
        }
        Returns: number
      }
      latest_body_fat_estimate: { Args: { p_user_id: string }; Returns: number }
      match_dish_by_embedding: {
        Args: {
          match_count?: number
          match_threshold?: number
          match_user_id: string
          query_embedding: string
        }
        Returns: {
          calories_per_100g: number
          carbs_g_per_100g: number
          fat_g_per_100g: number
          fiber_g_per_100g: number
          id: string
          name: string
          protein_g_per_100g: number
          reference_serving_g: number
          similarity: number
        }[]
      }
      recompute_weight_trend: { Args: { p_user_id: string }; Returns: undefined }
      weekly_energy_balance: {
        Args: { p_as_of?: string; p_user_id: string }
        Returns: {
          balance: number
          calories_in: number
          calories_out: number
          calories_out_source: string
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
