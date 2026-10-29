import { useSyncExternalStore } from "react";

/** Whether a CSS media query matches, read on the client (false while prerendering) */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** The sidebar layout's breakpoint (docs/frontend.md, Layout): Tailwind's md */
export const DESKTOP_QUERY = "(min-width: 768px)";
