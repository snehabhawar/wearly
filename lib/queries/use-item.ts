import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getCurrentCloset } from "@/lib/supabase/closet";
import { ACTIVITY_LIMIT, toItemDetail, type ItemDetail } from "./item";
import { closetKeys } from "./use-closet";

/** Under the closet key, so the Realtime subscription refreshes it with the grid */
export const itemKeys = { detail: (garmentId: string) => [...closetKeys.all, "item", garmentId] as const };

/** One garment for /closet/[garmentId], read under RLS. Null when it isn't in the user's closet. */
export function useItem(garmentId: string) {
  return useQuery({
    queryKey: itemKeys.detail(garmentId),
    queryFn: async (): Promise<ItemDetail | null> => {
      const supabase = createClient();
      const [closet, garment, stats, absences] = await Promise.all([
        getCurrentCloset(supabase),
        supabase
          .from("garments")
          .select(
            "id, name, category, color, seasons, formality, photo_path, tags_source, status, hanger_assignments(hangers(number, led_color, led_pattern, on_rail, garment_on))",
          )
          .eq("id", garmentId)
          .is("hanger_assignments.ended_at", null)
          .maybeSingle(),
        supabase
          .from("garment_stats")
          .select("wears_ytd, last_worn_on, browsed_count, idle_days_in_season, cost_per_wear")
          .eq("garment_id", garmentId)
          .maybeSingle(),
        supabase
          .from("absences")
          .select("left_at, returned_at, classification")
          .eq("garment_id", garmentId)
          .order("left_at", { ascending: false })
          .limit(ACTIVITY_LIMIT),
      ]);
      for (const r of [garment, stats, absences]) if (r.error) throw r.error;
      if (!garment.data || !closet) return null;
      return toItemDetail({
        garment: garment.data,
        stats: stats.data,
        absences: absences.data ?? [],
        timeZone: closet.timezone,
      });
    },
  });
}
