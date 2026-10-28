import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Refreshes the Supabase session on every signed-in screen, sends signed-out visitors to /login
 * and signed-in ones away from it. /api/* checks its own auth (the hub has no session).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies, headers) => {
        for (const { name, value } of cookies) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookies) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // getClaims verifies the token, unlike getSession, so it is safe to gate on
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname, search } = request.nextUrl;

  if (pathname === "/login") {
    return signedIn ? redirectKeepingCookies(request, response, "/today") : response;
  }
  if (!signedIn) {
    const to = new URL("/login", request.url);
    to.searchParams.set("next", pathname + search);
    return redirectKeepingCookies(request, response, to);
  }
  return response;
}

/** A redirect that still carries any refreshed session cookies */
function redirectKeepingCookies(request: NextRequest, from: NextResponse, to: string | URL) {
  const redirect = NextResponse.redirect(new URL(to, request.url));
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  // Signed-in screens (the (app) route group) plus /login
  matcher: ["/today/:path*", "/closet/:path*", "/plan/:path*", "/swipe/:path*", "/style/:path*", "/login"],
};
