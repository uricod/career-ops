import "server-only";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import {
  cleanSearchText,
  HOSTED_SEARCH_SOURCES,
  type HostedSearchEvent,
  type HostedSearchResult,
} from "./job-search";
import { resolveCommunityAiProvider } from "./ai-provider.mjs";
import {
  indexedJobMatch,
  locationMatch,
  searchWords,
} from "./indexed-job-match.mjs";

type RawJob = {
  title?: unknown;
  url?: unknown;
  company?: unknown;
  location?: unknown;
  description?: unknown;
  postedAt?: unknown;
};

type SearchInput = {
  query: string;
  location: string;
  sinceDays: number;
};

type SearchSummary = {
  results: HostedSearchResult[];
  boardsChecked: number;
  failedBoards: number;
};

type IndexedJob = {
  title?: unknown;
  url?: unknown;
  company?: unknown;
  location?: unknown;
  ats?: unknown;
  first_seen?: unknown;
  scraped_at?: unknown;
};

type IndexedManifest = {
  chunks?: unknown;
  totalJobs?: unknown;
  last_updated?: unknown;
};

type IndexedCandidate = {
  job: IndexedJob;
  matchedTerms: string[];
  postedAt: string;
  score: number;
};

type IndexSummary = {
  results: HostedSearchResult[];
  chunksChecked: number;
  failedChunks: number;
  totalJobs: number;
};

type IndexProgress = {
  checked: number;
  total: number;
  matches: number;
};

type IndexScanOptions = {
  input: SearchInput;
  manifest: IndexResult;
  onProgress: (progress: IndexProgress) => void;
};

type IndexResult = {
  chunks: string[];
  totalJobs: number;
  version: string;
};

const INDEX_BASE = "https://feashliaa.github.io/job-board-data/data/chunks";
const MAX_RESULTS = 120;
const INDEX_CANDIDATE_LIMIT = 1_000;

const COMMUNITY = [
  { id: "allfrum", label: "All Frum Jobs" },
  { id: "yidjob", label: "YidJob" },
  { id: "trefajob", label: "TrefAJob" },
  { id: "luach", label: "Luach" },
] as const;

function decodeEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function visibleText(value: unknown, max = 4_000) {
  return decodeEntities(String(value ?? "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function dateText(value: unknown) {
  const numeric = Number(value);
  const parsed = Number.isFinite(numeric) && numeric > 0
    ? numeric
    : Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
}

async function response(url: string, init: RequestInit = {}, timeout = 18_000) {
  const result = await fetch(url, {
    ...init,
    redirect: "error",
    cache: "no-store",
    headers: {
      Accept: "application/json, application/xml, text/xml, text/html;q=0.9",
      "User-Agent": "Career-Ops-Community/1.0 (+https://career-ops.org)",
      ...init.headers,
    },
    signal: AbortSignal.timeout(timeout),
  });
  if (!result.ok) throw new Error(`HTTP ${result.status}`);
  return result;
}

async function json(url: string, timeout?: number) {
  return response(url, {}, timeout).then((item) => item.json());
}

async function text(url: string, timeout?: number) {
  return response(url, {}, timeout).then((item) => item.text());
}

async function indexedManifest(): Promise<IndexResult> {
  const payload = (await json(`${INDEX_BASE}/jobs_manifest.json`, 20_000)) as IndexedManifest;
  const chunks = Array.isArray(payload.chunks)
    ? payload.chunks.map(String).filter((chunk) => /^jobs_chunk_\d+\.json\.gz$/.test(chunk))
    : [];
  if (!chunks.length) throw new Error("index_manifest_empty");
  return {
    chunks,
    totalJobs: Math.max(0, Number(payload.totalJobs) || 0),
    version: String(payload.last_updated || "current"),
  };
}

async function indexedChunk(chunk: string, version: string): Promise<IndexedJob[]> {
  const url = `${INDEX_BASE}/${chunk}?v=${encodeURIComponent(version)}`;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fetched = await fetch(url, {
        redirect: "error",
        cache: "force-cache",
        headers: {
          Accept: "application/gzip, application/octet-stream",
          "User-Agent": "Career-Ops-Community/1.0 (+https://career-ops.org)",
        },
        signal: AbortSignal.timeout(25_000),
      });
      if (!fetched.ok) throw new Error(`HTTP ${fetched.status}`);
      const packed = Buffer.from(await fetched.arrayBuffer());
      const parsed = JSON.parse(gunzipSync(packed).toString("utf8"));
      return Array.isArray(parsed) ? (parsed as IndexedJob[]) : [];
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("index_chunk_failed");
}

function xmlTag(block: string, tag: string) {
  return visibleText(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block)?.[1],
  );
}

async function allFrumJobs(): Promise<RawJob[]> {
  const xml = await text("https://allfrumjobs.com/rss.xml");
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => ({
    title: xmlTag(match[1], "title"),
    url: xmlTag(match[1], "link"),
    company: "",
    location: "",
    description: xmlTag(match[1], "description"),
    postedAt: xmlTag(match[1], "pubDate"),
  }));
}

