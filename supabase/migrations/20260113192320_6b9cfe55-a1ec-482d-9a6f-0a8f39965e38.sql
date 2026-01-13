-- Add email_opt_in column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_opt_in boolean DEFAULT false;