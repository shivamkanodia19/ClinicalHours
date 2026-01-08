-- Create experience_entries table for tracking hours and moments at saved opportunities
CREATE TABLE public.experience_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  saved_opportunity_id UUID NOT NULL REFERENCES public.saved_opportunities(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('hours', 'moment')),
  hours NUMERIC NULL,
  title TEXT NULL,
  notes TEXT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.experience_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies for experience_entries
CREATE POLICY "Users can view own experience entries"
ON public.experience_entries
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own experience entries"
ON public.experience_entries
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own experience entries"
ON public.experience_entries
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own experience entries"
ON public.experience_entries
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_experience_entries_updated_at
BEFORE UPDATE ON public.experience_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster queries
CREATE INDEX idx_experience_entries_user_id ON public.experience_entries(user_id);
CREATE INDEX idx_experience_entries_saved_opportunity_id ON public.experience_entries(saved_opportunity_id);