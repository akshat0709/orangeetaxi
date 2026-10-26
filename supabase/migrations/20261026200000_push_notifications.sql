-- ============================================================================
-- Orange Taxi — push notifications to chauffeurs and passengers (2026-10-26)
--
-- Why: new-ride alerts were only raised by the driver app itself while it was open and
-- connected. With the app in the background, closed, or the phone locked, Android pauses the
-- app and the chauffeur never heard about the ride. Now the database sends a real push
-- notification (through Expo's push service) the moment a ride needs a chauffeur, so it
-- arrives even when the app is not running.
--
-- Sends to:
--   * new ride looking for a chauffeur -> online, free chauffeurs within 5 km of the pickup
--     (same radius the app uses), or online free chauffeurs whose location is unknown;
--   * scheduled ride dispatched to a chauffeur -> that chauffeur;
--   * ride cancelled by the passenger/admin -> the assigned chauffeur;
--   * passenger: chauffeur accepted / arrived (with the ride OTP) / ride completed /
--     ride cancelled by the chauffeur or Orange Taxi.
-- The driver app saves its Expo push token in drivers.push_token, the passenger app in
-- profiles.push_token.
-- A failed push never blocks or rolls back the booking. Idempotent.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.send_expo_push(_messages jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF _messages IS NULL OR jsonb_array_length(_messages) = 0 THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := _messages,
    headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Expo push failed: %', SQLERRM;
END; $$;
REVOKE ALL ON FUNCTION public.send_expo_push(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_drivers_of_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  plat double precision := NEW.pickup_lat;
  plng double precision := NEW.pickup_lng;
  coords text[];
  fare text := '₹' || round(COALESCE(NEW.final_fare, NEW.estimated_fare, 0))::text;
  route text := COALESCE(NULLIF(NEW.pickup_area, ''), 'Pickup') || ' → ' || COALESCE(NULLIF(NEW.drop_area, ''), 'Drop');
  msgs jsonb;
  token text;
BEGIN
  -- 1. A ride is looking for a chauffeur.
  IF NEW.status = 'searching' AND NEW.driver_id IS NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'searching') THEN
    IF plat IS NULL OR plng IS NULL THEN
      coords := string_to_array(split_part(COALESCE(NEW.pickup_address, ''), '|', 1), ',');
      BEGIN
        plat := NULLIF(trim(coords[1]), '')::double precision;
        plng := NULLIF(trim(coords[2]), '')::double precision;
      EXCEPTION WHEN OTHERS THEN
        plat := NULL; plng := NULL;
      END;
    END IF;

    SELECT jsonb_agg(jsonb_build_object(
             'to', d.push_token,
             'title', 'New ride request · ' || fare,
             'body', route,
             'sound', 'default',
             'priority', 'high',
             'channelId', 'orange-driver-dispatches',
             'ttl', 120,
             'data', jsonb_build_object('type', 'new_ride', 'bookingId', NEW.id)))
      INTO msgs
    FROM (
      SELECT dr.push_token
      FROM drivers dr
      WHERE dr.is_online IS TRUE
        AND COALESCE(dr.is_active, true)
        AND dr.push_token LIKE 'ExponentPushToken[%'
        AND NOT EXISTS (
          SELECT 1 FROM bookings b
          WHERE b.driver_id = dr.id AND b.status IN ('accepted', 'arrived', 'in_progress'))
        AND (
          plat IS NULL OR plng IS NULL OR dr.current_lat IS NULL OR dr.current_lng IS NULL
          OR 6371 * 2 * asin(sqrt(
               power(sin(radians(dr.current_lat - plat) / 2), 2)
               + cos(radians(plat)) * cos(radians(dr.current_lat))
                 * power(sin(radians(dr.current_lng - plng) / 2), 2))) <= 5)
      LIMIT 100
    ) d;
    PERFORM public.send_expo_push(msgs);
    RETURN NEW;
  END IF;

  IF TG_OP <> 'UPDATE' OR NEW.driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT push_token INTO token FROM drivers WHERE id = NEW.driver_id;
  IF token IS NULL OR token NOT LIKE 'ExponentPushToken[%' THEN
    RETURN NEW;
  END IF;

  -- 2. A scheduled ride was handed to this chauffeur by the server.
  IF OLD.status = 'scheduled' AND NEW.status = 'accepted' THEN
    PERFORM public.send_expo_push(jsonb_build_array(jsonb_build_object(
      'to', token,
      'title', 'Scheduled ride starting',
      'body', 'Head to pickup: ' || COALESCE(NULLIF(NEW.pickup_area, ''), 'see the app'),
      'sound', 'default', 'priority', 'high', 'channelId', 'orange-driver-dispatches',
      'data', jsonb_build_object('type', 'scheduled_ride', 'bookingId', NEW.id))));

  -- 3. The passenger (or admin) cancelled a ride this chauffeur had.
  ELSIF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled'
        AND OLD.status IN ('accepted', 'arrived', 'in_progress')
        AND COALESCE(NEW.cancelled_by, '') <> 'driver' THEN
    PERFORM public.send_expo_push(jsonb_build_array(jsonb_build_object(
      'to', token,
      'title', 'Ride cancelled',
      'body', 'The passenger cancelled ' || COALESCE(NEW.reference, 'the ride') || '.',
      'sound', 'default', 'priority', 'high', 'channelId', 'orange-driver-dispatches',
      'data', jsonb_build_object('type', 'ride_cancelled', 'bookingId', NEW.id))));
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_drivers_of_booking failed: %', SQLERRM;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.notify_drivers_of_booking() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bookings_notify_drivers ON public.bookings;
CREATE TRIGGER trg_bookings_notify_drivers
  AFTER INSERT OR UPDATE OF status, driver_id ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_drivers_of_booking();

-- Passenger notifications ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_passenger_of_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  token text;
  dname text;
  plate text;
  title text;
  body text;
BEGIN
  IF NEW.customer_id IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  SELECT push_token INTO token FROM profiles WHERE id = NEW.customer_id;
  IF token IS NULL OR token NOT LIKE 'ExponentPushToken[%' THEN
    RETURN NEW;
  END IF;
  SELECT split_part(COALESCE(full_name, ''), ' ', 1), vehicle_number INTO dname, plate
  FROM drivers WHERE id = NEW.driver_id;
  dname := COALESCE(NULLIF(dname, ''), 'Your chauffeur');
  plate := COALESCE(NULLIF(NEW.vehicle_number, ''), plate);

  IF NEW.status = 'accepted' THEN
    title := 'Chauffeur on the way';
    body := dname || ' accepted your ride' || COALESCE(' · ' || plate, '') || '.';
  ELSIF NEW.status = 'arrived' THEN
    title := 'Your chauffeur has arrived';
    body := dname || ' is at the pickup' || COALESCE(' · ' || plate, '')
            || COALESCE('. Ride OTP: ' || NULLIF(NEW.ride_otp, ''), '') || '.';
  ELSIF NEW.status = 'completed' THEN
    title := 'Ride complete';
    body := 'Thanks for riding with Orange Taxi. Fare: ₹'
            || round(COALESCE(NEW.final_fare, NEW.estimated_fare, 0))::text || '.';
  ELSIF NEW.status = 'cancelled' AND COALESCE(NEW.cancelled_by, '') <> 'passenger'
        AND OLD.status IN ('searching', 'scheduled', 'accepted', 'arrived') THEN
    title := 'Ride cancelled';
    body := 'Your ride ' || COALESCE(NEW.reference, '') || ' was cancelled. Open the app to book again.';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.send_expo_push(jsonb_build_array(jsonb_build_object(
    'to', token, 'title', title, 'body', body,
    'sound', 'default', 'priority', 'high', 'channelId', 'orange-taxi-updates',
    'data', jsonb_build_object('type', 'ride_update', 'bookingId', NEW.id, 'status', NEW.status))));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_passenger_of_booking failed: %', SQLERRM;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.notify_passenger_of_booking() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bookings_notify_passenger ON public.bookings;
CREATE TRIGGER trg_bookings_notify_passenger
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_passenger_of_booking();
