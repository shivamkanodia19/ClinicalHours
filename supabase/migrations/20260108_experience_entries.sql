-- Create experience_entries table for tracking hours and moments at each location
CREATE TABLE public.experience_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  hours DECIMAL(5, 2),
  moment TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_entry CHECK (hours IS NOT NULL OR moment IS NOT NULL)
);

-- Add is_active_experience column to saved_opportunities
ALTER TABLE public.saved_opportunities 
ADD COLUMN IF NOT EXISTS is_active_experience BOOLEAN DEFAULT false;

-- Enable RLS on experience_entries
ALTER TABLE public.experience_entries ENABLE ROW LEVEL SECURITY;

-- Users can only view their own experience entries
CREATE POLICY "Users can view own experience entries"
  ON public.experience_entries FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own experience entries
CREATE POLICY "Users can insert own experience entries"
  ON public.experience_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own experience entries
CREATE POLICY "Users can update own experience entries"
  ON public.experience_entries FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own experience entries
CREATE POLICY "Users can delete own experience entries"
  ON public.experience_entries FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries by user
CREATE INDEX idx_experience_entries_user_id ON public.experience_entries(user_id);

-- Create index for faster queries by opportunity
CREATE INDEX idx_experience_entries_opportunity_id ON public.experience_entries(opportunity_id);

-- Create composite index for user + opportunity queries
CREATE INDEX idx_experience_entries_user_opportunity ON public.experience_entries(user_id, opportunity_id);

