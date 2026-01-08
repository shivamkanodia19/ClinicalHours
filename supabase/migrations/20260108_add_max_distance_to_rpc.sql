-- Add max_distance_miles parameter to get_opportunities_by_distance for server-side filtering
-- This allows the map to fetch only nearby opportunities instead of loading everything

CREATE OR REPLACE FUNCTION public.get_opportunities_by_distance(
  user_lat numeric,
  user_lon numeric,
  filter_type text DEFAULT NULL,
  search_term text DEFAULT NULL,
  page_limit integer DEFAULT 20,
  page_offset integer DEFAULT 0,
  max_distance_miles numeric DEFAULT NULL
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
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_search_term text;
BEGIN
  -- Server-side validation and sanitization (defense-in-depth)
  safe_search_term := CASE 
    WHEN search_term IS NULL OR search_term = '' THEN NULL
    WHEN length(search_term) > 100 THEN left(search_term, 100)
    ELSE search_term
  END;
  
  -- Remove ILIKE wildcards to prevent users from injecting their own patterns
  IF safe_search_term IS NOT NULL THEN
    safe_search_term := regexp_replace(safe_search_term, '[%_]', '', 'g');
  END IF;

  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    o.type::text,
    o.location,
    o.address,
    o.latitude,
    o.longitude,
    o.hours_required,
    o.acceptance_likelihood::text,
    o.description,
    o.requirements,
    o.phone,
    o.email,
    o.website,
    o.avg_rating,
    o.review_count,
    calculate_distance_miles(user_lat, user_lon, o.latitude, o.longitude) as distance_miles
  FROM opportunities_with_ratings o
  WHERE 
    (filter_type IS NULL OR o.type::text = filter_type)
    AND (safe_search_term IS NULL
         OR o.name ILIKE '%' || safe_search_term || '%' 
         OR o.location ILIKE '%' || safe_search_term || '%')
    -- Only filter by distance if max_distance_miles is provided
    AND (max_distance_miles IS NULL 
         OR calculate_distance_miles(user_lat, user_lon, o.latitude, o.longitude) <= max_distance_miles)
  ORDER BY 
    CASE WHEN o.latitude IS NULL OR o.longitude IS NULL THEN 1 ELSE 0 END,
    calculate_distance_miles(user_lat, user_lon, o.latitude, o.longitude) NULLS LAST,
    o.name
  LIMIT page_limit
  OFFSET page_offset;
END;
$$;

-- Also add a count function that respects the distance filter
CREATE OR REPLACE FUNCTION public.count_opportunities_within_distance(
  user_lat numeric,
  user_lon numeric,
  filter_type text DEFAULT NULL,
  search_term text DEFAULT NULL,
  max_distance_miles numeric DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- Remove ILIKE wildcards to prevent users from injecting their own patterns
  IF safe_search_term IS NOT NULL THEN
    safe_search_term := regexp_replace(safe_search_term, '[%_]', '', 'g');
  END IF;

  SELECT COUNT(*)
  INTO result
  FROM opportunities_with_ratings o
  WHERE 
    (filter_type IS NULL OR o.type::text = filter_type)
    AND (safe_search_term IS NULL
         OR o.name ILIKE '%' || safe_search_term || '%' 
         OR o.location ILIKE '%' || safe_search_term || '%')
    AND (max_distance_miles IS NULL 
         OR calculate_distance_miles(user_lat, user_lon, o.latitude, o.longitude) <= max_distance_miles);
  
  RETURN result;
END;
$$;

