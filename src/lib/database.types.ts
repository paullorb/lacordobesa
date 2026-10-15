export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      analytics_daily: {
        Row: {
          browser: string
          day: string
          detail: string
          device: string
          event: string
          hits: number
          lang: string
          path: string
          referrer: string
        }
        Insert: {
          browser?: string
          day: string
          detail?: string
          device?: string
          event: string
          hits?: number
          lang?: string
          path?: string
          referrer?: string
        }
        Update: {
          browser?: string
          day?: string
          detail?: string
          device?: string
          event?: string
          hits?: number
          lang?: string
          path?: string
          referrer?: string
        }
        Relationships: []
      }
      broadcast_optins: {
        Row: {
          channel: Database["public"]["Enums"]["broadcast_channel"]
          confirmed_at: string | null
          confirmed_by: string | null
          consent_text: string
          consented_at: string
          created_at: string
          email: string | null
          id: string
          name: string | null
          phone: string | null
          source: string
          unsubscribe_token: string
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["broadcast_channel"]
          confirmed_at?: string | null
          confirmed_by?: string | null
          consent_text: string
          consented_at?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          source?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["broadcast_channel"]
          confirmed_at?: string | null
          confirmed_by?: string | null
          consent_text?: string
          consented_at?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          source?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      closures: {
        Row: {
          created_at: string
          date: string
          id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      event_inquiries: {
        Row: {
          budget_band: string
          created_at: string
          email: string | null
          event_date: string | null
          guests: number | null
          id: string
          message: string | null
          name: string
          occasion: string
          phone: string
          staff_notes: string | null
          status: Database["public"]["Enums"]["inquiry_status"]
          updated_at: string
        }
        Insert: {
          budget_band: string
          created_at?: string
          email?: string | null
          event_date?: string | null
          guests?: number | null
          id?: string
          message?: string | null
          name: string
          occasion: string
          phone: string
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["inquiry_status"]
          updated_at?: string
        }
        Update: {
          budget_band?: string
          created_at?: string
          email?: string | null
          event_date?: string | null
          guests?: number | null
          id?: string
          message?: string | null
          name?: string
          occasion?: string
          phone?: string
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["inquiry_status"]
          updated_at?: string
        }
        Relationships: []
      }
      gallery_items: {
        Row: {
          caption: string | null
          category: string
          created_at: string
          id: string
          image_url: string
          is_featured: boolean
          storage_path: string | null
        }
        Insert: {
          caption?: string | null
          category?: string
          created_at?: string
          id?: string
          image_url: string
          is_featured?: boolean
          storage_path?: string | null
        }
        Update: {
          caption?: string | null
          category?: string
          created_at?: string
          id?: string
          image_url?: string
          is_featured?: boolean
          storage_path?: string | null
        }
        Relationships: []
      }
      menu_categories: {
        Row: {
          id: string
          label: string
          label_secondary: string | null
          note: string | null
          show_prices: boolean
          slug: string
          sort_order: number
        }
        Insert: {
          id?: string
          label: string
          label_secondary?: string | null
          note?: string | null
          show_prices?: boolean
          slug: string
          sort_order?: number
        }
        Update: {
          id?: string
          label?: string
          label_secondary?: string | null
          note?: string | null
          show_prices?: boolean
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          description_en: string | null
          description_es: string | null
          id: string
          is_available: boolean
          is_featured: boolean
          is_preorderable: boolean
          name: string
          preorder_unit: string
          price_label: string | null
          sort_order: number
          subtitle: string | null
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          description_en?: string | null
          description_es?: string | null
          id?: string
          is_available?: boolean
          is_featured?: boolean
          is_preorderable?: boolean
          name: string
          preorder_unit?: string
          price_label?: string | null
          sort_order?: number
          subtitle?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          description_en?: string | null
          description_es?: string | null
          id?: string
          is_available?: boolean
          is_featured?: boolean
          is_preorderable?: boolean
          name?: string
          preorder_unit?: string
          price_label?: string | null
          sort_order?: number
          subtitle?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_hours: {
        Row: {
          closes: string | null
          is_closed: boolean
          opens: string | null
          updated_at: string
          weekday: number
        }
        Insert: {
          closes?: string | null
          is_closed?: boolean
          opens?: string | null
          updated_at?: string
          weekday: number
        }
        Update: {
          closes?: string | null
          is_closed?: boolean
          opens?: string | null
          updated_at?: string
          weekday?: number
        }
        Relationships: []
      }
      preorder_lines: {
        Row: {
          id: string
          label: string
          menu_item_id: string | null
          preorder_id: string
          price_label: string | null
          quantity: number
          unit_label: string
        }
        Insert: {
          id?: string
          label: string
          menu_item_id?: string | null
          preorder_id: string
          price_label?: string | null
          quantity: number
          unit_label: string
        }
        Update: {
          id?: string
          label?: string
          menu_item_id?: string | null
          preorder_id?: string
          price_label?: string | null
          quantity?: number
          unit_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "preorder_lines_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preorder_lines_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preorder_lines_preorder_id_fkey"
            columns: ["preorder_id"]
            isOneToOne: false
            referencedRelation: "preorders"
            referencedColumns: ["id"]
          },
        ]
      }
      preorders: {
        Row: {
          created_at: string
          email: string | null
          id: string
          locale: string
          manage_token: string
          name: string
          notes: string | null
          phone: string
          pickup_date: string
          pickup_time: string
          source: string
          staff_notes: string | null
          status: Database["public"]["Enums"]["preorder_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          locale?: string
          manage_token?: string
          name: string
          notes?: string | null
          phone: string
          pickup_date: string
          pickup_time: string
          source?: string
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["preorder_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          locale?: string
          manage_token?: string
          name?: string
          notes?: string | null
          phone?: string
          pickup_date?: string
          pickup_time?: string
          source?: string
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["preorder_status"]
          updated_at?: string
        }
        Relationships: []
      }
      request_quota: {
        Row: {
          bucket: string
          created_at: string
          id: number
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: never
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: never
        }
        Relationships: []
      }
      reservations: {
        Row: {
          changed_count: number
          confirmation_sent_at: string | null
          created_at: string
          date: string
          email: string | null
          id: string
          locale: string
          manage_token: string
          name: string
          notes: string | null
          party_size: number
          phone: string
          source: string
          staff_notes: string | null
          start_time: string
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
        }
        Insert: {
          changed_count?: number
          confirmation_sent_at?: string | null
          created_at?: string
          date: string
          email?: string | null
          id?: string
          locale?: string
          manage_token?: string
          name: string
          notes?: string | null
          party_size: number
          phone: string
          source?: string
          staff_notes?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Update: {
          changed_count?: number
          confirmation_sent_at?: string | null
          created_at?: string
          date?: string
          email?: string | null
          id?: string
          locale?: string
          manage_token?: string
          name?: string
          notes?: string | null
          party_size?: number
          phone?: string
          source?: string
          staff_notes?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      specials: {
        Row: {
          created_at: string
          description: string | null
          ends_on: string | null
          id: string
          is_active: boolean
          starts_on: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_on?: string | null
          id?: string
          is_active?: boolean
          starts_on?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_on?: string | null
          id?: string
          is_active?: boolean
          starts_on?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          added_at: string
          user_id: string
        }
        Insert: {
          added_at?: string
          user_id: string
        }
        Update: {
          added_at?: string
          user_id?: string
        }
        Relationships: []
      }
      waitlist_entries: {
        Row: {
          created_at: string
          date: string
          email: string | null
          id: string
          name: string
          party_size: number
          phone: string
          staff_notes: string | null
          status: Database["public"]["Enums"]["waitlist_status"]
          time_preference: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          email?: string | null
          id?: string
          name: string
          party_size: number
          phone: string
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["waitlist_status"]
          time_preference?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          email?: string | null
          id?: string
          name?: string
          party_size?: number
          phone?: string
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["waitlist_status"]
          time_preference?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      menu_items_public: {
        Row: {
          category_id: string | null
          category_label: string | null
          category_sort: number | null
          created_at: string | null
          description: string | null
          description_en: string | null
          description_es: string | null
          id: string | null
          is_available: boolean | null
          is_featured: boolean | null
          is_preorderable: boolean | null
          name: string | null
          preorder_unit: string | null
          price_label: string | null
          sort_order: number | null
          subtitle: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      analytics_breakdown: {
        Args: {
          p_by: string
          p_detail?: string
          p_event: string
          p_from: string
          p_to: string
        }
        Returns: { bucket: string; total: number }[]
      }
      arrange_menu_categories: { Args: { p_ids: string[] }; Returns: number }
      arrange_menu_items: {
        Args: { p_category: string; p_ids: string[] }
        Returns: number
      }
      cancel_preorder_by_token: {
        Args: { p_token: string }
        Returns: undefined
      }
      cancel_reservation_by_token: {
        Args: { p_token: string }
        Returns: undefined
      }
      is_staff: { Args: never; Returns: boolean }
      join_waitlist: {
        Args: {
          p_date: string
          p_email: string
          p_name: string
          p_party_size: number
          p_phone: string
          p_time_preference?: string
        }
        Returns: undefined
      }
      manage_token_valid: { Args: { p_token: string }; Returns: boolean }
      move_reservation_by_token: {
        Args: {
          p_date: string
          p_party_size: number
          p_time: string
          p_token: string
        }
        Returns: undefined
      }
      phone_key: { Args: { p: string }; Returns: string }
      preorder_by_token: {
        Args: { p_token: string }
        Returns: {
          lines: Json
          name: string
          notes: string
          pickup_date: string
          pickup_time: string
          status: Database["public"]["Enums"]["preorder_status"]
        }[]
      }
      preorder_settings: { Args: never; Returns: Json }
      request_event_inquiry: {
        Args: {
          p_budget_band: string
          p_email: string
          p_event_date?: string
          p_guests?: number
          p_message?: string
          p_name: string
          p_occasion: string
          p_phone: string
        }
        Returns: undefined
      }
      request_preorder: {
        Args: {
          p_email: string
          p_lines: Json
          p_locale?: string
          p_name: string
          p_notes?: string
          p_phone: string
          p_pickup_date: string
          p_pickup_time: string
        }
        Returns: string
      }
      request_reservation: {
        Args: {
          p_date: string
          p_email: string
          p_locale?: string
          p_name: string
          p_notes?: string
          p_party_size: number
          p_phone: string
          p_time: string
        }
        Returns: string
      }
      reservation_availability: {
        Args: { p_date: string }
        Returns: {
          seats_left: number
          slot: string
        }[]
      }
      reservation_by_token: {
        Args: { p_token: string }
        Returns: {
          changes_left: number
          name: string
          notes: string
          party_size: number
          res_date: string
          start_time: string
          status: Database["public"]["Enums"]["reservation_status"]
        }[]
      }
      reservation_settings: { Args: never; Returns: Json }
      subscribe_broadcast: {
        Args: {
          p_channel: string
          p_consent_text: string
          p_email?: string
          p_name?: string
          p_phone?: string
        }
        Returns: undefined
      }
      track_event: {
        Args: {
          p_browser: string
          p_detail: string
          p_device: string
          p_event: string
          p_lang: string
          p_path: string
          p_referrer: string
        }
        Returns: undefined
      }
      take_request_quota: {
        Args: { p_bucket: string; p_max_1h: number; p_max_24h: number }
        Returns: boolean
      }
      unsubscribe_broadcast: { Args: { p_token: string }; Returns: undefined }
    }
    Enums: {
      broadcast_channel: "whatsapp" | "email"
      inquiry_status: "new" | "in_progress" | "quoted" | "won" | "lost"
      preorder_status:
        | "pending"
        | "confirmed"
        | "ready"
        | "collected"
        | "cancelled"
      reservation_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "no_show"
        | "completed"
      waitlist_status:
        | "waiting"
        | "notified"
        | "converted"
        | "expired"
        | "cancelled"
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
    Enums: {
      broadcast_channel: ["whatsapp", "email"],
      inquiry_status: ["new", "in_progress", "quoted", "won", "lost"],
      preorder_status: [
        "pending",
        "confirmed",
        "ready",
        "collected",
        "cancelled",
      ],
      reservation_status: [
        "pending",
        "confirmed",
        "cancelled",
        "no_show",
        "completed",
      ],
      waitlist_status: [
        "waiting",
        "notified",
        "converted",
        "expired",
        "cancelled",
      ],
    },
  },
} as const

