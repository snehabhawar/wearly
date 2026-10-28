"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { SwipeDecisionRequest } from "@/lib/api";

export type LetGoRoute = Extract<SwipeDecisionRequest, { decision: "let_go" }>["route"];

const ROUTES: { route: LetGoRoute; title: string; sub: string }[] = [
  { route: "donate", title: "Donate", sub: "Pass it on to someone who'll wear it" },
  { route: "resell", title: "Resell", sub: "We draft a listing from its tags, ready to share to any app" },
  { route: "swap", title: "Swap with friends", sub: "Offer it to your swap circle first" },
];

/** Where a let-go garment goes: donate, resell or swap (docs/api.md, Swipe). */
export function LetGoSheet({
  open,
  onOpenChange,
  subject,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "the camel wool coat", for the description */
  subject: string;
  onPick: (route: LetGoRoute) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto w-full max-w-lg gap-2.5 rounded-t-[26px] px-5 pt-2 pb-7">
        <SheetHeader className="px-0 pr-10">
          <SheetTitle className="text-[22px] font-semibold">Where should it go?</SheetTitle>
          <SheetDescription>
            Its hanger keeps breathing amber until {subject} leaves the closet.
          </SheetDescription>
        </SheetHeader>
        {ROUTES.map(({ route, title, sub }) => (
          <button
            key={route}
            type="button"
            onClick={() => onPick(route)}
            className="flex min-h-11 flex-col items-start gap-0.5 rounded-2xl border border-line bg-card px-4 py-3.5 text-left transition-colors hover:bg-lilac focus-visible:outline-2"
          >
            <span className="text-[15px] font-semibold">{title}</span>
            <span className="text-[13px] text-muted-foreground">{sub}</span>
          </button>
        ))}
      </SheetContent>
    </Sheet>
  );
}
