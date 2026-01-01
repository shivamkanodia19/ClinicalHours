-- Add privacy controls for public profile data
-- Allows users to opt-in to showing their information publicly

-- Add privacy settings column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS profile_visibility TEXT DEFAULT 'public' CHECK (profile_visibility IN ('public', 'private', 'anonymous'));

-- Update public_profiles view to respect privacy settings
DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  CASE 
    WHEN profile_visibility = 'anonymous' THEN NULL
    WHEN profile_visibility = 'private' THEN NULL
    ELSE full_name
  END as full_name,
  CASE 
    WHEN profile_visibility = 'anonymous' THEN NULL
    WHEN profile_visibility = 'private' THEN NULL
    ELSE university
  END as university,
  CASE 
    WHEN profile_visibility = 'anonymous' THEN NULL
    WHEN profile_visibility = 'private' THEN NULL
    ELSE major
  END as major,
  CASE 
    WHEN profile_visibility = 'anonymous' THEN NULL
    WHEN profile_visibility = 'private' THEN NULL
    ELSE graduation_year
  END as graduation_year,
  CASE 
    WHEN profile_visibility = 'anonymous' THEN NULL
    WHEN profile_visibility = 'private' THEN NULL
    ELSE clinical_hours
  END as clinical_hours
FROM public.profiles
WHERE profile_visibility != 'private' OR profile_visibility IS NULL;

-- Enable security invoker so the view respects the caller's permissions
ALTER VIEW public.public_profiles SET (security_invoker = on);

-- Grant SELECT on the limited public view to authenticated users
GRANT SELECT ON public.public_profiles TO authenticated;

-- Also grant to anon for unauthenticated access to Q&A (view-only)
GRANT SELECT ON public.public_profiles TO anon;

-- Add comment explaining privacy levels
COMMENT ON COLUMN public.profiles.profile_visibility IS 
  'Profile visibility: public (show all info), private (hide from public view), anonymous (show info but not name)';

