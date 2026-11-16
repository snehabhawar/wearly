"use client";

import { Camera, LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";
import { GarmentDetailsForm } from "@/components/garment-details-form";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import type { ItemDetail } from "@/lib/queries/item";
import { shrinkPhoto } from "@/lib/photos/shrink";
import { useUploadGarmentPhoto } from "@/lib/queries/use-garment-photo";
import { cn } from "@/lib/utils";

/**
 * "Add a photo": opens the back camera on a phone (a file picker on desktop), uploads the
 * photo, and the server removes the background. Then asks for a name and type.
 */
export function PhotoCapture({ item, className }: { item: ItemDetail; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadGarmentPhoto(item.garmentId);
  const [askDetails, setAskDetails] = useState(false);
  const [shrinkFailed, setShrinkFailed] = useState(false);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setShrinkFailed(false);
    setAskDetails(false);
    let photo: Blob;
    try {
      photo = await shrinkPhoto(file);
    } catch {
      setShrinkFailed(true);
      return;
    }
    upload.mutate(photo, { onSuccess: () => setAskDetails(true) });
  }

  const error = shrinkFailed
    ? "We couldn't read that photo. Try another one."
    : upload.error
      ? upload.error instanceof ApiError && upload.error.code === "invalid_body"
        ? "We couldn't spot a garment in that photo. Try again on a plainer background."
        : "We couldn't cut out the background just now. Try again in a moment."
      : null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void onPick(e.target.files?.[0]);
          e.target.value = ""; // picking the same file again still fires change
        }}
      />
      <Button
        variant="outline"
        disabled={upload.isPending}
        onClick={() => input.current?.click()}
        className="h-11.5 gap-2 rounded-lg font-semibold"
      >
        {upload.isPending ? (
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
        ) : (
          <Camera aria-hidden className="size-4" />
        )}
        {upload.isPending ? "Removing the background…" : item.photoPath ? "Change photo" : "Add a photo"}
      </Button>
      <p role="status" className={cn("text-[13px] text-muted-strong", !upload.isPending && "sr-only")}>
        {upload.isPending ? "Uploading your photo and cutting out the background. This takes a few seconds." : ""}
      </p>
      {error && (
        <p role="alert" className="text-[13px] text-amber-ink">
          {error}
        </p>
      )}
      {askDetails && <GarmentDetailsForm item={item} onDone={() => setAskDetails(false)} />}
    </div>
  );
}
