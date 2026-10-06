import bcrypt from "bcryptjs";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { HttpError, serviceUnavailable } from "./errors";

export type AppRole = "candidate" | "employer" | "admin";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: AppRole;
}

function getJwtSecret(): string {
  const secret = process.env["JWT_SECRET"] ?? process.env["SESSION_SECRET"];
  if (!secret) {
    throw serviceUnavailable(
      "Authentication is not configured. Set JWT_SECRET in the project secrets.",
    );
  }
  return secret;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(passwordHash)) {
    return false;
  }
  return bcrypt.compare(password, passwordHash);
}

export function signAccessToken(user: AuthenticatedUser): string {
  return jwt.sign({ email: user.email, role: user.role }, getJwtSecret(), {
    subject: user.id,
    expiresIn: "8h",
    issuer: "skillmatch-ai",
    audience: "skillmatch-ai-app",
  });
}

export function readAccessToken(token: string): AuthenticatedUser {
  let payload: string | JwtPayload;
  try {
    payload = jwt.verify(token, getJwtSecret(), {
      issuer: "skillmatch-ai",
      audience: "skillmatch-ai-app",
    });
  } catch {
    throw new HttpError(401, "INVALID_TOKEN", "Your session is invalid or expired. Please sign in again.");
  }

  if (
    typeof payload === "string" ||
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    !["candidate", "employer", "admin"].includes(String(payload.role))
  ) {
    throw new HttpError(401, "INVALID_TOKEN", "Your session is invalid or expired. Please sign in again.");
  }

  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role as AppRole,
  };
}

export function optionalAuthentication(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authorization = req.header("authorization");
  if (!authorization) {
    next();
    return;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    next(new HttpError(401, "INVALID_TOKEN", "Use a valid bearer token to sign in."));
    return;
  }

  try {
    req.authUser = readAccessToken(match[1]);
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuthentication(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.authUser) {
    next(new HttpError(401, "UNAUTHORIZED", "Sign in to continue."));
    return;
  }
  next();
}

export function requireRole(...roles: AppRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      next(new HttpError(401, "UNAUTHORIZED", "Sign in to continue."));
      return;
    }
    if (!roles.includes(req.authUser.role)) {
      next(new HttpError(403, "FORBIDDEN", "Your account does not have permission to do that."));
      return;
    }
    next();
  };
}
