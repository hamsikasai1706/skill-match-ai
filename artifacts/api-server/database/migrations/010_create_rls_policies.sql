ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;

-- The Express API uses a server-only Supabase service key and enforces JWT
-- ownership and role checks. No browser-facing role receives direct table access.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users', 'candidate_profiles', 'skills', 'candidate_skills',
    'jobs', 'job_skills', 'saved_jobs', 'match_results'
  ]
  LOOP
    EXECUTE format(
      'REVOKE ALL ON public.%I FROM anon, authenticated',
      table_name
    );
    EXECUTE format(
      'GRANT ALL ON public.%I TO service_role',
      table_name
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      table_name || '_api_service_only', table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      table_name || '_api_service_only', table_name
    );
  END LOOP;
END
$$;
