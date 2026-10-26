import { GarmentThumb } from "@/components/garment-thumb";
import { LedDot } from "@/components/led-dot";
import type { ClosetItem } from "@/lib/queries/closet";
import { cn } from "@/lib/utils";

export type OutfitPiece = { item: ClosetItem; meta?: string };

/** An outfit as a list of pieces (Today, Plan). Swap buttons come after MVP. */
export function OutfitCard({
  title,
  subtitle,
  pieces,
  lit = false,
  className,
}: {
  title: string;
  subtitle?: string;
  pieces: OutfitPiece[];
  /** The pieces' hangers glow purple */
  lit?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-3xl bg-card p-6 shadow-sm", className)}>
      <div className="flex flex-col gap-1">
        <h2 className="text-[26px] font-semibold">{title}</h2>
        {subtitle && <span className="text-sm text-muted-foreground">{subtitle}</span>}
      </div>
      <ul className="flex flex-col gap-2.5">
        {pieces.map(({ item, meta }) => {
          const mystery = item.name === null && item.category === null;
          return (
            <li key={item.hangerNumber} className="flex items-center gap-3.5 rounded-lg border border-line p-2">
              <span
                className={cn(
                  "relative flex size-15 shrink-0 items-center justify-center rounded-md",
                  mystery ? "border-2 border-dashed border-heat-2 bg-plum-soft" : "bg-lilac",
                )}
              >
                {mystery ? (
                  <span aria-hidden className="font-heading text-2xl font-bold text-plum">
                    ?
                  </span>
                ) : (
                  <GarmentThumb garment={item} hangerNumber={item.hangerNumber} sizes="60px" />
                )}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{item.name ?? `Hanger ${item.hangerNumber}`}</span>
                <span className="text-[13px] text-muted-foreground">
                  {meta ?? (mystery ? "Mystery pick · no photo yet" : `Hanger ${item.hangerNumber}`)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {lit && (
        <LedDot
          color="purple"
          label="These hangers glow purple when you open the closet."
          className="text-[13px] text-muted-strong"
        />
      )}
    </section>
  );
}
