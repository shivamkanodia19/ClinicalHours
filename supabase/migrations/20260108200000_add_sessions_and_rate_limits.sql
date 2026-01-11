-- Add sessions table for database-backed session storage
-- This replaces in-memory session validation with persistent storage

CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  csrf_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  remember_me BOOLEAN DEFAULT FALSE,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions(expires_at);

-- Enable RLS on sessions
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Revoke all access from client roles - sessions should only be managed via service role
REVOKE ALL ON public.sessions FROM anon;
REVOKE ALL ON public.sessions FROM authenticated;

-- Create explicit deny policy for defense in depth
CREATE POLICY "Deny all client access to sessions"
ON public.sessions
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- Add rate_limits table for persistent rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,  -- Format: "type:identifier" e.g., "email:user@example.com" or "ip:192.168.1.1"
  count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  window_duration_seconds INTEGER NOT NULL,
  failed_attempts INTEGER DEFAULT 0,
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(key)
);

-- Index for fast rate limit lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON public.rate_limits(key);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON public.rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked_until ON public.rate_limits(blocked_until);

-- Enable RLS on rate_limits
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Revoke all access from client roles
REVOKE ALL ON public.rate_limits FROM anon;
REVOKE ALL ON public.rate_limits FROM authenticated;

-- Create explicit deny policy
CREATE POLICY "Deny all client access to rate_limits"
ON public.rate_limits
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- Function to clean up expired sessions (can be called by a cron job)
CREATE OR REPLACE FUNCTION clean_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.sessions
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Function to clean up old rate limit records
CREATE OR REPLACE FUNCTION clean_expired_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start + (window_duration_seconds || ' seconds')::INTERVAL < NOW()
    AND (blocked_until IS NULL OR blocked_until < NOW());
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Grant execute permissions to service role functions
GRANT EXECUTE ON FUNCTION clean_expired_sessions() TO service_role;
GRANT EXECUTE ON FUNCTION clean_expired_rate_limits() TO service_role;

-- Add comment for documentation
COMMENT ON TABLE public.sessions IS 'Stores user sessions for secure cookie-based authentication. Only accessible via service role.';
COMMENT ON TABLE public.rate_limits IS 'Persistent rate limiting storage. Only accessible via service role.';


