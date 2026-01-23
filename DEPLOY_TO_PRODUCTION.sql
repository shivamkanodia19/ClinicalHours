-- ============================================================
-- PRODUCTION DEPLOYMENT SQL
-- Run this in your Supabase SQL Editor to fix admin dashboard
-- ============================================================

-- 1. CREATE GUEST SESSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS guest_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_agent TEXT,
  converted_to_user_id UUID REFERENCES auth.users(id)
);

-- Index for efficient date queries (sorting by day/time)
CREATE INDEX IF NOT EXISTS idx_guest_sessions_created_at ON guest_sessions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE guest_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (guests aren't authenticated)
DROP POLICY IF EXISTS "Allow anonymous insert" ON guest_sessions;
CREATE POLICY "Allow anonymous insert" ON guest_sessions 
  FOR INSERT 
  WITH CHECK (true);

-- Allow admin users to read all guest sessions
DROP POLICY IF EXISTS "Allow admin read" ON guest_sessions;
CREATE POLICY "Allow admin read" ON guest_sessions 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Add comments for documentation
COMMENT ON TABLE guest_sessions IS 'Tracks anonymous guest browsing sessions for analytics';
COMMENT ON COLUMN guest_sessions.session_id IS 'Unique identifier stored in localStorage to prevent duplicate session logging';
COMMENT ON COLUMN guest_sessions.converted_to_user_id IS 'If the guest later signs up, this links to their user account';


-- 2. ALLOW ADMINS TO READ ALL PROFILES
-- ============================================================
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));


-- 3. VERIFY DEPLOYMENT
-- ============================================================
-- Run this to verify the table was created:
-- SELECT COUNT(*) as guest_session_count FROM guest_sessions;
-- 
-- Run this to verify admin can read profiles:
-- SELECT COUNT(*) as profile_count FROM profiles;
