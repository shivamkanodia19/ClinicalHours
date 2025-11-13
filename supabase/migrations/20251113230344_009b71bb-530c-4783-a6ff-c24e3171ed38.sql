-- Fix created_by field to be NOT NULL with default
ALTER TABLE public.opportunities 
ALTER COLUMN created_by SET NOT NULL,
ALTER COLUMN created_by SET DEFAULT auth.uid();