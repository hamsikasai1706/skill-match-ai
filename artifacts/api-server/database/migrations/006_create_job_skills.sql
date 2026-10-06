CREATE TABLE IF NOT EXISTS public.job_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  skill_type text NOT NULL CHECK (skill_type IN ('required', 'preferred')),
  importance integer NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_skills_job_skill_type_unique UNIQUE (job_id, skill_id, skill_type)
);
