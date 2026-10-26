import { BottomNav } from "@/components/bottom-nav";
import { SidebarNav } from "@/components/sidebar-nav";

/**
 * Signed-in screens. Desktop (≥ 768px): sidebar plus a wide content area.
 * Phone: single column with the bottom tab bar (docs/frontend.md, Layout).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full">
      <SidebarNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex flex-1 flex-col">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
