import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "./types";

export type Closet = Tables<"closets">;

/**
 * The signed-in user's closet, or null when signed out or before onboarding.
 * Works with the browser or the server client: RLS only returns closets the user owns,
 * and the MVP allows one per user (unique owner_id).
 */
export async function getCurrentCloset(supabase: SupabaseClient<Database>): Promise<Closet | null> {
  const { data, error } = await supabase.from("closets").select("*").maybeSingle();
  if (error) throw error;
  return data;
}
