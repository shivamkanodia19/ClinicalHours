-- Remove overloaded RPC signature to avoid ambiguity in PostgREST/Supabase RPC resolution
-- Keep only the version that includes max_distance_miles.

DROP FUNCTION IF EXISTS public.get_opportunities_by_distance(
  user_lat numeric,
  user_lon numeric,
  filter_type text,
  search_term text,
  page_limit integer,
  page_offset integer
);
