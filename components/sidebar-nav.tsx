"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { isActive, NAV_ITEMS } from "@/components/nav-items";
import { SignOutButton } from "@/components/sign-out-button";
import { cn } from "@/lib/utils";

/** Desktop navigation (≥ 768px). Phones use BottomNav. */
export function SidebarNav() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-7 border-r border-line bg-card px-5 py-7 md:flex">
      <Link href="/today" aria-label="Wearly, go to Today">
        <Logo className="text-[26px]" />
      </Link>
      <nav aria-label="Main" className="flex flex-col gap-1">
        {/* The pathname is unknown while prerendering routes with params, so the active item fills in on load */}
        <Suspense fallback={<SidebarLinks pathname="" />}>
          <ActiveSidebarLinks />
        </Suspense>
      </nav>
      <SignOutButton className="mt-auto" />
    </aside>
  );
}

function ActiveSidebarLinks() {
  return <SidebarLinks pathname={usePathname()} />;
}

function SidebarLinks({ pathname }: { pathname: string }) {
  return (
    <>
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const { Icon } = item;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] transition-colors",
              active
                ? "bg-plum-soft font-bold text-plum"
                : "font-medium text-muted-strong hover:bg-lilac",
            )}
          >
            <Icon aria-hidden className="size-5" strokeWidth={1.9} />
            {"longLabel" in item ? item.longLabel : item.label}
          </Link>
        );
      })}
    </>
  );
}
