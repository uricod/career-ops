import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const communityMode = process.env.NEXT_PUBLIC_CAREER_OPS_MODE === "community";
  const publicCommunityPath =
    path === "/" ||
    path === "/login" ||
    path.startsWith("/auth/") ||
    path === "/api/community/auth/request-link";
  const protectedCommunityPath =
    path.startsWith("/community") ||
    (path.startsWith("/api/community/") && !publicCommunityPath);

  if (communityMode) {
    const hostedPath = publicCommunityPath || protectedCommunityPath;
    if (!hostedPath) {
      if (path.startsWith("/api/"))
        return NextResponse.json({ error: "Not available." }, { status: 404 });
      return NextResponse.redirect(new URL("/", request.url));
    }
  }
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    if (communityMode && protectedCommunityPath) {
      if (path.startsWith("/api/"))
        return NextResponse.json(
          { error: "Invitation service is not configured." },
          { status: 503 },
        );
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next({ request });
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookies) {
          cookies.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
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
        return NextResponse.json(
          { error: "Sign in required." },
          { status: 401 },
        );
      const login = new URL("/login", request.url);
      login.searchParams.set("next", path);
      return NextResponse.redirect(login);
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("membership_status")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.membership_status !== "active") {
      if (path.startsWith("/api/"))
        return NextResponse.json(
          { error: "Active invitation required." },
          { status: 403 },
        );
      const login = new URL("/login", request.url);
      login.searchParams.set("error", "invite");
      return NextResponse.redirect(login);
    }
  }
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\..*).*)"],
};
