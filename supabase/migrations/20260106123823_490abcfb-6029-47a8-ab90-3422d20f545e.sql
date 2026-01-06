-- Fix Q&A views to use public_profiles instead of private profiles table
-- This allows all users to see author information and respects privacy settings

-- Drop and recreate questions_with_votes view
DROP VIEW IF EXISTS public.questions_with_votes;

CREATE OR REPLACE VIEW public.questions_with_votes AS
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
LEFT JOIN public.public_profiles p ON q.user_id = p.id
GROUP BY q.id, q.opportunity_id, q.user_id, q.title, q.body, q.created_at, q.updated_at,
         p.full_name, p.university, p.major, p.graduation_year, p.clinical_hours;

-- Grant access to the view
GRANT SELECT ON public.questions_with_votes TO anon, authenticated;

-- Drop and recreate answers_with_votes view
DROP VIEW IF EXISTS public.answers_with_votes;

CREATE OR REPLACE VIEW public.answers_with_votes AS
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
LEFT JOIN public.public_profiles p ON a.user_id = p.id
GROUP BY a.id, a.question_id, a.user_id, a.body, a.is_accepted, a.created_at, a.updated_at,
         p.full_name, p.university, p.major, p.graduation_year, p.clinical_hours;

-- Grant access to the view
GRANT SELECT ON public.answers_with_votes TO anon, authenticated;