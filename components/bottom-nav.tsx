"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, GalleryVerticalEnd, LayoutGrid, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/today", label: "Today", Icon: Sun },
  { href: "/closet", label: "Closet", Icon: LayoutGrid },
  { href: "/plan", label: "Plan", Icon: CalendarDays },
  { href: "/swipe", label: "Swipe", Icon: GalleryVerticalEnd },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 flex h-19 shrink-0 items-center justify-around border-t border-line bg-card pb-[max(6px,env(safe-area-inset-bottom))]"
    >
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-12 min-w-16 flex-col items-center justify-center gap-1 text-[11px]",
              active ? "font-bold text-plum" : "font-medium text-muted-foreground",
            )}
          >
            <Icon aria-hidden className="size-5.5" strokeWidth={1.9} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
