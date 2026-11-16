"use client";

import { ChevronLeft, Heart, LoaderCircle, Sparkles, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { GarmentThumb, type GarmentLook } from "@/components/garment-thumb";
import { Button } from "@/components/ui/button";
import type { GarmentCategory } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { looksFor, type TryOnLook } from "@/lib/demo/tryon";
import { shrinkPhoto } from "@/lib/photos/shrink";
import type { ClosetItem } from "@/lib/queries/closet";
import type { ItemDetail } from "@/lib/queries/item";
import { useCloset } from "@/lib/queries/use-closet";
import { useCurrentCloset } from "@/lib/queries/use-current-closet";
import { useItem } from "@/lib/queries/use-item";
import { useSwipeDecision } from "@/lib/queries/use-swipe-deck";
import { useModelPhoto, useStartTryOn, useTryOn } from "@/lib/queries/use-tryon";
import { outfitKey, suggestPairings } from "@/lib/tryon/outfit";
import { cn } from "@/lib/utils";

const COUNT_WORD = ["", "One way", "Two ways", "Three ways", "Four ways"];

const SLOT_LABEL: Record<GarmentCategory, string> = {
  top: "A top",
  bottom: "Bottoms",
  outer: "A layer",
  one_piece: "A dress",
};

type Back = { href: string; label: string };

/**
 * /style/[garmentId]: ways to wear a garment. Hand-picked looks show their pre-generated
 * try-on (lib/demo/tryon.ts); "Your mix" pairs it with pieces from the closet and dresses
 * the model live with FASHN (lib/tryon). Keep starts the wear challenge.
 */
export function StyleScreen({ garmentId, back }: { garmentId: string; back: Back }) {
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

function StyleBody({ item, back }: { item: ItemDetail; back: Back }) {
  const looks = looksFor(item.garmentId);
  const closet = useCloset();
  const ownModel = Boolean(useCurrentCloset().data?.model_photo_path);
  const canMix = item.photoPath !== null && item.category !== null;
  const name = item.name ? `the ${item.name.toLowerCase()}` : `the piece on hanger ${item.hanger?.number ?? ""}`.trim();

  const items = closet.data?.items ?? [];
  const slots = item.category
    ? suggestPairings({ garmentId: item.garmentId, category: item.category }, items, looks.flatMap((l) => l.with))
    : [];
  // Start the mix from the first hand-picked look, else from the top suggestion for the first slot
  const [mix, setMix] = useState<Partial<Record<GarmentCategory, string | null>>>({});
  const picked = (slot: GarmentCategory, options: { garmentId: string }[]) => {
    if (slot in mix) return mix[slot] ?? null;
    const fromLook = looks[0]?.with.find((id) => options.some((o) => o.garmentId === id));
    if (fromLook) return fromLook;
    return slot === slots[0]?.slot ? (options[0]?.garmentId ?? null) : null;
  };
  const mixIds = slots.map((s) => picked(s.slot, s.options)).filter((id): id is string => id !== null);

  const [active, setActive] = useState(0);
  const choices = looks.length + (canMix ? 1 : 0);

  if (choices === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-[28px] font-semibold md:text-[40px]">Style it</h1>
        <p className="text-[15px] leading-relaxed text-muted-strong">
          We don&apos;t have looks for {name} yet. Add a photo and its type, and Wearly can dress you up in it.
        </p>
        <Button
          variant="outline"
          className="h-11 self-start rounded-lg px-4.5 font-semibold"
          render={<Link href={`/closet/${item.garmentId}`} />}
          nativeButton={false}
        >
          Add a photo
        </Button>
      </div>
    );
  }

  const index = Math.min(active, choices - 1);
  const look: TryOnLook | null = index < looks.length ? looks[index] : null;
  const outfit = look ? look.with : mixIds;
  const pieces = outfit.map((id) => items.find((c) => c.garmentId === id) ?? null);
  // Hand-picked looks have a pre-made image of the demo model; with your own photo they're made live
  const live = look === null || ownModel;

  return (
    <>
      <div className="flex flex-col gap-0.5">
        <h1 className="text-[28px] font-semibold md:text-[40px]">Style it</h1>
        <span className="text-sm text-muted-strong">
          {looks.length > 0 ? `${COUNT_WORD[looks.length]} to wear ${name}` : `Pair ${name} with pieces from your closet`}
        </span>
      </div>

      <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_300px] md:items-start md:gap-6">
        {live ? (
          <LivePicture
            key={outfitKey([item.garmentId, ...outfit])}
            item={item}
            outfit={outfit}
            pieces={pieces}
            ready={canMix && pieces.every((p) => p?.photoPath)}
          />
        ) : (
          <StaticPicture key={look!.image} look={look!} item={item} pieces={pieces} />
        )}

        <div className="flex flex-col gap-3.5">
          <div
            role="group"
            aria-label="Looks"
            className={cn("grid gap-2 md:grid-cols-1", choices >= 4 ? "grid-cols-4" : choices === 3 ? "grid-cols-3" : "grid-cols-2")}
          >
            {looks.map((l, i) => (
              <LookButton key={l.id} on={i === index} title={l.title} sub={l.sub} onClick={() => setActive(i)} />
            ))}
            {canMix && (
              <LookButton on={look === null} title="Your mix" sub="pick pieces" onClick={() => setActive(looks.length)} />
            )}
          </div>

          {look ? (
            <p className="text-[13px] leading-snug text-muted-strong">{look.note}</p>
          ) : (
            <MixPicker
              slots={slots}
              picked={picked}
              onPick={(slot, id) => setMix((m) => ({ ...m, [slot]: id }))}
              loading={closet.isPending}
            />
          )}

          <ModelChoice own={ownModel} />
          {item.status === "active" && <KeepAction item={item} back={back} />}
        </div>
      </div>
    </>
  );
}

