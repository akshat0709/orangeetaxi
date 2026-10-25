


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'customer',
    'driver',
    'admin'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_role"("_email" "text", "_role" "public"."app_role", "_grant" boolean) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE target uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RETURN 'forbidden'; END IF;
  SELECT id INTO target FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF target IS NULL THEN RETURN 'not_found'; END IF;
  
  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (target, _role) ON CONFLICT DO NOTHING;
    IF _role = 'driver' THEN
      INSERT INTO public.drivers (user_id, full_name, city, phone, vehicle_model, vehicle_number)
      VALUES (
        target, 
        split_part(_email, '@', 1),
        'Delhi NCR', 
        '', 
        'Orange Go', 
        'Unassigned'
      ) ON CONFLICT (user_id) DO NOTHING;
    END IF;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = target AND role = _role;
  END IF;
  
  RETURN 'ok';
END; $$;


ALTER FUNCTION "public"."admin_set_role"("_email" "text", "_role" "public"."app_role", "_grant" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_encode_geohash"("lat" double precision, "lng" double precision, "precision_len" integer DEFAULT 6) RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  base32 text := '0123456789bcdefghjkmnpqrstuvwxyz';
  lat_min double precision := -90.0;
  lat_max double precision := 90.0;
  lon_min double precision := -180.0;
  lon_max double precision := 180.0;
  mid double precision;
  bits integer[] := ARRAY[16, 8, 4, 2, 1];
  bit integer := 1;
  ch integer := 0;
  even boolean := true;
  geohash text := '';
BEGIN
  IF lat IS NULL OR lng IS NULL THEN
    RETURN NULL;
  END IF;

  WHILE length(geohash) < precision_len LOOP
    IF even THEN
      mid := (lon_min + lon_max) / 2.0;
      IF lng > mid THEN
        ch := ch | bits[bit];
        lon_min := mid;
      ELSE
        lon_max := mid;
      END IF;
    ELSE
      mid := (lat_min + lat_max) / 2.0;
      IF lat > mid THEN
        ch := ch | bits[bit];
        lat_min := mid;
      ELSE
        lat_max := mid;
      END IF;
    END IF;

    even := NOT even;

    IF bit < 5 THEN
      bit := bit + 1;
    ELSE
      geohash := geohash || substr(base32, ch + 1, 1);
      bit := 1;
      ch := 0;
    END IF;
  END LOOP;

  RETURN geohash;
END;
$$;


ALTER FUNCTION "public"."fn_encode_geohash"("lat" double precision, "lng" double precision, "precision_len" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_nearby_drivers"("p_lat" double precision, "p_lng" double precision, "p_radius_km" double precision DEFAULT 5.0, "p_limit" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "full_name" "text", "phone" "text", "vehicle_model" "text", "vehicle_number" "text", "current_lat" double precision, "current_lng" double precision, "rating" numeric, "distance_km" double precision)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_prefix text;
BEGIN
  -- Precision 5 prefix covers ~5km x 5km quadrant
  v_prefix := substr(public.fn_encode_geohash(p_lat, p_lng, 5), 1, 5);

  RETURN QUERY
  SELECT
    d.id,
    d.full_name,
    d.phone,
    d.vehicle_model,
    d.vehicle_number,
    d.current_lat,
    d.current_lng,
    d.rating,
    ROUND(
      (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(p_lat)) * cos(radians(d.current_lat)) *
          cos(radians(d.current_lng) - radians(p_lng)) +
          sin(radians(p_lat)) * sin(radians(d.current_lat))
        ))
      ))::numeric, 2
    )::double precision AS distance_km
  FROM public.drivers d
  WHERE d.is_online = true
    AND d.status = 'active'
    AND d.current_lat IS NOT NULL
    AND d.current_lng IS NOT NULL
    AND (d.geohash LIKE (v_prefix || '%') OR d.geohash IS NOT NULL)
  ORDER BY distance_km ASC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_nearby_drivers"("p_lat" double precision, "p_lng" double precision, "p_radius_km" double precision, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_surge_multiplier"() RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  active_searching_rides int;
  online_drivers int;
  ratio numeric;
  surge numeric;
