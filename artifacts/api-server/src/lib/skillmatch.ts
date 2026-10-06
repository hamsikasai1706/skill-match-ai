import { getSupabase } from "./supabase";
import { HttpError, notFound } from "./errors";

export interface Skill {
  id: string;
  name: string;
  category: string;
}

export interface CandidateSkill {
  id: string;
  skillId: string;
  name: string;
  category: string;
  proficiency: "beginner" | "intermediate" | "advanced" | "expert";
  yearsExperience: number;
}

export interface CandidateContext {
  userId: string;
  name: string;
  profileId: string;
  headline: string;
  bio: string;
  experienceYears: number;
  preferredLocation: string;
  preferredWorkMode: "remote" | "hybrid" | "onsite";
  preferredCategories: string[];
  skills: CandidateSkill[];
  completion: number;
}

export interface JobSkill extends Skill {
  importance: number;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  description: string;
  location: string;
  workMode: "remote" | "hybrid" | "onsite";
  category: string;
  experienceMin: number;
  experienceMax: number;
  salaryMin: number;
  salaryMax: number;
  createdBy: string;
  status: "active" | "archived";
  createdAt: string;
  requiredSkills: JobSkill[];
  preferredSkills: JobSkill[];
}

export interface JobMatch {
  job: Job;
  matchScore: number;
  scoreBreakdown: {
    requiredSkills: number;
    preferredSkills: number;
    experience: number;
  };
  matchedRequiredSkills: string[];
  missingRequiredSkills: string[];
  matchedPreferredSkills: string[];
  experienceMatch: number;
}

interface SkillRow {
  id: string;
  name: string;
  category: string;
}

interface CandidateSkillRow {
  id: string;
  skill_id: string;
  proficiency: CandidateSkill["proficiency"];
  years_experience: number | string;
  skills: SkillRow | SkillRow[] | null;
}

interface JobSkillRow {
  skill_type: "required" | "preferred";
  importance: number;
  skills: SkillRow | SkillRow[] | null;
}

interface JobRow {
  id: string;
  title: string;
  company: string;
  description: string;
  location: string;
  work_mode: Job["workMode"];
  category: string;
  experience_min: number | string;
  experience_max: number | string;
  salary_min: number | string;
  salary_max: number | string;
  created_by: string;
  status: Job["status"];
  created_at: string;
  job_skills: JobSkillRow[] | null;
}

function failDatabase(error: unknown): void {
  if (error) {
    throw new HttpError(
      500,
      "DATABASE_ERROR",
      "A database operation failed. Confirm that the Supabase migrations have been applied.",
    );
  }
}

function asSkill(value: SkillRow | SkillRow[] | null): SkillRow | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function mapCandidateSkill(row: CandidateSkillRow): CandidateSkill | null {
  const skill = asSkill(row.skills);
  if (!skill) return null;
  return {
    id: row.id,
    skillId: row.skill_id,
    name: skill.name,
    category: skill.category,
    proficiency: row.proficiency,
    yearsExperience: Number(row.years_experience),
  };
}

function mapJob(row: JobRow): Job {
  const requiredSkills: JobSkill[] = [];
  const preferredSkills: JobSkill[] = [];
  for (const entry of row.job_skills ?? []) {
    const skill = asSkill(entry.skills);
    if (!skill) continue;
    const mapped = { ...skill, importance: Number(entry.importance) };
    if (entry.skill_type === "required") requiredSkills.push(mapped);
    else preferredSkills.push(mapped);
  }
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    description: row.description,
    location: row.location,
    workMode: row.work_mode,
    category: row.category,
    experienceMin: Number(row.experience_min),
    experienceMax: Number(row.experience_max),
    salaryMin: Number(row.salary_min),
    salaryMax: Number(row.salary_max),
    createdBy: row.created_by,
    status: row.status,
    createdAt: row.created_at,
    requiredSkills,
    preferredSkills,
  };
}

export async function getSkills(search = ""): Promise<Skill[]> {
  const supabase = getSupabase();
  let query = supabase.from("skills").select("id,name,category").order("name");
  if (search.trim()) query = query.ilike("name", `%${search.trim()}%`);
  const { data, error } = await query;
  failDatabase(error);
  return (data ?? []) as Skill[];
}

