"use client";

import { useEffect, useState } from "react";
import { LedDot } from "@/components/led-dot";
import { Button } from "@/components/ui/button";
import { ApiError, findHanger } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const MESSAGE_MS = 4000;

/** Blinks a hanger white (POST /api/hangers/{n}/find) and says so in words next to the button. */
export function FindItButton({ hangerNumber, className }: { hangerNumber: number; className?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  useEffect(() => {
    if (state !== "sent" && state !== "failed") return;
    const t = setTimeout(() => setState("idle"), MESSAGE_MS);
    return () => clearTimeout(t);
  }, [state]);

  async function find() {
    setState("sending");
    try {
      await findHanger(hangerNumber);
      setState("sent");
    } catch (e) {
      console.error(e instanceof ApiError ? e.code : e);
      setState("failed");
    }
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Button onClick={find} disabled={state === "sending"} className="h-11.5 w-full rounded-lg font-semibold">
        {state === "sending" ? "Finding…" : "Find it"}
      </Button>
      <p role="status" className="min-h-4 text-xs text-muted-strong">
        {state === "sent" && (
          <LedDot color="white" label={`Hanger ${hangerNumber} is blinking white.`} className="text-xs" />
        )}
        {state === "failed" && "We couldn't reach the hub just now. Try again in a moment."}
      </p>
    </div>
  );
}
