-- ============================================================================
-- ORANGE TAXI MUMBAI - FIX BOOKINGS INSERT RLS POLICY
-- Allows authenticated riders (and guest/fallback inserts where customer_id IS NULL)
-- ============================================================================

DROP POLICY IF EXISTS "bookings_insert_customer" ON public.bookings;
CREATE POLICY "bookings_insert_customer" ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid() 
    OR customer_id IS NULL 
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "bookings_insert_anon" ON public.bookings;
CREATE POLICY "bookings_insert_anon" ON public.bookings
  FOR INSERT TO anon
  WITH CHECK (customer_id IS NULL);
