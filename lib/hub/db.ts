import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { WEAR_PROFILES, type WearProfile, type WearProfileName } from "@/lib/wear-engine";

/** The service-role client: hub code runs with no signed-in user and scopes every query to one closet */
export type Db = SupabaseClient<Database>;

export type HubCloset = {
  id: string;
  timeZone: string;
  profileName: WearProfileName;
  profile: WearProfile;
  lastSweptAt: Date | null;
};

export async function loadCloset(db: Db, closetId: string): Promise<HubCloset> {
  const { data, error } = await db
    .from("closets")
    .select("id, timezone, wear_profile, last_swept_at")
    .eq("id", closetId)
    .single();
  if (error) throw error;
  const profileName = data.wear_profile as WearProfileName;
  return {
    id: data.id,
    timeZone: data.timezone,
    profileName,
    profile: WEAR_PROFILES[profileName],
    lastSweptAt: data.last_swept_at ? new Date(data.last_swept_at) : null,
  };
}

/** Postgres unique_violation: a duplicate seq, or a wear the sweep already wrote */
export function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

/** Unwraps a supabase-js result, throwing its error */
export function check<R extends { data: unknown; error: unknown }>(result: R): Extract<R, { error: null }>["data"] {
  if (result.error !== null) throw result.error;
  return result.data;
}
