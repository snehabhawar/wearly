import type { Metadata } from "next";
import { CamScreen } from "@/components/cam-screen";
import { ClosetRealtime } from "@/components/closet-realtime";
import { QueryProvider } from "@/components/query-provider";

export const metadata: Metadata = { title: "Closet camera · Wearly" };

// A phone inside the closet: no app chrome, just the camera (signed in: proxy.ts)
export default function CamPage() {
  return (
    <QueryProvider>
      <ClosetRealtime />
      <CamScreen />
    </QueryProvider>
  );
}
