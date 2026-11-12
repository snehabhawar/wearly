// Rendered inside PhotoCapture (a client component), so no "use client" entry of its own
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { GarmentCategory } from "@/lib/api";
import type { ItemDetail } from "@/lib/queries/item";
import { useUpdateGarment } from "@/lib/queries/use-garment-photo";
import { cn } from "@/lib/utils";

const CATEGORIES: { value: GarmentCategory; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottoms" },
  { value: "outer", label: "Outerwear" },
  { value: "one_piece", label: "Dress" },
];

/** After a new photo: what is it? Name and type, both optional to change. */
export function GarmentDetailsForm({ item, onDone }: { item: ItemDetail; onDone: () => void }) {
  const update = useUpdateGarment(item.garmentId);
  const [name, setName] = useState(item.name ?? "");
  const [category, setCategory] = useState<GarmentCategory | null>(item.category);
  const trimmed = name.trim();
  const changed = (trimmed !== "" && trimmed !== item.name) || (category !== null && category !== item.category);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!changed) return onDone();
        update.mutate(
          {
            ...(trimmed !== "" && trimmed !== item.name && { name: trimmed }),
            ...(category !== null && category !== item.category && { category }),
          },
          { onSuccess: onDone },
        );
      }}
      className="flex flex-col gap-3.5 rounded-2xl border border-line bg-card p-4"
    >
      <p className="text-sm font-semibold">Looks great. What is it?</p>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-muted-strong">
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Grey hoodie"
          className="h-11 rounded-lg border border-input bg-background px-3 text-base font-normal text-ink outline-none focus-visible:ring-3 focus-visible:ring-plum/30"
        />
      </label>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[13px] font-semibold text-muted-strong">Type</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-pressed={category === c.value}
              onClick={() => setCategory(c.value)}
              className={cn(
                "min-h-10 rounded-full border px-3.5 text-sm font-semibold",
                category === c.value ? "border-plum bg-plum text-primary-foreground" : "border-line bg-background text-ink",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>
      {update.isError && (
        <p role="alert" className="text-[13px] text-amber-ink">
          That didn&apos;t save. Try again in a moment.
        </p>
      )}
      <div className="flex gap-2.5">
        <Button type="submit" disabled={update.isPending} className="h-11 flex-1 rounded-lg font-semibold">
          {update.isPending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone} className="h-11 rounded-lg px-4 font-semibold">
          Not now
        </Button>
      </div>
    </form>
  );
}
