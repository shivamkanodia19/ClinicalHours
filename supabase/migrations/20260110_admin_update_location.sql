-- Create a function to update opportunity location that bypasses RLS
-- This function uses SECURITY DEFINER to run with the privileges of the function owner (postgres)

CREATE OR REPLACE FUNCTION admin_update_opportunity_location(
  opp_id UUID,
  new_location TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE opportunities
  SET location = new_location,
      updated_at = NOW()
  WHERE id = opp_id;
  
  RETURN FOUND;
END;
$$;

-- Grant execute permission to authenticated users
-- You may want to restrict this further to admin users only
GRANT EXECUTE ON FUNCTION admin_update_opportunity_location(UUID, TEXT) TO authenticated;

-- Add a comment explaining the function
COMMENT ON FUNCTION admin_update_opportunity_location IS 'Updates opportunity location, bypassing RLS. Used by admin fix-states tool.';

