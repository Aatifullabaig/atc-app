-- ============================================
-- ATC TRACKER - Complete Database Setup
-- Execute this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. ENABLE EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "http";

-- ============================================
-- 2. CREATE CORE TABLES
-- ============================================

-- Users Table (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  is_approved BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Pilots Table (Instructors and Cadets)
CREATE TABLE IF NOT EXISTS public.pilots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  role TEXT NOT NULL,
  license_number TEXT,
  medical_expiry DATE,
  is_active BOOLEAN DEFAULT TRUE,
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Aircraft Table
CREATE TABLE IF NOT EXISTS public.aircraft (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  callsign TEXT,
  type TEXT NOT NULL,
  manufacturer TEXT,
  model TEXT,
  status TEXT DEFAULT 'grounded',
  max_altitude FLOAT,
  max_speed FLOAT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Flights Table
CREATE TABLE IF NOT EXISTS public.flights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  callsign TEXT NOT NULL,
  aircraft_id UUID REFERENCES public.aircraft(id) ON DELETE SET NULL,
  pic_id UUID REFERENCES public.pilots(id) ON DELETE SET NULL,
  instructor_id UUID REFERENCES public.pilots(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'tower',
  phase TEXT DEFAULT 'taxi',
  runway TEXT DEFAULT '22',
  radial_deg INT,
  distance_nm NUMERIC,
  altitude_feet INT,
  direction TEXT DEFAULT 'inbound',
  go_arounds INT DEFAULT 0,
  airborne_at TIMESTAMP WITH TIME ZONE,
  landing_time TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  landing_count INT DEFAULT 0,
  logs JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- VOR Configuration Table
CREATE TABLE IF NOT EXISTS public.vor_config (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL DEFAULT 'VOR',
  latitude DECIMAL(10, 6) NOT NULL,
  longitude DECIMAL(10, 6) NOT NULL,
  frequency VARCHAR(50) DEFAULT '114.2 MHz',
  airport_code VARCHAR(10) DEFAULT 'VAGD',
  magnetic_variation DECIMAL(4, 2) DEFAULT 0.1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Global State Table (for system configuration)
CREATE TABLE IF NOT EXISTS public.global_state (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log Table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_approved ON public.users(is_approved);
CREATE INDEX IF NOT EXISTS idx_pilots_user_id ON public.pilots(user_id);
CREATE INDEX IF NOT EXISTS idx_pilots_email ON public.pilots(email);
CREATE INDEX IF NOT EXISTS idx_pilots_role ON public.pilots(role);
CREATE INDEX IF NOT EXISTS idx_pilots_active ON public.pilots(is_active);
CREATE INDEX IF NOT EXISTS idx_flights_status ON public.flights(status);
CREATE INDEX IF NOT EXISTS idx_flights_phase ON public.flights(phase);
CREATE INDEX IF NOT EXISTS idx_flights_callsign ON public.flights(callsign);
CREATE INDEX IF NOT EXISTS idx_flights_aircraft_id ON public.flights(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_flights_pic_id ON public.flights(pic_id);
CREATE INDEX IF NOT EXISTS idx_flights_instructor_id ON public.flights(instructor_id);
CREATE INDEX IF NOT EXISTS idx_flights_created ON public.flights(created_at);
CREATE INDEX IF NOT EXISTS idx_aircraft_status ON public.aircraft(status);
CREATE INDEX IF NOT EXISTS idx_aircraft_code ON public.aircraft(code);
CREATE INDEX IF NOT EXISTS idx_aircraft_callsign ON public.aircraft(callsign);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_global_state_key ON public.global_state(key);

-- ============================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aircraft ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vor_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. CREATE RLS POLICIES
-- ============================================

-- USERS POLICIES
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile"
ON public.users FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admin can read all users" ON public.users;
CREATE POLICY "Admin can read all users"
ON public.users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admin can update users" ON public.users;
CREATE POLICY "Admin can update users"
ON public.users FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- PILOTS POLICIES
DROP POLICY IF EXISTS "Users can read pilots" ON public.pilots;
CREATE POLICY "Users can read pilots"
ON public.pilots FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin can manage pilots" ON public.pilots;
CREATE POLICY "Admin can manage pilots"
ON public.pilots FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Ground crew can read pilots" ON public.pilots;
CREATE POLICY "Ground crew can read pilots"
ON public.pilots FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('ground', 'admin', 'ground_tower', 'instructor')
    AND is_approved = TRUE
  )
);

-- AIRCRAFT POLICIES
DROP POLICY IF EXISTS "Authenticated users can read aircraft" ON public.aircraft;
CREATE POLICY "Authenticated users can read aircraft"
ON public.aircraft FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Ground crew can insert aircraft" ON public.aircraft;
CREATE POLICY "Ground crew can insert aircraft"
ON public.aircraft FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('ground', 'admin', 'ground_tower')
    AND is_approved = TRUE
  )
);

DROP POLICY IF EXISTS "Ground crew can update aircraft" ON public.aircraft;
CREATE POLICY "Ground crew can update aircraft"
ON public.aircraft FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('ground', 'admin', 'ground_tower')
    AND is_approved = TRUE
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('ground', 'admin', 'ground_tower')
    AND is_approved = TRUE
  )
);

