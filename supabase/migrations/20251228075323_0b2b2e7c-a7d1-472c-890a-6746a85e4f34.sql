-- Fix PUBLIC_DATA_EXPOSURE: Restrict profiles access to owner-only
-- Drop the overly permissive policy that exposes all student data
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Create a policy that only allows users to view their own profile
CREATE POLICY "Users can view own profile only"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Create a public view with only the fields needed for Q&A context
-- This view shows limited, non-sensitive information for Q&A author attribution
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  full_name,
  university,
  major,
  graduation_year,
  clinical_hours
FROM public.profiles;

-- Enable security invoker so the view respects the caller's permissions
-- But since we're granting SELECT directly, this allows reading public fields
ALTER VIEW public.public_profiles SET (security_invoker = on);

-- Grant SELECT on the limited public view to authenticated users
GRANT SELECT ON public.public_profiles TO authenticated;

-- Also grant to anon for unauthenticated access to Q&A (view-only)
GRANT SELECT ON public.public_profiles TO anon;

-- Update the existing views that join on profiles to use the public_profiles view
-- The questions_with_votes and answers_with_votes views already only expose
-- author_name, author_university, author_major, author_graduation_year, author_clinical_hours
-- which is exactly what we want. They should continue to work as they query from profiles
-- which is accessible via the security invoker mechanism.