import { cn } from "@/lib/utils";

const STARBURST =
  "23,12 15.7,13.53 19.78,19.78 13.53,15.7 12,23 10.47,15.7 4.22,19.78 8.3,13.53 1,12 8.3,10.47 4.22,4.22 10.47,8.3 12,1 13.53,8.3 19.78,4.22 15.7,10.47";

/** The starburst mark and "wearly" wordmark, in the current text color */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 font-heading font-bold text-plum", className)}>
      <svg viewBox="0 0 24 24" aria-hidden className="size-[0.9em] fill-current">
        <polygon points={STARBURST} />
      </svg>
      wearly
    </span>
  );
}
