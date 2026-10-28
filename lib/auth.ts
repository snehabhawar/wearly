/** Seeded demo account (supabase/seed.sql), offered on /login so a demo needs no typing */
export const DEMO_ACCOUNT = { email: "demo@wearly.app", password: "wearly-demo" } as const;

/**
 * Where to go after signing in: the `next` query param when it is a path inside this app, else Today.
 * Rejects absolute and protocol-relative URLs so /login can't redirect off-site.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/today";
  if (next === "/login" || next.startsWith("/login?")) return "/today";
  return next;
}
