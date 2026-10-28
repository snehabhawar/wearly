import { SwipeDeck } from "@/components/swipe-deck";
import { FIXTURE_DECK, FIXTURE_TIMEZONE } from "@/lib/queries/fixtures";

// Fixture deck until GET /api/swipe/deck exists (backend B3, real in B7)
export default function SwipePage() {
  return (
    <div className="mx-auto flex w-full max-w-110 px-5 pt-7 pb-12 md:pt-8">
      <SwipeDeck cards={FIXTURE_DECK} timeZone={FIXTURE_TIMEZONE} />
    </div>
  );
}
