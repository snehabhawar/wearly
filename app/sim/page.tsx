import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HubSimulator } from "@/components/hub-simulator";
import { simEnabled } from "@/lib/hub";

export const metadata: Metadata = { title: "Hub simulator · Wearly" };

// Dev only (docs/frontend.md): hidden in production unless SIM_ENABLED=true, like the /api/sim routes
export default function SimPage() {
  if (!simEnabled()) notFound();
  return <HubSimulator />;
}