BEGIN
  -- Count active riders vs active drivers
  SELECT count(*) INTO active_searching_rides FROM public.bookings WHERE status = 'searching';
  SELECT count(*) INTO online_drivers FROM public.drivers WHERE is_online = true;
  
  surge := 1.0;
  
  IF online_drivers > 0 THEN
    ratio := active_searching_rides::numeric / online_drivers::numeric;
    IF ratio >= 2.0 THEN
      surge := 1.5;
    ELSIF ratio >= 1.0 THEN
      surge := 1.2;
    END IF;
  ELSE
    IF active_searching_rides > 0 THEN
      surge := 2.0;
    END IF;
  END IF;
  
  RETURN surge;
END;
$$;


ALTER FUNCTION "public"."get_surge_multiplier"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  requested_role text := NEW.raw_user_meta_data->>'role';
  assigned_role public.app_role := 'customer';
BEGIN
  IF requested_role = 'driver' THEN
    assigned_role := 'driver';
  END IF;
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role)
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END; $$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user AND role = _role)
$$;


ALTER FUNCTION "public"."has_role"("_user" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_driver_of"("_booking_driver" "uuid", "_user" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = _booking_driver AND d.user_id = _user)
$$;


ALTER FUNCTION "public"."is_driver_of"("_booking_driver" "uuid", "_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_fn_booking_geohash"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  clean_addr text;
  parts text[];
  lat_val double precision;
  lng_val double precision;
BEGIN
  IF NEW.pickup_address IS NOT NULL AND NEW.pickup_address <> '' THEN
    clean_addr := split_part(NEW.pickup_address, '|', 1);
    parts := string_to_array(clean_addr, ',');
    IF array_length(parts, 1) >= 2 THEN
      BEGIN
        lat_val := trim(parts[1])::double precision;
        lng_val := trim(parts[2])::double precision;
        NEW.pickup_geohash := public.fn_encode_geohash(lat_val, lng_val, 6);
      EXCEPTION WHEN OTHERS THEN
        NEW.pickup_geohash := NULL;
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_fn_booking_geohash"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_fn_driver_geohash"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.current_lat IS NOT NULL AND NEW.current_lng IS NOT NULL THEN
    NEW.geohash := public.fn_encode_geohash(NEW.current_lat::double precision, NEW.current_lng::double precision, 6);
  ELSE
    NEW.geohash := NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_fn_driver_geohash"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_ride_otp"("_booking_id" "uuid", "_otp" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  b record;
  clean_otp text := trim(COALESCE(_otp, ''));
BEGIN
  -- Fetch booking record
  SELECT id, driver_id, status, ride_otp, customer_id
  INTO b
  FROM public.bookings
  WHERE id = _booking_id;

  IF b.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ride record not found.');
  END IF;

  -- Verify caller is assigned driver, customer, or admin (when auth is present)
  IF auth.uid() IS NOT NULL THEN
    IF NOT public.is_driver_of(b.driver_id, auth.uid()) THEN
      IF NOT public.has_role(auth.uid(), 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: You are not the assigned chauffeur for this ride.');
      END IF;
    END IF;
  END IF;

  -- Verify OTP matches passenger code
  IF b.ride_otp IS NULL OR clean_otp = '' OR b.ride_otp <> clean_otp THEN
    RETURN jsonb_build_object('success', false, 'error', 'Incorrect OTP. Please check with the passenger.');
  END IF;

  -- Set session guard flag for integrity trigger if present
  PERFORM set_config('app.otp_verified', 'on', true);

  -- Transition to in_progress and clear OTP (using empty string to satisfy NOT NULL constraints)
  UPDATE public.bookings
  SET status = 'in_progress',
      started_at = now(),
      updated_at = now(),
      ride_otp = ''
  WHERE id = _booking_id;

  PERFORM set_config('app.otp_verified', 'off', true);

  RETURN jsonb_build_object('success', true, 'message', 'OTP verified. Trip started successfully.');
END;
$$;


ALTER FUNCTION "public"."verify_ride_otp"("_booking_id" "uuid", "_otp" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reference" "text" DEFAULT "upper"("substr"("md5"(("random"())::"text"), 1, 8)) NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "driver_id" "uuid",
    "pickup_location" "text",
    "drop_location" "text",
    "pickup_lat" numeric,
    "pickup_lng" numeric,
    "drop_lat" numeric,
    "drop_lng" numeric,
    "distance_km" numeric DEFAULT 0 NOT NULL,
    "duration_min" integer DEFAULT 0 NOT NULL,
    "vehicle_code" "text" NOT NULL,
    "vehicle_name" "text" DEFAULT ''::"text" NOT NULL,
    "base_fare" numeric DEFAULT 0 NOT NULL,
    "distance_fare" numeric DEFAULT 0 NOT NULL,
    "tax_amount" numeric DEFAULT 0 NOT NULL,
    "estimated_fare" numeric DEFAULT 0 NOT NULL,
    "final_fare" numeric,
    "status" "text" DEFAULT 'searching'::"text" NOT NULL,
    "payment_method" "text" DEFAULT 'cash'::"text" NOT NULL,
    "payment_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "ride_otp" "text" DEFAULT ''::"text",
    "scheduled_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "arrived_at" timestamp with time zone,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "cancel_reason" "text" DEFAULT ''::"text" NOT NULL,
    "rating" integer,
    "review" "text" DEFAULT ''::"text" NOT NULL,
    "sos_raised" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pickup_area" "text" DEFAULT ''::"text" NOT NULL,
    "pickup_address" "text" DEFAULT ''::"text" NOT NULL,
    "drop_area" "text" DEFAULT ''::"text" NOT NULL,
    "drop_address" "text" DEFAULT ''::"text" NOT NULL,
    "safety_status" "text" DEFAULT 'ok'::"text",
    "pickup_geohash" "text"
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."corporate_enquiries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_name" "text" NOT NULL,
    "contact_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "city" "text" DEFAULT ''::"text",
    "team_size" "text" DEFAULT ''::"text",
    "requirement" "text" DEFAULT ''::"text",
    "message" "text" DEFAULT ''::"text",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."corporate_enquiries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driver_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "city" "text" NOT NULL,
    "experience_years" integer DEFAULT 0,
    "licence_number" "text" DEFAULT ''::"text",
    "owns_vehicle" boolean DEFAULT false,
    "message" "text" DEFAULT ''::"text",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "admin_notes" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "aadhaar_number" "text" DEFAULT ''::"text",
    "dl_url" "text" DEFAULT ''::"text",
    "photo_url" "text" DEFAULT ''::"text"
);


ALTER TABLE "public"."driver_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driver_cash_settlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "driver_id" "uuid" NOT NULL,
    "amount" numeric NOT NULL,
    "collected_by" "text" DEFAULT 'Admin'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "driver_cash_settlements_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."driver_cash_settlements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."drivers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "city" "text" NOT NULL,
    "driving_license" "text",
    "vehicle_model" "text" NOT NULL,
    "vehicle_number" "text" NOT NULL,
    "rating" numeric(3,2) DEFAULT 5.00 NOT NULL,
    "total_rides" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "is_verified" boolean DEFAULT false NOT NULL,
    "current_lat" numeric,
    "current_lng" numeric,
    "location_updated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_online" boolean DEFAULT false NOT NULL,
    "push_token" "text",
    "aadhaar_number" "text" DEFAULT ''::"text",
    "dl_url" "text" DEFAULT ''::"text",
    "photo_url" "text" DEFAULT ''::"text",
    "geohash" "text"
);


ALTER TABLE "public"."drivers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fleet_vehicles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plate_number" "text" NOT NULL,
    "model" "text" DEFAULT 'Mahindra BE.6'::"text" NOT NULL,
    "color" "text" DEFAULT 'Signature Orange'::"text",
    "battery_percentage" integer DEFAULT 100 NOT NULL,
    "status" "text" DEFAULT 'in_bay'::"text" NOT NULL,
    "assigned_driver_id" "uuid",
    "assigned_at" timestamp with time zone,
    "bay_number" "text" DEFAULT 'Bay 1'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "fleet_vehicles_battery_percentage_check" CHECK ((("battery_percentage" >= 0) AND ("battery_percentage" <= 100))),
    CONSTRAINT "fleet_vehicles_status_check" CHECK (("status" = ANY (ARRAY['in_bay'::"text", 'assigned'::"text", 'maintenance'::"text"])))
);


ALTER TABLE "public"."fleet_vehicles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pricing_settings" (
    "id" integer NOT NULL,
    "tax_percent" numeric DEFAULT 5.0 NOT NULL,
    "platform_fee" numeric DEFAULT 20.0 NOT NULL,
    "surge_multiplier" numeric DEFAULT 1.0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pricing_settings_id_check" CHECK (("id" = 1))
);


ALTER TABLE "public"."pricing_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" DEFAULT ''::"text" NOT NULL,
    "phone" "text" DEFAULT ''::"text" NOT NULL,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "push_token" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_areas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "lat" numeric NOT NULL,
    "lng" numeric NOT NULL,
    "is_airport" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."service_areas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicle_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "tagline" "text" DEFAULT ''::"text" NOT NULL,
    "seats" integer NOT NULL,
    "base_fare" numeric NOT NULL,
    "per_km" numeric NOT NULL,
    "minimum_fare" numeric NOT NULL,
    "image_url" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vehicle_categories" OWNER TO "postgres";


ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_reference_key" UNIQUE ("reference");



ALTER TABLE ONLY "public"."corporate_enquiries"
    ADD CONSTRAINT "corporate_enquiries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_applications"
    ADD CONSTRAINT "driver_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_cash_settlements"
    ADD CONSTRAINT "driver_cash_settlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."drivers"
    ADD CONSTRAINT "drivers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."drivers"
    ADD CONSTRAINT "drivers_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."fleet_vehicles"
    ADD CONSTRAINT "fleet_vehicles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fleet_vehicles"
    ADD CONSTRAINT "fleet_vehicles_plate_number_key" UNIQUE ("plate_number");



ALTER TABLE ONLY "public"."pricing_settings"
    ADD CONSTRAINT "pricing_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_areas"
    ADD CONSTRAINT "service_areas_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."service_areas"
    ADD CONSTRAINT "service_areas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role");



ALTER TABLE ONLY "public"."vehicle_categories"
    ADD CONSTRAINT "vehicle_categories_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."vehicle_categories"
    ADD CONSTRAINT "vehicle_categories_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_bookings_pickup_geohash" ON "public"."bookings" USING "btree" ("pickup_geohash") WHERE ("status" = 'searching'::"text");



CREATE INDEX "idx_drivers_geohash" ON "public"."drivers" USING "btree" ("geohash") WHERE ("is_online" = true);



CREATE OR REPLACE TRIGGER "trg_booking_geohash" BEFORE INSERT OR UPDATE OF "pickup_address" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."trg_fn_booking_geohash"();



CREATE OR REPLACE TRIGGER "trg_driver_geohash" BEFORE INSERT OR UPDATE OF "current_lat", "current_lng" ON "public"."drivers" FOR EACH ROW EXECUTE FUNCTION "public"."trg_fn_driver_geohash"();



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id");



ALTER TABLE ONLY "public"."driver_cash_settlements"
    ADD CONSTRAINT "driver_cash_settlements_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."drivers"
    ADD CONSTRAINT "drivers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fleet_vehicles"
    ADD CONSTRAINT "fleet_vehicles_assigned_driver_id_fkey" FOREIGN KEY ("assigned_driver_id") REFERENCES "public"."drivers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admin manage applications" ON "public"."driver_applications" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admin manage enquiries" ON "public"."corporate_enquiries" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Allow all on driver_cash_settlements" ON "public"."driver_cash_settlements" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all on fleet_vehicles" ON "public"."fleet_vehicles" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated users to insert" ON "public"."fleet_vehicles" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to update" ON "public"."fleet_vehicles" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow public read access" ON "public"."fleet_vehicles" FOR SELECT USING (true);



CREATE POLICY "Anyone can insert applications" ON "public"."driver_applications" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Anyone can insert enquiries" ON "public"."corporate_enquiries" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Drivers can update own record" ON "public"."drivers" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Drivers can view assigned bookings" ON "public"."bookings" FOR SELECT USING ((("status" = 'searching'::"text") OR "public"."is_driver_of"("driver_id", "auth"."uid"())));



CREATE POLICY "Riders can view own bookings" ON "public"."bookings" FOR SELECT USING (("auth"."uid"() = "customer_id"));



CREATE POLICY "admin deletes bookings" ON "public"."bookings" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "admin manage areas" ON "public"."service_areas" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "admin manage drivers" ON "public"."drivers" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "admin manage pricing" ON "public"."pricing_settings" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "admin manage vehicles" ON "public"."vehicle_categories" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "areas readable by all" ON "public"."service_areas" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bookings read" ON "public"."bookings" FOR SELECT TO "authenticated" USING ((("customer_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'driver'::"public"."app_role") AND (("driver_id" IS NULL) OR "public"."is_driver_of"("driver_id", "auth"."uid"())))));



