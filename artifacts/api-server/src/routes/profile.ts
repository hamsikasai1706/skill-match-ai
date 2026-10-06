import { Router, type IRouter } from "express";
import {
  AddProfileSkillBody,
  AddProfileSkillResponse,
  GetProfileResponse,
  ListProfileSkillsResponse,
  ListSkillsQueryParams,
  ListSkillsResponse,
  RemoveProfileSkillParams,
  RemoveProfileSkillResponse,
  UpdateProfileBody,
  UpdateProfileResponse,
  UpdateProfileSkillBody,
  UpdateProfileSkillParams,
  UpdateProfileSkillResponse,
} from "@workspace/api-zod";
import { requireAuthentication, requireRole } from "../lib/auth";
import { HttpError, notFound, validationError } from "../lib/errors";
import { getCandidateContext, getSkills } from "../lib/skillmatch";
import { getSupabase } from "../lib/supabase";

const router: IRouter = Router();
const candidateOnly = [requireAuthentication, requireRole("candidate")];

router.get("/profile", ...candidateOnly, async (req, res, next): Promise<void> => {
  const candidate = await getCandidateContext(req.authUser!.id);
  res.json(
    GetProfileResponse.parse({
      success: true,
      data: {
        userId: candidate.userId,
        name: candidate.name,
        headline: candidate.headline,
        bio: candidate.bio,
        experienceYears: candidate.experienceYears,
        preferredLocation: candidate.preferredLocation,
        preferredWorkMode: candidate.preferredWorkMode,
        preferredCategories: candidate.preferredCategories,
        skills: candidate.skills,
        completion: candidate.completion,
      },
    }),
  );
});

router.put("/profile", ...candidateOnly, async (req, res, next): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    next(validationError(parsed.error.issues[0]?.message ?? "Profile details are invalid."));
    return;
  }
  const userId = req.authUser!.id;
  const supabase = getSupabase();
  const [userResult, profileResult] = await Promise.all([
    supabase.from("users").update({ name: parsed.data.name.trim() }).eq("id", userId),
    supabase
      .from("candidate_profiles")
      .update({
        headline: parsed.data.headline,
        bio: parsed.data.bio,
        experience_years: parsed.data.experienceYears,
        preferred_location: parsed.data.preferredLocation,
        preferred_work_mode: parsed.data.preferredWorkMode,
        preferred_categories: parsed.data.preferredCategories,
      })
      .eq("user_id", userId),
  ]);
  if (userResult.error || profileResult.error) {
    req.log.error(
      { userError: userResult.error?.code, profileError: profileResult.error?.code },
      "Profile update failed",
    );
    next(new HttpError(500, "PROFILE_UPDATE_FAILED", "We could not save your profile."));
    return;
  }

  const candidate = await getCandidateContext(userId);
  res.json(
    UpdateProfileResponse.parse({
      success: true,
      data: {
        userId: candidate.userId,
        name: candidate.name,
        headline: candidate.headline,
        bio: candidate.bio,
        experienceYears: candidate.experienceYears,
        preferredLocation: candidate.preferredLocation,
        preferredWorkMode: candidate.preferredWorkMode,
        preferredCategories: candidate.preferredCategories,
        skills: candidate.skills,
        completion: candidate.completion,
      },
    }),
  );
});

router.get("/skills", async (req, res, next): Promise<void> => {
  const parsed = ListSkillsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    next(validationError("Skill search is invalid."));
    return;
  }
  const skills = await getSkills(parsed.data.q ?? "");
  res.json(ListSkillsResponse.parse({ success: true, data: skills }));
});

router.get(
  "/profile/skills",
  ...candidateOnly,
  async (req, res): Promise<void> => {
    const candidate = await getCandidateContext(req.authUser!.id);
    res.json(
      ListProfileSkillsResponse.parse({ success: true, data: candidate.skills }),
    );
  },
);

