---
name: SkillMatch Supabase choice
description: Database choice and key-handling constraint for SkillMatch AI.
---

SkillMatch AI uses the user's existing Supabase PostgreSQL project as its authoritative database. Keep any Supabase secret key server-only; do not substitute Replit PostgreSQL or expose privileged access to the browser.

**Why:** the user explicitly selected their existing Supabase project and asked not to switch databases.

**How to apply:** database migrations, API queries, and production setup for this app must target Supabase. Browser code may use only publishable values.
