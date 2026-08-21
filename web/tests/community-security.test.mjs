import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  clientAddress,
  isInvitationEmail,
  isSameOriginMutation,
  privateJson,
  rateLimitKey,
  safeCommunityPath,
} from "../src/lib/community/security.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const read = (relative) =>
  fs.readFileSync(path.join(repoRoot, relative), "utf8");

test("auth callback accepts only the private member tree", () => {
  assert.equal(safeCommunityPath("/community"), "/community");
  assert.equal(
    safeCommunityPath("/community/jobs?q=engineer#saved"),
    "/community/jobs?q=engineer#saved",
  );
  for (const malicious of [
    "https://evil.example/",
    "//evil.example/",
    "/\\evil.example/",
    "/community/%5c%5cevil.example/",
    "/community/%2f%2fevil.example/",
    "/communityevil",
    "/login",
    null,
  ])
    assert.equal(safeCommunityPath(malicious), "/community");
});

test("auth callback verifies one-time email token hashes server-side", () => {
  const callback = read("web/src/app/auth/callback/route.ts");
  assert.match(callback, /url\.searchParams\.get\("token_hash"\)/);
  assert.match(callback, /supabase\.auth\.verifyOtp/);
  assert.match(callback, /type: "magiclink"/);
});

test("passwordless sign-in uses the cookie-backed SSR client for PKCE", () => {
  const route = read(
    "web/src/app/api/community/auth/request-link/route.ts",
  );
  assert.match(route, /await getSupabaseServerClient\(\)/);
  assert.match(route, /supabase\.auth\.signInWithOtp/);
  assert.doesNotMatch(route, /createClient\(/);
});

test("redeemed invitations can sign active returning members back in", () => {
  const requestLink = read(
    "web/src/app/api/community/auth/request-link/route.ts",
  );
  const callback = read("web/src/app/auth/callback/route.ts");
  assert.match(requestLink, /invitation\?\.status === "redeemed"/);
  assert.match(requestLink, /profile\?\.membership_status === "active"/);
  assert.match(callback, /supabase\.rpc\(\s*"is_active_member"/);
  assert.match(callback, /active === true/);
});

test("cookie-backed mutations require the exact deployment origin", () => {
  const url = "https://community.example/api/community/admin/invitations";
  assert.equal(
    isSameOriginMutation(
      new Request(url, {
        method: "POST",
        headers: {
          origin: "https://community.example",
          "sec-fetch-site": "same-origin",
        },
      }),
    ),
    true,
  );
  for (const headers of [
    {},
    { origin: "https://evil.example" },
    {
      origin: "https://community.example",
      "sec-fetch-site": "cross-site",
    },
  ])
    assert.equal(
      isSameOriginMutation(new Request(url, { method: "POST", headers })),
      false,
    );
});

test("sensitive JSON is never cacheable", async () => {
  const response = privateJson({ ok: true });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { ok: true });
});

test("login throttle keys retain no raw email or address", () => {
  const key = rateLimitKey(
    "a-long-random-server-secret",
    "auth-identity",
    "203.0.113.7",
    "member@example.org",
  );
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.equal(key.includes("member"), false);
  assert.equal(key.includes("203"), false);
});

test("login throttling prefers Vercel's trusted client address", () => {
  const request = new Request("https://community.example/login", {
    headers: {
      "x-vercel-forwarded-for": "203.0.113.7",
      "x-forwarded-for": "198.51.100.9, 10.0.0.1",
      "x-real-ip": "192.0.2.4",
    },
  });
  assert.equal(clientAddress(request), "203.0.113.7");
});

test("invitation email validation is bounded and cannot backtrack", () => {
  for (const valid of [
    "member@example.org",
    "first.last+jobs@community.example",
  ])
    assert.equal(isInvitationEmail(valid), true);
  for (const invalid of [
    "member@example",
    "member@@example.org",
    ".member@example.org",
    "member@-example.org",
    "member@javascript:alert.example",
    `${"a".repeat(321)}@example.org`,
  ])
    assert.equal(isInvitationEmail(invalid), false, invalid);
});

test("database policies require active membership, not ownership alone", () => {
  const sql = read("supabase/migrations/202608210002_security_hardening.sql");
  assert.match(sql, /active members read own profile/);
  assert.match(sql, /active members create own applications/);
  assert.match(sql, /active members read own usage events/);
  assert.ok((sql.match(/public\.is_active_member\(\)/g) || []).length >= 10);
  assert.match(sql, /auth\.role\(\) <> 'service_role'/);
  assert.match(
    sql,
    /revoke all on public\.auth_rate_limits from public, anon, authenticated/,
  );
});

test("public Supabase signup is disabled in the shipped configuration", () => {
  const config = read("supabase/config.toml");
  assert.match(config, /\[auth\][\s\S]*?enable_signup = false/);
  assert.match(config, /\[auth\.email\][\s\S]*?enable_signup = true/);
});

test("production CSP uses nonces and blocks script attributes", () => {
  const proxy = read("web/src/proxy.ts");
  const nextConfig = read("web/next.config.mjs");
  assert.match(proxy, /script-src 'self' 'nonce-\$\{nonce\}' 'strict-dynamic'/);
  assert.match(proxy, /script-src-attr 'none'/);
  assert.doesNotMatch(proxy, /script-src[^\n]*unsafe-inline/);
  assert.doesNotMatch(nextConfig, /script-src[^\n]*unsafe-inline/);
});

test("every cookie-backed Community mutation has an origin gate", () => {
  for (const route of [
    "web/src/app/api/community/evaluate/route.ts",
    "web/src/app/api/community/search/route.ts",
    "web/src/app/api/community/rank/route.ts",
    "web/src/app/api/community/auth/request-link/route.ts",
    "web/src/app/api/community/admin/invitations/route.ts",
  ])
    assert.match(read(route), /isSameOriginMutation\(request\)/, route);
});

test("hosted search is member-only, streamed, and never spends AI tokens", () => {
  const route = read("web/src/app/api/community/search/route.ts");
  assert.match(route, /getCommunityMembership/);
  assert.match(route, /application\/x-ndjson/);
  assert.match(route, /tokens: 0/);
  assert.doesNotMatch(route, /api\.openai\.com/);
});

test("AI search ranking reserves quota before calling the model", () => {
  const route = read("web/src/app/api/community/rank/route.ts");
  assert.match(route, /p_operation: "search-shortlist"/);
  assert.match(route, /Buffer\.byteLength\(payload, "utf8"\)/);
  assert.ok(route.indexOf("reserve_ai_usage") < route.indexOf("api.openai.com"));
  assert.match(route, /store: false/);
});

test("AI quota reservation is multilingual-safe and bounded before the API call", () => {
  const route = read("web/src/app/api/community/evaluate/route.ts");
  assert.match(route, /Buffer\.byteLength\(openAiPayload, "utf8"\)/);
  assert.match(route, /if \(reservation > 20_000\)/);
  assert.doesNotMatch(route, /job\.length \+ resume\.length\) \/ 3/);
  assert.ok(
    route.indexOf("if (reservation > 20_000)") <
      route.indexOf("reserve_ai_usage"),
  );
  assert.ok(
    route.indexOf("reserve_ai_usage") < route.indexOf("api.openai.com"),
  );
});
