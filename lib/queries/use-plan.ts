import type { SupabaseClient } from "@supabase/supabase-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { generatePlan, lightPlanDay } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { toWeekPlan, type WeekPlan } from "./plan";

export const planKeys = { week: (weekStart: string) => ["plan", weekStart] as const };

async function readPlan(supabase: SupabaseClient<Database>, weekStart: string): Promise<WeekPlan | null> {
  const { data, error } = await supabase
    .from("plans")
    .select("id, week_start, forecast, plan_items(day, slot, reason, garments(name, category, color, photo_path), hangers(number))")
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error) throw error;
  return data ? toWeekPlan(data) : null;
}

/** The week's plan under RLS. A week without one gets planned on first visit (POST /api/plans/generate). */
export function usePlan(weekStart: string | null) {
  return useQuery({
    queryKey: planKeys.week(weekStart ?? ""),
    enabled: weekStart !== null,
    queryFn: async () => {
      const supabase = createClient();
      const plan = await readPlan(supabase, weekStart!);
      if (plan) return plan;
      await generatePlan({ week_start: weekStart! });
      return readPlan(supabase, weekStart!);
    },
  });
}

/** Plans the week again, keeping nothing from the old plan */
export function useReplan(weekStart: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => generatePlan({ week_start: weekStart!, replace: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: planKeys.week(weekStart ?? "") }),
  });
}

/** "Light up tomorrow": that day's hangers glow purple */
export function useLightPlanDay() {
  return useMutation({ mutationFn: ({ planId, day }: { planId: string; day: string }) => lightPlanDay(planId, day) });
}
