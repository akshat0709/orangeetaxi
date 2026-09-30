CREATE OR REPLACE FUNCTION public.get_surge_multiplier()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  active_searching_rides int;
  online_drivers int;
  ratio numeric;
  surge numeric;
BEGIN
  -- Count how many bookings are currently 'searching'
  SELECT count(*) INTO active_searching_rides FROM public.bookings WHERE status = 'searching';
  
  -- Count how many drivers are currently 'online'
  SELECT count(*) INTO online_drivers FROM public.drivers WHERE is_online = true;
  
  -- Default surge
  surge := 1.0;
  
  IF online_drivers > 0 THEN
    ratio := active_searching_rides::numeric / online_drivers::numeric;
    
    -- If there are more searching rides than online drivers
    IF ratio >= 2.0 THEN
      surge := 1.5;
    ELSIF ratio >= 1.0 THEN
      surge := 1.2;
    END IF;
  ELSE
    -- If there are NO online drivers, but there are searching rides, apply max surge
    IF active_searching_rides > 0 THEN
      surge := 2.0;
    END IF;
  END IF;
  
  RETURN surge;
END;
$$;
