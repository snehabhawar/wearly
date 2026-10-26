"use client";

import { GarmentThumb } from "@/components/garment-thumb";
import { heatLevel, isWaiting, type ClosetItem } from "@/lib/queries/closet";
import { cn } from "@/lib/utils";

const HEAT = ["bg-heat-0 border-line", "bg-heat-1", "bg-heat-2", "bg-heat-3"] as const;

/** One hanger in the closet grid: shaded by how often it's worn, selectable. */
export function HangerTile({
  item,
  selected = false,
  onSelect,
}: {
  item: ClosetItem;
  selected?: boolean;
  onSelect?: (hangerNumber: number) => void;
}) {
  const waiting = isWaiting(item);
  const known = item.name !== null || item.category !== null;
  const label = [
    `Hanger ${item.hangerNumber}`,
    item.name ?? "no photo yet",
    waiting && "waiting a while",
    item.away && "out of the closet",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={() => onSelect?.(item.hangerNumber)}
      className={cn(
        "relative flex aspect-square items-center justify-center rounded-lg border-2 border-transparent transition-shadow",
        HEAT[heatLevel(item.wears90d)],
        selected && "border-ink ring-3 ring-plum/25",
        item.away && "opacity-50",
      )}
    >
      <GarmentThumb
        garment={item}
        hangerNumber={item.hangerNumber}
        className={known ? "size-3/5" : "text-[26px]"}
      />
      {known && (
        <span className="absolute bottom-1 left-1.5 text-[11px] font-semibold text-ink">{item.hangerNumber}</span>
      )}
      {item.away && (
        <span className="absolute top-1 left-1.5 text-[10px] font-bold tracking-wide text-ink uppercase">Out</span>
      )}
      {waiting && (
        <span
          aria-hidden
          className="absolute top-1.5 right-1.5 size-2 rounded-full bg-amber shadow-[0_0_0_3px_color-mix(in_oklab,var(--amber)_30%,transparent)]"
        />
      )}
    </button>
  );
}
