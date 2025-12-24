-- Create enum for votable types
CREATE TYPE public.votable_type AS ENUM ('question', 'answer');

-- Questions table
CREATE TABLE public.opportunity_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Answers table
CREATE TABLE public.question_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.opportunity_questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_accepted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Votes table (for both questions and answers)
CREATE TABLE public.discussion_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  votable_id UUID NOT NULL,
  votable_type votable_type NOT NULL,
  value INTEGER NOT NULL CHECK (value IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, votable_id, votable_type)
);

-- Enable RLS
ALTER TABLE public.opportunity_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_votes ENABLE ROW LEVEL SECURITY;

-- Questions policies
CREATE POLICY "Anyone can view questions" ON public.opportunity_questions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create questions" ON public.opportunity_questions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own questions" ON public.opportunity_questions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own questions" ON public.opportunity_questions FOR DELETE USING (auth.uid() = user_id);

-- Answers policies
CREATE POLICY "Anyone can view answers" ON public.question_answers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create answers" ON public.question_answers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own answers" ON public.question_answers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own answers" ON public.question_answers FOR DELETE USING (auth.uid() = user_id);

-- Votes policies
CREATE POLICY "Anyone can view votes" ON public.discussion_votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can vote" ON public.discussion_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own votes" ON public.discussion_votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own votes" ON public.discussion_votes FOR DELETE USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_opportunity_questions_updated_at
  BEFORE UPDATE ON public.opportunity_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_question_answers_updated_at
  BEFORE UPDATE ON public.question_answers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create view for questions with vote counts
CREATE VIEW public.questions_with_votes AS
SELECT 
  q.*,
  p.full_name as author_name,
  COALESCE(SUM(v.value), 0) as vote_count,
  (SELECT COUNT(*) FROM public.question_answers a WHERE a.question_id = q.id) as answer_count
FROM public.opportunity_questions q
LEFT JOIN public.profiles p ON q.user_id = p.id
LEFT JOIN public.discussion_votes v ON v.votable_id = q.id AND v.votable_type = 'question'
GROUP BY q.id, p.full_name;

-- Create view for answers with vote counts
CREATE VIEW public.answers_with_votes AS
SELECT 
  a.*,
  p.full_name as author_name,
  COALESCE(SUM(v.value), 0) as vote_count
FROM public.question_answers a
LEFT JOIN public.profiles p ON a.user_id = p.id
LEFT JOIN public.discussion_votes v ON v.votable_id = a.id AND v.votable_type = 'answer'
GROUP BY a.id, p.full_name;