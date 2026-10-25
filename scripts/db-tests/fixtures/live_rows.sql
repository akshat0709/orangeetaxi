-- Synthetic rows shaped like the live project's data, inserted BEFORE the catch-up runs, so the
-- catch-up's backfills and the new triggers are exercised against existing data. No real data.
-- Supabase creates this trigger on the live project (the schema dump leaves out auth.* triggers).
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO auth.users (id, email, phone, raw_user_meta_data) VALUES
  -- The live handle_new_user() needs full_name and phone in the sign-up metadata (NOT NULL columns).
  ('11111111-0000-4000-8000-000000000001', 'legacy.rider@x.in', null, '{"full_name":"Legacy Rider","phone":"+919800000000"}'),
  ('11111111-0000-4000-8000-000000000002', 'legacy.driver@x.in', '+919800000001', '{"full_name":"Legacy Driver","phone":"+919800000001"}'),
  ('11111111-0000-4000-8000-000000000003', 'legacy.idle@x.in', '+919800000002', '{"full_name":"Idle","phone":"+919800000002"}');
INSERT INTO public.user_roles (user_id, role) VALUES
  ('11111111-0000-4000-8000-000000000002', 'driver'), ('11111111-0000-4000-8000-000000000003', 'driver')
  ON CONFLICT DO NOTHING;

INSERT INTO public.pricing_settings (id, tax_percent, platform_fee) VALUES (1, 0, 0);
INSERT INTO public.vehicle_categories (code, name, tagline, seats, base_fare, per_km, minimum_fare, sort_order)
VALUES ('ORANGE_SEDAN', 'Orange Sedan', 'Legacy category', 4, 59, 15, 129, 2);

-- One approved driver with a location (geohash backfill), one never activated.
INSERT INTO public.drivers (id, user_id, full_name, phone, city, vehicle_model, vehicle_number, is_active, is_verified,
  is_online, current_lat, current_lng, rating, total_rides)
VALUES
  ('22222222-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000002', 'Legacy Driver', '+919800000001',
   'Bengaluru', 'Mahindra BE.6', 'KA 01 AB 1234', false, false, false, 12.97, 77.59, 4.7, 44),
  ('22222222-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000003', 'Idle Applicant', '+919800000002',
   'Bengaluru', 'Tata Nexon EV', 'KA 01 CD 5678', false, false, false, null, null, 5, 0);

-- A completed, unrated ride (the rating that failed on 2026-10-25) and an older cancelled one.
INSERT INTO public.bookings (id, reference, customer_id, driver_id, pickup_area, pickup_address, drop_area, drop_address,
  distance_km, vehicle_code, vehicle_name, estimated_fare, final_fare, status, payment_method, payment_status,
  ride_otp, completed_at)
VALUES
  ('33333333-0000-4000-8000-000000000001', 'LEGACY01', '11111111-0000-4000-8000-000000000001',
   '22222222-0000-4000-8000-000000000001', 'Koramangala', '12.93,77.62', 'Indiranagar', '12.97,77.64',
   6, 'ORANGE_SEDAN', 'Orange Sedan', 255, 255, 'completed', 'cash', 'paid', '', now()),
  ('33333333-0000-4000-8000-000000000002', 'LEGACY02', '11111111-0000-4000-8000-000000000001',
   null, 'Koramangala', '12.93,77.62', 'Airport', '13.19,77.70', 35, 'ORANGE_SEDAN', 'Orange Sedan',
   600, null, 'cancelled', 'cash', 'pending', '', null);
