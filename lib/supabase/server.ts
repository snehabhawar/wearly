import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";
import type { Database } from "./types";

/** The part of Next's cookies() store this client needs. lib/ stays free of Next imports, so callers pass it in. */
export type CookieStore = {
  getAll(): { name: string; value: string }[];
  set(name: string, value: string, options?: CookieOptions): unknown;
};

/**
 * Supabase client for /api/* route handlers: acts as the user who sent the request, still under RLS.
 * Create one per request: `createServerSupabase(await cookies())`.
 */
export function createServerSupabase(cookieStore: CookieStore) {
  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookies) => {
        try {
          for (const { name, value, options } of cookies) cookieStore.set(name, value, options);
        } catch {
          // Server components can't set cookies; the proxy refreshes the session instead (F4)
        }
      },
    },
  });
}
