CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  company text NOT NULL,
  description text NOT NULL,
  location text NOT NULL,
  work_mode text NOT NULL CHECK (work_mode IN ('remote', 'hybrid', 'onsite')),
  category text NOT NULL,
  experience_min numeric(4,1) NOT NULL DEFAULT 0 CHECK (experience_min >= 0),
  experience_max numeric(4,1) NOT NULL DEFAULT 0 CHECK (experience_max >= experience_min),
  salary_min numeric(12,2) NOT NULL DEFAULT 0 CHECK (salary_min >= 0),
  salary_max numeric(12,2) NOT NULL DEFAULT 0 CHECK (salary_max >= salary_min),
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
