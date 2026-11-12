"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_ACCOUNT, safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

/** Email + password sign-in (MVP: the seeded demo account). Runs in the browser, so no server action. */
export function LoginForm() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setPending(false);
      setError(
        error.status === 400
          ? "That email and password don't match. Try again, or use the demo account."
          : "We couldn't reach Wearly just now. Check your connection and try again.",
      );
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={signIn} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 rounded-xl bg-card px-3.5"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 rounded-xl bg-card px-3.5"
        />
      </div>

      <p role="alert" className="min-h-5 text-[13px] leading-snug text-amber-ink">
        {error}
      </p>

      <Button type="submit" disabled={pending} className="h-11 rounded-xl text-[15px] font-semibold">
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <div className="flex flex-col gap-2 rounded-2xl bg-lilac px-4 py-3.5">
        <p className="text-[13px] leading-snug text-muted-strong">
          Trying Wearly? The demo closet has 24 hangers and a few months of history.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setEmail(DEMO_ACCOUNT.email);
            setPassword(DEMO_ACCOUNT.password);
            setError("");
          }}
          className="h-10 self-start rounded-lg bg-card px-3.5 font-semibold"
        >
          Use the demo account
        </Button>
      </div>
    </form>
  );
}
