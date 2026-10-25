export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      bookings: {
        Row: {
          accepted_at: string | null;
          arrived_at: string | null;
          base_fare: number;
          cancel_reason: string;
          cancelled_at: string | null;
          completed_at: string | null;
          created_at: string;
          customer_id: string;
          distance_fare: number;
          distance_km: number;
          driver_id: string | null;
          drop_address: string;
          drop_area: string;
          duration_min: number;
          estimated_fare: number;
          final_fare: number | null;
          id: string;
          payment_method: string;
          payment_status: string;
          pickup_address: string;
          pickup_area: string;
          rating: number | null;
          reference: string;
          review: string;
          ride_otp: string;
          scheduled_at: string | null;
          sos_raised: boolean;
          started_at: string | null;
          status: string;
          tax_amount: number;
          updated_at: string;
          vehicle_code: string;
          vehicle_name: string;
        };
        Insert: {
          accepted_at?: string | null;
          arrived_at?: string | null;
          base_fare?: number;
          cancel_reason?: string;
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          customer_id: string;
          distance_fare?: number;
          distance_km?: number;
          driver_id?: string | null;
          drop_address?: string;
          drop_area: string;
          duration_min?: number;
          estimated_fare?: number;
          final_fare?: number | null;
          id?: string;
          payment_method?: string;
          payment_status?: string;
          pickup_address?: string;
          pickup_area: string;
          rating?: number | null;
          reference?: string;
          review?: string;
          ride_otp?: string;
          scheduled_at?: string | null;
          sos_raised?: boolean;
          started_at?: string | null;
          status?: string;
          tax_amount?: number;
          updated_at?: string;
          vehicle_code: string;
          vehicle_name?: string;
        };
        Update: {
          accepted_at?: string | null;
          arrived_at?: string | null;
          base_fare?: number;
          cancel_reason?: string;
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          customer_id?: string;
          distance_fare?: number;
          distance_km?: number;
          driver_id?: string | null;
          drop_address?: string;
          drop_area?: string;
          duration_min?: number;
          estimated_fare?: number;
          final_fare?: number | null;
          id?: string;
          payment_method?: string;
          payment_status?: string;
          pickup_address?: string;
          pickup_area?: string;
          rating?: number | null;
          reference?: string;
          review?: string;
          ride_otp?: string;
          scheduled_at?: string | null;
          sos_raised?: boolean;
          started_at?: string | null;
          status?: string;
          tax_amount?: number;
          updated_at?: string;
          vehicle_code?: string;
          vehicle_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["id"];
          },
        ];
      };
      corporate_enquiries: {
        Row: {
          city: string;
          company_name: string;
          contact_name: string;
          created_at: string;
          email: string;
          id: string;
          message: string;
          phone: string;
          requirement: string;
          status: string;
          team_size: string;
          updated_at: string;
        };
        Insert: {
          city?: string;
          company_name: string;
          contact_name: string;
          created_at?: string;
          email: string;
          id?: string;
          message?: string;
          phone: string;
          requirement?: string;
          status?: string;
          team_size?: string;
          updated_at?: string;
        };
        Update: {
          city?: string;
          company_name?: string;
          contact_name?: string;
          created_at?: string;
          email?: string;
          id?: string;
          message?: string;
          phone?: string;
          requirement?: string;
          status?: string;
          team_size?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      driver_applications: {
        Row: {
          admin_notes: string;
          city: string;
          created_at: string;
          email: string;
          experience_years: number;
          full_name: string;
          id: string;
          licence_number: string;
          message: string;
          owns_vehicle: boolean;
          phone: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          admin_notes?: string;
          city: string;
          created_at?: string;
          email: string;
          experience_years?: number;
          full_name: string;
          id?: string;
          licence_number?: string;
          message?: string;
          owns_vehicle?: boolean;
          phone: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          admin_notes?: string;
          city?: string;
          created_at?: string;
          email?: string;
          experience_years?: number;
          full_name?: string;
          id?: string;
          licence_number?: string;
          message?: string;
          owns_vehicle?: boolean;
          phone?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      drivers: {
        Row: {
          city: string;
          created_at: string;
          current_lat: number | null;
          current_lng: number | null;
          full_name: string;
          id: string;
          is_online: boolean;
          location_updated_at: string | null;
          phone: string;
          rating: number;
          status: string;
          total_rides: number;
          updated_at: string;
          user_id: string | null;
          vehicle_code: string;
          vehicle_model: string;
          vehicle_number: string;
        };
        Insert: {
          city?: string;
          created_at?: string;
          current_lat?: number | null;
          current_lng?: number | null;
          full_name: string;
          id?: string;
          is_online?: boolean;
          location_updated_at?: string | null;
          phone?: string;
          rating?: number;
          status?: string;
          total_rides?: number;
          updated_at?: string;
          user_id?: string | null;
          vehicle_code?: string;
          vehicle_model?: string;
          vehicle_number?: string;
        };
        Update: {
          city?: string;
          created_at?: string;
          current_lat?: number | null;
          current_lng?: number | null;
          full_name?: string;
          id?: string;
          is_online?: boolean;
          location_updated_at?: string | null;
          phone?: string;
          rating?: number;
          status?: string;
          total_rides?: number;
          updated_at?: string;
          user_id?: string | null;
          vehicle_code?: string;
          vehicle_model?: string;
          vehicle_number?: string;
        };
        Relationships: [];
      };
      pricing_settings: {
        Row: {
          cancellation_charge: number;
          currency: string;
          demo_note: string;
          id: number;
          platform_fee: number;
          surge_enabled: boolean;
          surge_multiplier: number;
          tax_percent: number;
          updated_at: string;
          waiting_charge_per_min: number;
          waiting_free_minutes: number;
        };
        Insert: {
          cancellation_charge?: number;
          currency?: string;
          demo_note?: string;
          id?: number;
          platform_fee?: number;
          surge_enabled?: boolean;
          surge_multiplier?: number;
          tax_percent?: number;
          updated_at?: string;
          waiting_charge_per_min?: number;
          waiting_free_minutes?: number;
        };
        Update: {
          cancellation_charge?: number;
          currency?: string;
          demo_note?: string;
          id?: number;
          platform_fee?: number;
          surge_enabled?: boolean;
          surge_multiplier?: number;
          tax_percent?: number;
          updated_at?: string;
          waiting_charge_per_min?: number;
          waiting_free_minutes?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          phone: string | null;
          updated_at: string;
          wallet_balance: number;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          updated_at?: string;
          wallet_balance?: number;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          updated_at?: string;
          wallet_balance?: number;
        };
        Relationships: [];
      };
      service_areas: {
        Row: {
          id: string;
          is_active: boolean;
          is_airport: boolean;
          lat: number;
          lng: number;
          name: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          is_active?: boolean;
          is_airport?: boolean;
          lat: number;
          lng: number;
          name: string;
          sort_order?: number;
        };
        Update: {
          id?: string;
          is_active?: boolean;
          is_airport?: boolean;
          lat?: number;
          lng?: number;
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      wallet_transactions: {
        Row: {
          amount: number;
          booking_id: string | null;
          created_at: string;
          description: string;
          id: string;
          reference_id: string | null;
          type: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          booking_id?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          reference_id?: string | null;
          type: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          booking_id?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          reference_id?: string | null;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      vehicle_categories: {
        Row: {
          base_fare: number;
          code: string;
          id: string;
          is_active: boolean;
          minimum_fare: number;
          name: string;
          per_km: number;
          seats: number;
          sort_order: number;
          tagline: string;
          updated_at: string;
        };
        Insert: {
          base_fare: number;
          code: string;
          id?: string;
          is_active?: boolean;
          minimum_fare: number;
          name: string;
          per_km: number;
          seats?: number;
          sort_order?: number;
          tagline?: string;
          updated_at?: string;
        };
        Update: {
          base_fare?: number;
          code?: string;
          id?: string;
          is_active?: boolean;
          minimum_fare?: number;
          name?: string;
          per_km?: number;
          seats?: number;
          sort_order?: number;
          tagline?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_set_role: {
        Args: {
          _email: string;
          _grant: boolean;
          _role: Database["public"]["Enums"]["app_role"];
        };
        Returns: string;
      };
      claim_first_admin: { Args: never; Returns: boolean };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_driver_of: {
        Args: { _booking_driver: string; _user: string };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "driver" | "customer";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "driver", "customer"],
    },
  },
} as const;
