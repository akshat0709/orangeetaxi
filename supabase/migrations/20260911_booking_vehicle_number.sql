-- Migration: Add vehicle_number to bookings table
-- Run this in the Supabase Dashboard SQL Editor if you wish to have a dedicated vehicle_number column:
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS vehicle_number text;
