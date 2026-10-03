import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/akshatgupta/Desktop/a/orangeetaxi/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('driver_applications').insert({
    email: 'test_driver123@example.com',
    full_name: 'Test Driver',
    phone: '+919999999999',
    city: 'Delhi',
    licence_number: 'DL12345',
    aadhaar_number: '123412341234',
    experience_years: 5,
    photo_url: 'http://example.com/photo.jpg',
    dl_url: 'http://example.com/dl.jpg',
    owns_vehicle: true,
    status: 'new',
    message: ''
  });
  console.log("Error:", error);
  console.log("Data:", data);
}
test();
