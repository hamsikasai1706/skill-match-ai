import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import {
  GetCurrentUserResponse,
  LoginBody,
  LoginResponse,
  LogoutResponse,
  RegisterBody,
  RegisterResponse,
} from "@workspace/api-zod";
import { requireAuthentication, hashPassword, signAccessToken, verifyPassword } from "../lib/auth";
import { HttpError, validationError } from "../lib/errors";
import { getSupabase } from "../lib/supabase";

const router: IRouter = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res): void => {
    res.status(429).json({
      success: false,
      error: { code: "RATE_LIMITED", message: "Too many sign-in attempts. Wait before trying again." },
    });
  },
});

function userView(row: {
  id: string;
  name: string;
  email: string;
  role: "candidate" | "employer" | "admin";
}) {
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

router.post("/auth/register", authLimiter, async (req, res, next): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    next(validationError(parsed.error.issues[0]?.message ?? "Registration details are invalid."));
    return;
  }

  if (parsed.data.role === "admin") {
    next(new HttpError(403, "ROLE_NOT_ALLOWED", "Admin accounts cannot be created through public registration."));
    return;
  }

  const supabase = getSupabase();
  const email = parsed.data.email.trim().toLowerCase();
  const passwordHash = await hashPassword(parsed.data.password);
  const { data, error } = await supabase
    .from("users")
    .insert({
      name: parsed.data.name.trim(),
      email,
      password_hash: passwordHash,
      role: parsed.data.role,
    })
    .select("id,name,email,role")
    .single();

  if (error) {
    if (error.code === "23505") {
      next(new HttpError(409, "EMAIL_ALREADY_REGISTERED", "An account with this email already exists."));
      return;
    }
    req.log.error({ code: error.code }, "Registration database operation failed");
    next(new HttpError(500, "REGISTRATION_FAILED", "We could not create your account. Please try again."));
    return;
  }

  const user = data as {
    id: string;
    name: string;
    email: string;
    role: "candidate" | "employer" | "admin";
  };

  if (user.role === "candidate") {
    const { error: profileError } = await supabase.from("candidate_profiles").insert({
      user_id: user.id,
    });
    if (profileError) {
      const { error: cleanupError } = await supabase.from("users").delete().eq("id", user.id);
      req.log.error(
        { code: profileError.code, rollbackFailed: Boolean(cleanupError) },
        "Candidate profile creation failed during registration",
      );
      next(new HttpError(500, "REGISTRATION_FAILED", "We could not finish creating your account. Please try again."));
      return;
    }
  }

  const token = signAccessToken(userView(user));
  res.status(201).json(
    RegisterResponse.parse({
      success: true,
      data: { token, user: userView(user) },
    }),
  );
});

router.post("/auth/login", authLimiter, async (req, res, next): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    next(validationError(parsed.error.issues[0]?.message ?? "Email or password is invalid."));
    return;
  }

  const supabase = getSupabase();
  const email = parsed.data.email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("users")
    .select("id,name,email,role,password_hash")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    req.log.error({ code: error.code }, "Login database operation failed");
    next(new HttpError(500, "LOGIN_FAILED", "We could not sign you in. Please try again."));
    return;
  }

  const row = data as
    | {
        id: string;
        name: string;
        email: string;
        role: "candidate" | "employer" | "admin";
        password_hash: string;
      }
    | null;
  if (!row || !(await verifyPassword(parsed.data.password, row.password_hash))) {
    next(new HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect."));
    return;
  }

  const user = userView(row);
  const token = signAccessToken(user);
  res.json(LoginResponse.parse({ success: true, data: { token, user } }));
});

router.post("/auth/logout", requireAuthentication, (_req, res): void => {
  res.json(LogoutResponse.parse({ success: true, data: {} }));
});

router.get(
  "/auth/me",
  requireAuthentication,
  async (req, res, next): Promise<void> => {
    const userId = req.authUser?.id;
    if (!userId) {
      next(new HttpError(401, "UNAUTHORIZED", "Sign in to continue."));
      return;
    }

    const { data, error } = await getSupabase()
      .from("users")
      .select("id,name,email,role")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      req.log.error({ code: error.code }, "Current-user lookup failed");
      next(new HttpError(500, "USER_LOOKUP_FAILED", "We could not load your account."));
      return;
    }
    if (!data) {
      next(new HttpError(401, "UNAUTHORIZED", "This account is no longer available."));
      return;
    }

    res.json(GetCurrentUserResponse.parse({ success: true, data: userView(data) }));
  },
);

export default router;
