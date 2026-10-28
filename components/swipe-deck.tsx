"use client";

import { ExternalLink, Heart, Sparkles } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { cardSubject, DeckCard } from "@/components/deck-card";
import { LetGoSheet, type LetGoRoute } from "@/components/let-go-sheet";
import { Button } from "@/components/ui/button";
import type { SwipeCard, SwipeDecisionRequest } from "@/lib/api";
import { todayIn } from "@/lib/format";
import { cn } from "@/lib/utils";

const TOAST_MS = 4000;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const LET_GO_TOAST: Record<LetGoRoute, string> = {
  donate: "Marked for donation.",
  resell: "Listing drafted.",
  swap: "Offered to your swap circle.",
};

/** The closet's date, read on the client only, so the prerendered page never holds a stale "today" */
function useToday(timeZone: string): string | null {
  return useSyncExternalStore(
    () => () => {},
    () => todayIn(timeZone),
    () => null,
  );
}

/**
 * Keep-or-let-go deck: one card at a time with Let go, Style it and Keep.
 * Buttons are the accessible path; arrow keys work while the deck has focus.
 */
export function SwipeDeck({
  cards,
  timeZone,
  onDecide,
}: {
  cards: SwipeCard[];
  /** The closet's timezone, for "waiting since" */
  timeZone: string;
  /** Records a decision (POST /api/swipe/decisions once the backend stub lands, task B3) */
  onDecide?: (decision: SwipeDecisionRequest) => void;
}) {
  const today = useToday(timeZone);
  const [index, setIndex] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [kept, setKept] = useState(0);
  const [letGo, setLetGo] = useState(0);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const card = cards[index];
  const remaining = cards.length - index;

  function decide(decision: SwipeDecisionRequest, message: string) {
    onDecide?.(decision);
    setSheetOpen(false);
    setToast(message);
    setIndex((i) => i + 1);
  }

  function keep() {
    if (!card) return;
    setKept((n) => n + 1);
    decide(
      { garment_id: card.garment_id, decision: "keep" },
      `Kept. ${capitalize(cardSubject(card))} joins next week's plan, with a 30-day wear challenge.`,
    );
  }

  function pickRoute(route: LetGoRoute) {
    if (!card) return;
    setLetGo((n) => n + 1);
    const light = card.hanger_number ? ` Hanger ${card.hanger_number} breathes amber until it leaves.` : "";
    decide({ garment_id: card.garment_id, decision: "let_go", route }, LET_GO_TOAST[route] + light);
  }

  function restart() {
    setIndex(0);
    setKept(0);
    setLetGo(0);
    setToast("");
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-3xl font-semibold md:text-[40px]">Keep or let go</h1>
          <span className="text-[13px] text-muted-foreground">
            Waiting 6+ months, counted within each item&apos;s season
          </span>
        </div>
        {card && (
          <span className="shrink-0 rounded-full bg-peach-soft px-2.5 py-1.5 text-xs font-bold text-amber-ink">
            {remaining} left
          </span>
        )}
      </div>

      {card ? (
        <section
          aria-label="Deck"
          aria-keyshortcuts="ArrowLeft ArrowRight"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === "ArrowLeft") setSheetOpen(true);
            if (e.key === "ArrowRight") keep();
          }}
          className="flex flex-col gap-4.5 rounded-[28px] outline-none focus-visible:ring-3 focus-visible:ring-plum/30"
        >
          <div className="relative pb-3.5">
            {remaining > 2 && <span aria-hidden className="absolute inset-x-4 top-3.5 bottom-0 rounded-[26px] bg-heat-1" />}
            {remaining > 1 && <span aria-hidden className="absolute inset-x-2 top-1.75 bottom-1.75 rounded-[26px] bg-plum-soft" />}
            <DeckCard key={card.garment_id} card={card} today={today} className="relative" />
          </div>

          <div className="flex items-start justify-center gap-7">
            <DeckButton label="Let go" onClick={() => setSheetOpen(true)} tone="amber">
              <ExternalLink className="size-6.5" strokeWidth={2} />
            </DeckButton>
            {/* Opens Style it once that screen exists */}
            <DeckButton label="Style it" disabled tone="lilac" small>
              <Sparkles className="size-5.5" strokeWidth={2} />
            </DeckButton>
            <DeckButton label="Keep" onClick={keep} tone="plum">
              <Heart className="size-6.5" strokeWidth={2} />
            </DeckButton>
          </div>
          <p className="hidden text-center text-xs text-muted-foreground md:block">
            Tip: with the card focused, press ← to let go or → to keep.
          </p>
        </section>
      ) : (
        <section className="flex flex-col items-center gap-3 px-5 py-16 text-center">
          <h2 className="text-[26px] font-semibold">All caught up</h2>
          <p className="max-w-sm text-[15px] leading-relaxed text-muted-strong">
            You kept {kept} and let go of {letGo}. We&apos;ll check back when something else has been waiting a
            while.
          </p>
          <Button variant="outline" onClick={restart} className="h-11 rounded-lg px-4.5 font-semibold">
            Start over
          </Button>
        </section>
      )}

      <p role="status" className={cn("rounded-[14px] bg-ink px-4 py-3 text-[13px] leading-snug text-white", !toast && "sr-only")}>
        {toast}
      </p>

      {card && (
        <LetGoSheet open={sheetOpen} onOpenChange={setSheetOpen} subject={cardSubject(card)} onPick={pickRoute} />
      )}
    </div>
  );
}

const TONES = {
  amber: { ring: "border-2 border-amber bg-card", text: "text-amber-ink" },
  lilac: { ring: "border-2 border-heat-2 bg-card", text: "text-plum" },
  plum: { ring: "bg-plum text-primary-foreground", text: "text-plum" },
} as const;

function DeckButton({
  label,
  tone,
  small = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  tone: keyof typeof TONES;
  small?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex flex-col items-center gap-1.5 rounded-xl text-xs font-semibold disabled:opacity-50",
        t.text,
        small && "mt-2",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex items-center justify-center rounded-full transition-transform group-enabled:group-hover:scale-105 group-enabled:group-active:scale-95",
          small ? "size-13" : "size-16",
          t.ring,
        )}
      >
        {children}
      </span>
      {label}
    </button>
  );
}
