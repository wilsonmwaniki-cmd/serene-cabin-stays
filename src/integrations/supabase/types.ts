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
      addons: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          price_kes: number
          pricing_unit: Database["public"]["Enums"]["addon_pricing_unit"]
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          price_kes: number
          pricing_unit?: Database["public"]["Enums"]["addon_pricing_unit"]
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          price_kes?: number
          pricing_unit?: Database["public"]["Enums"]["addon_pricing_unit"]
          slug?: string
        }
        Relationships: []
      }
      booking_addons: {
        Row: {
          addon_id: string
          booking_id: string
          created_at: string
          id: string
          pricing_unit: Database["public"]["Enums"]["addon_pricing_unit"]
          quantity: number
          unit_price_kes: number
        }
        Insert: {
          addon_id: string
          booking_id: string
          created_at?: string
          id?: string
          pricing_unit: Database["public"]["Enums"]["addon_pricing_unit"]
          quantity?: number
          unit_price_kes: number
        }
        Update: {
          addon_id?: string
          booking_id?: string
          created_at?: string
          id?: string
          pricing_unit?: Database["public"]["Enums"]["addon_pricing_unit"]
          quantity?: number
          unit_price_kes?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_addons_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          adults: number
          check_in: string
          check_out: string
          children: number
          created_at: string
          discount_kes: number | null
          guest_email: string
          guest_name: string
          guest_phone: string | null
          id: string
          notes: string | null
          pod_id: string
          promo_code_id: string | null
          promo_code_kind: Database["public"]["Enums"]["promo_code_kind"] | null
          promo_code_text: string | null
          rooms: number
          status: Database["public"]["Enums"]["booking_status"]
          subtotal_kes: number | null
          total_kes: number | null
        }
        Insert: {
          adults?: number
          check_in: string
          check_out: string
          children?: number
          created_at?: string
          discount_kes?: number | null
          guest_email: string
          guest_name: string
          guest_phone?: string | null
          id?: string
          notes?: string | null
          pod_id: string
          promo_code_id?: string | null
          promo_code_kind?: Database["public"]["Enums"]["promo_code_kind"] | null
          promo_code_text?: string | null
          rooms?: number
          status?: Database["public"]["Enums"]["booking_status"]
          subtotal_kes?: number | null
          total_kes?: number | null
        }
        Update: {
          adults?: number
          check_in?: string
          check_out?: string
          children?: number
          created_at?: string
          discount_kes?: number | null
          guest_email?: string
          guest_name?: string
          guest_phone?: string | null
          id?: string
          notes?: string | null
          pod_id?: string
          promo_code_id?: string | null
          promo_code_kind?: Database["public"]["Enums"]["promo_code_kind"] | null
          promo_code_text?: string | null
          rooms?: number
          status?: Database["public"]["Enums"]["booking_status"]
          subtotal_kes?: number | null
          total_kes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount_kes: number
          business_area: Database["public"]["Enums"]["business_area"]
          category: string
          created_at: string
          description: string
          expense_date: string
          id: string
          notes: string | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount_kes: number
          business_area?: Database["public"]["Enums"]["business_area"]
          category: string
          created_at?: string
          description: string
          expense_date?: string
          id?: string
          notes?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount_kes?: number
          business_area?: Database["public"]["Enums"]["business_area"]
          category?: string
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["message_status"]
          subject: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          subject?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          subject?: string | null
        }
        Relationships: []
      }
      pod_images: {
        Row: {
          alt: string | null
          created_at: string
          display_order: number
          id: string
          pod_id: string
          storage_path: string
        }
        Insert: {
          alt?: string | null
          created_at?: string
          display_order?: number
          id?: string
          pod_id: string
          storage_path: string
        }
        Update: {
          alt?: string | null
          created_at?: string
          display_order?: number
          id?: string
          pod_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "pod_images_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
        ]
      }
      pods: {
        Row: {
          amenities: string[]
          capacity: number
          created_at: string
          description: string
          display_order: number
          id: string
          image_url: string | null
          name: string
          price_kes: number
          size_sqft: number | null
          slug: string
          surcharge_kes: number
          total_units: number
        }
        Insert: {
          amenities?: string[]
          capacity?: number
          created_at?: string
          description: string
          display_order?: number
          id?: string
          image_url?: string | null
          name: string
          price_kes: number
          size_sqft?: number | null
          slug: string
          surcharge_kes?: number
          total_units?: number
        }
        Update: {
          amenities?: string[]
          capacity?: number
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          image_url?: string | null
          name?: string
          price_kes?: number
          size_sqft?: number | null
          slug?: string
          surcharge_kes?: number
          total_units?: number
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          amount_kes: number
          code: string
          created_at: string
          description: string | null
          discount_type: Database["public"]["Enums"]["promo_discount_type"]
          ends_at: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["promo_code_kind"]
          label: string
          percent_off: number | null
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          amount_kes?: number
          code: string
          created_at?: string
          description?: string | null
          discount_type?: Database["public"]["Enums"]["promo_discount_type"]
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["promo_code_kind"]
          label: string
          percent_off?: number | null
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          amount_kes?: number
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: Database["public"]["Enums"]["promo_discount_type"]
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["promo_code_kind"]
          label?: string
          percent_off?: number | null
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          id: string
          key: string
          label: string | null
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          label?: string | null
          updated_at?: string
          value?: string
        }
        Update: {
          id?: string
          key?: string
          label?: string | null
          updated_at?: string
          value?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      pod_availability: {
        Args: { _check_in: string; _check_out: string; _pod_id: string }
        Returns: {
          units_available: number
          units_booked: number
          units_total: number
        }[]
      }
    }
    Enums: {
      addon_pricing_unit: "per_night" | "per_night_per_adult" | "one_time"
      app_role: "admin" | "moderator" | "user"
      business_area: "cabins" | "restaurant" | "shared"
      booking_status: "pending" | "confirmed" | "cancelled"
      message_status: "new" | "read" | "replied" | "archived"
      promo_code_kind: "discount" | "affiliate"
      promo_discount_type: "fixed" | "percentage"
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
      addon_pricing_unit: ["per_night", "per_night_per_adult", "one_time"],
      app_role: ["admin", "moderator", "user"],
      business_area: ["cabins", "restaurant", "shared"],
      booking_status: ["pending", "confirmed", "cancelled"],
      message_status: ["new", "read", "replied", "archived"],
      promo_code_kind: ["discount", "affiliate"],
      promo_discount_type: ["fixed", "percentage"],
    },
  },
} as const
