"use client";

import { ChevronLeft, Heart, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { GarmentThumb, type GarmentLook } from "@/components/garment-thumb";
import { Button } from "@/components/ui/button";
import { looksFor, type TryOnLook } from "@/lib/demo/tryon";
import type { ItemDetail } from "@/lib/queries/item";
import { useCloset } from "@/lib/queries/use-closet";
import { useItem } from "@/lib/queries/use-item";
import { useSwipeDecision } from "@/lib/queries/use-swipe-deck";
import { cn } from "@/lib/utils";

const COUNT_WORD = ["", "One way", "Two ways", "Three ways"];

/**
 * /style/[garmentId]: ways to wear a garment that's been waiting, with a try-on image per
 * look (MVP: pre-generated, lib/demo/tryon.ts) and Keep, which starts the wear challenge.
 */
export function StyleScreen({ garmentId, back }: { garmentId: string; back: { href: string; label: string } }) {
  const item = useItem(garmentId);

  return (
    <div className="mx-auto flex w-full max-w-110 flex-col gap-4 px-5 pt-4 pb-12 md:max-w-3xl md:pt-8">
      <Link
        href={back.href}
        className="flex min-h-11 items-center gap-1 self-start pr-2 text-[15px] font-semibold text-plum"
      >
        <ChevronLeft aria-hidden className="size-5" />
        {back.label}
      </Link>

      {item.isPending ? (
        <div aria-busy="true" aria-label="Loading looks" className="flex flex-col gap-4">
          <div className="h-9 w-40 animate-pulse rounded-lg bg-heat-0" />
          <div className="h-95 animate-pulse rounded-3xl bg-heat-0" />
        </div>
      ) : item.isError ? (
        <p role="alert" className="text-[15px] text-muted-strong">
          We couldn&apos;t load this one just now. Your hangers are fine; it&apos;s the connection.
        </p>
      ) : !item.data ? (
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-semibold">Not in your closet</h1>
          <p className="text-[15px] text-muted-strong">This garment isn&apos;t in your closet, or it was removed.</p>
        </div>
      ) : (
        <StyleBody item={item.data} back={back} />
      )}
    </div>
  );
}

function StyleBody({ item, back }: { item: ItemDetail; back: { href: string; label: string } }) {
  const looks = looksFor(item.garmentId);
  const [active, setActive] = useState(0);
  const name = item.name ?? `the piece on hanger ${item.hanger?.number ?? ""}`.trim();

  if (looks.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-[28px] font-semibold md:text-[40px]">Style it</h1>
        <p className="text-[15px] leading-relaxed text-muted-strong">
          We don&apos;t have looks for {item.name ? `the ${item.name.toLowerCase()}` : name} yet. Once it has a photo,
          Wearly can dress you up in it.
        </p>
        <Button
          variant="outline"
          className="h-11 self-start rounded-lg px-4.5 font-semibold"
          render={<Link href={back.href} />}
          nativeButton={false}
        >
          Back to {back.label.toLowerCase()}
        </Button>
      </div>
    );
  }

  const look = looks[Math.min(active, looks.length - 1)];
  return (
    <>
      <div className="flex flex-col gap-0.5">
        <h1 className="text-[28px] font-semibold md:text-[40px]">Style it</h1>
        <span className="text-sm text-muted-strong">
          {COUNT_WORD[looks.length]} to wear {item.name ? `the ${item.name.toLowerCase()}` : name}
        </span>
      </div>

      <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_300px] md:items-start md:gap-6">
        <LookPicture key={look.image} look={look} item={item} />

        <div className="flex flex-col gap-3.5">
          <div role="group" aria-label="Looks" className="grid grid-cols-3 gap-2 md:grid-cols-1">
            {looks.map((l, i) => {
              const on = l === look;
              return (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setActive(i)}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[14px] border px-1.5 py-2 md:items-start md:px-4",
                    on ? "border-plum bg-plum text-primary-foreground" : "border-line bg-card text-ink hover:border-line-strong",
                  )}
                >
                  <span className="text-[13px] font-bold">{l.title}</span>
                  <span className={cn("text-[11px]", on ? "text-primary-foreground/85" : "text-muted-strong")}>{l.sub}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[13px] leading-snug text-muted-strong">{look.note}</p>
          {item.status === "active" && <KeepAction item={item} back={back} />}
        </div>
      </div>
    </>
  );
}

