"use client";

import Image from "next/image";
import { useState } from "react";
import { garmentColorHex, SILHOUETTE_PATHS, silhouetteFor } from "@/lib/garment-visuals";
import { cn } from "@/lib/utils";

export type GarmentLook = {
  name: string | null;
  category: string | null;
  color: string | null;
  photoPath: string | null;
};

/**
 * What a garment looks like, filling its (relatively positioned) container:
 * the photo if there is one, else a colored silhouette of its kind, else the
 * hanger number (a garment we don't know anything about yet).
 */
export function GarmentThumb({
  garment,
  hangerNumber,
  sizes = "96px",
  className,
}: {
  garment: GarmentLook | null;
  hangerNumber: number | null;
  /** Rendered width hint for the photo, as in next/image */
  sizes?: string;
  className?: string;
}) {
  // Remember which photo failed, not just that one did: the same thumb is reused for other garments
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const shape = garment ? silhouetteFor(garment.category, garment.name) : null;

  if (garment?.photoPath && garment.photoPath !== failedPhoto) {
    return (
      <Image
        src={garment.photoPath}
        alt=""
        fill
        sizes={sizes}
        className={cn("object-contain", className)}
        // Photos taken in the app come from /api/garments/{id}/photo, which needs the sign-in
        // cookie: the browser loads them directly, not through the image optimizer
        unoptimized={garment.photoPath.startsWith("/api/")}
        onError={() => setFailedPhoto(garment.photoPath)}
      />
    );
  }

  if (shape) {
    return (
      <svg viewBox="0 0 64 64" aria-hidden className={cn("size-3/5", className)}>
        <path
          d={SILHOUETTE_PATHS[shape]}
          fill={garmentColorHex(garment?.color ?? null)}
          className="stroke-ink"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <span aria-hidden className={cn("font-heading text-[1.6em] font-semibold text-ink", className)}>
      {hangerNumber ?? "?"}
    </span>
  );
}
