import test from "node:test";
import assert from "node:assert/strict";
import {
  indexedJobMatch,
  locationMatch,
  resolveRequestedLocation,
} from "../src/lib/community/indexed-job-match.mjs";

const NOW = Date.parse("2026-08-24T12:00:00Z");

test("a Lakewood NJ search rejects remote jobs restricted to the United Kingdom", () => {
  assert.equal(locationMatch("United Kingdom - Remote", "Lakewood, NJ").matched, false);
});

test("a city and state search includes nearby roles across the requested state", () => {
  assert.deepEqual(locationMatch("Newark, NJ", "Lakewood, NJ"), {
    matched: true,
    score: 3,
  });
  assert.deepEqual(locationMatch("Lakewood, New Jersey", "Lakewood, NJ"), {
    matched: true,
    score: 5,
  });
});

test("indexed matching uses the job title rather than incidental description text", () => {
  const input = { query: "Software Developer", location: "Lakewood, NJ", sinceDays: 30 };
  assert.ok(indexedJobMatch({
    title: "Software Engineer",
    location: "Jersey City, NJ",
    first_seen: "2026-08-20T00:00:00Z",
  }, input, NOW));
  assert.equal(indexedJobMatch({
    title: "Office Manager",
    location: "Lakewood, NJ",
    first_seen: "2026-08-20T00:00:00Z",
    description: "Works with software developers",
  }, input, NOW), null);
});

test("stale indexed jobs are excluded", () => {
  assert.equal(indexedJobMatch({
    title: "Software Developer",
    location: "Lakewood, NJ",
    first_seen: "2026-06-01T00:00:00Z",
  }, { query: "Software Developer", location: "Lakewood, NJ", sinceDays: 30 }, NOW), null);
});

test("preferred profile location resolves an ambiguous city", () => {
  assert.equal(
    resolveRequestedLocation("Lakewood", ["Lakewood, NJ"], new Headers()),
    "Lakewood, NJ",
  );
});

test("Vercel location headers resolve the member's current city", () => {
  const headers = new Headers({
    "x-vercel-ip-city": "Lakewood",
    "x-vercel-ip-country-region": "NJ",
  });
  assert.equal(resolveRequestedLocation("Lakewood", [], headers), "Lakewood, NJ");
});

test("a city-only search falls back to the visitor's trusted US region", () => {
  const headers = new Headers({
    "x-vercel-ip-city": "Jackson",
    "x-vercel-ip-country": "US",
    "x-vercel-ip-country-region": "NJ",
  });
  assert.equal(resolveRequestedLocation("Lakewood", [], headers), "Lakewood, NJ");
});

test("a state-only search is not duplicated by location fallback", () => {
  const headers = new Headers({
    "x-vercel-ip-country": "US",
    "x-vercel-ip-country-region": "NJ",
  });
  assert.equal(resolveRequestedLocation("NY", [], headers), "NY");
});
