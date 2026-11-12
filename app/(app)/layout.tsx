import { AppShell } from "@/components/app-shell";
import { ClosetRealtime } from "@/components/closet-realtime";
import { QueryProvider } from "@/components/query-provider";

// Signed-out visitors never reach these screens: proxy.ts sends them to /login.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <QueryProvider>
      <ClosetRealtime />
      <AppShell>{children}</AppShell>
    </QueryProvider>
  );
}
