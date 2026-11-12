import { cn } from "@/lib/utils";

const TONES = {
  plain: { card: "border border-line bg-card", label: "text-muted-foreground", note: "text-muted-foreground" },
  plum: { card: "bg-plum text-primary-foreground", label: "text-plum-soft", note: "text-plum-soft" },
  peach: { card: "bg-peach-soft", label: "font-semibold text-amber-ink", note: "text-muted-strong" },
  cream: { card: "bg-cream", label: "text-muted-foreground", note: "text-muted-foreground" },
} as const;

/** A big slab number with a label, e.g. closet stats and item details */
export function StatCard({
  label,
  value,
  note,
  progress,
  tone = "plain",
  size = "lg",
  className,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  /** 0-100: draws a bar under the value (plum tone) */
  progress?: number;
  tone?: keyof typeof TONES;
  size?: "lg" | "sm";
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <div
      className={cn(
        "flex flex-col",
        size === "lg" ? "gap-2 rounded-xl px-5 py-4.5" : "gap-0.5 rounded-lg px-3.5 py-3",
        t.card,
        className,
      )}
    >
      <span className={cn(size === "lg" ? "text-[13px]" : "text-xs", t.label)}>{label}</span>
      <span className={cn("font-heading leading-none font-bold", size === "lg" ? "text-[40px]" : "text-2xl")}>
        {value}
      </span>
      {progress !== undefined && (
        <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-white/20">
          <span className="block h-full rounded-full bg-peach" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </span>
      )}
      {note && <span className={cn("text-xs", t.note)}>{note}</span>}
    </div>
  );
}
