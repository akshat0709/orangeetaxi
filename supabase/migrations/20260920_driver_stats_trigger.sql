-- Migration: Automatically update driver total_rides and rating upon booking completion or rating
-- Uses SECURITY DEFINER to bypass client RLS restrictions safely

CREATE OR REPLACE FUNCTION public.handle_booking_driver_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_driver_id uuid;
  v_total_rides int;
  v_avg_rating numeric(3,1);
BEGIN
  v_driver_id := NEW.driver_id;
  IF v_driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count total completed rides for this driver
  SELECT COUNT(*) INTO v_total_rides
  FROM public.bookings
  WHERE driver_id = v_driver_id AND status = 'completed';

  -- Calculate average rating from all rated bookings for this driver
  SELECT ROUND(AVG(rating)::numeric, 1) INTO v_avg_rating
  FROM public.bookings
  WHERE driver_id = v_driver_id AND rating IS NOT NULL;

  IF v_avg_rating IS NULL THEN
    v_avg_rating := 5.0;
  END IF;

  -- Update driver record
  UPDATE public.drivers
  SET
    total_rides = GREATEST(COALESCE(total_rides, 0), v_total_rides),
    rating = v_avg_rating,
    updated_at = now()
  WHERE id = v_driver_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_booking_driver_stats ON public.bookings;
CREATE TRIGGER trigger_booking_driver_stats
AFTER INSERT OR UPDATE OF status, rating ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.handle_booking_driver_stats();
