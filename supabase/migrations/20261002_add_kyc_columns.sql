ALTER TABLE public.driver_applications 
ADD COLUMN IF NOT EXISTS aadhaar_number text DEFAULT '',
ADD COLUMN IF NOT EXISTS dl_url text DEFAULT '',
ADD COLUMN IF NOT EXISTS photo_url text DEFAULT '';

ALTER TABLE public.drivers
ADD COLUMN IF NOT EXISTS aadhaar_number text DEFAULT '',
ADD COLUMN IF NOT EXISTS dl_url text DEFAULT '',
ADD COLUMN IF NOT EXISTS photo_url text DEFAULT '';