router.post(
  "/profile/skills",
  ...candidateOnly,
  async (req, res, next): Promise<void> => {
    const parsed = AddProfileSkillBody.safeParse(req.body);
    if (!parsed.success) {
      next(validationError(parsed.error.issues[0]?.message ?? "Skill details are invalid."));
      return;
    }
    const candidate = await getCandidateContext(req.authUser!.id);
    const supabase = getSupabase();
    const { data: skillRecord, error: skillError } = await supabase
      .from("skills")
      .select("id")
      .eq("id", parsed.data.skillId)
      .maybeSingle();
    if (skillError) {
      req.log.error({ code: skillError.code }, "Skill lookup failed");
      next(new HttpError(500, "SKILL_LOOKUP_FAILED", "We could not load that skill."));
      return;
    }
    if (!skillRecord) {
      next(notFound("The selected skill does not exist."));
      return;
    }

    const { data, error } = await supabase
      .from("candidate_skills")
      .insert({
        candidate_id: candidate.profileId,
        skill_id: parsed.data.skillId,
        proficiency: parsed.data.proficiency,
        years_experience: parsed.data.yearsExperience,
      })
      .select("id,skill_id,proficiency,years_experience,skills(id,name,category)")
      .single();
    if (error) {
      if (error.code === "23505") {
        next(new HttpError(409, "SKILL_ALREADY_ADDED", "This skill is already in your profile."));
        return;
      }
      req.log.error({ code: error.code }, "Candidate skill insert failed");
      next(new HttpError(500, "SKILL_ADD_FAILED", "We could not add that skill."));
      return;
    }

    const value = data as {
      id: string;
      skill_id: string;
      proficiency: "beginner" | "intermediate" | "advanced" | "expert";
      years_experience: string | number;
      skills: { id: string; name: string; category: string } | Array<{ id: string; name: string; category: string }> | null;
    };
    const relatedSkill = (
      Array.isArray(value.skills) ? value.skills[0] : value.skills
    ) as { id: string; name: string; category: string } | null | undefined;
    if (!relatedSkill) {
      next(new HttpError(500, "SKILL_DATA_MISSING", "The saved skill could not be loaded."));
      return;
    }
    res.status(201).json(
      AddProfileSkillResponse.parse({
        success: true,
        data: {
          id: value.id,
          skillId: value.skill_id,
          name: relatedSkill.name,
          category: relatedSkill.category,
          proficiency: value.proficiency,
          yearsExperience: Number(value.years_experience),
        },
      }),
    );
  },
);

router.put(
  "/profile/skills/:skillId",
  ...candidateOnly,
  async (req, res, next): Promise<void> => {
    const params = UpdateProfileSkillParams.safeParse(req.params);
    const body = UpdateProfileSkillBody.safeParse(req.body);
    if (!params.success || !body.success) {
      next(validationError("Skill update details are invalid."));
      return;
    }

    const candidate = await getCandidateContext(req.authUser!.id);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("candidate_skills")
      .update({
        proficiency: body.data.proficiency,
        years_experience: body.data.yearsExperience,
      })
      .eq("id", params.data.skillId)
      .eq("candidate_id", candidate.profileId)
      .select("id,skill_id,proficiency,years_experience,skills(id,name,category)")
      .maybeSingle();
    if (error) {
      req.log.error({ code: error.code }, "Candidate skill update failed");
      next(new HttpError(500, "SKILL_UPDATE_FAILED", "We could not update that skill."));
      return;
    }
    if (!data) {
      next(notFound("That skill is not in your profile."));
      return;
    }

    const value = data as {
      id: string;
      skill_id: string;
      proficiency: "beginner" | "intermediate" | "advanced" | "expert";
      years_experience: string | number;
      skills: { id: string; name: string; category: string } | Array<{ id: string; name: string; category: string }> | null;
    };
    const relatedSkill = (
      Array.isArray(value.skills) ? value.skills[0] : value.skills
    ) as { id: string; name: string; category: string } | null | undefined;
    if (!relatedSkill) {
      next(new HttpError(500, "SKILL_DATA_MISSING", "The updated skill could not be loaded."));
      return;
    }
    res.json(
      UpdateProfileSkillResponse.parse({
        success: true,
        data: {
          id: value.id,
          skillId: value.skill_id,
          name: relatedSkill.name,
          category: relatedSkill.category,
          proficiency: value.proficiency,
          yearsExperience: Number(value.years_experience),
        },
      }),
    );
  },
);

router.delete(
  "/profile/skills/:skillId",
  ...candidateOnly,
  async (req, res, next): Promise<void> => {
    const params = RemoveProfileSkillParams.safeParse(req.params);
    if (!params.success) {
      next(validationError("Skill identifier is invalid."));
      return;
    }
    const candidate = await getCandidateContext(req.authUser!.id);
    const { data, error } = await getSupabase()
      .from("candidate_skills")
      .delete()
      .eq("id", params.data.skillId)
      .eq("candidate_id", candidate.profileId)
      .select("id")
      .maybeSingle();
    if (error) {
      req.log.error({ code: error.code }, "Candidate skill delete failed");
      next(new HttpError(500, "SKILL_REMOVE_FAILED", "We could not remove that skill."));
      return;
    }
    if (!data) {
      next(notFound("That skill is not in your profile."));
      return;
    }
    res.json(RemoveProfileSkillResponse.parse({ success: true, data: {} }));
  },
);

export default router;
