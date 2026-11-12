import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { HubSimulator } from "@/components/hub-simulator";
import { simEnabled } from "@/lib/hub";

export const metadata: Metadata = { title: "Hub simulator · Wearly" };

// Dev only (docs/frontend.md): hidden in production unless SIM_ENABLED=true, like the /api/sim routes
export default function SimPage() {
  return (
    <Suspense>
      <SimGate />
    </Suspense>
  );
}

/** Reads SIM_ENABLED per request, not once at build time */
async function SimGate() {
  await connection();
  if (!simEnabled()) notFound();
  return <HubSimulator />;
}
