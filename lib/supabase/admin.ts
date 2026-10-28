import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";
import type { Database } from "./types";

/**
 * Service-role client: bypasses RLS. Only for work with no signed-in user behind it
 * (hub ingest, /api/sim, the sweep). Scope every query to the right closet in code.
 * The "server-only" import fails the build if a client component ever imports this file.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env.local and fill it in.");
  return createClient<Database>(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
