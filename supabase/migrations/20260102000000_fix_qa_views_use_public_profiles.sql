-- Fix PUBLIC_DATA_EXPOSURE: Update Q&A views to use public_profiles instead of profiles
-- This ensures anonymous users can view Q&A and respects user privacy settings

-- Drop and recreate questions_with_votes view to use public_profiles
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
  q.moderation_status,
  COALESCE(SUM(v.value), 0) as vote_count,
  (SELECT COUNT(*) FROM public.question_answers a 
   WHERE a.question_id = q.id 
   AND a.moderation_status = 'approved') as answer_count,
  pp.full_name as author_name,
  pp.university as author_university,
  pp.major as author_major,
  pp.graduation_year as author_graduation_year,
  pp.clinical_hours as author_clinical_hours
FROM public.opportunity_questions q
LEFT JOIN public.public_profiles pp ON q.user_id = pp.id
LEFT JOIN public.discussion_votes v ON v.votable_id = q.id AND v.votable_type = 'question'
GROUP BY q.id, pp.full_name, pp.university, pp.major, pp.graduation_year, pp.clinical_hours;

-- Drop and recreate answers_with_votes view to use public_profiles
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
  a.moderation_status,
  COALESCE(SUM(v.value), 0) as vote_count,
  pp.full_name as author_name,
  pp.university as author_university,
  pp.major as author_major,
  pp.graduation_year as author_graduation_year,
  pp.clinical_hours as author_clinical_hours
FROM public.question_answers a
LEFT JOIN public.public_profiles pp ON a.user_id = pp.id
LEFT JOIN public.discussion_votes v ON v.votable_id = a.id AND v.votable_type = 'answer'
GROUP BY a.id, pp.full_name, pp.university, pp.major, pp.graduation_year, pp.clinical_hours;

-- Grant SELECT permissions on views to authenticated and anon users
GRANT SELECT ON public.questions_with_votes TO authenticated;
GRANT SELECT ON public.questions_with_votes TO anon;
GRANT SELECT ON public.answers_with_votes TO authenticated;
GRANT SELECT ON public.answers_with_votes TO anon;

