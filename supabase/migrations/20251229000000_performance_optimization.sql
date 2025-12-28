-- Performance Optimization Migration
-- Adds indexes, optimizes queries, and improves scalability for Q&A and Reviews

-- ============================================
-- REVIEWS TABLE OPTIMIZATIONS
-- ============================================

-- Index for filtering reviews by opportunity (most common query)
CREATE INDEX IF NOT EXISTS idx_reviews_opportunity_id ON public.reviews(opportunity_id);

-- Index for sorting by creation date (for pagination)
CREATE INDEX IF NOT EXISTS idx_reviews_created_at_desc ON public.reviews(created_at DESC);

-- Composite index for opportunity + date sorting (optimizes common query pattern)
CREATE INDEX IF NOT EXISTS idx_reviews_opportunity_created_at ON public.reviews(opportunity_id, created_at DESC);

-- Index for user reviews (for user profile pages)
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);

-- Index for unique constraint check (opportunity_id, user_id) - already has unique constraint but index helps
-- The unique constraint already creates an index, but we'll ensure it's optimized

-- ============================================
-- Q&A TABLES OPTIMIZATIONS
-- ============================================

-- Questions table indexes
CREATE INDEX IF NOT EXISTS idx_questions_opportunity_id ON public.opportunity_questions(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_questions_created_at_desc ON public.opportunity_questions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_user_id ON public.opportunity_questions(user_id);
-- Composite for common query: opportunity questions sorted by votes/date
CREATE INDEX IF NOT EXISTS idx_questions_opportunity_created ON public.opportunity_questions(opportunity_id, created_at DESC);

-- Answers table indexes
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON public.question_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_created_at_desc ON public.question_answers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_answers_user_id ON public.question_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_answers_is_accepted ON public.question_answers(is_accepted) WHERE is_accepted = true;
-- Composite for common query: question answers sorted by votes
CREATE INDEX IF NOT EXISTS idx_answers_question_created ON public.question_answers(question_id, created_at DESC);

-- Votes table indexes (critical for vote counting performance)
CREATE INDEX IF NOT EXISTS idx_votes_votable ON public.discussion_votes(votable_id, votable_type);
CREATE INDEX IF NOT EXISTS idx_votes_user_votable ON public.discussion_votes(user_id, votable_id, votable_type);
-- This index supports the unique constraint and vote lookups
CREATE INDEX IF NOT EXISTS idx_votes_user ON public.discussion_votes(user_id);

-- ============================================
-- OPPORTUNITIES TABLE OPTIMIZATIONS
-- ============================================

-- Index for type filtering (if not exists)
CREATE INDEX IF NOT EXISTS idx_opportunities_type ON public.opportunities(type);

-- Index for location-based queries
CREATE INDEX IF NOT EXISTS idx_opportunities_location ON public.opportunities(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Index for name/location search (using GIN for text search)
-- Note: pg_trgm extension must be enabled first
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
  END IF;
END $$;

-- Create trigram indexes for fuzzy text search (only if extension is available)
-- These help with ILIKE queries
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE INDEX IF NOT EXISTS idx_opportunities_name_trgm ON public.opportunities USING gin(name gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_opportunities_location_trgm ON public.opportunities USING gin(location gin_trgm_ops);
  END IF;
END $$;

-- ============================================
-- SAVED OPPORTUNITIES OPTIMIZATIONS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_saved_opportunities_user_id ON public.saved_opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_opportunities_opportunity_id ON public.saved_opportunities(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_saved_opportunities_user_created ON public.saved_opportunities(user_id, created_at DESC);

-- ============================================
-- VIEW OPTIMIZATIONS
-- ============================================

-- Materialized view for opportunities_with_ratings (if needed for very high traffic)
-- For now, we'll keep it as a regular view but ensure indexes support it
-- The view already uses indexes on reviews.opportunity_id

-- ============================================
-- DATABASE CONSTRAINTS & VALIDATION
-- ============================================

-- Add check constraints for data integrity (only if they don't exist)
DO $$ 
BEGIN
  -- Reviews constraints
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_comment_length'
  ) THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT check_comment_length CHECK (comment IS NULL OR char_length(comment) <= 2000);
  END IF;

  -- Questions constraints
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_title_length'
  ) THEN
    ALTER TABLE public.opportunity_questions
      ADD CONSTRAINT check_title_length CHECK (char_length(title) <= 200),
      ADD CONSTRAINT check_body_length CHECK (body IS NULL OR char_length(body) <= 5000);
  END IF;

  -- Answers constraints
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_answer_length'
  ) THEN
    ALTER TABLE public.question_answers
      ADD CONSTRAINT check_answer_length CHECK (char_length(body) <= 5000);
  END IF;
END $$;

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers if they don't exist
DROP TRIGGER IF EXISTS update_reviews_updated_at ON public.reviews;
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_questions_updated_at ON public.opportunity_questions;
CREATE TRIGGER update_questions_updated_at
  BEFORE UPDATE ON public.opportunity_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_answers_updated_at ON public.question_answers;
CREATE TRIGGER update_answers_updated_at
  BEFORE UPDATE ON public.question_answers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ENABLE EXTENSIONS FOR TEXT SEARCH
-- ============================================

-- Enable pg_trgm for fuzzy text search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ============================================

-- Update statistics for better query planning
ANALYZE public.reviews;
ANALYZE public.opportunity_questions;
ANALYZE public.question_answers;
ANALYZE public.discussion_votes;
ANALYZE public.opportunities;
ANALYZE public.saved_opportunities;

