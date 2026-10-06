CREATE TABLE IF NOT EXISTS public.candidate_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  proficiency text NOT NULL CHECK (proficiency IN ('beginner', 'intermediate', 'advanced', 'expert')),
  years_experience numeric(4,1) NOT NULL DEFAULT 0 CHECK (years_experience >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidate_skills_candidate_skill_unique UNIQUE (candidate_id, skill_id)
);
