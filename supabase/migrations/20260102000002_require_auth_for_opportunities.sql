-- Restrict opportunities pages to authenticated users only
-- Note: Anonymous users can still view opportunities data (e.g., on the map),
-- but the /opportunities and /opportunities/:id pages require authentication.
-- This is enforced at the frontend level in Opportunities.tsx and OpportunityDetail.tsx

-- Ensure the original policy allowing anonymous users to view opportunities exists
-- This allows the map to work for anonymous users while protecting the opportunities pages
-- The frontend routes handle redirecting anonymous users away from /opportunities pages

-- Check if policy exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'opportunities' 
    AND policyname = 'Anyone can view opportunities'
  ) THEN
    CREATE POLICY "Anyone can view opportunities"
      ON public.opportunities FOR SELECT
      USING (true);
  END IF;
END $$;

