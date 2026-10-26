import { BottomNav } from "@/components/bottom-nav";

/**
 * Signed-in screens. MVP: the phone layout everywhere; on desktop it sits in a
 * centered ~480px column on the cream background (docs/frontend.md, Layout).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-120 flex-col bg-background md:border-x md:border-line">
      <main className="flex flex-1 flex-col">{children}</main>
      <BottomNav />
    </div>
  );
}
