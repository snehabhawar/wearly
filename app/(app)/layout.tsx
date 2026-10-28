import { AppShell } from "@/components/app-shell";

// Signed-out visitors never reach these screens: proxy.ts sends them to /login.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
