import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";

/**
 * Runs before every page request.
 *
 * Two jobs:
 *   1. Refresh the Supabase session cookie so a signed-in user stays signed in
 *      across reloads and after the PWA is reopened from the home screen.
 *   2. Gate the app: financial routes require a session, auth routes require
 *      the absence of one.
 */

/** Routes reachable without a session. */
const PUBLIC_ROUTES = ["/login", "/signup", "/auth", "/offline"];

/** Routes a signed-in user should be bounced away from. */
const AUTH_ONLY_ROUTES = ["/login", "/signup"];

function matches(pathname: string, routes: string[]) {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Revalidates the token with Supabase Auth and writes refreshed cookies.
  // Nothing between here and the response should short-circuit it.
  let user = null;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch {
    // Supabase itself is unreachable - a network failure, not a rejected
    // session. Bouncing a signed-in user to the login screen would be a lie,
    // so the request continues and the page's own error boundary reports it.
    return response;
  }

  const { pathname, search } = request.nextUrl;

  /**
   * Redirect while keeping any cookies Supabase refreshed during this request.
   *
   * `getUser()` can rotate the access and refresh tokens, and `setAll` writes
   * them onto `response`. Returning a bare NextResponse.redirect() would drop
   * those Set-Cookie headers, leaving the browser holding a refresh token the
   * server has already retired - which signs the user out on the next request.
   */
  function redirectTo(target: URL) {
    const redirect = NextResponse.redirect(target);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  if (!user && !matches(pathname, PUBLIC_ROUTES)) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.search = "";
    // Remember where they were headed so login can land them back there.
    if (pathname !== "/") target.searchParams.set("next", `${pathname}${search}`);
    return redirectTo(target);
  }

  if (user && matches(pathname, AUTH_ONLY_ROUTES)) {
    const target = request.nextUrl.clone();
    target.pathname = "/";
    target.search = "";
    return redirectTo(target);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next.js internals, the service worker, the manifest
     * and static assets - those must stay reachable while signed out so an
     * installed PWA can still boot to the login screen.
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|screenshots/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
};
