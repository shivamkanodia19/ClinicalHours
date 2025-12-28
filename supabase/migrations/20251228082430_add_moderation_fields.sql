-- Create moderation_status enum
CREATE TYPE public.moderation_status AS ENUM ('pending', 'approved', 'rejected', 'flagged');

-- Add moderation_status to reviews table
ALTER TABLE public.reviews 
ADD COLUMN moderation_status public.moderation_status NOT NULL DEFAULT 'approved';

-- Add moderation_status to opportunity_questions table
ALTER TABLE public.opportunity_questions 
ADD COLUMN moderation_status public.moderation_status NOT NULL DEFAULT 'approved';

-- Add moderation_status to question_answers table
ALTER TABLE public.question_answers 
ADD COLUMN moderation_status public.moderation_status NOT NULL DEFAULT 'approved';

-- Update RLS policies to only show approved content to regular users
-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
DROP POLICY IF EXISTS "Anyone can view questions" ON public.opportunity_questions;
DROP POLICY IF EXISTS "Anyone can view answers" ON public.question_answers;

-- Create new SELECT policies that filter by moderation_status
-- Reviews: Regular users see approved, moderators/admins see all
CREATE POLICY "Users can view approved reviews"
  ON public.reviews FOR SELECT
  USING (
    moderation_status = 'approved' 
    OR auth.uid() = user_id 
    OR public.has_role(auth.uid(), 'moderator') 
    OR public.has_role(auth.uid(), 'admin')
  );

-- Questions: Regular users see approved, moderators/admins see all
CREATE POLICY "Users can view approved questions"
  ON public.opportunity_questions FOR SELECT
  USING (
    moderation_status = 'approved' 
    OR auth.uid() = user_id 
    OR public.has_role(auth.uid(), 'moderator') 
    OR public.has_role(auth.uid(), 'admin')
  );

-- Answers: Regular users see approved, moderators/admins see all
CREATE POLICY "Users can view approved answers"
  ON public.question_answers FOR SELECT
  USING (
    moderation_status = 'approved' 
    OR auth.uid() = user_id 
    OR public.has_role(auth.uid(), 'moderator') 
    OR public.has_role(auth.uid(), 'admin')
  );

-- Create indexes for moderation_status to improve query performance
CREATE INDEX IF NOT EXISTS idx_reviews_moderation_status ON public.reviews(moderation_status);
CREATE INDEX IF NOT EXISTS idx_questions_moderation_status ON public.opportunity_questions(moderation_status);
CREATE INDEX IF NOT EXISTS idx_answers_moderation_status ON public.question_answers(moderation_status);

-- Recreate views to include moderation_status (views will respect RLS policies)
DROP VIEW IF EXISTS public.questions_with_votes;
CREATE VIEW public.questions_with_votes AS
SELECT 
  q.*,
  p.full_name as author_name,
  COALESCE(SUM(v.value), 0) as vote_count,
  (SELECT COUNT(*) FROM public.question_answers a 
   WHERE a.question_id = q.id 
   AND a.moderation_status = 'approved') as answer_count
FROM public.opportunity_questions q
LEFT JOIN public.profiles p ON q.user_id = p.id
LEFT JOIN public.discussion_votes v ON v.votable_id = q.id AND v.votable_type = 'question'
GROUP BY q.id, p.full_name;

DROP VIEW IF EXISTS public.answers_with_votes;
CREATE VIEW public.answers_with_votes AS
SELECT 
  a.*,
  p.full_name as author_name,
  COALESCE(SUM(v.value), 0) as vote_count
FROM public.question_answers a
LEFT JOIN public.profiles p ON a.user_id = p.id
LEFT JOIN public.discussion_votes v ON v.votable_id = a.id AND v.votable_type = 'answer'
GROUP BY a.id, p.full_name;

