import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HubSimulator } from "@/components/hub-simulator";

export const metadata: Metadata = { title: "Hub simulator · Wearly" };

// Dev only (docs/frontend.md): hidden in production, like the /api/sim routes
export default function SimPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <HubSimulator />;
}
