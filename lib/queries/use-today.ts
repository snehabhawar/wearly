import { useSyncExternalStore } from "react";
import { todayIn } from "@/lib/format";

/** The closet's date, read on the client only, so a prerendered page never holds a stale "today" */
export function useToday(timeZone: string | undefined): string | null {
  return useSyncExternalStore(
    () => () => {},
    () => (timeZone ? todayIn(timeZone) : null),
    () => null,
  );
}
