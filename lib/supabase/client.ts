import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";
import type { Database } from "./types";

/**
 * Supabase client for the browser: the signed-in user's session from cookies, every read under RLS.
 * createBrowserClient returns one shared instance, so calling this in many components is cheap.
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
}
