-- Create email verification tokens table
CREATE TABLE public.email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster token lookups
CREATE INDEX idx_email_verification_tokens_token ON public.email_verification_tokens(token);
CREATE INDEX idx_email_verification_tokens_user_id ON public.email_verification_tokens(user_id);

-- Enable Row Level Security
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own tokens
CREATE POLICY "Users can view own tokens" 
ON public.email_verification_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy: Allow insert from edge functions (service role)
CREATE POLICY "Service role can insert tokens" 
ON public.email_verification_tokens 
FOR INSERT 
WITH CHECK (true);

-- Policy: Allow update from edge functions (service role)
CREATE POLICY "Service role can update tokens" 
ON public.email_verification_tokens 
FOR UPDATE 
USING (true);

-- Add email_verified column to profiles if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;