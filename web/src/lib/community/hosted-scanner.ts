import "server-only";
import { createHash } from "node:crypto";
import {
  cleanSearchText,
  HOSTED_SEARCH_SOURCES,
  type HostedSearchEvent,
  type HostedSearchResult,
} from "./job-search";
import { resolveCommunityAiProvider } from "./ai-provider.mjs";

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

type AtsConfig = {
  id: "greenhouse" | "lever" | "ashby";
  label: string;
  dataset: string;
  sample: number;
};

const DATASET_BASE =
  "https://raw.githubusercontent.com/Feashliaa/job-board-aggregator/main/data";
const SLUG = /^[A-Za-z0-9._-]{1,100}$/;
const MAX_RESULTS = 120;
const ATS: AtsConfig[] = [
  {
    id: "greenhouse",
    label: "Greenhouse",
    dataset: `${DATASET_BASE}/greenhouse_companies.json`,
    sample: 24,
  },
  {
    id: "lever",
    label: "Lever",
    dataset: `${DATASET_BASE}/lever_companies.json`,
    sample: 24,
  },
  {
    id: "ashby",
    label: "Ashby",
    dataset: `${DATASET_BASE}/ashby_companies.json`,
    sample: 12,
  },
];

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

function stableSample(values: string[], count: number, seed: string) {
  const clean = [...new Set(values.filter((value) => SLUG.test(value)))];
  if (clean.length <= count) return clean;
  const digest = createHash("sha256").update(seed).digest();
  const start = digest.readUInt32BE(0) % clean.length;
  const stride = Math.max(1, Math.floor(clean.length / count));
  const picked: string[] = [];
  for (let index = 0; index < count; index += 1)
    picked.push(clean[(start + index * stride) % clean.length]);
  return [...new Set(picked)];
}

function companyName(slug: string) {
  return slug
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function atsUrl(source: AtsConfig["id"], slug: string) {
  if (source === "greenhouse")
    return `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
  if (source === "lever")
    return `https://api.lever.co/v0/postings/${slug}?mode=json`;
  return `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`;
}

async function atsJobs(source: AtsConfig["id"], slug: string): Promise<RawJob[]> {
  const payload = (await json(atsUrl(source, slug), source === "ashby" ? 35_000 : 18_000)) as Record<string, unknown> | unknown[];
  if (source === "greenhouse") {
    const jobs = Array.isArray((payload as Record<string, unknown>).jobs)
      ? ((payload as Record<string, unknown>).jobs as Array<Record<string, unknown>>)
      : [];
    return jobs.map((job) => ({
      title: job.title,
      url: job.absolute_url,
      company: companyName(slug),
      location: (job.location as Record<string, unknown> | undefined)?.name,
      description: job.content,
      postedAt: job.first_published ?? job.updated_at,
    }));
  }
  if (source === "lever") {
    const jobs = Array.isArray(payload) ? (payload as Array<Record<string, unknown>>) : [];
    return jobs.map((job) => ({
      title: job.text,
      url: job.hostedUrl,
      company: companyName(slug),
      location: (job.categories as Record<string, unknown> | undefined)?.location,
      description: job.descriptionPlain,
      postedAt: job.createdAt,
    }));
  }
  const jobs = Array.isArray((payload as Record<string, unknown>).jobs)
    ? ((payload as Record<string, unknown>).jobs as Array<Record<string, unknown>>)
    : [];
  return jobs.map((job) => ({
    title: job.title,
    url: job.jobUrl,
    company: companyName(slug),
    location: job.location,
    description: job.descriptionPlain ?? job.descriptionHtml ?? job.description,
    postedAt: job.publishedAt,
  }));
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

function words(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((word) => word.length > 1)
    .slice(0, 12);
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
  const queryWords = words(input.query);
  const locationWords = words(input.location);
  const titleHaystack = `${title} ${description.slice(0, 500)}`.toLowerCase();
  const locationHaystack = location.toLowerCase();
  const matchedTerms = queryWords.filter((word) => titleHaystack.includes(word));
  if (queryWords.length && matchedTerms.length === 0) return null;
  if (
    locationWords.length &&
    !locationWords.some((word) => locationHaystack.includes(word)) &&
    !/remote|anywhere|all locations/i.test(locationHaystack)
  )
    return null;
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

  emit({
    kind: "start",
    sources: HOSTED_SEARCH_SOURCES,
    boardCount: ATS.reduce((sum, config) => sum + config.sample, 0) + COMMUNITY.length,
    aiConfigured: resolveCommunityAiProvider().configured,
  });
  const atsLists = await Promise.all(
    ATS.map(async (config) => {
      try {
        const payload = await json(config.dataset);
        const list = Array.isArray(payload) ? payload.map(String) : [];
        return stableSample(list, config.sample, `${input.query}|${input.location}|${config.id}`);
      } catch {
        return [];
      }
    }),
  );
  const atsRun = Promise.all(
    ATS.map(async (config, configIndex) => {
      const slugs = atsLists[configIndex];
      let checked = 0;
      let failed = 0;
      let matches = 0;
      emit({ kind: "sourceStart", source: config.id, boards: slugs.length });
      await parallel(slugs, 6, async (slug) => {
        try {
          for (const job of await atsJobs(config.id, slug))
            if (add(job, config.id, config.label)) matches += 1;
        } catch {
          failed += 1;
        } finally {
          checked += 1;
          emit({
            kind: "sourceProgress",
            source: config.id,
            checked,
            total: slugs.length,
            matches,
          });
        }
      });
      boardsChecked += checked;
      failedBoards += failed;
      emit({ kind: "sourceDone", source: config.id, checked, matches, failed });
    }),
  );

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
  await Promise.all([atsRun, communityRun]);

  results.sort((a, b) => {
    const matchDelta = b.matchedTerms.length - a.matchedTerms.length;
    if (matchDelta) return matchDelta;
    return (b.postedAt || "").localeCompare(a.postedAt || "");
  });
  return { results, boardsChecked, failedBoards };
}