DROP POLICY IF EXISTS "Admin can delete aircraft" ON public.aircraft;
CREATE POLICY "Admin can delete aircraft"
ON public.aircraft FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- FLIGHTS POLICIES
DROP POLICY IF EXISTS "Authenticated users can read flights" ON public.flights;
CREATE POLICY "Authenticated users can read flights"
ON public.flights FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Tower crew can insert flights" ON public.flights;
CREATE POLICY "Tower crew can insert flights"
ON public.flights FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('tower', 'admin', 'ground_tower', 'instructor')
    AND is_approved = TRUE
  )
);

DROP POLICY IF EXISTS "Tower crew can update flights" ON public.flights;
CREATE POLICY "Tower crew can update flights"
ON public.flights FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('tower', 'admin', 'ground_tower', 'instructor')
    AND is_approved = TRUE
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('tower', 'admin', 'ground_tower', 'instructor')
    AND is_approved = TRUE
  )
);

DROP POLICY IF EXISTS "Admin can delete flights" ON public.flights;
CREATE POLICY "Admin can delete flights"
ON public.flights FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- VOR_CONFIG POLICIES
DROP POLICY IF EXISTS "Allow authenticated users to read vor_config" ON public.vor_config;
CREATE POLICY "Allow authenticated users to read vor_config" ON public.vor_config
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow admin users to manage vor_config" ON public.vor_config;
CREATE POLICY "Allow admin users to manage vor_config" ON public.vor_config
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- GLOBAL_STATE POLICIES
DROP POLICY IF EXISTS "Allow authenticated users to read global state" ON public.global_state;
CREATE POLICY "Allow authenticated users to read global state" ON public.global_state
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow admin to manage global state" ON public.global_state;
CREATE POLICY "Allow admin to manage global state" ON public.global_state
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- AUDIT_LOG POLICIES
DROP POLICY IF EXISTS "Users can read own audit logs" ON public.audit_log;
CREATE POLICY "Users can read own audit logs"
ON public.audit_log FOR SELECT
USING (user_id = auth.uid() OR EXISTS (
  SELECT 1 FROM public.users
  WHERE id = auth.uid() AND role = 'admin'
));

DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_log;
CREATE POLICY "System can insert audit logs"
ON public.audit_log FOR INSERT
WITH CHECK (TRUE);

-- ============================================
-- 6. CREATE HELPER FUNCTIONS
-- ============================================

-- Function to get user role
DROP FUNCTION IF EXISTS public.get_user_role(UUID);
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM public.users WHERE id = user_id;
  RETURN COALESCE(user_role, 'user');
END;
$$ LANGUAGE plpgsql;

-- Function to check if user is approved
DROP FUNCTION IF EXISTS public.is_user_approved(UUID);
CREATE OR REPLACE FUNCTION public.is_user_approved(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  approved BOOLEAN;
BEGIN
  SELECT is_approved INTO approved FROM public.users WHERE id = user_id;
  RETURN COALESCE(approved, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function to auto-create user on signup
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role, is_approved)
  VALUES (new.id, new.email, 'user', FALSE);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to delete old flight data (older than 48 hours)
DROP FUNCTION IF EXISTS public.delete_old_flights();
CREATE OR REPLACE FUNCTION public.delete_old_flights()
RETURNS void AS $$
BEGIN
  DELETE FROM public.flights
  WHERE created_at < now() - interval '48 hours'
  AND status = 'completed';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. INSERT DEFAULT DATA
-- ============================================

-- Insert default VOR configuration
INSERT INTO public.vor_config (name, latitude, longitude, frequency, airport_code)
VALUES ('GDA VOR', 21.5268, 80.2903, '114.2 MHz', 'VAGD')
ON CONFLICT (id) DO NOTHING;

-- Insert default global state
INSERT INTO public.global_state (key, value)
VALUES ('vor_gondia', '{"lat": 21.5268, "lng": 80.2903, "name": "GDA VOR", "frequency": "114.2"}')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 8. REPLICATION SETTINGS (for Real-time)
-- ============================================
-- Execute these if you want real-time updates
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.flights;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.aircraft;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.pilots;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.users;

-- ============================================
-- SETUP COMPLETE
-- ============================================
-- Next steps:
-- 1. Create admin user in Supabase Auth Console
-- 2. Update the admin's role:
--    UPDATE public.users SET role='admin', is_approved=TRUE
--    WHERE email='admin@example.com'
-- 3. Create test users (instructors, cadets)
-- 4. Configure environment variables in your app
-- 5. Test authentication and permissions
-- 6. Monitor audit logs for activity
