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
      allocations: {
        Row: {
          created_at: string
          delivery_status: string | null
          id: string
          ngo_id: string
          quantity: number
          source: string
          status: string
          surplus_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_status?: string | null
          id?: string
          ngo_id: string
          quantity?: number
          source?: string
          status: string
          surplus_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_status?: string | null
          id?: string
          ngo_id?: string
          quantity?: number
          source?: string
          status?: string
          surplus_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocations_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_surplus_id_fkey"
            columns: ["surplus_id"]
            isOneToOne: false
            referencedRelation: "surplus_food"
            referencedColumns: ["id"]
          },
        ]
      }
      food_assessments: {
        Row: {
          ai_estimated_quantity: number | null
          ai_estimated_weight: number | null
          analysis_mode: string
          assessment_note: string | null
          confirmation_status: string
          confirmed_at: string | null
          confirmed_quantity: number | null
          created_at: string
          food_name: string
          id: string
          image_reference: string | null
          kitchen_id: string
          message_id: string | null
          model: string | null
          quality_screening_status: string
          quantity_unit: string
        }
        Insert: {
          ai_estimated_quantity?: number | null
          ai_estimated_weight?: number | null
          analysis_mode?: string
          assessment_note?: string | null
          confirmation_status?: string
          confirmed_at?: string | null
          confirmed_quantity?: number | null
          created_at?: string
          food_name: string
          id?: string
          image_reference?: string | null
          kitchen_id: string
          message_id?: string | null
          model?: string | null
          quality_screening_status: string
          quantity_unit?: string
        }
        Update: {
          ai_estimated_quantity?: number | null
          ai_estimated_weight?: number | null
          analysis_mode?: string
          assessment_note?: string | null
          confirmation_status?: string
          confirmed_at?: string | null
          confirmed_quantity?: number | null
          created_at?: string
          food_name?: string
          id?: string
          image_reference?: string | null
          kitchen_id?: string
          message_id?: string | null
          model?: string | null
          quality_screening_status?: string
          quantity_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_assessments_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_assessments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchens: {
        Row: {
          address: string | null
          contact_name: string | null
          conversation_state: string
          created_at: string
          id: string
          name: string
          pending_assessment_id: string | null
          phone: string
          status: string
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          conversation_state?: string
          created_at?: string
          id?: string
          name: string
          pending_assessment_id?: string | null
          phone: string
          status?: string
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          conversation_state?: string
          created_at?: string
          id?: string
          name?: string
          pending_assessment_id?: string | null
          phone?: string
          status?: string
        }
        Relationships: []
      }
      ngos: {
        Row: {
          address: string | null
          contact_name: string | null
          conversation_state: string
          created_at: string
          distance_km: number | null
          id: string
          name: string
          pending_surplus_id: string | null
          phone: string
          proposed_quantity: number | null
          status: string
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          conversation_state?: string
          created_at?: string
          distance_km?: number | null
          id?: string
          name: string
          pending_surplus_id?: string | null
          phone: string
          proposed_quantity?: number | null
          status?: string
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          conversation_state?: string
          created_at?: string
          distance_km?: number | null
          id?: string
          name?: string
          pending_surplus_id?: string | null
          phone?: string
          proposed_quantity?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ngos_pending_surplus_id_fkey"
            columns: ["pending_surplus_id"]
            isOneToOne: false
            referencedRelation: "surplus_food"
            referencedColumns: ["id"]
          },
        ]
      }
      surplus_food: {
        Row: {
          assessment_id: string | null
          created_at: string
          estimated_weight_kg: number | null
          food_name: string
          id: string
          kitchen_id: string
          pickup_location: string | null
          quantity: number
          source: string
          state: string
          unit: string
          usable_until: string | null
        }
        Insert: {
          assessment_id?: string | null
          created_at?: string
          estimated_weight_kg?: number | null
          food_name: string
          id?: string
          kitchen_id: string
          pickup_location?: string | null
          quantity: number
          source?: string
          state?: string
          unit?: string
          usable_until?: string | null
        }
        Update: {
          assessment_id?: string | null
          created_at?: string
          estimated_weight_kg?: number | null
          food_name?: string
          id?: string
          kitchen_id?: string
          pickup_location?: string | null
          quantity?: number
          source?: string
          state?: string
          unit?: string
          usable_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surplus_food_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: true
            referencedRelation: "food_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surplus_food_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchens"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          created_at: string
          direction: string
          from_phone: string | null
          id: string
          kitchen_id: string | null
          media_reference: string | null
          message_text: string | null
          message_type: string
          mode: string
          ngo_id: string | null
          provider_message_id: string | null
        }
        Insert: {
          created_at?: string
          direction: string
          from_phone?: string | null
          id?: string
          kitchen_id?: string | null
          media_reference?: string | null
          message_text?: string | null
          message_type: string
          mode?: string
          ngo_id?: string | null
          provider_message_id?: string | null
        }
        Update: {
          created_at?: string
          direction?: string
          from_phone?: string | null
          id?: string
          kitchen_id?: string | null
          media_reference?: string | null
          message_text?: string | null
          message_type?: string
          mode?: string
          ngo_id?: string | null
          provider_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
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
