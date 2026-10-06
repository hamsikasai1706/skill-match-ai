CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique_idx ON public.users (lower(email));
CREATE INDEX IF NOT EXISTS candidate_profiles_user_id_idx ON public.candidate_profiles (user_id);
CREATE INDEX IF NOT EXISTS candidate_skills_candidate_idx ON public.candidate_skills (candidate_id);
CREATE INDEX IF NOT EXISTS candidate_skills_skill_idx ON public.candidate_skills (skill_id);
CREATE INDEX IF NOT EXISTS jobs_status_created_idx ON public.jobs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_category_idx ON public.jobs (category);
CREATE INDEX IF NOT EXISTS jobs_location_idx ON public.jobs (location);
CREATE INDEX IF NOT EXISTS jobs_created_by_idx ON public.jobs (created_by);
CREATE INDEX IF NOT EXISTS job_skills_job_type_idx ON public.job_skills (job_id, skill_type);
CREATE INDEX IF NOT EXISTS job_skills_skill_type_idx ON public.job_skills (skill_id, skill_type);
CREATE INDEX IF NOT EXISTS saved_jobs_user_created_idx ON public.saved_jobs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS match_results_user_score_idx ON public.match_results (user_id, match_score DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS candidate_profiles_set_updated_at ON public.candidate_profiles;
CREATE TRIGGER candidate_profiles_set_updated_at BEFORE UPDATE ON public.candidate_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS jobs_set_updated_at ON public.jobs;
CREATE TRIGGER jobs_set_updated_at BEFORE UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS match_results_set_updated_at ON public.match_results;
CREATE TRIGGER match_results_set_updated_at BEFORE UPDATE ON public.match_results
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
