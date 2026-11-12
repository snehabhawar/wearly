"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useCurrentCloset } from "@/lib/queries/use-current-closet";
import { closetKeys } from "@/lib/queries/use-closet";
import { createClient } from "@/lib/supabase/client";

/** Tables the app listens to (docs/backend.md, Realtime) */
const TABLES = ["hangers", "absences", "wears", "commands"] as const;
/** One burst of hanger events (or a seed run) becomes one refetch */
const DEBOUNCE_MS = 300;

/**
 * One Realtime subscription per closet: any change to its hangers, absences, wears or
 * commands refetches the closet, so the grid updates live when a garment is lifted.
 */
export function ClosetRealtime() {
  const queryClient = useQueryClient();
  const closetId = useCurrentCloset().data?.id;

  useEffect(() => {
    if (!closetId) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refetch = () => {
      clearTimeout(timer);
      timer = setTimeout(() => queryClient.invalidateQueries({ queryKey: closetKeys.all }), DEBOUNCE_MS);
    };

    const channel = supabase.channel(`closet:${closetId}`);
    for (const table of TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `closet_id=eq.${closetId}` }, refetch);
    }
    channel.subscribe();

    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [closetId, queryClient]);

  return null;
}
