import { createHmac } from "node:crypto";

/** Only accept browser mutations issued by this exact deployment origin. */
export function isSameOriginMutation(request) {
  try {
    const origin = request.headers.get("origin");
    const fetchSite = request.headers.get("sec-fetch-site");
    return (
      Boolean(origin) &&
      origin === new URL(request.url).origin &&
      fetchSite !== "cross-site"
    );
  } catch {
    return false;
  }
}

/** Auth callbacks may return only to the private member tree. */
export function safeCommunityPath(value) {
  if (typeof value !== "string" || value.includes("\\")) return "/community";
  try {
    const parsed = new URL(value, "https://community.invalid");
    if (parsed.origin !== "https://community.invalid") return "/community";
    if (/%(?:2f|5c)/i.test(parsed.pathname)) return "/community";
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return parsed.pathname === "/community" ||
      parsed.pathname.startsWith("/community/")
      ? path
      : "/community";
  } catch {
    return "/community";
  }
}

export function privateJson(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

export function clientAddress(request) {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function rateLimitKey(secret, scope, ...parts) {
  return createHmac("sha256", secret)
    .update([scope, ...parts].join("\u001f"))
    .digest("hex");
}
