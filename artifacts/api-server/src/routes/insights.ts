import { Router, type IRouter } from "express";
import {
  GetCandidateDashboardResponse,
  GetEmployerDashboardResponse,
  GetMatchParams,
  GetMatchResponse,
  GetSkillGapsResponse,
  ListMatchesResponse,
} from "@workspace/api-zod";
import { requireAuthentication, requireRole } from "../lib/auth";
import { notFound, validationError } from "../lib/errors";
import {
  calculateMatch,
  getCandidateContext,
  getJobById,
  getJobs,
  getSavedJobDates,
  persistMatches,
  type Job,
  type JobMatch,
} from "../lib/skillmatch";
import { getSupabase } from "../lib/supabase";

const router: IRouter = Router();
const candidateOnly = [requireAuthentication, requireRole("candidate")];

function jobForApi(job: Job) {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    description: job.description,
    location: job.location,
    workMode: job.workMode,
    category: job.category,
    experienceMin: job.experienceMin,
    experienceMax: job.experienceMax,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    status: job.status,
    createdAt: job.createdAt,
    requiredSkills: job.requiredSkills.map(({ id, name, category }) => ({ id, name, category })),
    preferredSkills: job.preferredSkills.map(({ id, name, category }) => ({ id, name, category })),
  };
}

function withSaved(match: JobMatch, saved: boolean) {
  return {
    ...match,
    job: jobForApi(match.job),
    saved,
  };
}

async function getSkillGaps(userId: string) {
  const candidate = await getCandidateContext(userId);
  const jobs = await getJobs({ status: "active" });
  const currentSkillIds = new Set(candidate.skills.map((skill) => skill.skillId));
  const gaps = new Map<
    string,
    { skill: { id: string; name: string; category: string }; relatedJobs: number }
  >();

  for (const job of jobs) {
    const missing = new Set(
      job.requiredSkills
        .filter((skill) => !currentSkillIds.has(skill.id))
        .map((skill) => skill.id),
    );
    for (const skillId of missing) {
      const skill = job.requiredSkills.find((item) => item.id === skillId);
      if (!skill) continue;
      const existing = gaps.get(skillId);
      if (existing) existing.relatedJobs += 1;
      else gaps.set(skillId, { skill, relatedJobs: 1 });
    }
  }

  const orderedGaps = [...gaps.values()]
    .map((gap) => ({
      ...gap,
      importance:
        gap.relatedJobs >= 4 ? "high" : gap.relatedJobs >= 2 ? "medium" : "low",
    }))
    .sort((a, b) => b.relatedJobs - a.relatedJobs || a.skill.name.localeCompare(b.skill.name));

  return { candidate, jobs, gaps: orderedGaps };
}

router.get("/matches", ...candidateOnly, async (req, res): Promise<void> => {
  const candidate = await getCandidateContext(req.authUser!.id);
  const jobs = await getJobs({ status: "active" });
  const savedDates = await getSavedJobDates(candidate.userId);
  const matches = jobs
    .map((job) => calculateMatch(candidate, job))
    .sort((a, b) => b.matchScore - a.matchScore || Date.parse(b.job.createdAt) - Date.parse(a.job.createdAt));
  await persistMatches(candidate.userId, matches);
  res.json(
    ListMatchesResponse.parse({
      success: true,
      data: matches.map((match) => withSaved(match, savedDates.has(match.job.id))),
    }),
  );
});

router.get(
  "/matches/:jobId",
  ...candidateOnly,
  async (req, res, next): Promise<void> => {
    const params = GetMatchParams.safeParse(req.params);
    if (!params.success) {
      next(validationError("Job identifier is invalid."));
      return;
    }
    const job = await getJobById(params.data.jobId);
    if (job.status !== "active") {
      next(notFound("Job not found."));
      return;
    }
    const candidate = await getCandidateContext(req.authUser!.id);
    const match = calculateMatch(candidate, job);
    await persistMatches(candidate.userId, [match]);
    res.json(GetMatchResponse.parse({ success: true, data: match }));
  },
);

router.get("/skill-gaps", ...candidateOnly, async (req, res): Promise<void> => {
  const { candidate, gaps } = await getSkillGaps(req.authUser!.id);
  res.json(
    GetSkillGapsResponse.parse({
      success: true,
      data: {
        currentSkills: candidate.skills,
        gaps: gaps.map((gap) => ({
          skill: gap.skill,
          relatedJobs: gap.relatedJobs,
          importance: gap.importance,
        })),
      },
    }),
  );
});

router.get(
  "/dashboard/candidate",
  ...candidateOnly,
  async (req, res): Promise<void> => {
    const userId = req.authUser!.id;
    const [{ candidate, jobs, gaps }, savedDates] = await Promise.all([
      getSkillGaps(userId),
      getSavedJobDates(userId),
    ]);
    const matches = jobs
      .map((job) => calculateMatch(candidate, job))
      .sort((a, b) => b.matchScore - a.matchScore);
    await persistMatches(userId, matches);
    const topMatches = matches.slice(0, 4).map((match) =>
      withSaved(match, savedDates.has(match.job.id)),
    );
    res.json(
      GetCandidateDashboardResponse.parse({
        success: true,
        data: {
          profileCompletion: candidate.completion,
          topMatch: topMatches[0] ?? null,
          savedJobsCount: savedDates.size,
          skillGapsCount: gaps.length,
          topMatches,
          recommendedSkills: gaps.slice(0, 5).map((gap) => ({
            skill: gap.skill,
            relatedJobs: gap.relatedJobs,
            importance: gap.importance,
          })),
        },
      }),
    );
  },
);

router.get(
  "/dashboard/employer",
  requireAuthentication,
  requireRole("employer", "admin"),
  async (req, res): Promise<void> => {
    const jobs = await getJobs({
      status: "all",
      createdBy: req.authUser?.role === "employer" ? req.authUser.id : undefined,
    });
    res.json(
      GetEmployerDashboardResponse.parse({
        success: true,
        data: {
          totalActiveJobs: jobs.filter((job) => job.status === "active").length,
          totalArchivedJobs: jobs.filter((job) => job.status === "archived").length,
          recentJobs: jobs.slice(0, 6).map(jobForApi),
        },
      }),
    );
  },
);

export default router;