async function yidJobs(): Promise<RawJob[]> {
  const query = encodeURIComponent(JSON.stringify({ active: true, is_filled: false }));
  const payload = await json(
    `https://yidjob.com/api/apps/69a9c3b1a58cac8c762496b3/entities/Job?q=${query}&sort=-created_date&limit=100`,
  );
  if (!Array.isArray(payload)) return [];
  return (payload as Array<Record<string, unknown>>).map((job) => ({
    title: job.title,
    url: `https://yidjob.com/JobDetail?id=${encodeURIComponent(String(job.id ?? ""))}`,
    company: job.company_name,
    location: [job.city, job.state, job.zipcode].filter(Boolean).join(", "),
    description: job.description,
    postedAt: job.created_date ?? job.updated_date,
  }));
}

function trefJob(html: string, url: string): RawJob | null {
  const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script[1]);
      const values = Array.isArray(parsed) ? parsed : [parsed];
      const job = values.find((value) => value?.["@type"] === "JobPosting");
      if (!job?.title) continue;
      const locations = (Array.isArray(job.jobLocation) ? job.jobLocation : [job.jobLocation])
        .map((item: Record<string, unknown>) => {
          const address = (item?.address ?? {}) as Record<string, unknown>;
          return [address.addressLocality, address.addressRegion, address.addressCountry]
            .filter(Boolean)
            .join(", ");
        })
        .filter(Boolean)
        .join("; ");
      return {
        title: job.title,
        url,
        company: job.hiringOrganization?.name,
        location: locations,
        description: job.description,
        postedAt: job.datePosted,
      };
    } catch {
      // Ignore malformed third-party structured data.
    }
  }
  return null;
}

async function trefJobs(): Promise<RawJob[]> {
  const sitemap = await text("https://www.trefajob.com/sitemap.xml");
  const urls = [...sitemap.matchAll(/<loc>(https:\/\/www\.trefajob\.com\/jobs\/[a-f0-9-]+)<\/loc>/gi)]
    .map((match) => match[1])
    .slice(0, 30);
  const jobs: RawJob[] = [];
  for (let index = 0; index < urls.length; index += 5) {
    const pageJobs = await Promise.all(
      urls.slice(index, index + 5).map(async (url) => {
        try {
          return trefJob(await text(url), url);
        } catch {
          return null;
        }
      }),
    );
    jobs.push(...pageJobs.filter((job): job is RawJob => Boolean(job)));
  }
  return jobs;
}

function luachPage(html: string): RawJob[] {
  const starts = [...html.matchAll(/<div class="[^"]*listing-container-list[^"]*"[^>]*data-url="([^"]+)"/gi)];
  return starts.map((match, index) => {
    const block = html.slice(match.index, starts[index + 1]?.index ?? html.length);
    const title = visibleText(/listing-title-list[\s\S]*?trunc-1[^>]*>([\s\S]*?)<\/div>/i.exec(block)?.[1]);
    const description = visibleText(/listing-description-container[^>]*>([\s\S]*?)<\/div>/i.exec(block)?.[1]);
    const location = visibleText(/Posted In:\s*([^<]+)/i.exec(block)?.[1]);
    const path = String(match[1] ?? "");
    return {
      title,
      url: new URL(path, "https://luach.com").href,
      company: "",
      location,
      description,
      postedAt: /(\d{2}\/\d{2}\/\d{4})/.exec(block)?.[1],
    };
  });
}

