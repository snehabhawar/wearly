"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, NAV_ITEMS } from "@/components/nav-items";
import { cn } from "@/lib/utils";

/** Phone navigation (< 768px). Desktop uses SidebarNav. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 flex h-19 shrink-0 items-center justify-around border-t border-line bg-card pb-[max(6px,env(safe-area-inset-bottom))] md:hidden"
    >
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
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
