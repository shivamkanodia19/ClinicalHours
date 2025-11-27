-- Add tracking fields to saved_opportunities table
ALTER TABLE public.saved_opportunities
ADD COLUMN IF NOT EXISTS contacted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS applied boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS heard_back boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS scheduled_interview boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS deadline date,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_saved_opportunities_updated_at
  BEFORE UPDATE ON public.saved_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();