import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { toClosetItems, toClosetSummary, type ClosetItem, type ClosetSummary } from "./closet";

/** Query keys shared with the Realtime subscription that invalidates them */
export const closetKeys = { all: ["closet"] as const };

export type ClosetData = { items: ClosetItem[]; summary: ClosetSummary };

/** Hangers with their current garment, garment_stats and closet_summary, read in parallel under RLS */
export async function fetchCloset(supabase: SupabaseClient<Database>): Promise<ClosetData> {
  const [hangers, stats, summary] = await Promise.all([
    supabase
      .from("hangers")
      .select(
        "number, on_rail, garment_on, led_color, hanger_assignments(garments(id, name, category, color, photo_path, status))",
      )
      .is("hanger_assignments.ended_at", null),
    supabase.from("garment_stats").select("*"),
    supabase.from("closet_summary").select("*").maybeSingle(),
  ]);
  if (hangers.error) throw hangers.error;
  if (stats.error) throw stats.error;
  if (summary.error) throw summary.error;
  return { items: toClosetItems(hangers.data, stats.data), summary: toClosetSummary(summary.data) };
}

export function useCloset() {
  return useQuery({ queryKey: closetKeys.all, queryFn: () => fetchCloset(createClient()) });
}