export async function getCandidateContext(userId: string): Promise<CandidateContext> {
  const supabase = getSupabase();
  const [userResult, profileResult] = await Promise.all([
    supabase.from("users").select("name").eq("id", userId).maybeSingle(),
    supabase
      .from("candidate_profiles")
      .select("id,headline,bio,experience_years,preferred_location,preferred_work_mode,preferred_categories")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  failDatabase(userResult.error);
  failDatabase(profileResult.error);
  if (!userResult.data || !profileResult.data) {
    throw notFound("Complete a candidate profile before using job matching.");
  }

  const profile = profileResult.data as {
    id: string;
    headline: string;
    bio: string;
    experience_years: number | string;
    preferred_location: string;
    preferred_work_mode: CandidateContext["preferredWorkMode"];
    preferred_categories: string[] | null;
  };
  const { data: skillRows, error: skillError } = await supabase
    .from("candidate_skills")
    .select("id,skill_id,proficiency,years_experience,skills(id,name,category)")
    .eq("candidate_id", profile.id);
  failDatabase(skillError);

  const skills = ((skillRows ?? []) as CandidateSkillRow[])
    .map(mapCandidateSkill)
    .filter((item): item is CandidateSkill => item !== null);
  const completionFields = [
    Boolean(String(userResult.data.name ?? "").trim()),
    Boolean(profile.headline.trim()),
    Boolean(profile.bio.trim()),
    Number(profile.experience_years) > 0,
    Boolean(profile.preferred_location.trim()),
    Boolean(profile.preferred_work_mode),
    skills.length > 0,
  ];

  return {
    userId,
    name: String(userResult.data.name),
    profileId: profile.id,
    headline: profile.headline,
    bio: profile.bio,
    experienceYears: Number(profile.experience_years),
    preferredLocation: profile.preferred_location,
    preferredWorkMode: profile.preferred_work_mode,
    preferredCategories: profile.preferred_categories ?? [],
    skills,
    completion: Math.round(
      (completionFields.filter(Boolean).length / completionFields.length) * 100,
    ),
  };
}

const JOB_SKILLS_SELECT =
  "id,title,company,description,location,work_mode,category,experience_min,experience_max,salary_min,salary_max,created_by,status,created_at,job_skills(skill_type,importance,skills(id,name,category))";

export async function getJobs(options?: {
  status?: "active" | "archived" | "all";
  createdBy?: string;
}): Promise<Job[]> {
  const supabase = getSupabase();
  let query = supabase.from("jobs").select(JOB_SKILLS_SELECT);
  if (options?.status && options.status !== "all") {
    query = query.eq("status", options.status);
  }
  if (options?.createdBy) {
    query = query.eq("created_by", options.createdBy);
  }
  const { data, error } = await query.order("created_at", { ascending: false });
  failDatabase(error);
  return ((data ?? []) as JobRow[]).map(mapJob);
}

export async function getJobById(id: string): Promise<Job> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_SKILLS_SELECT)
    .eq("id", id)
    .maybeSingle();
  failDatabase(error);
  if (!data) throw notFound("Job not found.");
  return mapJob(data as JobRow);
}

export function calculateMatch(candidate: CandidateContext, job: Job): JobMatch {
  const candidateSkillNames = new Set(
    candidate.skills.map((skill) => skill.name.trim().toLocaleLowerCase()),
  );
  const matchedRequiredSkills = job.requiredSkills
    .filter((skill) => candidateSkillNames.has(skill.name.trim().toLocaleLowerCase()))
    .map((skill) => skill.name);
  const missingRequiredSkills = job.requiredSkills
    .filter((skill) => !candidateSkillNames.has(skill.name.trim().toLocaleLowerCase()))
    .map((skill) => skill.name);
  const matchedPreferredSkills = job.preferredSkills
    .filter((skill) => candidateSkillNames.has(skill.name.trim().toLocaleLowerCase()))
    .map((skill) => skill.name);

  const requiredScore = job.requiredSkills.length
    ? matchedRequiredSkills.length / job.requiredSkills.length
    : 1;
  const preferredScore = job.preferredSkills.length
    ? matchedPreferredSkills.length / job.preferredSkills.length
    : 1;
  let experienceMatch = 1;
  if (job.experienceMin > 0 && candidate.experienceYears < job.experienceMin) {
    experienceMatch = Math.max(
      0,
      Math.min(1, candidate.experienceYears / job.experienceMin),
    );
  }

  const scoreBreakdown = {
    requiredSkills: requiredScore * 70,
    preferredSkills: preferredScore * 20,
    experience: experienceMatch * 10,
  };

  return {
    job,
    matchScore: Math.max(
      0,
      Math.min(
        100,
        Math.round(
          scoreBreakdown.requiredSkills +
            scoreBreakdown.preferredSkills +
            scoreBreakdown.experience,
        ),
      ),
    ),
    scoreBreakdown,
    matchedRequiredSkills,
    missingRequiredSkills,
    matchedPreferredSkills,
    experienceMatch,
  };
}

export async function persistMatches(
  userId: string,
  matches: JobMatch[],
): Promise<void> {
  if (!matches.length) return;
  const supabase = getSupabase();
  const rows = matches.map((match) => ({
    user_id: userId,
    job_id: match.job.id,
    match_score: match.matchScore,
    matched_skills: match.matchedRequiredSkills,
    missing_skills: match.missingRequiredSkills,
    preferred_matches: match.matchedPreferredSkills,
    experience_match: {
      score: match.experienceMatch,
      breakdown: match.scoreBreakdown,
    },
  }));
  const { error } = await supabase
    .from("match_results")
    .upsert(rows, { onConflict: "user_id,job_id" });
  failDatabase(error);
}

export async function saveExplanation(
  userId: string,
  jobId: string,
  explanation: unknown,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("match_results")
    .update({ explanation })
    .eq("user_id", userId)
    .eq("job_id", jobId);
  failDatabase(error);
}

export async function getSavedJobDates(userId: string): Promise<Map<string, string>> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("saved_jobs")
    .select("job_id,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  failDatabase(error);
  return new Map(
    ((data ?? []) as Array<{ job_id: string; created_at: string }>).map((row) => [
      row.job_id,
      row.created_at,
    ]),
  );
}

export async function replaceJobSkills(
  jobId: string,
  required: Array<{ skillId: string; importance?: number }>,
  preferred: Array<{ skillId: string; importance?: number }>,
): Promise<void> {
  const supabase = getSupabase();
  const { error: deleteError } = await supabase
    .from("job_skills")
    .delete()
    .eq("job_id", jobId);
  failDatabase(deleteError);
  const rows = [
    ...required.map((skill) => ({
      job_id: jobId,
      skill_id: skill.skillId,
      skill_type: "required" as const,
      importance: skill.importance ?? 3,
    })),
    ...preferred.map((skill) => ({
      job_id: jobId,
      skill_id: skill.skillId,
      skill_type: "preferred" as const,
      importance: skill.importance ?? 3,
    })),
  ];
  if (!rows.length) return;
  const { error } = await supabase.from("job_skills").insert(rows);
  failDatabase(error);
}
