-- Fix Security Definer Views by recreating them with SECURITY INVOKER
-- Views should use SECURITY INVOKER to respect the querying user's RLS policies

-- 1. Drop and recreate opportunities_with_ratings view
DROP VIEW IF EXISTS public.opportunities_with_ratings CASCADE;

CREATE VIEW public.opportunities_with_ratings 
WITH (security_invoker = true)
AS
SELECT o.id,
    o.name,
    o.type,
    o.location,
    o.address,
    o.latitude,
    o.longitude,
    o.hours_required,
    o.acceptance_likelihood,
    o.phone,
    o.email,
    o.website,
    o.requirements,
    o.description,
    o.created_by,
    o.created_at,
    o.updated_at,
    COALESCE(avg(r.rating), (0)::numeric) AS avg_rating,
    count(r.id) AS review_count
FROM opportunities o
LEFT JOIN reviews r ON o.id = r.opportunity_id
GROUP BY o.id;

-- Grant access to roles
GRANT SELECT ON public.opportunities_with_ratings TO anon;
GRANT SELECT ON public.opportunities_with_ratings TO authenticated;

-- 2. Drop and recreate public_profiles view
DROP VIEW IF EXISTS public.public_profiles CASCADE;

CREATE VIEW public.public_profiles
WITH (security_invoker = true)
AS
SELECT id,
    full_name,
    university,
    major,
    graduation_year,
    clinical_hours
FROM profiles;

-- Grant access to roles
GRANT SELECT ON public.public_profiles TO anon;
GRANT SELECT ON public.public_profiles TO authenticated;

-- 3. Drop and recreate questions_with_votes view (depends on public_profiles)
DROP VIEW IF EXISTS public.questions_with_votes CASCADE;

CREATE VIEW public.questions_with_votes
WITH (security_invoker = true)
AS
SELECT q.id,
    q.opportunity_id,
    q.user_id,
    q.title,
    q.body,
    q.created_at,
    q.updated_at,
    COALESCE(sum(v.value), (0)::bigint) AS vote_count,
    count(DISTINCT a.id) AS answer_count,
    p.full_name AS author_name,
    p.university AS author_university,
    p.major AS author_major,
    p.graduation_year AS author_graduation_year,
    p.clinical_hours AS author_clinical_hours
FROM opportunity_questions q
LEFT JOIN discussion_votes v ON v.votable_id = q.id AND v.votable_type = 'question'::votable_type
LEFT JOIN question_answers a ON a.question_id = q.id
LEFT JOIN public_profiles p ON q.user_id = p.id
GROUP BY q.id, q.opportunity_id, q.user_id, q.title, q.body, q.created_at, q.updated_at, 
         p.full_name, p.university, p.major, p.graduation_year, p.clinical_hours;

-- Grant access to roles
GRANT SELECT ON public.questions_with_votes TO anon;
GRANT SELECT ON public.questions_with_votes TO authenticated;

-- 4. Drop and recreate answers_with_votes view (depends on public_profiles)
DROP VIEW IF EXISTS public.answers_with_votes CASCADE;

CREATE VIEW public.answers_with_votes
WITH (security_invoker = true)
AS
SELECT a.id,
    a.question_id,
    a.user_id,
    a.body,
    a.is_accepted,
    a.created_at,
    a.updated_at,
    COALESCE(sum(v.value), (0)::bigint) AS vote_count,
    p.full_name AS author_name,
    p.university AS author_university,
    p.major AS author_major,
    p.graduation_year AS author_graduation_year,
    p.clinical_hours AS author_clinical_hours
FROM question_answers a
LEFT JOIN discussion_votes v ON v.votable_id = a.id AND v.votable_type = 'answer'::votable_type
LEFT JOIN public_profiles p ON a.user_id = p.id
GROUP BY a.id, a.question_id, a.user_id, a.body, a.is_accepted, a.created_at, a.updated_at,
         p.full_name, p.university, p.major, p.graduation_year, p.clinical_hours;

-- Grant access to roles
GRANT SELECT ON public.answers_with_votes TO anon;
GRANT SELECT ON public.answers_with_votes TO authenticated;