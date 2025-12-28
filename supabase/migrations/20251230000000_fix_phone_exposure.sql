-- Fix phone number exposure in database views
-- Update views to use public_profiles instead of profiles to ensure phone numbers are never exposed

-- Update questions_with_votes view to use public_profiles
DROP VIEW IF EXISTS public.questions_with_votes;
CREATE VIEW public.questions_with_votes
WITH (security_invoker = true) AS
SELECT 
  q.id,
  q.opportunity_id,
  q.user_id,
  q.title,
  q.body,
  q.created_at,
  q.updated_at,
  COALESCE(SUM(v.value), 0) AS vote_count,
  COUNT(DISTINCT a.id) AS answer_count,
  p.full_name AS author_name,
  p.university AS author_university,
  p.major AS author_major,
  p.graduation_year AS author_graduation_year,
  p.clinical_hours AS author_clinical_hours
FROM public.opportunity_questions q
LEFT JOIN public.discussion_votes v ON v.votable_id = q.id AND v.votable_type = 'question'
LEFT JOIN public.question_answers a ON a.question_id = q.id
LEFT JOIN public.public_profiles p ON p.id = q.user_id
GROUP BY q.id, p.full_name, p.university, p.major, p.graduation_year, p.clinical_hours;

-- Update answers_with_votes view to use public_profiles
DROP VIEW IF EXISTS public.answers_with_votes;
CREATE VIEW public.answers_with_votes
WITH (security_invoker = true) AS
SELECT 
  a.id,
  a.question_id,
  a.user_id,
  a.body,
  a.is_accepted,
  a.created_at,
  a.updated_at,
  COALESCE(SUM(v.value), 0) AS vote_count,
  p.full_name AS author_name,
  p.university AS author_university,
  p.major AS author_major,
  p.graduation_year AS author_graduation_year,
  p.clinical_hours AS author_clinical_hours
FROM public.question_answers a
LEFT JOIN public.discussion_votes v ON v.votable_id = a.id AND v.votable_type = 'answer'
LEFT JOIN public.public_profiles p ON p.id = a.user_id
GROUP BY a.id, p.full_name, p.university, p.major, p.graduation_year, p.clinical_hours;

-- Ensure public_profiles view explicitly excludes phone and other sensitive fields
-- (This is already the case, but we'll recreate it to be explicit)
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles AS
SELECT 
  id,
  full_name,
  university,
  major,
  graduation_year,
  clinical_hours
  -- Explicitly excluded: phone, city, state, gpa, resume_url, linkedin_url, 
  -- career_goals, research_experience, bio, pre_med_track, certifications
FROM public.profiles;

-- Set security invoker on the view
ALTER VIEW public.public_profiles SET (security_invoker = on);

-- Grant SELECT on the limited public view
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;

-- Add comment to profiles table phone column documenting privacy
COMMENT ON COLUMN public.profiles.phone IS 'Private field - only accessible by profile owner. Never exposed through views or public queries.';

