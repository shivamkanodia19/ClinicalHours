-- Add performance indexes for common query patterns
-- These indexes will significantly improve query performance as data grows

-- Index for opportunity search (name and location)
CREATE INDEX IF NOT EXISTS idx_opportunities_name_location 
ON opportunities USING gin(to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(location, '')));

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_opportunities_type 
ON opportunities(type) 
WHERE type IS NOT NULL;

-- Index for geospatial queries (latitude/longitude)
CREATE INDEX IF NOT EXISTS idx_opportunities_coords 
ON opportunities(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Index for reviews lookup by opportunity
CREATE INDEX IF NOT EXISTS idx_reviews_opportunity_user 
ON reviews(opportunity_id, user_id);

-- Index for reviews by opportunity and created_at (for sorting)
CREATE INDEX IF NOT EXISTS idx_reviews_opportunity_created 
ON reviews(opportunity_id, created_at DESC);

-- Index for questions by opportunity and created_at (for sorting)
CREATE INDEX IF NOT EXISTS idx_questions_opportunity_created 
ON opportunity_questions(opportunity_id, created_at DESC);

-- Index for answers by question and created_at (for sorting)
CREATE INDEX IF NOT EXISTS idx_answers_question_created 
ON question_answers(question_id, created_at DESC);

-- Index for saved opportunities lookup
CREATE INDEX IF NOT EXISTS idx_saved_opportunities_user 
ON saved_opportunities(user_id, opportunity_id);

-- Index for profiles lookup (if not already exists)
CREATE INDEX IF NOT EXISTS idx_profiles_id 
ON profiles(id);

-- Composite index for opportunities view with ratings (if view exists)
-- This helps with the opportunities_with_ratings view queries
CREATE INDEX IF NOT EXISTS idx_opportunities_created_at 
ON opportunities(created_at DESC);

