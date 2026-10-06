import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serviceUnavailable } from "./errors";

let adminClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SECRET_KEY"];

  if (!url || !key) {
    throw serviceUnavailable(
      "Database access is not configured. Add the server-only Supabase URL and secret key to the project environment.",
    );
  }

  if (!adminClient) {
    adminClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}