async function luachJobs(): Promise<RawJob[]> {
  const sections = ["full-time-jobs", "part-time-jobs", "freelance-jobs", "one-time-jobs"];
  const pages = await Promise.all(
    sections.map(async (section) => {
      try {
        return luachPage(await text(`https://luach.com/${section}`));
      } catch {
        return [];
      }
    }),
  );
  return pages.flat();
}

function normalizeJob(
  job: RawJob,
  source: string,
  sourceLabel: string,
  input: SearchInput,
): HostedSearchResult | null {
  const title = cleanSearchText(job.title, 180);
  const urlValue = cleanSearchText(job.url, 2_000);
  let url: URL;
  try {
    url = new URL(urlValue);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
      return null;
  } catch {
    return null;
  }
  if (!title) return null;
  const company = cleanSearchText(job.company, 140) || sourceLabel;
  const location = cleanSearchText(job.location, 220);
  const description = visibleText(job.description);
  const queryWords = searchWords(input.query);
  const titleHaystack = title.toLowerCase();
  const matchedTerms = queryWords.filter((word) => titleHaystack.includes(word));
  if (queryWords.length && matchedTerms.length === 0) return null;
  if (!locationMatch(location, input.location).matched) return null;
  const postedAt = dateText(job.postedAt);
  if (
    postedAt &&
    Date.parse(postedAt) < Date.now() - input.sinceDays * 86_400_000
  )
    return null;
  return {
    id: createHash("sha256").update(url.href).digest("hex").slice(0, 20),
    url: url.href,
    company,
    title,
    location,
    source,
    sourceLabel,
    postedAt,
    description,
    matchedTerms,
  };
}

async function parallel<T>(items: T[], concurrency: number, task: (item: T) => Promise<void>) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const item = items[cursor++];
        await task(item);
      }
    }),
  );
}

