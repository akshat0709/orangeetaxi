-- One-time DATA step (not a migration): run after 20261025150000, once the owner confirms.
--
-- Keeps what riders see today now that the website and app read vehicles from the database:
--   * adds Orange Signature at the price the website/app showed until now (₹99 + ₹18/km, min ₹149);
--   * hides the old Orange Go / Sedan / XL categories (riders never saw them on the website);
--     an admin can switch any of them back on in Admin → Pricing;
--   * platform fee ₹0 (owner decision, 2026-10-25).
-- Safe to run more than once.
INSERT INTO public.vehicle_categories (code, name, tagline, seats, base_fare, per_km, minimum_fare, is_active, sort_order)
VALUES ('ORANGE_SIGNATURE', 'Orange Signature', 'Spotless, Pre-Cooled Mahindra BE 6 EV', 4, 99, 18, 149, true, 1)
ON CONFLICT (code) DO NOTHING;

UPDATE public.vehicle_categories SET is_active = false
 WHERE code IN ('ORANGE_GO', 'ORANGE_SEDAN', 'ORANGE_XL');

UPDATE public.pricing_settings SET platform_fee = 0 WHERE id = 1;

SELECT code, name, base_fare, per_km, minimum_fare, is_active FROM public.vehicle_categories ORDER BY sort_order;
