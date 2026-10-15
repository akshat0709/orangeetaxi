-- Drop the broken policies created by the earlier security audit
DROP POLICY IF EXISTS "Riders can view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Drivers can view assigned bookings" ON public.bookings;

-- Create correct policies that account for the status 'searching' and driver_id vs user_id
CREATE POLICY "Riders can view own bookings" ON public.bookings FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "Drivers can view assigned bookings" ON public.bookings FOR SELECT USING (
  status = 'searching' 
  OR 
  (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()))
);
