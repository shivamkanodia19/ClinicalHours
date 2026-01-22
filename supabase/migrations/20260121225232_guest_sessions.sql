-- Create guest_sessions table to track anonymous guest browsing sessions
CREATE TABLE IF NOT EXISTS guest_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_agent TEXT,
  converted_to_user_id UUID REFERENCES auth.users(id)
);

-- Index for efficient date queries (sorting by day/time)
CREATE INDEX idx_guest_sessions_created_at ON guest_sessions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE guest_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (guests aren't authenticated)
CREATE POLICY "Allow anonymous insert" ON guest_sessions 
  FOR INSERT 
  WITH CHECK (true);

-- Allow admin users to read all guest sessions
CREATE POLICY "Allow admin read" ON guest_sessions 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Add comment for documentation
COMMENT ON TABLE guest_sessions IS 'Tracks anonymous guest browsing sessions for analytics';
COMMENT ON COLUMN guest_sessions.session_id IS 'Unique identifier stored in localStorage to prevent duplicate session logging';
COMMENT ON COLUMN guest_sessions.converted_to_user_id IS 'If the guest later signs up, this links to their user account';
