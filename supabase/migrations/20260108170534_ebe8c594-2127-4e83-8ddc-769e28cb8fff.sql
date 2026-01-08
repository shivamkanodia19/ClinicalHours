-- Fix SQL Injection in RPC functions by properly escaping ILIKE patterns
-- Also harden email_verification_tokens RLS policies

-- 1. Fix get_opportunities_by_distance function with proper input sanitization
CREATE OR REPLACE FUNCTION public.get_opportunities_by_distance(
  user_lat numeric, 
  user_lon numeric, 
  filter_type text DEFAULT NULL::text, 
  search_term text DEFAULT NULL::text, 
  page_limit integer DEFAULT 20, 
  page_offset integer DEFAULT 0, 
  max_distance_miles numeric DEFAULT NULL::numeric
)
RETURNS TABLE(
  id uuid, 
  name text, 
  type text, 
  location text, 
  address text, 
  latitude numeric, 
  longitude numeric, 
  hours_required text, 
  acceptance_likelihood text, 
  description text, 
  requirements text[], 
  phone text, 
  email text, 
  website text, 
  avg_rating numeric, 
  review_count bigint, 
  distance_miles numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  safe_search_term text;
BEGIN
  -- Server-side validation and sanitization (defense-in-depth)
  safe_search_term := CASE 
    WHEN search_term IS NULL OR search_term = '' THEN NULL
    WHEN length(search_term) > 100 THEN left(search_term, 100)
    ELSE search_term
  END;
  
  -- CRITICAL: Escape ILIKE special characters to prevent SQL injection
  IF safe_search_term IS NOT NULL THEN
    safe_search_term := replace(replace(replace(safe_search_term, '\', '\\'), '%', '\%'), '_', '\_');
  END IF;

  RETURN QUERY
  SELECT 
    o.id, o.name, o.type::text, o.location, o.address,
    o.latitude, o.longitude, o.hours_required,
    o.acceptance_likelihood::text, o.description, o.requirements,
    o.phone, o.email, o.website, o.avg_rating, o.review_count,
    calculate_distance_miles(user_lat, user_lon, o.latitude, o.longitude) as distance_miles
  FROM opportunities_with_ratings o
  WHERE 
    (filter_type IS NULL OR o.type::text = filter_type)
    AND (safe_search_term IS NULL
         OR o.name ILIKE '%' || safe_search_term || '%' 
         OR o.location ILIKE '%' || safe_search_term || '%')
    AND (max_distance_miles IS NULL 
         OR calculate_distance_miles(user_lat, user_lon, o.latitude, o.longitude) <= max_distance_miles)
  ORDER BY 
    CASE WHEN o.latitude IS NULL OR o.longitude IS NULL THEN 1 ELSE 0 END,
    calculate_distance_miles(user_lat, user_lon, o.latitude, o.longitude) NULLS LAST,
    o.name
  LIMIT page_limit
  OFFSET page_offset;
END;
$function$;

-- 2. Fix count_opportunities function with proper input sanitization
CREATE OR REPLACE FUNCTION public.count_opportunities(
  filter_type text DEFAULT NULL::text, 
  search_term text DEFAULT NULL::text
)
RETURNS bigint
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result bigint;
  safe_search_term text;
BEGIN
  -- Server-side validation and sanitization (defense-in-depth)
  safe_search_term := CASE 
    WHEN search_term IS NULL OR search_term = '' THEN NULL
    WHEN length(search_term) > 100 THEN left(search_term, 100)
    ELSE search_term
  END;
  
  -- CRITICAL: Escape ILIKE special characters to prevent SQL injection
  IF safe_search_term IS NOT NULL THEN
    safe_search_term := replace(replace(replace(safe_search_term, '\', '\\'), '%', '\%'), '_', '\_');
  END IF;

  SELECT COUNT(*)
  INTO result
  FROM opportunities_with_ratings o
  WHERE 
    (filter_type IS NULL OR o.type::text = filter_type)
    AND (safe_search_term IS NULL
         OR o.name ILIKE '%' || safe_search_term || '%' 
         OR o.location ILIKE '%' || safe_search_term || '%');
  
  RETURN result;
END;
$function$;

-- 3. Harden email_verification_tokens - add explicit deny for client roles
REVOKE ALL ON public.email_verification_tokens FROM anon;
REVOKE ALL ON public.email_verification_tokens FROM authenticated;

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Deny all client access to email_verification_tokens" ON public.email_verification_tokens;

-- Add explicit deny policy for client roles
CREATE POLICY "Deny all client access to email_verification_tokens"
ON public.email_verification_tokens
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);