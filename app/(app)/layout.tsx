import { AppShell } from "@/components/app-shell";

// The auth guard (signed-out users go to /login) arrives with /login (task F4).
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
