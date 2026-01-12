-- Increase website URL length limit from 500 to 2000 characters
-- This allows for longer URLs that some hospital systems generate

ALTER TABLE opportunities
  DROP CONSTRAINT IF EXISTS opp_website_length;

ALTER TABLE opportunities
  ADD CONSTRAINT opp_website_length CHECK (website IS NULL OR length(website) <= 2000);

