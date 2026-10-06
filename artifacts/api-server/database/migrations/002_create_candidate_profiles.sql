CREATE TABLE IF NOT EXISTS public.candidate_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  headline text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  experience_years numeric(4,1) NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
  preferred_location text NOT NULL DEFAULT '',
  preferred_work_mode text NOT NULL DEFAULT 'remote'
    CHECK (preferred_work_mode IN ('remote', 'hybrid', 'onsite')),
  preferred_categories text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
