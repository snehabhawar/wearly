import { CalendarDays, GalleryVerticalEnd, LayoutGrid, Sun } from "lucide-react";

/** Main destinations, shared by the desktop sidebar and the phone tab bar */
export const NAV_ITEMS = [
  { href: "/today", label: "Today", Icon: Sun },
  { href: "/closet", label: "Closet", Icon: LayoutGrid },
  { href: "/plan", label: "Plan", Icon: CalendarDays },
  { href: "/swipe", label: "Swipe", longLabel: "Keep or let go", Icon: GalleryVerticalEnd },
] as const;

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
