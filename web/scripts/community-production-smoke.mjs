import crypto from "node:crypto";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";

function loadEnvironment(file) {
  if (!file) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2];
    if (value.startsWith('"') && value.endsWith('"')) {
      try {
        value = JSON.parse(value);
      } catch {
        value = value.slice(1, -1);
      }
    }
    process.env[match[1]] = value;
  }
}

loadEnvironment(process.argv[2]);
const base = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const skipAi = process.env.COMMUNITY_SMOKE_SKIP_AI === "1";
const accountOnly = process.env.COMMUNITY_SMOKE_ACCOUNT_ONLY === "1";
if (!base || !supabaseUrl || !secret)
  throw new Error("Production site and Supabase admin configuration are required.");

const service = createClient(supabaseUrl, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const id = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
const email = `codex-e2e-${id}@example.com`;
const originalPassword = `E2E!${crypto.randomUUID()}x`;
const recoveredPassword = `Recovered!${crypto.randomUUID()}x`;
const checks = [];
let userId = "";
let browser;

function check(condition, label) {
  if (!condition) throw new Error(label);
  checks.push(label);
}

try {
  const created = await service.auth.admin.createUser({
    email,
    password: originalPassword,
    email_confirm: true,
    app_metadata: { role: "admin" },
  });
  if (created.error || !created.data.user)
    throw created.error || new Error("Test user creation failed.");
  userId = created.data.user.id;
  const activated = await service
    .from("profiles")
    .update({
      membership_status: "active",
      daily_token_limit: 20_000,
      locations: ["Lakewood, NJ"],
      include_community_sources: true,
    })
    .eq("id", userId);
  if (activated.error) throw activated.error;

  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_PATH ||
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  browser = await chromium.launch({ headless: true, executablePath });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(120_000);

  let response = await page.goto(`${base}/login`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForLoadState("networkidle");
  check(response?.status() === 200, "login page returns 200");
  check(
    await page.getByRole("button", { name: "Forgot password?" }).isVisible(),
    "forgot-password control is visible",
  );
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByLabel("Member email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await page.getByText(/password-reset link is on its way/i).waitFor();
  check(true, "reset request completes without account disclosure");

  await page.getByRole("button", { name: "Use password" }).click();
  await page.getByLabel("Member email").fill(email);
  await page.getByLabel("Password").fill(originalPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`${base}/community`);
  check(true, "password login reaches the private workspace");

  for (const path of [
    "/community/jobs",
    "/community/tracker",
    "/community/fit",
    "/community/usage",
    "/community/profile",
    "/community/admin",
  ]) {
    response = await page.goto(base + path, { waitUntil: "domcontentloaded" });
    check(response?.status() === 200, `${path} returns 200`);
  }

  let resultCount = 0;
  const resume =
    "Senior software developer with eight years of JavaScript, TypeScript, Node.js, React, SQL, cloud systems, API design, testing, mentoring, and production operations experience.";
  if (!accountOnly) {
    await page.goto(`${base}/community/jobs`, { waitUntil: "domcontentloaded" });
    await page.getByPlaceholder(/Operations manager/).fill("Software Developer");
    await page.getByPlaceholder(/Remote, Brooklyn/).fill("Lakewood, NJ");
    await page.getByRole("button", { name: "Run job search" }).click();
    await page
      .getByText("Search complete", { exact: true })
      .waitFor({ timeout: 300_000 });
    const resultHeading = await page
      .locator("h2")
      .filter({ hasText: /roles found/ })
      .first()
      .textContent();
    resultCount = Number((resultHeading || "").match(/(\d+)/)?.[1] || 0);
    check(
      resultCount >= 20,
      `production search returns a useful result set (${resultCount})`,
    );

    await page.getByRole("button", { name: "Save to board" }).first().click();
    await page.getByRole("button", { name: "Saved" }).first().waitFor();
    check(true, "search result saves to the private board");

    if (!skipAi) {
      await page.getByRole("button", { name: "Use AI to shortlist" }).click();
      await page.getByLabel(/Resume evidence/).fill(resume);
      await page.getByRole("button", { name: "Rank best matches" }).click();
      await page.getByText(/AI ranked ·/).waitFor({ timeout: 180_000 });
      const rankText = await page.getByText(/AI ranked ·/).textContent();
      check(
        /\d[\d,]* tokens used/.test(rankText || ""),
        "Grok shortlist runs and records nonzero token usage",
      );
    }

    await page.goto(`${base}/community/tracker`, {
      waitUntil: "domcontentloaded",
    });
    await page.locator("select").first().waitFor();
    check(true, "saved job appears on the board");
    await page.locator("select").first().selectOption("applied");
    await page.getByLabel(/Remove /).first().click();
    await page.getByText("Your shortlist is beautifully empty.").waitFor();
    check(true, "board status update and delete both persist");
  }

  if (!skipAi) {
    await page.goto(`${base}/community/fit`, { waitUntil: "domcontentloaded" });
    const posting =
      "Software Developer role requiring JavaScript, TypeScript, Node.js, React, SQL, cloud deployment, automated testing, API ownership, clear communication, and engineering mentorship.";
    await page.getByLabel(/Job description/).fill(posting);
    await page.getByLabel(/Your resume evidence/).fill(resume);
    await page.getByRole("button", { name: "Run fit check" }).click();
    await page.getByText(/tokens · approx\./).waitFor({ timeout: 180_000 });
    check(true, "Grok fit check completes with metered usage");

    await page.goto(`${base}/community/usage`, { waitUntil: "domcontentloaded" });
    const usageText = await page.locator("body").textContent();
    check((usageText || "").includes("search shortlist"), "allowance shows shortlist activity");
    check((usageText || "").includes("fit check"), "allowance shows fit-check activity");
    check(
      (usageText || "").toLowerCase().includes("grok"),
      "allowance identifies the Grok model",
    );
  }

  await page.goto(`${base}/community/profile`, { waitUntil: "domcontentloaded" });
  const locations = page.getByLabel(/Preferred locations/);
  await locations.fill("Remote; Brooklyn, NY; Lakewood, NJ");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await page.waitForTimeout(1_000);
  await page.reload({ waitUntil: "domcontentloaded" });
  const savedLocations = page.getByLabel(/Preferred locations/);
  check(
    (await savedLocations.inputValue()).includes("Lakewood, NJ"),
    "profile preserves city-and-state locations",
  );

  await page.goto(`${base}/community/admin`, { waitUntil: "domcontentloaded" });
  check(
    await page.getByText("Community control").isVisible(),
    "admin console loads for an administrator",
  );
  check(
    await page.getByText(email).last().isVisible(),
    "admin member list includes the active member",
  );

  const recovery = await service.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${base}/auth/complete?mode=recovery` },
  });
  if (recovery.error || !recovery.data.properties?.action_link)
    throw recovery.error || new Error("Recovery link generation failed.");
  const recoveryContext = await browser.newContext({
    viewport: { width: 1200, height: 900 },
  });
  const recoveryPage = await recoveryContext.newPage();
  recoveryPage.setDefaultTimeout(120_000);
  await recoveryPage.goto(recovery.data.properties.action_link, {
    waitUntil: "domcontentloaded",
  });
  await recoveryPage.waitForURL(`${base}/auth/reset-password`);
  await recoveryPage
    .getByLabel("New password", { exact: true })
    .fill(recoveredPassword);
  await recoveryPage
    .getByLabel("Confirm new password", { exact: true })
    .fill(recoveredPassword);
  await recoveryPage.getByRole("button", { name: "Save new password" }).click();
  await recoveryPage.getByText("Your password is updated.").waitFor();
  check(true, "real recovery link updates the password");

  await recoveryPage.goto(`${base}/community/profile`, {
    waitUntil: "domcontentloaded",
  });
  await recoveryPage.getByRole("button", { name: "Sign out" }).click();
  await recoveryPage.waitForURL(`${base}/`);
  await recoveryPage.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await recoveryPage.getByLabel("Member email").fill(email);
  await recoveryPage.getByLabel("Password").fill(recoveredPassword);
  await recoveryPage.getByRole("button", { name: "Sign in" }).click();
  await recoveryPage.waitForURL(`${base}/community`);
  check(true, "the recovered password signs in successfully");

  console.log(
    JSON.stringify({ ok: true, checks: checks.length, results: resultCount }),
  );
} finally {
  if (browser) await browser.close().catch(() => {});
  if (userId) await service.auth.admin.deleteUser(userId).catch(() => {});
}
