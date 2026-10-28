"use client";

import { ClosetView } from "@/components/closet-view";
import { Button } from "@/components/ui/button";
import { useCloset } from "@/lib/queries/use-closet";

/** The Closet screen on live data: loading and error states around ClosetView */
export function ClosetScreen() {
  const { data, isPending, isError, refetch } = useCloset();

  if (isPending) return <ClosetSkeleton />;
  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3 px-5 pt-7 md:px-10 md:pt-8">
        <h1 className="text-3xl font-semibold md:text-[40px]">Your closet</h1>
        <p role="alert" className="text-[15px] text-muted-strong">
          We couldn&apos;t load your closet just now. Your hangers are fine; it&apos;s the connection.
        </p>
        <Button variant="outline" onClick={() => refetch()} className="h-11 rounded-lg px-4.5 font-semibold">
          Try again
        </Button>
      </div>
    );
  }
  return <ClosetView items={data.items} summary={data.summary} />;
}

function ClosetSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your closet" className="flex flex-col gap-6 px-5 pt-7 pb-12 md:px-10 md:pt-8">
      <div className="flex flex-col gap-2">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-heat-0" />
        <div className="h-4 w-72 animate-pulse rounded bg-heat-0" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-37 animate-pulse rounded-3xl bg-heat-0" />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-5 lg:w-3/5">
        {Array.from({ length: 24 }, (_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-2xl bg-heat-0" />
        ))}
      </div>
    </div>
  );
}
