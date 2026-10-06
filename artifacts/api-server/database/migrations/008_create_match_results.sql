CREATE TABLE IF NOT EXISTS public.match_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  match_score integer NOT NULL CHECK (match_score BETWEEN 0 AND 100),
  matched_skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferred_matches jsonb NOT NULL DEFAULT '[]'::jsonb,
  experience_match jsonb NOT NULL DEFAULT '{}'::jsonb,
  explanation jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_results_user_job_unique UNIQUE (user_id, job_id)
);
