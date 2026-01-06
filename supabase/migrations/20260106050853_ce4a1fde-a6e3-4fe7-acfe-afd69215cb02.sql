-- Create a function to get opportunities sorted by distance
CREATE OR REPLACE FUNCTION public.get_opportunities_by_distance(
  user_lat numeric,
  user_lon numeric,
  filter_type text DEFAULT NULL,
  search_term text DEFAULT NULL,
  page_limit integer DEFAULT 20,
  page_offset integer DEFAULT 0
)
RETURNS TABLE (
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
BEGIN
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
    AND (search_term IS NULL OR search_term = '' 
         OR o.name ILIKE '%' || search_term || '%' 
         OR o.location ILIKE '%' || search_term || '%')
  ORDER BY 
    CASE WHEN o.latitude IS NULL OR o.longitude IS NULL THEN 1 ELSE 0 END,
    calculate_distance_miles(user_lat, user_lon, o.latitude, o.longitude) NULLS LAST,
    o.name
  LIMIT page_limit
  OFFSET page_offset;
END;
$$;

-- Create a function to count opportunities with filters
CREATE OR REPLACE FUNCTION public.count_opportunities(
  filter_type text DEFAULT NULL,
  search_term text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result bigint;
BEGIN
  SELECT COUNT(*)
  INTO result
  FROM opportunities_with_ratings o
  WHERE 
    (filter_type IS NULL OR o.type::text = filter_type)
    AND (search_term IS NULL OR search_term = '' 
         OR o.name ILIKE '%' || search_term || '%' 
         OR o.location ILIKE '%' || search_term || '%');
  
  RETURN result;
END;
$$;