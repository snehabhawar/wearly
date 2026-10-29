"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Signs out in the browser, then lets the proxy send the next request to /login */
export function SignOutButton({ className, iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await createClient().auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-medium text-muted-strong transition-colors hover:bg-lilac disabled:opacity-60",
        className,
      )}
    >
      <LogOut aria-hidden className="size-5" strokeWidth={1.9} />
      {iconOnly ? <span className="sr-only">Sign out</span> : pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
