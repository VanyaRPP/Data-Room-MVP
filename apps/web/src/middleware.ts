import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@dataroom/shared";

const AUTH_PATHS = new Set(["/login", "/register"]);

/**
 * Cheap presence check only - the API verifies the JWT's signature and
 * expiry on every request regardless. This just avoids flashing protected
 * pages at a logged-out visitor before their first API call comes back.
 *
 * Deliberately one-directional: it only redirects *away from* protected
 * pages when there's definitely no cookie. It does NOT redirect *away from*
 * /login|/register just because a cookie is present, because "present" and
 * "valid" aren't the same thing here - a stale cookie would otherwise bounce
 * to "/", get rejected there by the real JWT check, bounce back to /login,
 * and loop forever. That direction is handled client-side in
 * (auth)/layout.tsx, against the actual /auth/me result instead of a guess.
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);
  const isAuthPath = AUTH_PATHS.has(pathname);

  if (!hasSession && !isAuthPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except: the API rewrite, share links, and static assets.
  // `s/` rather than `s`, or this would also skip /shared-with-me.
  matcher: ["/((?!api/|s/|_next/static|_next/image|favicon.ico).*)"],
};
