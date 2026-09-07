-- roles
CREATE TYPE public.app_role AS ENUM ('admin','driver','customer');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'driver'));
CREATE POLICY "own profile write" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- new user bootstrap
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- config
CREATE TABLE public.vehicle_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text NOT NULL DEFAULT '',
  seats int NOT NULL DEFAULT 4,
  base_fare numeric NOT NULL,
  per_km numeric NOT NULL,
  minimum_fare numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vehicle_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.vehicle_categories TO authenticated;
GRANT ALL ON public.vehicle_categories TO service_role;
ALTER TABLE public.vehicle_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.vehicle_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "categories admin write" ON public.vehicle_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER vc_updated BEFORE UPDATE ON public.vehicle_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  is_airport boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.service_areas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.service_areas TO authenticated;
GRANT ALL ON public.service_areas TO service_role;
ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "areas public read" ON public.service_areas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "areas admin write" ON public.service_areas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.pricing_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  waiting_charge_per_min numeric NOT NULL DEFAULT 2,
  waiting_free_minutes int NOT NULL DEFAULT 3,
  cancellation_charge numeric NOT NULL DEFAULT 50,
  surge_enabled boolean NOT NULL DEFAULT false,
  surge_multiplier numeric NOT NULL DEFAULT 1,
  tax_percent numeric NOT NULL DEFAULT 0,
  platform_fee numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  demo_note text NOT NULL DEFAULT 'Demo configuration — final commercial rates and operating rules will be configured by Orange Taxi.',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pricing_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.pricing_settings TO authenticated;
GRANT ALL ON public.pricing_settings TO service_role;
ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing public read" ON public.pricing_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "pricing admin write" ON public.pricing_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER ps_updated BEFORE UPDATE ON public.pricing_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- drivers
CREATE TABLE public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  vehicle_code text NOT NULL DEFAULT 'ORANGE_SEDAN',
  vehicle_model text NOT NULL DEFAULT '',
  vehicle_number text NOT NULL DEFAULT '',
  is_online boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  rating numeric NOT NULL DEFAULT 5,
  total_rides int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drivers readable by signed in" ON public.drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY "driver updates own" ON public.drivers FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manages drivers" ON public.drivers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR user_id = auth.uid());
CREATE POLICY "admin deletes drivers" ON public.drivers FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER drivers_updated BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.driver_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  city text NOT NULL,
  licence_number text NOT NULL DEFAULT '',
  experience_years int NOT NULL DEFAULT 0,
  owns_vehicle boolean NOT NULL DEFAULT false,
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new',
  admin_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.driver_applications TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.driver_applications TO authenticated;
GRANT ALL ON public.driver_applications TO service_role;
ALTER TABLE public.driver_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can apply" ON public.driver_applications FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admin reads applications" ON public.driver_applications FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin updates applications" ON public.driver_applications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin deletes applications" ON public.driver_applications FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER da_updated BEFORE UPDATE ON public.driver_applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- corporate enquiries
CREATE TABLE public.corporate_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  city text NOT NULL DEFAULT '',
  team_size text NOT NULL DEFAULT '',
  requirement text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.corporate_enquiries TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.corporate_enquiries TO authenticated;
GRANT ALL ON public.corporate_enquiries TO service_role;
ALTER TABLE public.corporate_enquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can enquire" ON public.corporate_enquiries FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admin reads enquiries" ON public.corporate_enquiries FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin updates enquiries" ON public.corporate_enquiries FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin deletes enquiries" ON public.corporate_enquiries FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER ce_updated BEFORE UPDATE ON public.corporate_enquiries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- bookings
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE DEFAULT ('OT' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  pickup_area text NOT NULL,
  pickup_address text NOT NULL DEFAULT '',
  drop_area text NOT NULL,
  drop_address text NOT NULL DEFAULT '',
  distance_km numeric NOT NULL DEFAULT 0,
  duration_min int NOT NULL DEFAULT 0,
  vehicle_code text NOT NULL,
  vehicle_name text NOT NULL DEFAULT '',
  base_fare numeric NOT NULL DEFAULT 0,
  distance_fare numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  estimated_fare numeric NOT NULL DEFAULT 0,
  final_fare numeric,
  status text NOT NULL DEFAULT 'searching',
  payment_method text NOT NULL DEFAULT 'cash',
  payment_status text NOT NULL DEFAULT 'pending',
  scheduled_at timestamptz,
  accepted_at timestamptz,
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text NOT NULL DEFAULT '',
  rating int,
  review text NOT NULL DEFAULT '',
  sos_raised boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_driver_of(_booking_driver uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = _booking_driver AND d.user_id = _user)
$$;

CREATE POLICY "bookings read" ON public.bookings FOR SELECT TO authenticated USING (
  customer_id = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR (public.has_role(auth.uid(),'driver') AND (driver_id IS NULL OR public.is_driver_of(driver_id, auth.uid())))
);
CREATE POLICY "customer creates booking" ON public.bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "bookings update" ON public.bookings FOR UPDATE TO authenticated USING (
  customer_id = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'driver')
) WITH CHECK (
  customer_id = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'driver')
);
CREATE POLICY "admin deletes bookings" ON public.bookings FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER bookings_updated BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- seed demo configuration
INSERT INTO public.pricing_settings (id) VALUES (1);

INSERT INTO public.vehicle_categories (code,name,tagline,seats,base_fare,per_km,minimum_fare,sort_order) VALUES
 ('ORANGE_GO','Orange Go','Economy electric hatchback for everyday city rides',4,49,12,99,1),
 ('ORANGE_SEDAN','Orange Sedan','Premium electric sedan with extra comfort',4,59,15,129,2),
 ('ORANGE_XL','Orange XL','Six to seven seater for groups, luggage and airport runs',6,79,20,179,3);

INSERT INTO public.service_areas (name,lat,lng,is_airport,sort_order) VALUES
 ('Delhi',28.6139,77.2090,false,1),
 ('Gurugram',28.4595,77.0266,false,2),
 ('Noida',28.5355,77.3910,false,3),
 ('Ghaziabad',28.6692,77.4538,false,4),
 ('Faridabad',28.4089,77.3178,false,5),
 ('IGI Airport (T1)',28.5562,77.0999,true,6),
 ('IGI Airport (T3)',28.5562,77.1000,true,7);