CREATE OR REPLACE FUNCTION public.admin_set_role(_email text, _role public.app_role, _grant boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RETURN 'forbidden'; END IF;
  SELECT id INTO target FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF target IS NULL THEN RETURN 'not_found'; END IF;
  
  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (target, _role) ON CONFLICT DO NOTHING;
    
    -- If granting driver role, automatically create their driver profile
    IF _role = 'driver' THEN
      INSERT INTO public.drivers (user_id, full_name, city, phone, vehicle_model, vehicle_number)
      VALUES (
        target, 
        split_part(_email, '@', 1), -- fallback name
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
