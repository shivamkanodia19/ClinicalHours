-- Add length constraints to profiles table
ALTER TABLE public.profiles
  ADD CONSTRAINT full_name_length CHECK (length(full_name) <= 100),
  ADD CONSTRAINT university_length CHECK (university IS NULL OR length(university) <= 200),
  ADD CONSTRAINT major_length CHECK (major IS NULL OR length(major) <= 100),
  ADD CONSTRAINT pre_med_track_length CHECK (pre_med_track IS NULL OR length(pre_med_track) <= 100),
  ADD CONSTRAINT bio_length CHECK (bio IS NULL OR length(bio) <= 2000),
  ADD CONSTRAINT career_goals_length CHECK (career_goals IS NULL OR length(career_goals) <= 2000),
  ADD CONSTRAINT research_experience_length CHECK (research_experience IS NULL OR length(research_experience) <= 5000),
  ADD CONSTRAINT phone_length CHECK (phone IS NULL OR length(phone) <= 20),
  ADD CONSTRAINT city_length CHECK (city IS NULL OR length(city) <= 100),
  ADD CONSTRAINT state_length CHECK (state IS NULL OR length(state) <= 50),
  ADD CONSTRAINT linkedin_url_length CHECK (linkedin_url IS NULL OR length(linkedin_url) <= 500),
  ADD CONSTRAINT resume_url_length CHECK (resume_url IS NULL OR length(resume_url) <= 500);

-- Add length constraints to opportunities table
ALTER TABLE public.opportunities
  ADD CONSTRAINT opp_name_length CHECK (length(name) <= 200),
  ADD CONSTRAINT opp_location_length CHECK (length(location) <= 200),
  ADD CONSTRAINT opp_address_length CHECK (address IS NULL OR length(address) <= 500),
  ADD CONSTRAINT opp_hours_required_length CHECK (length(hours_required) <= 100),
  ADD CONSTRAINT opp_phone_length CHECK (phone IS NULL OR length(phone) <= 30),
  ADD CONSTRAINT opp_email_length CHECK (email IS NULL OR length(email) <= 254),
  ADD CONSTRAINT opp_website_length CHECK (website IS NULL OR length(website) <= 500),
  ADD CONSTRAINT opp_description_length CHECK (description IS NULL OR length(description) <= 5000);

-- Add length constraints to user_projects table
ALTER TABLE public.user_projects
  ADD CONSTRAINT proj_title_length CHECK (length(title) <= 200),
  ADD CONSTRAINT proj_description_length CHECK (description IS NULL OR length(description) <= 3000),
  ADD CONSTRAINT proj_impact_length CHECK (impact IS NULL OR length(impact) <= 2000);

-- Add length constraints to reviews table
ALTER TABLE public.reviews
  ADD CONSTRAINT review_comment_length CHECK (comment IS NULL OR length(comment) <= 5000);

-- Add length constraints to opportunity_questions table
ALTER TABLE public.opportunity_questions
  ADD CONSTRAINT question_title_length CHECK (length(title) <= 300),
  ADD CONSTRAINT question_body_length CHECK (body IS NULL OR length(body) <= 5000);

-- Add length constraints to question_answers table
ALTER TABLE public.question_answers
  ADD CONSTRAINT answer_body_length CHECK (length(body) <= 10000);