# SkillMatch AI

Skill-first job matching for candidates and employers.

> Find the right job based on your skills — not just your job title.

SkillMatch AI is a full-stack React, TypeScript, Express, and Supabase application. Its match score is calculated on the server from job requirements and candidate profile data. Gemini is used only for optional, evidence-based match explanations; it cannot change the score.

## Product areas

- **Candidates:** profile and skill management, job search and filters, deterministic job scores, saved jobs, matches, skill-gap recommendations, and candidate dashboard.
- **Employers:** create, edit, archive, and delete listings; employer dashboard.
- **Admins:** review all listings and archive or remove them. Public registration does not create admin accounts.
- **Public:** product landing page and active job search.

## Workspace structure

- `artifacts/skillmatch-ai` — React/Vite web app.
- `artifacts/api-server` — Express API, database migrations, and demo seed.
- `lib/api-spec/openapi.yaml` — API contract used to generate the typed client and Zod schemas.
- `artifacts/api-server/database/migrations` — ordered Supabase SQL migrations.
- `artifacts/api-server/database/seed.sql` — example skills and job listings.

## Database setup

The app uses the existing Supabase project at `https://mcrkavvinthyinosdepa.supabase.co`. It does not use Replit's built-in PostgreSQL database.

1. Open the Supabase SQL editor for the project.
2. Run each file in `artifacts/api-server/database/migrations` in numeric order, from `001` to `010`.
3. Run `artifacts/api-server/database/seed.sql` for the example skill catalog and listings.
4. Add the Supabase **secret** key as `SUPABASE_SECRET_KEY` in Replit Secrets (or in the server host's secret manager). The publishable key is not a substitute: the API requires server-only database access, and browser roles have no direct table policies.

The server needs `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. If they are missing, database-backed API requests return an explicit configuration error; the API does not silently use another database or substitute mock records. The provided publishable URL/key are listed in `artifacts/skillmatch-ai/.env.example` and are safe for browser use, but all current app data requests go through Express.

To make an existing account an admin, first register it normally, then update its role directly in Supabase:

```sql
UPDATE public.users
SET role = 'admin'
WHERE email = lower('the-account-email@example.com');
```

## Environment variables

Copy the relevant `.env.example` file for local reference. Do not commit actual `.env` files. In Replit, use **Secrets** for private values; use the hosting provider's secret manager for production.

### API server

| Variable | Required | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | Existing Supabase project URL. |
| `SUPABASE_SECRET_KEY` | Yes | Server-only Supabase key; never expose it to the browser. |
| `JWT_SECRET` | Yes for standalone hosting | Signs the app's 8-hour bearer tokens. The Replit workspace currently has `SESSION_SECRET`, which the API uses as a fallback when `JWT_SECRET` is absent. |
| `CLIENT_URL` | Yes in production | Allowed frontend origin(s), comma-separated. |
| `GEMINI_API_KEY` | For AI explanations | Private Gemini API key. Without it, the API returns an explicit not-configured response. |
| `GEMINI_MODEL` | No | Defaults to `gemini-2.5-flash`. |
| `PORT` | Host-managed | API listening port; Render supplies this automatically. |

### Web app

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | Only for a separate API host | API origin only, e.g. `https://your-api.onrender.com` (do not append `/api`). Leave unset for same-origin `/api` requests. |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Public project URL retained for browser-safe Supabase configuration. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | No | Public/publishable key only; never place a secret key here. |

## Local development

Copy `artifacts/api-server/.env.example` to `artifacts/api-server/.env` and `artifacts/skillmatch-ai/.env.example` to `artifacts/skillmatch-ai/.env`, then fill in the local server values. The API package does not automatically load a `.env` file; export its values in the shell before starting the API. The web app's Vite process reads its own `.env` file. The API serves routes below `/api`.

```bash
# Terminal 1: API server
set -a; source artifacts/api-server/.env; set +a
PORT=3001 CLIENT_URL=http://localhost:5173 pnpm --filter @workspace/api-server run dev

# Terminal 2: web app
PORT=5173 BASE_PATH=/ VITE_API_URL=http://localhost:3001 pnpm --filter @workspace/skillmatch-ai run dev
```

In Replit, the configured `artifacts/api-server: API Server` and `artifacts/skillmatch-ai: web` workflows start each service with the workspace's proxy-aware settings.

## API

The complete request and response contract is in `lib/api-spec/openapi.yaml`. Main route groups:

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET/PUT /api/profile`, `GET /api/skills`, and candidate skill create/update/delete routes under `/api/profile/skills`
- `GET/POST /api/jobs`, job detail/update/delete/archive, and save/unsave routes under `/api/jobs`
- `GET /api/matches`, `GET /api/matches/:jobId`, `GET /api/saved-jobs`, and `/api/skill-gaps`
- `GET /api/dashboard/candidate` and `/api/dashboard/employer`
- `POST /api/ai/match-explanation`
- `GET /api/healthz`

The API uses bcrypt password hashes, short-lived signed bearer tokens, role checks, Zod validation, rate limits on authentication and AI requests, Helmet security headers, origin-restricted CORS, and Supabase row-level security. Registration allows candidate and employer roles only.

## Matching rules

Every candidate match is computed by the API from the current profile and job listing:

- Required skills: **70%**
- Preferred skills: **20%**
- Experience range: **10%**

The score is rounded to an integer from 0 to 100. Missing optional criteria are treated as satisfied so that a job with no preferred skills or no experience requirement does not lose score. The Gemini endpoint receives the calculated breakdown only to explain it; its output is schema-validated and never used to adjust the score.

## Deployment

### API on Render

Use the included `render.yaml` Blueprint or configure a Node web service with:

- Build: `pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build`
- Start: `pnpm --filter @workspace/api-server run start`
- Health check: `/api/healthz`

Set `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `JWT_SECRET`, `CLIENT_URL`, and (when enabled) `GEMINI_API_KEY` in Render's secret environment. `CLIENT_URL` must exactly match the deployed Vercel origin.

### Web app on Vercel

The included `vercel.json` builds the Vite app and rewrites client-side routes to the SPA entry point. Configure `VITE_API_URL` to the Render API origin (without `/api`) before the Vercel build. Add the public Supabase values only if the frontend needs browser-side public configuration.

After changing the OpenAPI contract, regenerate and type-check the clients with:

```bash
pnpm --filter @workspace/api-spec run codegen
```
# skillmatch-ai
