-- Create tracking_events table for event analytics
-- This table stores page views, button clicks, and conversion events

CREATE TABLE IF NOT EXISTS tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('page_view', 'button_click', 'guest_conversion', 'signup', 'login')),
  page_url TEXT NOT NULL,
  referrer_url TEXT,
  user_agent TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  timezone TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_tracking_events_session_id ON tracking_events(session_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_event_type ON tracking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_tracking_events_created_at ON tracking_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_events_user_id ON tracking_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracking_events_page_url ON tracking_events(page_url);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_tracking_events_session_type_created 
  ON tracking_events(session_id, event_type, created_at DESC);

-- Enable RLS
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous inserts (for tracking without authentication)
-- This is intentional - we want to track all visitors including guests
CREATE POLICY "Allow anonymous tracking inserts" 
  ON tracking_events 
  FOR INSERT 
  TO anon, authenticated
  WITH CHECK (true);

-- Policy: Only admins can read tracking data
CREATE POLICY "Only admins can read tracking events" 
  ON tracking_events 
  FOR SELECT 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Policy: No updates or deletes allowed (immutable audit log)
-- Admins can delete old data if needed via direct SQL

-- Add comment for documentation
COMMENT ON TABLE tracking_events IS 'Event tracking for analytics - page views, button clicks, and conversions';
COMMENT ON COLUMN tracking_events.session_id IS 'Client-generated session ID (UUID) for grouping events';
COMMENT ON COLUMN tracking_events.event_type IS 'Type of event: page_view, button_click, guest_conversion, signup, login';
COMMENT ON COLUMN tracking_events.metadata IS 'Additional event-specific data (button name, conversion source, etc.)';
