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

/** A deliberately conservative, bounded email check for private invitations. */
export function isInvitationEmail(value) {
  if (typeof value !== "string" || value.length < 3 || value.length > 320)
    return false;
  let at = -1;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 32 || code >= 127) return false;
    if (value[index] === "@") {
      if (at !== -1) return false;
      at = index;
    }
  }
  if (at < 1 || at > 64 || at === value.length - 1) return false;

  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    '()<>[]:;\\,"'.split("").some((character) => local.includes(character)) ||
    domain.length > 255 ||
    domain.startsWith(".") ||
    domain.endsWith(".") ||
    domain.includes("..")
  )
    return false;

  const labels = domain.split(".");
  if (labels.length < 2) return false;
  return labels.every((label) => {
    if (
      label.length < 1 ||
      label.length > 63 ||
      label.startsWith("-") ||
      label.endsWith("-")
    )
      return false;
    for (const character of label) {
      const code = character.charCodeAt(0);
      if (
        character !== "-" &&
        !(code >= 48 && code <= 57) &&
        !(code >= 65 && code <= 90) &&
        !(code >= 97 && code <= 122)
      )
        return false;
    }
    return true;
  });
}

export function rateLimitKey(secret, scope, ...parts) {
  return createHmac("sha256", secret)
    .update([scope, ...parts].join("\u001f"))
    .digest("hex");
}
