import { Router, type IRouter } from "express";
import {
  ArchiveJobParams,
  ArchiveJobResponse,
  CreateJobBody,
  CreateJobResponse,
  DeleteJobParams,
  DeleteJobResponse,
  GetJobParams,
  GetJobResponse,
  ListJobsQueryParams,
  ListJobsResponse,
  ListSavedJobsResponse,
  SaveJobParams,
  SaveJobResponse,
  UnsaveJobParams,
  UnsaveJobResponse,
  UpdateJobBody,
  UpdateJobParams,
  UpdateJobResponse,
} from "@workspace/api-zod";
import {
  optionalAuthentication,
  requireAuthentication,
  requireRole,
} from "../lib/auth";
import { HttpError, notFound, validationError } from "../lib/errors";
import {
  calculateMatch,
  getCandidateContext,
  getJobById,
  getJobs,
  getSavedJobDates,
  getSkills,
  persistMatches,
  replaceJobSkills,
} from "../lib/skillmatch";
import { getSupabase } from "../lib/supabase";

const router: IRouter = Router();
router.use(optionalAuthentication);

const candidateOnly = [requireAuthentication, requireRole("candidate")];
const employerOnly = [requireAuthentication, requireRole("employer", "admin")];

function publicJob(job: Awaited<ReturnType<typeof getJobById>>) {
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

function validSkillLists(
  required: Array<{ skillId: string }>,
  preferred: Array<{ skillId: string }>,
): boolean {
  const allIds = [...required, ...preferred].map((item) => item.skillId);
  return new Set(allIds).size === allIds.length;
}

async function validateSkillIds(
  ids: string[],
  req: Parameters<Parameters<IRouter["post"]>[1]>[0],
): Promise<boolean> {
  if (!ids.length) return true;
  const { data, error } = await getSupabase()
    .from("skills")
    .select("id")
    .in("id", ids);
  if (error) {
    req.log.error({ code: error.code }, "Job skill validation failed");
    return false;
  }
  return (data ?? []).length === ids.length;
}

async function createJob(
  userId: string,
  input: ReturnType<typeof CreateJobBody.parse>,
  req: Parameters<Parameters<IRouter["post"]>[1]>[0],
) {
  if (
    input.experienceMax < input.experienceMin ||
    input.salaryMax < input.salaryMin ||
    !validSkillLists(input.requiredSkills, input.preferredSkills)
  ) {
    throw validationError("Experience, salary, or skill requirements are inconsistent.");
  }

  const skillsAreValid = await validateSkillIds(
    [...input.requiredSkills, ...input.preferredSkills].map((item) => item.skillId),
    req,
  );
  if (!skillsAreValid) {
    throw validationError("Choose skills from the searchable skills list.");
  }

  const { data, error } = await getSupabase()
    .from("jobs")
    .insert({
      title: input.title.trim(),
      company: input.company.trim(),
      description: input.description.trim(),
      location: input.location.trim(),
      work_mode: input.workMode,
      category: input.category.trim(),
      experience_min: input.experienceMin,
      experience_max: input.experienceMax,
      salary_min: input.salaryMin,
      salary_max: input.salaryMax,
      created_by: userId,
      status: "active",
    })
    .select("id")
    .single();
  if (error || !data) {
    req.log.error({ code: error?.code }, "Job creation failed");
    throw new HttpError(500, "JOB_CREATE_FAILED", "We could not create this job.");
  }

  try {
    await replaceJobSkills(data.id as string, input.requiredSkills, input.preferredSkills);
  } catch (error) {
    const { error: rollbackError } = await getSupabase().from("jobs").delete().eq("id", data.id);
    req.log.error(
      { rollbackFailed: Boolean(rollbackError), error: error instanceof Error ? error.name : "unknown" },
      "Job skill insert failed after creating the job",
    );
    throw error;
  }
  return getJobById(data.id as string);
}

async function canManageJob(
  jobId: string,
  user: NonNullable<Express.Request["authUser"]>,
): Promise<Awaited<ReturnType<typeof getJobById>>> {
  const job = await getJobById(jobId);
  if (user.role !== "admin" && job.createdBy !== user.id) {
    throw new HttpError(403, "FORBIDDEN", "You can only manage jobs created by your account.");
  }
  return job;
}

router.get("/jobs", async (req, res, next): Promise<void> => {
  const parsed = ListJobsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    next(validationError("Job search filters are invalid."));
    return;
  }
  const user = req.authUser;
  const managedView = user?.role === "employer" || user?.role === "admin";
  const jobs = await getJobs({
    status: managedView ? "all" : "active",
    createdBy: user?.role === "employer" ? user.id : undefined,
  });
  const candidate =
    user?.role === "candidate" ? await getCandidateContext(user.id) : null;
  const savedDates = candidate ? await getSavedJobDates(candidate.userId) : new Map<string, string>();
  const query = parsed.data.q?.trim().toLocaleLowerCase();

  let results = jobs.map((job) => {
    const match = candidate
      ? calculateMatch(candidate, job)
      : {
          job,
          matchScore: 0,
          scoreBreakdown: { requiredSkills: 0, preferredSkills: 0, experience: 0 },
          matchedRequiredSkills: [],
          missingRequiredSkills: job.requiredSkills.map((skill) => skill.name),
          matchedPreferredSkills: [],
          experienceMatch: 0,
        };
    return { ...match, saved: Boolean(candidate && savedDates.has(job.id)) };
  });

  if (query) {
    results = results.filter(({ job }) =>
      [job.title, job.company, ...job.requiredSkills.map((skill) => skill.name), ...job.preferredSkills.map((skill) => skill.name)]
        .some((value) => value.toLocaleLowerCase().includes(query)),
    );
  }
  if (parsed.data.category) {
    results = results.filter((item) => item.job.category.toLocaleLowerCase() === parsed.data.category!.toLocaleLowerCase());
  }
  if (parsed.data.location) {
    const location = parsed.data.location.toLocaleLowerCase();
    results = results.filter((item) => item.job.location.toLocaleLowerCase().includes(location));
  }
  if (parsed.data.workMode) {
    results = results.filter((item) => item.job.workMode === parsed.data.workMode);
  }
  if (parsed.data.minExperience !== undefined) {
    results = results.filter((item) => item.job.experienceMax >= parsed.data.minExperience!);
  }
  if (parsed.data.maxExperience !== undefined) {
    results = results.filter((item) => item.job.experienceMin <= parsed.data.maxExperience!);
  }
  if (parsed.data.minSalary !== undefined) {
    results = results.filter((item) => item.job.salaryMax >= parsed.data.minSalary!);
  }
  if (parsed.data.maxSalary !== undefined) {
    results = results.filter((item) => item.job.salaryMin <= parsed.data.maxSalary!);
  }
  if (parsed.data.minMatch !== undefined) {
    results = results.filter((item) => item.matchScore >= parsed.data.minMatch!);
  }
  switch (parsed.data.sort) {
    case "newest":
      results.sort((a, b) => Date.parse(b.job.createdAt) - Date.parse(a.job.createdAt));
      break;
    case "salary-high":
      results.sort((a, b) => b.job.salaryMax - a.job.salaryMax);
      break;
    case "salary-low":
      results.sort((a, b) => a.job.salaryMin - b.job.salaryMin);
      break;
    default:
      if (candidate) results.sort((a, b) => b.matchScore - a.matchScore);
      break;
  }

  res.json(
    ListJobsResponse.parse({
      success: true,
      data: {
        items: results.map((match) => ({
          ...match,
          job: publicJob(match.job),
        })),
        total: results.length,
      },
    }),
  );
});

