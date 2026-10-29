"use client";

import { SwipeDeck } from "@/components/swipe-deck";
import { Button } from "@/components/ui/button";
import { useCloset } from "@/lib/queries/use-closet";
import { useCurrentCloset } from "@/lib/queries/use-current-closet";
import { useSwipeDeck, useSwipeDecision } from "@/lib/queries/use-swipe-deck";

/** The Keep-or-let-go screen on live data: loading and error states around SwipeDeck */
export function SwipeScreen({ embedded = false }: { embedded?: boolean }) {
  const deck = useSwipeDeck();
  const closet = useCurrentCloset();
  const rehomed = useCloset().data?.summary.rehomedThisYear;
  const decision = useSwipeDecision();

  if (deck.isPending || closet.isPending) return <SwipeSkeleton />;
  if (deck.isError || !closet.data) {
    return (
      <div className="flex w-full flex-col items-start gap-3">
        {embedded ? (
          <h2 className="text-[26px] font-semibold">Keep or let go</h2>
        ) : (
          <h1 className="text-3xl font-semibold md:text-[40px]">Keep or let go</h1>
        )}
        <p role="alert" className="text-[15px] text-muted-strong">
          We couldn&apos;t load your deck just now. Your hangers are fine; it&apos;s the connection.
        </p>
        <Button variant="outline" onClick={() => deck.refetch()} className="h-11 rounded-lg px-4.5 font-semibold">
          Try again
        </Button>
      </div>
    );
  }
  return (
    <SwipeDeck
      cards={deck.data.cards}
      timeZone={closet.data.timezone}
      onDecide={(d) => decision.mutateAsync(d)}
      rehomedThisYear={rehomed}
      embedded={embedded}
    />
  );
}

function SwipeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your deck" className="flex w-full flex-col gap-4">
      <div className="h-9 w-56 animate-pulse rounded-lg bg-heat-0" />
      <div className="h-4 w-72 animate-pulse rounded bg-heat-0" />
      <div className="h-110 animate-pulse rounded-[26px] bg-heat-0" />
    </div>
  );
}
