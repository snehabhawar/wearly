import { createHash } from "node:crypto";
import type { Db } from "./db";

export type HubDevice = { id: string; closetId: string };

/** devices.secret_hash is the sha256 hex of the hub's bearer secret */
export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** The hub behind a bearer secret, or null. Also records the heartbeat (devices.last_seen_at). */
export async function authenticateHub(db: Db, secret: string | null, now: Date): Promise<HubDevice | null> {
  if (!secret) return null;
  const { data, error } = await db
    .from("devices")
    .update({ last_seen_at: now.toISOString() })
    .eq("secret_hash", hashSecret(secret))
    .select("id, closet_id")
    .maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, closetId: data.closet_id } : null;
}

/** "Bearer <secret>" from an Authorization header */
export function bearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
