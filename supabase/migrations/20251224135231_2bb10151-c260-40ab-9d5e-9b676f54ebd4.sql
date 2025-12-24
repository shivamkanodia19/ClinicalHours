-- Fix security definer views by recreating them with security_invoker = true
DROP VIEW IF EXISTS public.questions_with_votes;
DROP VIEW IF EXISTS public.answers_with_votes;

-- Recreate views with security invoker
CREATE VIEW public.questions_with_votes 
WITH (security_invoker = true) AS
SELECT 
  q.*,
  p.full_name as author_name,
  COALESCE(SUM(v.value), 0) as vote_count,
  (SELECT COUNT(*) FROM public.question_answers a WHERE a.question_id = q.id) as answer_count
FROM public.opportunity_questions q
LEFT JOIN public.profiles p ON q.user_id = p.id
LEFT JOIN public.discussion_votes v ON v.votable_id = q.id AND v.votable_type = 'question'
GROUP BY q.id, p.full_name;

CREATE VIEW public.answers_with_votes 
WITH (security_invoker = true) AS
SELECT 
  a.*,
  p.full_name as author_name,
  COALESCE(SUM(v.value), 0) as vote_count
FROM public.question_answers a
LEFT JOIN public.profiles p ON a.user_id = p.id
LEFT JOIN public.discussion_votes v ON v.votable_id = a.id AND v.votable_type = 'answer'
GROUP BY a.id, p.full_name;