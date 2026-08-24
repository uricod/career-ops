const SEARCH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "in",
  "of",
  "or",
  "the",
  "to",
  "with",
]);

const US_STATES = {
  al: "alabama", ak: "alaska", az: "arizona", ar: "arkansas", ca: "california",
  co: "colorado", ct: "connecticut", de: "delaware", fl: "florida", ga: "georgia",
  hi: "hawaii", id: "idaho", il: "illinois", in: "indiana", ia: "iowa",
  ks: "kansas", ky: "kentucky", la: "louisiana", me: "maine", md: "maryland",
  ma: "massachusetts", mi: "michigan", mn: "minnesota", ms: "mississippi", mo: "missouri",
  mt: "montana", ne: "nebraska", nv: "nevada", nh: "new hampshire", nj: "new jersey",
  nm: "new mexico", ny: "new york", nc: "north carolina", nd: "north dakota", oh: "ohio",
  ok: "oklahoma", or: "oregon", pa: "pennsylvania", ri: "rhode island", sc: "south carolina",
  sd: "south dakota", tn: "tennessee", tx: "texas", ut: "utah", vt: "vermont",
  va: "virginia", wa: "washington", wv: "west virginia", wi: "wisconsin", wy: "wyoming",
  dc: "district of columbia",
};

function normalized(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function searchWords(value) {
  return normalized(value)
    .split(" ")
    .filter((word) => word.length > 1 && !SEARCH_STOP_WORDS.has(word))
    .slice(0, 12);
}

function hasTerm(haystack, term) {
  return new RegExp(`(?:^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z0-9])`, "i")
    .test(haystack);
}

function stateFor(value) {
  const clean = normalized(value);
  for (const [code, name] of Object.entries(US_STATES)) {
    if (clean === code || clean === name) return { code, name };
  }
  return null;
}

function stateInLocation(location, state) {
  return hasTerm(location, state.code) || location.includes(state.name);
}

export function locationMatch(jobLocation, requestedLocation) {
  const location = normalized(jobLocation);
  const requested = normalized(requestedLocation);
  if (!requested) return { matched: true, score: 0 };
  if (!location) return { matched: false, score: 0 };

  if (/\bremote\b|\banywhere\b/.test(requested)) {
    const matched = /\bremote\b|\banywhere\b/.test(location);
    return { matched, score: matched ? 3 : 0 };
  }

  const rawParts = String(requestedLocation ?? "")
    .split(",")
    .map((part) => normalized(part))
    .filter(Boolean);
  const explicitState = rawParts.map(stateFor).find(Boolean) ?? stateFor(requested);
  if (explicitState) {
    const stateMatched = stateInLocation(location, explicitState);
    if (!stateMatched) return { matched: false, score: 0 };
    const city = rawParts.length > 1 && !stateFor(rawParts[0]) ? rawParts[0] : "";
    return { matched: true, score: city && location.includes(city) ? 5 : 3 };
  }

  const requestedWords = searchWords(requested);
  const matched = requestedWords.length > 0 && requestedWords.every((word) => hasTerm(location, word));
  return { matched, score: matched ? 4 : 0 };
}

export function indexedJobMatch(job, input, now = Date.now()) {
  const title = normalized(job?.title);
  if (!title) return null;
  const queryWords = searchWords(input?.query);
  const matchedTerms = queryWords.filter((word) => hasTerm(title, word));
  if (queryWords.length && matchedTerms.length === 0) return null;

  const location = locationMatch(job?.location, input?.location);
  if (!location.matched) return null;

  const postedValue = job?.first_seen || job?.scraped_at || "";
  const postedTime = Date.parse(String(postedValue));
  if (
    Number.isFinite(postedTime) &&
    postedTime < now - Number(input?.sinceDays || 30) * 86_400_000
  ) return null;

  const exactPhrase = normalized(input?.query);
  const phraseBonus = exactPhrase && title.includes(exactPhrase) ? 4 : 0;
  return {
    matchedTerms,
    postedAt: Number.isFinite(postedTime) ? new Date(postedTime).toISOString() : "",
    score: phraseBonus + matchedTerms.length * 3 + location.score,
  };
}

export function resolveRequestedLocation(input, preferredLocations = [], requestHeaders = new Headers()) {
  const clean = String(input ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!clean || clean.includes(",") || /\bremote\b|\banywhere\b/i.test(clean)) return clean;

  const preferred = preferredLocations
    .map((value) => String(value ?? "").replace(/\s+/g, " ").trim())
    .find((value) => value && value.toLowerCase().includes(clean.toLowerCase()) && value.length > clean.length);
  if (preferred) return preferred.slice(0, 120);

  let ipCity = "";
  try {
    ipCity = decodeURIComponent(requestHeaders.get("x-vercel-ip-city") || "");
  } catch {
    ipCity = requestHeaders.get("x-vercel-ip-city") || "";
  }
  const region = (requestHeaders.get("x-vercel-ip-country-region") || "").trim();
  if (ipCity && region && normalized(ipCity) === normalized(clean))
    return `${clean}, ${region}`.slice(0, 120);
  return clean;
}
