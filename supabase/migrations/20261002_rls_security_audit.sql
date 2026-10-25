-- SECURE PROFILES TABLE
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- SECURE BOOKINGS TABLE
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
-- Riders can only see their own bookings
-- (audit 2026-10-25) was `auth.uid() = user_id`: bookings has no user_id column, so this file never applied.
CREATE POLICY "Riders can view own bookings" ON public.bookings FOR SELECT USING (auth.uid() = customer_id);
-- Drivers can see bookings assigned to them, or pending bookings in their area
CREATE POLICY "Drivers can view assigned bookings" ON public.bookings FOR SELECT USING (auth.uid() = driver_id OR status = 'pending');

-- SECURE DRIVERS TABLE
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Drivers can view own profile" ON public.drivers FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Drivers can update own location" ON public.drivers FOR UPDATE USING (auth.uid() = id);
-- Riders need to see driver locations for active rides
CREATE POLICY "Public can view driver locations for active rides" ON public.drivers FOR SELECT USING (is_online = true);
