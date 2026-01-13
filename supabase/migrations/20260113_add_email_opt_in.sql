-- Add email_opt_in column to profiles table (defaults to false)
-- Users can opt-in during signup or toggle this in their profile settings
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_opt_in BOOLEAN DEFAULT false;

-- Add index for efficient querying of opted-in users (for sending marketing emails later)
CREATE INDEX IF NOT EXISTS idx_profiles_email_opt_in ON public.profiles(email_opt_in) WHERE email_opt_in = true;

-- Comment for documentation
COMMENT ON COLUMN public.profiles.email_opt_in IS 'Whether user has opted in to receive email updates about opportunities and platform features';