function LookButton({ on, title, sub, onClick }: { on: boolean; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[14px] border px-1.5 py-2 md:items-start md:px-4",
        on ? "border-plum bg-plum text-primary-foreground" : "border-line bg-card text-ink hover:border-line-strong",
      )}
    >
      <span className="text-[13px] font-bold">{title}</span>
      <span className={cn("text-center text-[11px] md:text-left", on ? "text-primary-foreground/85" : "text-muted-strong")}>{sub}</span>
    </button>
  );
}

/** One row per slot: "None" or one of the suggested pieces */
function MixPicker({
  slots,
  picked,
  onPick,
  loading,
}: {
  slots: { slot: GarmentCategory; options: (ClosetItem & { garmentId: string })[] }[];
  picked: (slot: GarmentCategory, options: { garmentId: string }[]) => string | null;
  onPick: (slot: GarmentCategory, id: string | null) => void;
  loading: boolean;
}) {
  if (loading) return <div aria-busy="true" className="h-40 animate-pulse rounded-2xl bg-heat-0" />;
  return (
    <div className="flex flex-col gap-3">
      {slots.map(({ slot, options }) => {
        const current = picked(slot, options);
        return (
          <div key={slot} role="radiogroup" aria-label={SLOT_LABEL[slot]} className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold tracking-wide text-muted-foreground uppercase">{SLOT_LABEL[slot]}</span>
            {options.length === 0 ? (
              <span className="text-[13px] text-muted-strong">Nothing with a photo yet.</span>
            ) : (
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                <button
                  type="button"
                  role="radio"
                  aria-checked={current === null}
                  onClick={() => onPick(slot, null)}
                  className={cn(
                    "flex size-16 shrink-0 items-center justify-center rounded-xl border text-[12px] font-semibold",
                    current === null ? "border-plum bg-plum-soft text-plum" : "border-line bg-card text-muted-strong",
                  )}
                >
                  None
                </button>
                {options.map((o) => (
                  <button
                    key={o.garmentId}
                    type="button"
                    role="radio"
                    aria-checked={current === o.garmentId}
                    aria-label={o.name ?? `Hanger ${o.hangerNumber}`}
                    title={o.name ?? undefined}
                    onClick={() => onPick(slot, o.garmentId)}
                    className={cn(
                      "flex size-16 shrink-0 items-center justify-center rounded-xl border bg-card p-1",
                      current === o.garmentId ? "border-2 border-plum" : "border-line",
                    )}
                  >
                    <GarmentThumb garment={o} hangerNumber={o.hangerNumber} sizes="64px" className="size-full" />
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <p className="text-[12px] leading-snug text-muted-foreground">
        Each piece is one try-on step, about 15 seconds. Outfits you&apos;ve made before open right away.
      </p>
    </div>
  );
}

/** A hand-picked look's pre-made try-on image, or an outfit board until that image exists */
function StaticPicture({ look, item, pieces }: { look: TryOnLook; item: ItemDetail; pieces: (ClosetItem | null)[] }) {
  const [imageFailed, setImageFailed] = useState(false);
  const label = `${item.name ?? "this piece"} ${look.sub.replace(/^\+\s*/, "with ")}`;
  return (
    <Frame badge={imageFailed ? "Outfit preview" : "Try-on"}>
      {!imageFailed ? (
        <Image
          src={look.image}
          alt={`Try-on: ${label}`}
          fill
          sizes="(min-width: 768px) 420px, 100vw"
          className="object-contain"
          onError={() => setImageFailed(true)}
          preload
        />
      ) : (
        <Board item={item} pieces={pieces} label={`Outfit: ${label}`} />
      )}
    </Frame>
  );
}

/** An outfit dressed live: the board of its pieces until the try-on image is ready */
function LivePicture({
  item,
  outfit,
  pieces,
  ready,
}: {
  item: ItemDetail;
  outfit: string[];
  pieces: (ClosetItem | null)[];
  ready: boolean;
}) {
  const start = useStartTryOn();
  const job = useTryOn(start.data?.job_id ?? null);
  const current = job.data ?? start.data;
  const done = current?.status === "done" && current.image_url;
  const running = start.isPending || current?.status === "running" || current?.status === "queued";
  const failed = current?.status === "failed" || job.isError;
  const garmentIds = [item.garmentId, ...outfit];

  const startError =
    start.error instanceof ApiError && start.error.code === "rate_limited"
      ? "That's all the new try-ons for today. Outfits you've made already still open."
      : start.error
        ? "We couldn't start the try-on just now. Try again in a moment."
        : null;

  return (
    <Frame badge={done ? "Try-on" : "Outfit preview"}>
      {done ? (
        // Signed storage URL behind an app route that needs the sign-in cookie: no image optimizer
        <Image
          src={current.image_url!}
          alt={`Try-on: ${item.name ?? "this piece"}${outfit.length ? ` with ${outfit.length} more` : ""}`}
          fill
          unoptimized
          sizes="(min-width: 768px) 420px, 100vw"
          className="object-contain"
        />
      ) : (
        <>
          <Board item={item} pieces={pieces} label={`Outfit: ${item.name ?? "this piece"} and ${outfit.length} more`} />
          <div className="absolute inset-x-3.5 bottom-3.5 flex flex-col gap-2 rounded-2xl bg-card/95 p-3 shadow-sm">
            {running ? (
              <p role="status" className="flex items-center gap-2 text-[13px] font-semibold text-plum">
                <LoaderCircle aria-hidden className="size-4 animate-spin" />
                Dressing the model
                {current ? ` · piece ${current.step} of ${current.steps}` : "…"}
              </p>
            ) : (
              <>
                {(failed || startError) && (
                  <p role="alert" className="text-[13px] text-amber-ink">
                    {startError ?? current?.error ?? "The try-on didn't work this time. Try again."}
                  </p>
                )}
                <Button
                  onClick={() => start.mutate(garmentIds)}
                  disabled={!ready}
                  className="h-11 gap-2 rounded-xl font-semibold"
                >
                  <Sparkles aria-hidden className="size-4" />
                  {failed ? "Try again" : "Try it on"}
                </Button>
                {!ready && (
                  <span className="text-[12px] text-muted-strong">Every piece needs a photo first.</span>
                )}
              </>
            )}
          </div>
        </>
      )}
    </Frame>
  );
}

function Frame({ badge, children }: { badge: string; children: React.ReactNode }) {
  return (
    <div className="relative flex h-95 items-center justify-center overflow-hidden rounded-3xl bg-dawn md:h-130">
      {children}
      <span className="absolute top-3.5 left-3.5 flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1.5 text-xs font-semibold text-plum">
        <Sparkles aria-hidden className="size-3.5" />
        {badge}
      </span>
    </div>
  );
}

/** The garment large, with the pieces it's paired with stacked beside it */
function Board({ item, pieces, label }: { item: ItemDetail; pieces: (ClosetItem | null)[]; label: string }) {
  return (
    <div role="img" aria-label={label} className="flex items-center gap-2 px-4 pb-16">
      <Piece garment={item} hangerNumber={item.hanger?.number ?? null} size={pieces.length > 0 ? "large" : "solo"} />
      {pieces.length > 0 && (
        <div className="flex flex-col items-center gap-1">
          {pieces.map((p, i) => (
            <Piece
              key={p?.garmentId ?? i}
              garment={p}
              hangerNumber={p?.hangerNumber ?? null}
              size={pieces.length > 1 ? "small" : "medium"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Outfit board sizes: the garment alone or being styled, a single paired piece, or one of two stacked */
const PIECE = {
  solo: { box: "size-56 md:size-72", sizes: "288px" },
  large: { box: "size-40 md:size-60", sizes: "240px" },
  medium: { box: "size-32 md:size-48", sizes: "192px" },
  small: { box: "size-26 md:size-40", sizes: "160px" },
} as const;

function Piece({ garment, hangerNumber, size }: { garment: GarmentLook | null; hangerNumber: number | null; size: keyof typeof PIECE }) {
  return (
    <div className={cn("relative flex shrink-0 items-center justify-center", PIECE[size].box)}>
      <GarmentThumb garment={garment} hangerNumber={hangerNumber} sizes={PIECE[size].sizes} className="size-full" />
    </div>
  );
}

/** Who gets dressed: the demo model, or a full-body photo of the user */
function ModelChoice({ own }: { own: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const { upload, clear } = useModelPhoto();
  const [unreadable, setUnreadable] = useState(false);
  const busy = upload.isPending || clear.isPending;

  async function onPick(file: File | undefined) {
    if (!file) return;
    setUnreadable(false);
    try {
      upload.mutate(await shrinkPhoto(file));
    } catch {
      setUnreadable(true);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-card px-3.5 py-3">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div className="flex items-center gap-2 text-[13px]">
        <UserRound aria-hidden className="size-4 shrink-0 text-plum" />
        <span className="flex-1 text-muted-strong">
          {busy ? "Saving…" : own ? "Try-ons use your photo" : "Try-ons use the demo model"}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="min-h-9 font-semibold text-plum disabled:opacity-50"
        >
          {own ? "Change" : "Use my photo"}
        </button>
        {own && (
          <button
            type="button"
            disabled={busy}
            onClick={() => clear.mutate()}
            className="min-h-9 font-semibold text-muted-strong disabled:opacity-50"
          >
            Demo model
          </button>
        )}
      </div>
      {!own && !busy && (
        <span className="text-[12px] text-muted-foreground">A full-body photo, standing, in fitted clothes, works best.</span>
      )}
      {(unreadable || upload.isError || clear.isError) && (
        <p role="alert" className="text-[12px] text-amber-ink">
          {unreadable ? "We couldn't read that photo. Try another one." : "That didn't save. Try again in a moment."}
        </p>
      )}
    </div>
  );
}

/** Keep: same decision as the deck's Keep (30-day wear challenge, hanger light off) */
function KeepAction({ item, back }: { item: ItemDetail; back: Back }) {
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
