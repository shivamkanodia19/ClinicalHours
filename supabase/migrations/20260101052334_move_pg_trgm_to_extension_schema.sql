-- Move pg_trgm extension from public schema to extensions schema
-- This addresses the security issue: Extension in Public Schema
-- Reference: https://supabase.com/docs/guides/database/database-lint/lint=0014_extension_in_public

-- Create extension schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Drop existing indexes that use the extension (they will be recreated)
DROP INDEX IF EXISTS idx_opportunities_name_trgm;
DROP INDEX IF EXISTS idx_opportunities_location_trgm;

-- Drop extension from public schema (if it exists)
DROP EXTENSION IF EXISTS pg_trgm;

-- Create extension in extensions schema
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- Recreate indexes with schema-qualified functions
-- Note: We need to use the schema-qualified operator class
CREATE INDEX IF NOT EXISTS idx_opportunities_name_trgm 
  ON public.opportunities USING gin(name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_opportunities_location_trgm 
  ON public.opportunities USING gin(location extensions.gin_trgm_ops);

-- Grant usage on extensions schema to authenticated users
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO anon;

-- Grant execute on extension functions to authenticated users
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon;

