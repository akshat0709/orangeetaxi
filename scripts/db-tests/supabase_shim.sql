-- Minimal stand-in for the parts of Supabase the migrations rely on.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  phone text,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.role() TO anon, authenticated, service_role;

CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean DEFAULT false);
CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text, name text, owner uuid
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT ALL ON storage.objects, storage.buckets TO anon, authenticated, service_role;
CREATE FUNCTION storage.extension(name text) RETURNS text LANGUAGE sql IMMUTABLE AS
  $$ SELECT lower(reverse(split_part(reverse(name), '.', 1))) $$;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS
  $$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;

CREATE PUBLICATION supabase_realtime;

-- Realtime Authorization stand-in (private channels): policies on realtime.messages use realtime.topic().
CREATE SCHEMA realtime;
GRANT USAGE ON SCHEMA realtime TO anon, authenticated, service_role;
CREATE TABLE realtime.messages (id bigserial PRIMARY KEY, topic text, payload jsonb);
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
GRANT ALL ON realtime.messages TO anon, authenticated, service_role;
GRANT USAGE ON SEQUENCE realtime.messages_id_seq TO anon, authenticated, service_role;
CREATE FUNCTION realtime.topic() RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('realtime.topic', true), '') $$;
GRANT EXECUTE ON FUNCTION realtime.topic() TO anon, authenticated, service_role;
