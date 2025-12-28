-- Create password reset tokens table
CREATE TABLE public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Service role can insert tokens (for edge function)
CREATE POLICY "Service role can insert tokens"
ON public.password_reset_tokens
FOR INSERT
WITH CHECK (true);

-- Service role can update tokens (mark as used)
CREATE POLICY "Service role can update tokens"
ON public.password_reset_tokens
FOR UPDATE
USING (true);

-- Service role can select tokens (for verification)
CREATE POLICY "Service role can select tokens"
ON public.password_reset_tokens
FOR SELECT
USING (true);

-- Create index for faster token lookups
CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens(user_id);