router.get("/jobs/:id", async (req, res, next): Promise<void> => {
  const params = GetJobParams.safeParse(req.params);
  if (!params.success) {
    next(validationError("Job identifier is invalid."));
    return;
  }
  const job = await getJobById(params.data.id);
  const user = req.authUser;
  if (
    job.status === "archived" &&
    (!user || (user.role !== "admin" && !(user.role === "employer" && user.id === job.createdBy)))
  ) {
    next(notFound("Job not found."));
    return;
  }

  let match = null;
  let saved = false;
  if (user?.role === "candidate") {
    const candidate = await getCandidateContext(user.id);
    match = calculateMatch(candidate, job);
    const dates = await getSavedJobDates(user.id);
    saved = dates.has(job.id);
    await persistMatches(user.id, [match]);
  }
  res.json(
    GetJobResponse.parse({
      success: true,
      data: { job: publicJob(job), match, saved },
    }),
  );
});

router.post(
  "/jobs",
  ...employerOnly,
  async (req, res, next): Promise<void> => {
    const parsed = CreateJobBody.safeParse(req.body);
    if (!parsed.success) {
      next(validationError(parsed.error.issues[0]?.message ?? "Job details are invalid."));
      return;
    }
    const job = await createJob(req.authUser!.id, parsed.data, req);
    res.status(201).json(
      CreateJobResponse.parse({ success: true, data: publicJob(job) }),
    );
  },
);