CREATE POLICY "bookings update" ON "public"."bookings" FOR UPDATE TO "authenticated" USING ((("customer_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'driver'::"public"."app_role"))) WITH CHECK ((("customer_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'driver'::"public"."app_role")));



ALTER TABLE "public"."corporate_enquiries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer creates booking" ON "public"."bookings" FOR INSERT TO "authenticated" WITH CHECK (("customer_id" = "auth"."uid"()));



ALTER TABLE "public"."driver_applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driver_cash_settlements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."drivers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "drivers read scoped" ON "public"."drivers" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM "public"."bookings" "b"
  WHERE (("b"."driver_id" = "drivers"."id") AND ("b"."customer_id" = "auth"."uid"()))))));



CREATE POLICY "drivers self update" ON "public"."drivers" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."fleet_vehicles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pricing readable by all" ON "public"."pricing_settings" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."pricing_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles read" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'driver'::"public"."app_role")));



CREATE POLICY "profiles update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "roles readable by self and admin" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



ALTER TABLE "public"."service_areas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vehicle_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vehicles readable by all" ON "public"."vehicle_categories" FOR SELECT TO "authenticated", "anon" USING (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."bookings";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."drivers";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."admin_set_role"("_email" "text", "_role" "public"."app_role", "_grant" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_set_role"("_email" "text", "_role" "public"."app_role", "_grant" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_set_role"("_email" "text", "_role" "public"."app_role", "_grant" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_encode_geohash"("lat" double precision, "lng" double precision, "precision_len" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_encode_geohash"("lat" double precision, "lng" double precision, "precision_len" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_encode_geohash"("lat" double precision, "lng" double precision, "precision_len" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_nearby_drivers"("p_lat" double precision, "p_lng" double precision, "p_radius_km" double precision, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_nearby_drivers"("p_lat" double precision, "p_lng" double precision, "p_radius_km" double precision, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_nearby_drivers"("p_lat" double precision, "p_lng" double precision, "p_radius_km" double precision, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_surge_multiplier"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_surge_multiplier"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_surge_multiplier"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_driver_of"("_booking_driver" "uuid", "_user" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_driver_of"("_booking_driver" "uuid", "_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_driver_of"("_booking_driver" "uuid", "_user" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_fn_booking_geohash"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_fn_booking_geohash"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_fn_booking_geohash"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_fn_driver_geohash"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_fn_driver_geohash"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_fn_driver_geohash"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_ride_otp"("_booking_id" "uuid", "_otp" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_ride_otp"("_booking_id" "uuid", "_otp" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_ride_otp"("_booking_id" "uuid", "_otp" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."corporate_enquiries" TO "anon";
GRANT ALL ON TABLE "public"."corporate_enquiries" TO "authenticated";
GRANT ALL ON TABLE "public"."corporate_enquiries" TO "service_role";



GRANT ALL ON TABLE "public"."driver_applications" TO "anon";
GRANT ALL ON TABLE "public"."driver_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_applications" TO "service_role";



GRANT ALL ON TABLE "public"."driver_cash_settlements" TO "anon";
GRANT ALL ON TABLE "public"."driver_cash_settlements" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_cash_settlements" TO "service_role";



GRANT ALL ON TABLE "public"."drivers" TO "anon";
GRANT ALL ON TABLE "public"."drivers" TO "authenticated";
GRANT ALL ON TABLE "public"."drivers" TO "service_role";



GRANT ALL ON TABLE "public"."fleet_vehicles" TO "anon";
GRANT ALL ON TABLE "public"."fleet_vehicles" TO "authenticated";
GRANT ALL ON TABLE "public"."fleet_vehicles" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_settings" TO "anon";
GRANT ALL ON TABLE "public"."pricing_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_settings" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."service_areas" TO "anon";
GRANT ALL ON TABLE "public"."service_areas" TO "authenticated";
GRANT ALL ON TABLE "public"."service_areas" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."vehicle_categories" TO "anon";
GRANT ALL ON TABLE "public"."vehicle_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicle_categories" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































