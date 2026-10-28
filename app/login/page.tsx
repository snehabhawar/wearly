import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Sign in · Wearly" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-7 rounded-[28px] border border-line bg-card px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-3">
          <Link href="/" aria-label="Wearly home" className="self-start">
            <Logo className="text-[26px]" />
          </Link>
          <div className="flex flex-col gap-1">
            <h1 className="text-[28px] font-semibold">Welcome back</h1>
            <p className="text-[15px] text-muted-strong">Sign in to see what your closet noticed.</p>
          </div>
        </div>
        {/* useSearchParams reads ?next= at request time */}
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
