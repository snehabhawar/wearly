"use client";

import { ExternalLink, Heart, Sparkles } from "lucide-react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useState } from "react";
import { cardSubject, DeckCard } from "@/components/deck-card";
import { LetGoSheet, type LetGoRoute } from "@/components/let-go-sheet";
import { Button } from "@/components/ui/button";
import type { SwipeCard, SwipeDecisionRequest, SwipeDecisionResponse } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { useToday } from "@/lib/queries/use-today";
import { cn } from "@/lib/utils";

const TOAST_MS = 4000;
/** How far (px, with a little momentum) a card must be dragged to count as a swipe */
const SWIPE_DISTANCE = 120;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const LET_GO_TOAST: Record<LetGoRoute, string> = {
  donate: "Marked for donation.",
  resell: "Listing drafted.",
  swap: "Offered to your swap circle.",
};

/**
 * Keep-or-let-go deck: one card at a time with Let go, Style it and Keep.
 * Drag the card, or use the buttons (the accessible path) or the arrow keys while the deck has focus.
 */
export function SwipeDeck({
  cards,
  timeZone,
  onDecide,
  onRestart,
  rehomedThisYear,
}: {
  /** The deck, top card first. Cards decided here are hidden right away, before the deck reloads. */
  cards: SwipeCard[];
  /** The closet's timezone, for "waiting since" */
  timeZone: string;
  /** Records a decision (POST /api/swipe/decisions); a resell answer carries the drafted listing */
  onDecide?: (decision: SwipeDecisionRequest) => Promise<SwipeDecisionResponse | void> | void;
  /** Offers "Start over" when the deck is done (fixture decks only: real decisions are saved) */
  onRestart?: () => void;
  /** The impact counter: garments that left the closet this year */
  rehomedThisYear?: number;
}) {
  const today = useToday(timeZone);
  const [decided, setDecided] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [kept, setKept] = useState(0);
  const [letGo, setLetGo] = useState(0);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const visible = cards.filter((c) => !decided.has(c.garment_id));
  const card = visible[0];
  const remaining = visible.length;

  function decide(decision: SwipeDecisionRequest, message: string) {
    setDecided((prev) => new Set(prev).add(decision.garment_id));
    setSheetOpen(false);
    setToast(message);
    void Promise.resolve(onDecide?.(decision))
      .then((res) => {
        const listing = res?.listing;
        if (listing) {
          setToast(
            `Listing drafted: "${listing.title}", ${formatCents(listing.price_min_cents)}–${formatCents(listing.price_max_cents)}.` +
              message.slice(LET_GO_TOAST.resell.length),
          );
        }
      })
      .catch(() => {
        // Not saved: put the card back on top
        setDecided((prev) => {
          const next = new Set(prev);
          next.delete(decision.garment_id);
          return next;
        });
        setToast("That didn't save. Your hanger is fine; try again in a moment.");
      });
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
    setDecided(new Set());
    setKept(0);
    setLetGo(0);
    setToast("");
    onRestart?.();
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-3xl font-semibold md:text-[40px]">Keep or let go</h1>
          <span className="text-[13px] text-muted-foreground">
            Waiting 6+ months, counted within each item&apos;s season
          </span>
          {rehomedThisYear !== undefined && (
            <span className="text-[13px] font-semibold text-amber-ink">
              {rehomedThisYear} {rehomedThisYear === 1 ? "piece" : "pieces"} rehomed this year
            </span>
          )}
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
            <DraggableCard
              key={card.garment_id}
              card={card}
              today={today}
              onKeep={keep}
              onLetGo={() => setSheetOpen(true)}
            />
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
          {onRestart && (
            <Button variant="outline" onClick={restart} className="h-11 rounded-lg px-4.5 font-semibold">
              Start over
            </Button>
          )}
        </section>
      )}

      <p role="status" className={cn("rounded-[14px] bg-ink px-4 py-3 text-[13px] leading-snug text-white", !toast && "sr-only")}>
        {toast}
      </p>

      {card && (
        <LetGoSheet open={sheetOpen} onOpenChange={setSheetOpen} onPick={pickRoute} />
      )}
    </div>
  );
}

/** The top card: drag right to keep (it flies off), left to open the let-go sheet (it settles back). */
function DraggableCard({
  card,
  today,
  onKeep,
  onLetGo,
}: {
  card: SwipeCard;
  today: string | null;
  onKeep: () => void;
  onLetGo: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], reduceMotion ? [0, 0] : [-10, 10]);
  const keepHint = useTransform(x, [30, SWIPE_DISTANCE], [0, 1]);
  const letGoHint = useTransform(x, [-SWIPE_DISTANCE, -30], [1, 0]);

  return (
    <motion.div
      drag="x"
      dragElastic={0.6}
      dragMomentum={false}
      style={{ x, rotate }}
      onDragEnd={(_, info) => {
        const swipe = info.offset.x + info.velocity.x * 0.2;
        if (swipe > SWIPE_DISTANCE) {
          void animate(x, 640, { duration: reduceMotion ? 0 : 0.25 }).then(onKeep);
          return;
        }
        void animate(x, 0, { type: "spring", stiffness: 500, damping: 40 });
        if (swipe < -SWIPE_DISTANCE) onLetGo();
      }}
      className="relative cursor-grab touch-pan-y active:cursor-grabbing"
    >
      <DeckCard card={card} today={today} />
      <motion.span
        aria-hidden
        style={{ opacity: keepHint }}
        className="absolute top-5 left-5 -rotate-6 rounded-lg border-2 border-plum bg-card px-3 py-1 font-heading text-xl font-bold text-plum"
      >
        Keep
      </motion.span>
      <motion.span
        aria-hidden
        style={{ opacity: letGoHint }}
        className="absolute top-5 right-5 rotate-6 rounded-lg border-2 border-amber bg-card px-3 py-1 font-heading text-xl font-bold text-amber-ink"
      >
        Let go
      </motion.span>
    </motion.div>
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
