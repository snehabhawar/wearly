"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Camera, CircleAlert, LoaderCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { uploadGarmentPhoto } from "@/lib/api/client";
import type { ClosetItem } from "@/lib/queries/closet";
import { closetKeys, useCloset } from "@/lib/queries/use-closet";
import { cn } from "@/lib/utils";

/** Wait after a garment is hung back, so it has stopped swinging */
const SETTLE_MS = 2000;
/** Photos are sent at most this size on their long side */
const MAX_SIDE_PX = 1600;

type Mode = "new" | "every";
type Shot = {
  id: number;
  hanger: number;
  status: "snapping" | "working" | "done" | "failed";
  preview: string;
  result?: string;
};

/**
 * /cam: a phone inside the closet watching the rail. When a garment is hung back on a
 * hanger, it waits for it to settle, takes a photo and sends it in: the server removes
 * the background and Claude names the piece. The closet updates live everywhere else.
 */
export function CamScreen() {
  const video = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [watch, setWatch] = useState<number | "all">("all");
  const [mode, setMode] = useState<Mode>("new");
  const [shots, setShots] = useState<Shot[]>([]);
  const busy = useRef(new Set<number>());
  const closet = useCloset();
  const queryClient = useQueryClient();
  const items = useMemo(() => closet.data?.items ?? [], [closet.data]);

  async function start() {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser can't open the camera here. Open the secure address (https://…/cam).");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
      setStream(s);
    } catch {
      setCameraError("The camera didn't open. Allow camera access for this site and try again.");
    }
  }

  // Show the stream, and stop the camera when leaving the page
  useEffect(() => {
    if (!stream || !video.current) return;
    video.current.srcObject = stream;
    void video.current.play().catch(() => {});
    return () => stream.getTracks().forEach((t) => t.stop());
  }, [stream]);

  // Keep the screen on while the camera watches (Safari pauses the camera on lock)
  useEffect(() => {
    if (!stream || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = () => {
      if (document.visibilityState === "visible") {
        navigator.wakeLock.request("screen").then((l) => (lock = l)).catch(() => {});
      }
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release().catch(() => {});
    };
  }, [stream]);

  const snap = useCallback(
    async (item: ClosetItem, retag: boolean) => {
      const v = video.current;
      if (!item.garmentId || !v || v.videoWidth === 0 || busy.current.has(item.hangerNumber)) return;
      busy.current.add(item.hangerNumber);
      const id = Date.now();
      const scale = Math.min(1, MAX_SIDE_PX / Math.max(v.videoWidth, v.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(v.videoWidth * scale);
      canvas.height = Math.round(v.videoHeight * scale);
      canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
      const preview = canvas.toDataURL("image/jpeg", 0.5);
      const update = (s: Partial<Shot>) => setShots((all) => all.map((x) => (x.id === id ? { ...x, ...s } : x)));
      setShots((all) => [{ id, hanger: item.hangerNumber, status: "working" as const, preview }, ...all].slice(0, 8));

      try {
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.9),
        );
        const res = await uploadGarmentPhoto(item.garmentId, blob, { retag });
        update({
          status: "done",
          result: res.tagged?.name ? `Named it: ${res.tagged.name}` : "Photo saved",
        });
        void queryClient.invalidateQueries({ queryKey: closetKeys.all });
      } catch {
        update({ status: "failed", result: "Couldn't use that photo. Try again." });
      } finally {
        busy.current.delete(item.hangerNumber);
      }
    },
    [queryClient],
  );

  // A garment just came back to its hanger: snap it once it settles. Pending snaps live in a
  // ref, so a closet refetch during the wait (a light being acked) doesn't cancel them.
  const away = useRef(new Map<number, boolean>());
  const pending = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const timers = pending.current;
    return () => timers.forEach(clearTimeout);
  }, []);
  useEffect(() => {
    if (!stream) return;
    for (const item of items) {
      const wasAway = away.current.get(item.hangerNumber);
      away.current.set(item.hangerNumber, item.away);
      const cameBack = wasAway === true && !item.away;
      const watched = watch === "all" || watch === item.hangerNumber;
      const wanted = mode === "every" || !item.photoPath;
      if (cameBack && watched && wanted && item.garmentId && !pending.current.has(item.hangerNumber)) {
        setShots((all) => [
          { id: Date.now() + item.hangerNumber, hanger: item.hangerNumber, status: "snapping" as const, preview: "" },
          ...all.filter((s) => s.status !== "snapping"),
        ]);
        const retag = mode === "every";
        pending.current.set(
          item.hangerNumber,
          setTimeout(() => {
            pending.current.delete(item.hangerNumber);
            setShots((all) => all.filter((s) => s.status !== "snapping"));
            void snap(item, retag);
          }, SETTLE_MS),
        );
      }
    }
  }, [items, stream, watch, mode, snap]);

  const watched = watch === "all" ? null : items.find((i) => i.hangerNumber === watch);
  const latest = shots[0];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 bg-background px-4 py-5">
      <header className="flex items-center justify-between">
        <Link href="/closet" aria-label="Back to the closet">
          <Logo className="text-2xl" />
        </Link>
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-strong">
          <span aria-hidden className={cn("size-2 rounded-full", stream ? "bg-led-blue" : "bg-line-strong")} />
          {stream ? "Watching" : "Camera off"}
        </span>
      </header>

      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-ink">
        <video ref={video} playsInline muted className={cn("size-full object-cover", !stream && "hidden")} />
        {!stream && (
          <div className="flex size-full flex-col items-center justify-center gap-4 px-8 text-center text-primary-foreground">
            <Camera aria-hidden className="size-10" />
            <h1 className="text-2xl font-semibold">Closet camera</h1>
            <p className="text-[15px] leading-relaxed text-primary-foreground/80">
              Point this phone at the rail. When you hang something back, it takes a photo and Wearly names the piece.
              Only clothes, only then.
            </p>
            <Button onClick={() => void start()} className="h-12 gap-2 rounded-xl px-6 font-semibold">
              <Camera aria-hidden className="size-4.5" />
              Start camera
            </Button>
            {cameraError && (
              <p role="alert" className="text-[13px] text-led-yellow">
                {cameraError}
              </p>
            )}
          </div>
        )}
        {stream && latest && (
          <div
            role="status"
            className="absolute inset-x-3 bottom-3 flex items-center gap-2.5 rounded-2xl bg-card/95 px-3.5 py-3 text-[14px] font-semibold"
          >
            {latest.status === "snapping" || latest.status === "working" ? (
              <LoaderCircle aria-hidden className="size-4.5 shrink-0 animate-spin text-plum" />
            ) : latest.status === "done" ? (
              <Sparkles aria-hidden className="size-4.5 shrink-0 text-plum" />
            ) : (
              <CircleAlert aria-hidden className="size-4.5 shrink-0 text-amber-ink" />
            )}
            <span>
              Hanger {latest.hanger}:{" "}
              {latest.status === "snapping"
                ? "hung back, taking a photo…"
                : latest.status === "working"
                  ? "removing the background and naming it…"
                  : latest.result}
            </span>
          </div>
        )}
      </div>

      <section aria-label="Camera settings" className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
          Watch
          <select
            value={watch}
            onChange={(e) => setWatch(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="h-11 rounded-xl border border-line bg-card px-3 text-[15px] font-medium tracking-normal text-ink normal-case"
          >
            <option value="all">Every hanger</option>
            {items.map((i) => (
              <option key={i.hangerNumber} value={i.hangerNumber}>
                Hanger {i.hangerNumber}
                {i.name ? ` · ${i.name}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
          Take a photo
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="h-11 rounded-xl border border-line bg-card px-3 text-[15px] font-medium tracking-normal text-ink normal-case"
          >
            <option value="new">New pieces</option>
            <option value="every">Every time</option>
          </select>
        </label>
      </section>

      {stream && watched && (
        <Button
          variant="outline"
          onClick={() => void snap(watched, true)}
          disabled={latest?.status === "working" && latest.hanger === watched.hangerNumber}
          className="h-11.5 gap-2 rounded-xl font-semibold"
        >
          <Camera aria-hidden className="size-4" />
          Snap hanger {watched.hangerNumber} now
        </Button>
      )}

      <p className="text-[12px] leading-snug text-muted-foreground">
        Keep this page open with the screen on and the phone charging. Each photo uses one background-removal credit.
        {mode === "every" && " “Every time” also renames pieces you named yourself."}
      </p>

      {shots.some((s) => s.preview) && (
        <section aria-labelledby="shots-head" className="flex flex-col gap-2">
          <h2 id="shots-head" className="font-sans text-[13px] font-bold tracking-wide text-muted-foreground uppercase">
            Recent photos
          </h2>
          <ul className="flex flex-col gap-2">
            {shots
              .filter((s) => s.preview)
              .map((s) => (
                <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-2">
                  {/* A data URL preview of the frame just taken */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.preview} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
                  <span className="text-[14px]">
                    <strong className="font-semibold">Hanger {s.hanger}</strong>
                    <br />
                    <span className="text-muted-strong">
                      {s.status === "working" ? "Working on it…" : s.result}
                    </span>
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
