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

test("community boards run through the hosted scanner, not a link directory", () => {
  const scanner = fs.readFileSync(
    new URL("../../src/lib/community/hosted-scanner.ts", import.meta.url),
    "utf8",
  );
  for (const expected of [
    "allfrumjobs.com",
    "yidjob.com",
    "trefajob.com",
    "luach.com",
  ]) {
    assert.match(scanner, new RegExp(expected.replace(".", "\\."), "i"));
  }
  assert.match(scanner, /sourceDone/);
  assert.match(scanner, /greenhouse_companies\.json/);
  assert.match(scanner, /lever_companies\.json/);
  assert.match(scanner, /ashby_companies\.json/);
});
