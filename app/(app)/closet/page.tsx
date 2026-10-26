import { ClosetView } from "@/components/closet-view";
import { FIXTURE_CLOSET, FIXTURE_SUMMARY } from "@/lib/queries/fixtures";

// Fixture data until reads are wired up (backend B1/B2)
export default function ClosetPage() {
  return <ClosetView items={FIXTURE_CLOSET} summary={FIXTURE_SUMMARY} />;
}
