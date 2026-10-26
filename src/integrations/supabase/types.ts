export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  // Generated from the database schema (all migrations applied) on 2026-10-26.
  // Generated from the database schema (all migrations applied) on 2026-10-26.
  // Generated from the database schema (all migrations applied) on 2026-10-26.
  public: {
    Tables: {
      bookings: {
        Row: {
          accepted_at: string | null;
          accepted_driver_lat: number | null;
          accepted_driver_lng: number | null;
          arrived_at: string | null;
          base_fare: number;
          cancel_reason: string;
          cancellation_fee: number;
          cancelled_at: string | null;
          cancelled_by: string | null;
          completed_at: string | null;
          created_at: string;
          customer_id: string | null;
          discount_amount: number;
          distance_fare: number;
          distance_km: number;
          driver_id: string | null;
          drop_address: string;
          drop_area: string;
          drop_lat: number | null;
          drop_lng: number | null;
          drop_location: string | null;
          dues_amount: number;
          dues_ids: string[];
          duration_min: number;
          estimated_fare: number;
          final_fare: number | null;
          id: string;
          payment_intent_id: string | null;
          payment_made: string;
          payment_method: string;
          payment_status: string;
          pickup_address: string;
          pickup_area: string;
          pickup_geohash: string | null;
          pickup_lat: number | null;
          pickup_lng: number | null;
          pickup_location: string | null;
          promo_code: string | null;
          rating: number | null;
          reference: string;
          rental_hours: number | null;
          review: string;
          ride_otp: string | null;
          ride_type: string;
          safety_status: string | null;
          scheduled_at: string | null;
          sos_raised: boolean;
          started_at: string | null;
          status: string;
          surge_multiplier: number;
          tax_amount: number;
          updated_at: string;
          vehicle_code: string;
          vehicle_name: string;
          vehicle_number: string | null;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_driver_lat?: number | null;
          accepted_driver_lng?: number | null;
          arrived_at?: string | null;
          base_fare?: number;
          cancel_reason?: string;
          cancellation_fee?: number;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          completed_at?: string | null;
          created_at?: string;
          customer_id?: string | null;
          discount_amount?: number;
          distance_fare?: number;
          distance_km?: number;
          driver_id?: string | null;
          drop_address?: string;
          drop_area?: string;
          drop_lat?: number | null;
          drop_lng?: number | null;
          drop_location?: string | null;
          dues_amount?: number;
          dues_ids?: string[];
          duration_min?: number;
          estimated_fare?: number;
          final_fare?: number | null;
          id?: string;
          payment_intent_id?: string | null;
          payment_made?: string;
          payment_method?: string;
          payment_status?: string;
          pickup_address?: string;
          pickup_area?: string;
          pickup_geohash?: string | null;
          pickup_lat?: number | null;
          pickup_lng?: number | null;
          pickup_location?: string | null;
          promo_code?: string | null;
          rating?: number | null;
          reference?: string;
          rental_hours?: number | null;
          review?: string;
          ride_otp?: string | null;
          ride_type?: string;
          safety_status?: string | null;
          scheduled_at?: string | null;
          sos_raised?: boolean;
          started_at?: string | null;
          status?: string;
          surge_multiplier?: number;
          tax_amount?: number;
          updated_at?: string;
          vehicle_code: string;
          vehicle_name?: string;
          vehicle_number?: string | null;
        };
        Update: {
          accepted_at?: string | null;
          accepted_driver_lat?: number | null;
          accepted_driver_lng?: number | null;
          arrived_at?: string | null;
          base_fare?: number;
          cancel_reason?: string;
          cancellation_fee?: number;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          completed_at?: string | null;
          created_at?: string;
          customer_id?: string | null;
          discount_amount?: number;
          distance_fare?: number;
          distance_km?: number;
          driver_id?: string | null;
          drop_address?: string;
          drop_area?: string;
          drop_lat?: number | null;
          drop_lng?: number | null;
          drop_location?: string | null;
          dues_amount?: number;
          dues_ids?: string[];
          duration_min?: number;
          estimated_fare?: number;
          final_fare?: number | null;
          id?: string;
          payment_intent_id?: string | null;
          payment_made?: string;
          payment_method?: string;
          payment_status?: string;
          pickup_address?: string;
          pickup_area?: string;
          pickup_geohash?: string | null;
          pickup_lat?: number | null;
          pickup_lng?: number | null;
          pickup_location?: string | null;
          promo_code?: string | null;
          rating?: number | null;
          reference?: string;
          rental_hours?: number | null;
          review?: string;
          ride_otp?: string | null;
          ride_type?: string;
          safety_status?: string | null;
          scheduled_at?: string | null;
          sos_raised?: boolean;
          started_at?: string | null;
          status?: string;
          surge_multiplier?: number;
          tax_amount?: number;
          updated_at?: string;
          vehicle_code?: string;
          vehicle_name?: string;
          vehicle_number?: string | null;
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
      cancellation_dues: {
        Row: {
          amount: number;
          booking_id: string;
          carried_by: string | null;
          created_at: string;
          customer_id: string | null;
          id: string;
          note: string | null;
          settled_at: string | null;
          status: string;
          waived_by: string | null;
        };
        Insert: {
          amount: number;
          booking_id: string;
          carried_by?: string | null;
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          note?: string | null;
          settled_at?: string | null;
          status?: string;
          waived_by?: string | null;
        };
        Update: {
          amount?: number;
          booking_id?: string;
          carried_by?: string | null;
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          note?: string | null;
          settled_at?: string | null;
          status?: string;
          waived_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cancellation_dues_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: true;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cancellation_dues_carried_by_fkey";
            columns: ["carried_by"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      corporate_enquiries: {
        Row: {
          city: string | null;
          company_name: string;
          contact_name: string;
          created_at: string;
          email: string;
          id: string;
          message: string | null;
          phone: string;
          requirement: string | null;
          status: string;
          team_size: string | null;
          updated_at: string;
        };
        Insert: {
          city?: string | null;
          company_name: string;
          contact_name: string;
          created_at?: string;
          email: string;
          id?: string;
          message?: string | null;
          phone: string;
          requirement?: string | null;
          status?: string;
          team_size?: string | null;
          updated_at?: string;
        };
        Update: {
          city?: string | null;
          company_name?: string;
          contact_name?: string;
          created_at?: string;
          email?: string;
          id?: string;
          message?: string | null;
          phone?: string;
          requirement?: string | null;
          status?: string;
          team_size?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      driver_applications: {
        Row: {
          aadhaar_number: string | null;
          admin_notes: string | null;
          chassis_number: string | null;
          city: string;
          created_at: string;
          dl_url: string | null;
          driver_type: string;
          email: string;
          experience_years: number | null;
          full_name: string;
          id: string;
          licence_number: string | null;
          message: string | null;
          owns_vehicle: boolean | null;
          phone: string;
          photo_url: string | null;
          status: string;
          updated_at: string;
          vehicle_model: string | null;
          vehicle_number: string | null;
          vehicle_year: string | null;
        };
        Insert: {
          aadhaar_number?: string | null;
          admin_notes?: string | null;
          chassis_number?: string | null;
          city: string;
          created_at?: string;
          dl_url?: string | null;
          driver_type?: string;
          email: string;
          experience_years?: number | null;
          full_name: string;
          id?: string;
          licence_number?: string | null;
          message?: string | null;
          owns_vehicle?: boolean | null;
          phone: string;
          photo_url?: string | null;
          status?: string;
          updated_at?: string;
          vehicle_model?: string | null;
          vehicle_number?: string | null;
          vehicle_year?: string | null;
        };
        Update: {
          aadhaar_number?: string | null;
          admin_notes?: string | null;
          chassis_number?: string | null;
          city?: string;
          created_at?: string;
          dl_url?: string | null;
          driver_type?: string;
          email?: string;
          experience_years?: number | null;
          full_name?: string;
          id?: string;
          licence_number?: string | null;
          message?: string | null;
          owns_vehicle?: boolean | null;
          phone?: string;
          photo_url?: string | null;
          status?: string;
          updated_at?: string;
          vehicle_model?: string | null;
          vehicle_number?: string | null;
          vehicle_year?: string | null;
        };
        Relationships: [];
      };
      driver_cash_settlements: {
        Row: {
          amount: number;
          collected_by: string | null;
          created_at: string | null;
          driver_id: string;
          id: string;
          notes: string | null;
          payment_mode: string;
          razorpay_payment_id: string | null;
        };
        Insert: {
          amount: number;
          collected_by?: string | null;
          created_at?: string | null;
          driver_id: string;
          id?: string;
          notes?: string | null;
          payment_mode?: string;
          razorpay_payment_id?: string | null;
        };
        Update: {
          amount?: number;
          collected_by?: string | null;
          created_at?: string | null;
          driver_id?: string;
          id?: string;
          notes?: string | null;
          payment_mode?: string;
          razorpay_payment_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "driver_cash_settlements_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["id"];
          },
        ];
      };
      driver_commission_settlements: {
        Row: {
          amount: number;
          collected_by: string | null;
          created_at: string | null;
          direction: string;
          driver_id: string | null;
          driver_name: string | null;
          id: string;
          notes: string | null;
          payment_mode: string;
          razorpay_payment_id: string | null;
          reference_no: string | null;
        };
        Insert: {
          amount: number;
          collected_by?: string | null;
          created_at?: string | null;
          direction?: string;
          driver_id?: string | null;
          driver_name?: string | null;
          id?: string;
          notes?: string | null;
          payment_mode?: string;
          razorpay_payment_id?: string | null;
          reference_no?: string | null;
        };
        Update: {
          amount?: number;
          collected_by?: string | null;
          created_at?: string | null;
          direction?: string;
          driver_id?: string | null;
          driver_name?: string | null;
          id?: string;
          notes?: string | null;
          payment_mode?: string;
          razorpay_payment_id?: string | null;
          reference_no?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "driver_commission_settlements_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["id"];
          },
        ];
      };
      drivers: {
        Row: {
          aadhaar_number: string | null;
          city: string;
          created_at: string;
          current_lat: number | null;
          current_lng: number | null;
          dl_url: string | null;
          driver_type: string;
          driving_license: string | null;
          full_name: string;
          geohash: string | null;
          id: string;
          is_active: boolean;
          is_online: boolean;
          is_verified: boolean;
          location_updated_at: string | null;
          phone: string;
          photo_url: string | null;
          push_token: string | null;
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
          aadhaar_number?: string | null;
          city?: string;
          created_at?: string;
          current_lat?: number | null;
          current_lng?: number | null;
          dl_url?: string | null;
          driver_type?: string;
          driving_license?: string | null;
          full_name: string;
          geohash?: string | null;
          id?: string;
          is_active?: boolean;
          is_online?: boolean;
          is_verified?: boolean;
          location_updated_at?: string | null;
          phone?: string;
          photo_url?: string | null;
          push_token?: string | null;
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
          aadhaar_number?: string | null;
          city?: string;
          created_at?: string;
          current_lat?: number | null;
          current_lng?: number | null;
          dl_url?: string | null;
          driver_type?: string;
          driving_license?: string | null;
          full_name?: string;
          geohash?: string | null;
          id?: string;
          is_active?: boolean;
          is_online?: boolean;
          is_verified?: boolean;
          location_updated_at?: string | null;
          phone?: string;
          photo_url?: string | null;
          push_token?: string | null;
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
      fleet_vehicles: {
        Row: {
          assigned_at: string | null;
          assigned_driver_id: string | null;
          battery_percentage: number;
          bay_number: string | null;
          color: string | null;
          created_at: string | null;
          id: string;
          model: string;
          notes: string | null;
          plate_number: string;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          assigned_at?: string | null;
          assigned_driver_id?: string | null;
          battery_percentage?: number;
          bay_number?: string | null;
          color?: string | null;
          created_at?: string | null;
          id?: string;
          model?: string;
          notes?: string | null;
          plate_number: string;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          assigned_at?: string | null;
          assigned_driver_id?: string | null;
          battery_percentage?: number;
          bay_number?: string | null;
          color?: string | null;
          created_at?: string | null;
          id?: string;
          model?: string;
          notes?: string | null;
          plate_number?: string;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fleet_vehicles_assigned_driver_id_fkey";
            columns: ["assigned_driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_vehicles: {
        Row: {
          certified_standard: boolean | null;
          chassis_number: string | null;
          color: string | null;
          created_at: string | null;
          driver_id: string | null;
          id: string;
          model: string;
          owner_email: string | null;
          owner_name: string;
          owner_phone: string;
          plate_number: string;
          status: string | null;
          year: string | null;
        };
        Insert: {
          certified_standard?: boolean | null;
          chassis_number?: string | null;
          color?: string | null;
          created_at?: string | null;
          driver_id?: string | null;
          id?: string;
          model: string;
          owner_email?: string | null;
          owner_name: string;
          owner_phone: string;
          plate_number: string;
          status?: string | null;
          year?: string | null;
        };
        Update: {
          certified_standard?: boolean | null;
          chassis_number?: string | null;
          color?: string | null;
          created_at?: string | null;
          driver_id?: string | null;
          id?: string;
          model?: string;
          owner_email?: string | null;
          owner_name?: string;
          owner_phone?: string;
          plate_number?: string;
          status?: string | null;
          year?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "partner_vehicles_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_qr_codes: {
        Row: {
          amount: number;
          booking_id: string | null;
          close_by: string | null;
          created_at: string;
          created_by: string | null;
          driver_id: string | null;
          id: string;
          image_url: string;
          kind: string;
          paid_at: string | null;
          payment_id: string | null;
          status: string;
        };
        Insert: {
          amount: number;
          booking_id?: string | null;
          close_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          driver_id?: string | null;
          id: string;
          image_url: string;
          kind: string;
          paid_at?: string | null;
          payment_id?: string | null;
          status?: string;
        };
        Update: {
          amount?: number;
          booking_id?: string | null;
          close_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          driver_id?: string | null;
          id?: string;
          image_url?: string;
          kind?: string;
          paid_at?: string | null;
          payment_id?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_qr_codes_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_qr_codes_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["id"];
          },
        ];
      };
      pricing_settings: {
        Row: {
          cancellation_charge: number;
          cancellation_free_km: number;
          cancellation_free_minutes: number;
          cancellation_stuck_km: number;
          cancellation_stuck_minutes: number;
          currency: string;
          id: number;
          partner_commission_percent: number;
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
          cancellation_free_km?: number;
          cancellation_free_minutes?: number;
          cancellation_stuck_km?: number;
          cancellation_stuck_minutes?: number;
          currency?: string;
          id: number;
          partner_commission_percent?: number;
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
          cancellation_free_km?: number;
          cancellation_free_minutes?: number;
          cancellation_stuck_km?: number;
          cancellation_stuck_minutes?: number;
          currency?: string;
          id?: number;
          partner_commission_percent?: number;
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
          avatar_url: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          phone: string | null;
          push_token: string | null;
          updated_at: string;
          wallet_balance: number;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          push_token?: string | null;
          updated_at?: string;
          wallet_balance?: number;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          push_token?: string | null;
          updated_at?: string;
          wallet_balance?: number;
        };
        Relationships: [];
      };
      promo_redemptions: {
        Row: {
          booking_id: string | null;
          code: string;
          created_at: string;
          discount: number;
          id: string;
          user_id: string;
        };
        Insert: {
          booking_id?: string | null;
          code: string;
          created_at?: string;
          discount: number;
          id?: string;
          user_id: string;
        };
        Update: {
          booking_id?: string | null;
          code?: string;
          created_at?: string;
          discount?: number;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "promo_redemptions_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      refunds: {
        Row: {
          amount: number;
          booking_id: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          id: string;
          method: string;
          razorpay_refund_id: string | null;
          reason: string;
          status: string;
          ticket_id: string | null;
        };
        Insert: {
          amount: number;
          booking_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          id?: string;
          method: string;
          razorpay_refund_id?: string | null;
          reason: string;
          status?: string;
          ticket_id?: string | null;
        };
        Update: {
          amount?: number;
          booking_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          id?: string;
          method?: string;
          razorpay_refund_id?: string | null;
          reason?: string;
          status?: string;
          ticket_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "refunds_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "support_tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      security_audit_logs: {
        Row: {
          created_at: string;
          event_type: string;
          id: string;
          ip_address: string | null;
          metadata: Json;
          severity: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          event_type: string;
          id?: string;
          ip_address?: string | null;
          metadata?: Json;
          severity: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          id?: string;
          ip_address?: string | null;
          metadata?: Json;
          severity?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      service_areas: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          is_airport: boolean;
          lat: number;
          lng: number;
          name: string;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_airport?: boolean;
          lat: number;
          lng: number;
          name: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
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
      sos_alerts: {
        Row: {
          booking_id: string | null;
          created_at: string;
          driver_id: string | null;
          drop_area: string | null;
          guardian_phone: string | null;
          id: string;
          pickup_area: string | null;
          status: string;
          triggered_at: string;
          user_id: string | null;
        };
        Insert: {
          booking_id?: string | null;
          created_at?: string;
          driver_id?: string | null;
          drop_area?: string | null;
          guardian_phone?: string | null;
          id?: string;
          pickup_area?: string | null;
          status?: string;
          triggered_at?: string;
          user_id?: string | null;
        };
        Update: {
          booking_id?: string | null;
          created_at?: string;
          driver_id?: string | null;
          drop_area?: string | null;
          guardian_phone?: string | null;
          id?: string;
          pickup_area?: string | null;
          status?: string;
          triggered_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sos_alerts_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sos_alerts_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["id"];
          },
        ];
      };
      support_tickets: {
        Row: {
          admin_notes: string | null;
          booking_id: string | null;
          booking_reference: string | null;
          complaint_type: string;
          created_at: string;
          docket_number: string;
          email: string | null;
          id: string;
          message: string;
          name: string;
          phone: string;
          resolution_at: string | null;
          status: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          admin_notes?: string | null;
          booking_id?: string | null;
          booking_reference?: string | null;
          complaint_type: string;
          created_at?: string;
          docket_number: string;
          email?: string | null;
          id?: string;
          message: string;
          name: string;
          phone: string;
          resolution_at?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          admin_notes?: string | null;
          booking_id?: string | null;
          booking_reference?: string | null;
          complaint_type?: string;
          created_at?: string;
          docket_number?: string;
          email?: string | null;
          id?: string;
          message?: string;
          name?: string;
          phone?: string;
          resolution_at?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "support_tickets_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      user_consents: {
        Row: {
          consent_type: string;
          consented_at: string;
          id: string;
          ip_address: string | null;
          user_agent: string | null;
          user_id: string | null;
          version: string;
        };
        Insert: {
          consent_type?: string;
          consented_at?: string;
          id?: string;
          ip_address?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
          version?: string;
        };
        Update: {
          consent_type?: string;
          consented_at?: string;
          id?: string;
          ip_address?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
          version?: string;
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
      vehicle_categories: {
        Row: {
          base_fare: number;
          code: string;
          created_at: string;
          id: string;
          image_url: string | null;
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
          created_at?: string;
          id?: string;
          image_url?: string | null;
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
          created_at?: string;
          id?: string;
          image_url?: string | null;
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
      wallet_transactions: {
        Row: {
          amount: number;
          booking_id: string | null;
          created_at: string;
          description: string;
          id: string;
          reference_id: string | null;
          type: string;
          user_id: string | null;
        };
        Insert: {
          amount: number;
          booking_id?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          reference_id?: string | null;
          type: string;
          user_id?: string | null;
        };
        Update: {
          amount?: number;
          booking_id?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          reference_id?: string | null;
          type?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_booking: { Args: { _booking_id: string }; Returns: Json };
      admin_link_driver: { Args: { _driver_id: string; _email: string }; Returns: Json };
      admin_set_role: {
        Args: { _email: string; _role: Database["public"]["Enums"]["app_role"]; _grant: boolean };
        Returns: string;
      };
      auth_email_status: { Args: { _email: string }; Returns: string };
      can_access_ride_channel: { Args: { _topic: string }; Returns: boolean };
      can_read_driver_file: { Args: { _name: string }; Returns: boolean };
      claim_first_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      claim_scheduled_booking: { Args: { _booking_id: string }; Returns: Json };
      credit_wallet_topup: {
        Args: { _user_id: string; _amount: number; _payment_id: string; _description?: string };
        Returns: Json;
      };
      current_active_driver_id: { Args: Record<PropertyKey, never>; Returns: string };
      deduct_ride_wallet_payment: { Args: { _booking_id: string }; Returns: Json };
      delete_user_account: { Args: Record<PropertyKey, never>; Returns: Json };
      driver_can_view_customer: { Args: { _customer_id: string }; Returns: boolean };
      fn_cancellation_fee: {
        Args: { _booking_id: string; _by: string };
        Returns: {
          fee: number;
          reason: string;
          minutes_since_accept: number;
          driver_moved_km: number;
        }[];
      };
      fn_encode_geohash: {
        Args: { lat: number; lng: number; precision_len?: number };
        Returns: string;
      };
      fn_fare_quote: {
        Args: { _vehicle_code: string; _distance_km: number };
        Returns: {
          base_fare: number;
          distance_fare: number;
          minimum_fare: number;
          surge: number;
          ride_fare: number;
          tax: number;
          platform_fee: number;
          total: number;
        }[];
      };
      fn_hourly_package_price: { Args: { _hours: number }; Returns: number };
      fn_km_between: {
        Args: { lat1: number; lng1: number; lat2: number; lng2: number };
        Returns: number;
      };
      fn_parse_coord: { Args: { raw: string }; Returns: string };
      fn_trip_straight_km: {
        Args: { pickup_address: string; drop_address: string };
        Returns: number;
      };
      get_assigned_driver: {
        Args: { _booking_id: string };
        Returns: {
          id: string;
          full_name: string;
          phone: string;
          photo_url: string;
          vehicle_model: string;
          vehicle_number: string;
          vehicle_code: string;
          rating: number;
          total_rides: number;
          current_lat: number;
          current_lng: number;
          location_updated_at: string;
        }[];
      };
      get_cancellation_fee: { Args: { _booking_id: string }; Returns: Json };
      get_my_dues: { Args: Record<PropertyKey, never>; Returns: number };
      get_nearby_drivers: {
        Args: { p_lat: number; p_lng: number; p_radius_km?: number; p_limit?: number };
        Returns: {
          id: string;
          vehicle_model: string;
          current_lat: number;
          current_lng: number;
          rating: number;
          distance_km: number;
        }[];
      };
      get_online_driver_positions: {
        Args: Record<PropertyKey, never>;
        Returns: { id: string; current_lat: number; current_lng: number }[];
      };
      get_public_tracking_status: { Args: { _ref: string }; Returns: Json };
      get_ride_otp: { Args: { _booking_id: string }; Returns: string };
      get_surge_multiplier: { Args: Record<PropertyKey, never>; Returns: number };
      has_role: {
        Args: { _user: string; _role: Database["public"]["Enums"]["app_role"] };
        Returns: boolean;
      };
      is_customer_of_driver: { Args: { _driver_id: string }; Returns: boolean };
      is_driver_of: { Args: { _booking_driver: string; _user: string }; Returns: boolean };
      release_scheduled_booking: { Args: { _booking_id: string }; Returns: Json };
      rls_auto_enable: { Args: Record<PropertyKey, never>; Returns: string };
      settle_wallet_booking_internal: { Args: { _booking_id: string }; Returns: Json };
      start_scheduled_booking: { Args: { _booking_id: string }; Returns: Json };
      top_up_wallet: {
        Args: { _amount: number; _payment_id: string; _order_id?: string; _description?: string };
        Returns: Json;
      };
      verify_ride_otp: { Args: { _booking_id: string; _otp: string }; Returns: Json };
    };
    Enums: {
      app_role: "customer" | "driver" | "admin";
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
      app_role: ["customer", "driver", "admin"],
    },
  },
} as const;