function indexedCompany(value: unknown) {
  const clean = cleanSearchText(value, 140);
  return clean
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function indexedResult(candidate: IndexedCandidate): HostedSearchResult | null {
  const title = cleanSearchText(candidate.job.title, 180);
  const company = indexedCompany(candidate.job.company) || "Company board";
  const location = cleanSearchText(candidate.job.location, 220);
  const urlValue = cleanSearchText(candidate.job.url, 2_000);
  let url: URL;
  try {
    url = new URL(urlValue);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
  } catch {
    return null;
  }
  const sourceLabel = cleanSearchText(candidate.job.ats, 60) || "Company ATS";
  const source = sourceLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ats";
  return {
    id: createHash("sha256").update(url.href).digest("hex").slice(0, 20),
    url: url.href,
    company,
    title,
    location,
    source,
    sourceLabel,
    postedAt: candidate.postedAt,
    description: "",
    matchedTerms: candidate.matchedTerms,
  };
}

async function scanIndexedJobs({ input, manifest, onProgress }: IndexScanOptions): Promise<IndexSummary> {
  const candidates: IndexedCandidate[] = [];
  let checked = 0;
  let failed = 0;
  await parallel(manifest.chunks, 8, async (chunk) => {
    try {
      const jobs = await indexedChunk(chunk, manifest.version);
      for (const job of jobs) {
        const match = indexedJobMatch(job, input);
        if (match) candidates.push({ job, ...match });
      }
      if (candidates.length > INDEX_CANDIDATE_LIMIT * 2) {
        candidates.sort((a, b) => b.score - a.score || b.postedAt.localeCompare(a.postedAt));
        candidates.length = INDEX_CANDIDATE_LIMIT;
      }
    } catch {
      failed += 1;
    } finally {
      checked += 1;
      onProgress({
        checked,
        total: manifest.chunks.length,
        matches: Math.min(candidates.length, MAX_RESULTS),
      });
    }
  });
  candidates.sort((a, b) => b.score - a.score || b.postedAt.localeCompare(a.postedAt));
  const seen = new Set<string>();
  const results: HostedSearchResult[] = [];
  for (const candidate of candidates) {
    const result = indexedResult(candidate);
    if (!result || seen.has(result.url)) continue;
    seen.add(result.url);
    results.push(result);
    if (results.length >= MAX_RESULTS) break;
  }
  return {
    results,
    chunksChecked: checked,
    failedChunks: failed,
    totalJobs: manifest.totalJobs,
  };
}

export async function runHostedSearch(
  input: SearchInput,
  emit: (event: HostedSearchEvent) => void,
): Promise<SearchSummary> {
  const results: HostedSearchResult[] = [];
  const seen = new Set<string>();
  let boardsChecked = 0;
  let failedBoards = 0;
  const add = (job: RawJob, source: string, sourceLabel: string) => {
    if (results.length >= MAX_RESULTS) return false;
    const result = normalizeJob(job, source, sourceLabel, input);
    if (!result || seen.has(result.url)) return false;
    seen.add(result.url);
    results.push(result);
    emit({ kind: "result", result });
    return true;
  };

  let manifest: IndexResult | null = null;
  try {
    manifest = await indexedManifest();
  } catch {
    // Community sources still provide a useful partial result if the index CDN is down.
  }
  emit({
    kind: "start",
    sources: HOSTED_SEARCH_SOURCES,
    boardCount: (manifest?.chunks.length ?? 0) + COMMUNITY.length,
    aiConfigured: resolveCommunityAiProvider().configured,
    searchedLocation: input.location,
    indexedJobs: manifest?.totalJobs,
  });
  const indexRun = (async () => {
    emit({ kind: "sourceStart", source: "atsindex", boards: manifest?.chunks.length ?? 0 });
    if (!manifest) {
      failedBoards += 1;
      emit({
        kind: "warning",
        source: "atsindex",
        message: "The global ATS index did not answer. Community boards continued.",
      });
      emit({ kind: "sourceDone", source: "atsindex", checked: 0, matches: 0, failed: 1 });
      return;
    }
    const indexed = await scanIndexedJobs({
      input,
      manifest,
      onProgress: ({ checked, total, matches }) =>
        emit({ kind: "sourceProgress", source: "atsindex", checked, total, matches }),
    });
    let matches = 0;
    for (const result of indexed.results) {
      if (results.length >= MAX_RESULTS || seen.has(result.url)) continue;
      seen.add(result.url);
      results.push(result);
      emit({ kind: "result", result });
      matches += 1;
    }
    boardsChecked += indexed.chunksChecked;
    failedBoards += indexed.failedChunks;
    emit({
      kind: "sourceDone",
      source: "atsindex",
      checked: indexed.chunksChecked,
      matches,
      failed: indexed.failedChunks,
    });
  })();

  const communityFetchers = [allFrumJobs, yidJobs, trefJobs, luachJobs];
  const communityRun = Promise.all(
    COMMUNITY.map(async (source, index) => {
      emit({ kind: "sourceStart", source: source.id, boards: 1 });
      let matches = 0;
      let failed = 0;
      try {
        for (const job of await communityFetchers[index]())
          if (add(job, source.id, source.label)) matches += 1;
      } catch {
        failed = 1;
        emit({
          kind: "warning",
          source: source.id,
          message: `${source.label} did not answer this run. The other boards continued.`,
        });
      }
      boardsChecked += 1;
      failedBoards += failed;
      emit({
        kind: "sourceProgress",
        source: source.id,
        checked: 1,
        total: 1,
        matches,
      });
      emit({
        kind: "sourceDone",
        source: source.id,
        checked: 1,
        matches,
        failed,
      });
    }),
  );
  await Promise.all([indexRun, communityRun]);

  results.sort((a, b) => {
    const matchDelta = b.matchedTerms.length - a.matchedTerms.length;
    if (matchDelta) return matchDelta;
    return (b.postedAt || "").localeCompare(a.postedAt || "");
  });
  return { results, boardsChecked, failedBoards };
}
