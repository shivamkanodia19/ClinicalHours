-- Fix MISSING_RLS: Harden password_reset_tokens table RLS policies
-- This table should ONLY be accessible via service role key, never by client roles

-- Revoke all privileges from anon and authenticated roles
REVOKE ALL ON public.password_reset_tokens FROM anon;
REVOKE ALL ON public.password_reset_tokens FROM authenticated;

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Service role can insert tokens" ON public.password_reset_tokens;
DROP POLICY IF EXISTS "Service role can update tokens" ON public.password_reset_tokens;
DROP POLICY IF EXISTS "Service role can select tokens" ON public.password_reset_tokens;

-- Create explicit deny policies for client roles (defense in depth)
-- These policies ensure that even if privileges are accidentally granted, RLS will block access
CREATE POLICY "Deny all access to anon and authenticated"
ON public.password_reset_tokens
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- Note: Service role key bypasses RLS, so edge functions will continue to work
-- This table is intentionally inaccessible to all client roles for security

