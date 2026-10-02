INSERT INTO storage.buckets (id, name, public)
VALUES ('driver_kyc', 'driver_kyc', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'driver_kyc');
CREATE POLICY "Anon Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'driver_kyc');
