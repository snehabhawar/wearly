import { useQuery } from "@tanstack/react-query";
import { getCurrentCloset } from "@/lib/supabase/closet";
import { createClient } from "@/lib/supabase/client";

/** The signed-in user's closet row (id, timezone, wear profile). Rarely changes, so it never goes stale. */
export function useCurrentCloset() {
  return useQuery({
    queryKey: ["current-closet"],
    queryFn: () => getCurrentCloset(createClient()),
    staleTime: Infinity,
  });
}
