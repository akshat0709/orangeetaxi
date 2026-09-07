CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
