import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublishableKey } from "@/lib/community/config";

function contentSecurityPolicy(nonce: string) {
  let supabaseOrigin = "";
  try {
    supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").origin;
  } catch {
    // An invalid configuration must not broaden connect-src.
  }
  const connect = [
    "'self'",
    supabaseOrigin,
    supabaseOrigin.replace(/^https:/, "wss:"),
  ]
    .filter(Boolean)
    .join(" ");
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    "worker-src 'self' blob:",
    `connect-src ${connect}`,
    ...(process.env.NODE_ENV === "development"
      ? []
      : ["upgrade-insecure-requests"]),
  ].join("; ");
}

function secureResponse(
  response: NextResponse,
  csp: string,
  communityMode: boolean,
) {
  response.headers.set("Content-Security-Policy", csp);
  if (communityMode) {
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const communityMode = process.env.NEXT_PUBLIC_CAREER_OPS_MODE === "community";
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const secure = (response: NextResponse) =>
    secureResponse(response, csp, communityMode);
  const publicCommunityPath =
    path === "/" ||
    path === "/login" ||
    path === "/auth/callback" ||
    path === "/auth/complete" ||
    path === "/api/community/auth/activate" ||
    path === "/api/community/auth/request-link";
  const protectedCommunityPath =
    path.startsWith("/community") ||
    (path.startsWith("/api/community/") && !publicCommunityPath);

  if (communityMode) {
    const hostedPath = publicCommunityPath || protectedCommunityPath;
    if (!hostedPath) {
      if (path.startsWith("/api/"))
        return secure(
          NextResponse.json({ error: "Not available." }, { status: 404 }),
        );
      return secure(NextResponse.redirect(new URL("/", request.url)));
    }
  }
  const publishableKey = supabasePublishableKey();
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !publishableKey) {
    if (communityMode && protectedCommunityPath) {
      if (path.startsWith("/api/"))
        return secure(
          NextResponse.json(
            { error: "Invitation service is not configured." },
            { status: 503 },
          ),
        );
      return secure(NextResponse.redirect(new URL("/login", request.url)));
    }
    return secure(NextResponse.next({ request: { headers: requestHeaders } }));
  }
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookies) {
          cookies.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (communityMode && protectedCommunityPath) {
    if (!user) {
      if (path.startsWith("/api/"))
        return secure(
          NextResponse.json({ error: "Sign in required." }, { status: 401 }),
        );
      const login = new URL("/login", request.url);
      login.searchParams.set("next", path);
      return secure(NextResponse.redirect(login));
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("membership_status")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.membership_status !== "active") {
      if (path.startsWith("/api/"))
        return secure(
          NextResponse.json(
            { error: "Active invitation required." },
            { status: 403 },
          ),
        );
      const login = new URL("/login", request.url);
      login.searchParams.set("error", "invite");
      return secure(NextResponse.redirect(login));
    }
  }
  return secure(response);
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\..*).*)"],
};
