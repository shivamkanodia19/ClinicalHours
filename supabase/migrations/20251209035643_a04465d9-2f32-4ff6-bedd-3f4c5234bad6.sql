-- Allow created_by to be nullable for system-seeded opportunities
ALTER TABLE public.opportunities ALTER COLUMN created_by DROP NOT NULL;

-- Update the default to null (removing auth.uid() default which fails for system inserts)
ALTER TABLE public.opportunities ALTER COLUMN created_by SET DEFAULT NULL;