/** The try-on image, or an outfit board of the pieces' photos until that image exists */
function LookPicture({ look, item }: { look: TryOnLook; item: ItemDetail }) {
  const [imageFailed, setImageFailed] = useState(false);
  const closet = useCloset();
  const pieces = look.with.map((id) => closet.data?.items.find((c) => c.garmentId === id));

  return (
    <div className="relative flex h-95 items-center justify-center overflow-hidden rounded-3xl bg-dawn md:h-130">
      {!imageFailed ? (
        <Image
          src={look.image}
          alt={`Try-on: ${item.name ?? "this piece"} ${look.sub.replace(/^\+\s*/, "with ")}`}
          fill
          sizes="(min-width: 768px) 420px, 100vw"
          className="object-cover"
          onError={() => setImageFailed(true)}
          preload
        />
      ) : (
        <div role="img" aria-label={`Outfit: ${item.name ?? "this piece"} ${look.sub.replace(/^\+\s*/, "with ")}`} className="flex items-center gap-2 px-4">
          <Piece garment={item} hangerNumber={item.hanger?.number ?? null} size="large" />
          <div className="flex flex-col items-center gap-1">
            {pieces.map((p, i) => (
              <Piece
                key={look.with[i]}
                garment={p ?? null}
                hangerNumber={p?.hangerNumber ?? null}
                size={pieces.length > 1 ? "small" : "medium"}
              />
            ))}
          </div>
        </div>
      )}
      <span className="absolute top-3.5 left-3.5 flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1.5 text-xs font-semibold text-plum">
        <Sparkles aria-hidden className="size-3.5" />
        {imageFailed ? "Outfit preview" : "Try-on"}
      </span>
    </div>
  );
}

/** Outfit board sizes: the garment being styled, a single paired piece, or one of two stacked */
const PIECE = {
  large: { box: "size-44 md:size-64", sizes: "256px" },
  medium: { box: "size-36 md:size-52", sizes: "208px" },
  small: { box: "size-30 md:size-44", sizes: "176px" },
} as const;

function Piece({
  garment,
  hangerNumber,
  size,
}: {
  garment: GarmentLook | null;
  hangerNumber: number | null;
  size: keyof typeof PIECE;
}) {
  return (
    <div className={cn("relative flex shrink-0 items-center justify-center", PIECE[size].box)}>
      <GarmentThumb garment={garment} hangerNumber={hangerNumber} sizes={PIECE[size].sizes} className="size-full" />
    </div>
  );
}

/** Keep: same decision as the deck's Keep (30-day wear challenge, hanger light off) */
function KeepAction({ item, back }: { item: ItemDetail; back: { href: string; label: string } }) {
  const decision = useSwipeDecision();
  const subject = item.name ? `The ${item.name.toLowerCase()}` : "It";

  if (decision.isSuccess) {
    return (
      <div className="flex flex-col gap-2.5">
        <p role="status" className="rounded-[14px] bg-ink px-4 py-3 text-[13px] leading-snug text-white">
          Kept. {subject} joins next week&apos;s plan, with a 30-day wear challenge.
        </p>
        <Button
          variant="secondary"
          className="h-12 rounded-[14px] font-semibold"
          render={<Link href={back.href} />}
          nativeButton={false}
        >
          Back to {back.label.toLowerCase()}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={() => decision.mutate({ garment_id: item.garmentId, decision: "keep" })}
        disabled={decision.isPending}
        className="h-12.5 gap-2 rounded-[14px] text-[15px] font-semibold"
      >
        <Heart aria-hidden className="size-4.5" />
        {decision.isPending ? "Keeping…" : "Keep it, I'll wear it"}
      </Button>
      {decision.isError && (
        <p role="alert" className="text-[13px] text-amber-ink">
          That didn&apos;t save. Your hanger is fine; try again in a moment.
        </p>
      )}
    </div>
  );
}
