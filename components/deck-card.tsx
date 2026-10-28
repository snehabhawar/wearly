import { GarmentThumb } from "@/components/garment-thumb";
import { LedDot } from "@/components/led-dot";
import type { SwipeCard } from "@/lib/api";
import { formatSince } from "@/lib/format";
import { cn } from "@/lib/utils";

/** How a card names its garment in copy: "the camel wool coat", or "hanger 22" without a name */
export function cardSubject(card: SwipeCard): string {
  return card.name ? `the ${card.name.toLowerCase()}` : `hanger ${card.hanger_number ?? "?"}`;
}

/**
 * One garment in the Keep-or-let-go deck: what it looks like, how long it has
 * waited, and the amber light on its hanger.
 */
export function DeckCard({
  card,
  today,
  className,
}: {
  card: SwipeCard;
  /** YYYY-MM-DD in the closet's timezone, for "waiting since". Null (before hydration): always name the year */
  today: string | null;
  className?: string;
}) {
  const known = card.name !== null || card.category !== null;
  const hanger = card.hanger_number;

  return (
    <article
      aria-label={card.name ?? `Hanger ${hanger}`}
      className={cn("flex flex-col overflow-hidden rounded-[26px] bg-card shadow-lg", className)}
    >
      <div className="relative flex h-62.5 shrink-0 items-center justify-center bg-dawn">
        {known ? (
          <GarmentThumb
            garment={{ name: card.name, category: card.category, color: null, photoPath: card.photo_path }}
            hangerNumber={hanger}
            sizes="400px"
            className="size-42.5"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <span className="font-heading text-[56px] leading-none font-bold text-plum">{hanger}</span>
            <span className="text-[13px] text-muted-strong">No photo yet. Wearly knows it by its hanger number.</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 px-4.5 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-2xl font-semibold">{card.name ?? `Hanger ${hanger}`}</h2>
          {hanger !== null && (
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">Hanger {hanger}</span>
          )}
        </div>
        <dl className="grid grid-cols-3 gap-2">
          <Stat label="Waiting since" value={formatSince(card.waiting_since, today ?? "")} />
          <Stat label="Worn in 90 days" value={card.wears_90d} />
          <Stat label="Put back unworn" value={`${card.browsed_count}×`} />
        </dl>
        {hanger !== null && (
          <LedDot
            color="amber"
            label={`Hanger ${hanger} is breathing amber. Grab it and decide.`}
            className="text-[13px] font-medium text-amber-ink"
          />
        )}
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-[15px] font-bold">{value}</dd>
    </div>
  );
}
