import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("community fit route has a zero-token privacy fallback", () => {
  const route = fs.readFileSync(
    new URL("../../src/app/api/community/evaluate/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /heuristicEvaluation/);
  assert.match(route, /store:\s*false/);
  assert.doesNotMatch(
    route,
    /insert\([^)]*(resume|job_description|prompt|output)/i,
  );
});

test("community sources are curated external links", () => {
  const sources = fs.readFileSync(
    new URL("../../src/lib/community/sources.ts", import.meta.url),
    "utf8",
  );
  for (const expected of [
    "allfrumjobs.com",
    "yidjob.com",
    "trefajob.com",
    "luach.com",
    "jewishjobs.com",
    "careers.ou.org",
    "nbn.org.il",
  ]) {
    assert.match(sources, new RegExp(expected.replace(".", "\\."), "i"));
  }
  assert.match(sources, /do not scrape or republish/i);
});
