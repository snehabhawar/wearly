import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SwipeDecisionRequest } from "@/lib/api";
import { decideSwipe, getSwipeDeck } from "@/lib/api/client";
import { closetKeys } from "./use-closet";

export const swipeKeys = { deck: ["swipe-deck"] as const };

/** The deck from GET /api/swipe/deck. Each fetch also lights the top card's hanger amber, so it never reuses a stale one. */
export function useSwipeDeck() {
  return useQuery({ queryKey: swipeKeys.deck, queryFn: getSwipeDeck, staleTime: 0, refetchOnMount: "always" });
}

/** Records a decision, then reloads the deck (which lights the next hanger) and the closet stats */
export function useSwipeDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (decision: SwipeDecisionRequest) => decideSwipe(decision),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: swipeKeys.deck });
      void queryClient.invalidateQueries({ queryKey: closetKeys.all });
    },
  });
}
