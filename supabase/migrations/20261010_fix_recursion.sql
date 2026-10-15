GRANT EXECUTE ON FUNCTION public.is_driver_of(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Drivers can view assigned bookings" ON public.bookings;

CREATE POLICY "Drivers can view assigned bookings" ON public.bookings FOR SELECT USING (
  status = 'searching' 
  OR 
  public.is_driver_of(driver_id, auth.uid())
);
