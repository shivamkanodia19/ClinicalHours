-- Create reminders table
CREATE TABLE public.reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  remind_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own reminders"
ON public.reminders
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own reminders"
ON public.reminders
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminders"
ON public.reminders
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminders"
ON public.reminders
FOR DELETE
USING (auth.uid() = user_id);

-- Index for efficient querying of due reminders
CREATE INDEX idx_reminders_due ON public.reminders (remind_at, sent) WHERE sent = false;