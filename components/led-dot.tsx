import type { Light } from "@/lib/api";
import { cn } from "@/lib/utils";

const DOT: Record<Exclude<Light["color"], "off">, string> = {
  // API "purple": the blue LED, steady, with a soft ring
  purple: "bg-led-blue shadow-[0_0_0_4px_color-mix(in_oklab,var(--led-blue)_22%,transparent)]",
  // API "amber": the yellow LED, slow breathing
  amber:
    "bg-led-yellow shadow-[0_0_0_3px_color-mix(in_oklab,var(--led-yellow)_30%,transparent)] animate-led-breathe",
  // Two quick blinks
  white: "border border-line-strong bg-white animate-led-blink2",
};

/**
 * A hanger's light, drawn the way it looks in the closet. Never use it without
 * text nearby: pass `label`, or put a sentence next to it (docs/frontend.md).
 * Motion stops for people who prefer reduced motion; the ring stays.
 */
export function LedDot({
  color,
  label,
  className,
}: {
  color: Light["color"];
  label?: React.ReactNode;
  className?: string;
}) {
  if (color === "off") return label ? <span className={className}>{label}</span> : null;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full motion-reduce:animate-none", DOT[color])} />
      {label}
    </span>
  );
}