router.put(
  "/jobs/:id",
  ...employerOnly,
  async (req, res, next): Promise<void> => {
    const params = UpdateJobParams.safeParse(req.params);
    const parsed = UpdateJobBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      next(validationError("Job update details are invalid."));
      return;
    }
    const current = await canManageJob(params.data.id, req.authUser!);
    if (
      parsed.data.experienceMax < parsed.data.experienceMin ||
      parsed.data.salaryMax < parsed.data.salaryMin ||
      !validSkillLists(parsed.data.requiredSkills, parsed.data.preferredSkills)
    ) {
      next(validationError("Experience, salary, or skill requirements are inconsistent."));
      return;
    }
    const skillsAreValid = await validateSkillIds(
      [...parsed.data.requiredSkills, ...parsed.data.preferredSkills].map((item) => item.skillId),
      req,
    );
    if (!skillsAreValid) {
      next(validationError("Choose skills from the searchable skills list."));
      return;
    }

    const { error } = await getSupabase()
      .from("jobs")
      .update({
        title: parsed.data.title.trim(),
        company: parsed.data.company.trim(),
        description: parsed.data.description.trim(),
        location: parsed.data.location.trim(),
        work_mode: parsed.data.workMode,
        category: parsed.data.category.trim(),
        experience_min: parsed.data.experienceMin,
        experience_max: parsed.data.experienceMax,
        salary_min: parsed.data.salaryMin,
        salary_max: parsed.data.salaryMax,
      })
      .eq("id", current.id);
    if (error) {
      req.log.error({ code: error.code }, "Job update failed");
      next(new HttpError(500, "JOB_UPDATE_FAILED", "We could not update this job."));
      return;
    }
    await replaceJobSkills(current.id, parsed.data.requiredSkills, parsed.data.preferredSkills);
    const updated = await getJobById(current.id);
    res.json(
      UpdateJobResponse.parse({ success: true, data: publicJob(updated) }),
    );
  },
);

router.delete(
  "/jobs/:id",
  ...employerOnly,
  async (req, res, next): Promise<void> => {
    const params = DeleteJobParams.safeParse(req.params);
    if (!params.success) {
      next(validationError("Job identifier is invalid."));
      return;
    }
    const job = await canManageJob(params.data.id, req.authUser!);
    const { error } = await getSupabase().from("jobs").delete().eq("id", job.id);
    if (error) {
      req.log.error({ code: error.code }, "Job delete failed");
      next(new HttpError(500, "JOB_DELETE_FAILED", "We could not delete this job."));
      return;
    }
    res.json(DeleteJobResponse.parse({ success: true, data: {} }));
  },
);

router.patch(
  "/jobs/:id/archive",
  ...employerOnly,
  async (req, res, next): Promise<void> => {
    const params = ArchiveJobParams.safeParse(req.params);
    if (!params.success) {
      next(validationError("Job identifier is invalid."));
      return;
    }
    const job = await canManageJob(params.data.id, req.authUser!);
    const { error } = await getSupabase()
      .from("jobs")
      .update({ status: "archived" })
      .eq("id", job.id);
    if (error) {
      req.log.error({ code: error.code }, "Job archive failed");
      next(new HttpError(500, "JOB_ARCHIVE_FAILED", "We could not archive this job."));
      return;
    }
    const archived = await getJobById(job.id);
    res.json(ArchiveJobResponse.parse({ success: true, data: publicJob(archived) }));
  },
);

router.get("/saved-jobs", ...candidateOnly, async (req, res): Promise<void> => {
  const userId = req.authUser!.id;
  const savedDates = await getSavedJobDates(userId);
  const jobs = await getJobs({ status: "all" });
  const candidate = await getCandidateContext(userId);
  const items = jobs
    .filter((job) => savedDates.has(job.id))
    .map((job) => ({
      job: publicJob(job),
      savedAt: savedDates.get(job.id)!,
      matchScore: calculateMatch(candidate, job).matchScore,
    }));
  res.json(ListSavedJobsResponse.parse({ success: true, data: items }));
});

router.post(
  "/jobs/:id/save",
  ...candidateOnly,
  async (req, res, next): Promise<void> => {
    const params = SaveJobParams.safeParse(req.params);
    if (!params.success) {
      next(validationError("Job identifier is invalid."));
      return;
    }
    const job = await getJobById(params.data.id);
    if (job.status !== "active") {
      next(notFound("This job is no longer active."));
      return;
    }
    const { error } = await getSupabase()
      .from("saved_jobs")
      .upsert(
        { user_id: req.authUser!.id, job_id: job.id },
        { onConflict: "user_id,job_id", ignoreDuplicates: true },
      );
    if (error) {
      req.log.error({ code: error.code }, "Save job failed");
      next(new HttpError(500, "SAVE_JOB_FAILED", "We could not save this job."));
      return;
    }
    res.json(SaveJobResponse.parse({ success: true, data: {} }));
  },
);

router.delete(
  "/jobs/:id/save",
  ...candidateOnly,
  async (req, res, next): Promise<void> => {
    const params = UnsaveJobParams.safeParse(req.params);
    if (!params.success) {
      next(validationError("Job identifier is invalid."));
      return;
    }
    const { error } = await getSupabase()
      .from("saved_jobs")
      .delete()
      .eq("user_id", req.authUser!.id)
      .eq("job_id", params.data.id);
    if (error) {
      req.log.error({ code: error.code }, "Unsave job failed");
      next(new HttpError(500, "UNSAVE_JOB_FAILED", "We could not remove this saved job."));
      return;
    }
    res.json(UnsaveJobResponse.parse({ success: true, data: {} }));
  },
);

export default router;
