// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Orthodox/Frum community job-board provider. Each supported source is selected
// explicitly with `provider: frumjobs` and `board: <id>` in job_boards. The
// normalized posting URL always points to the source or original employer page,
// so the existing evaluation/application pipeline can process it normally.

import { BROWSER_LIKE_USER_AGENT } from "./_http.mjs";
import { decodeEntities } from "./_html-entities.mjs";

const ALLFRUM_RSS = "https://allfrumjobs.com/rss.xml";
const YIDJOB_API =
  "https://yidjob.com/api/apps/69a9c3b1a58cac8c762496b3/entities/Job";
const TREFAJOB_SITEMAP = "https://www.trefajob.com/sitemap.xml";
const LUACH_ORIGIN = "https://luach.com";
const SUPPORTED = new Set(["allfrum", "yidjob", "trefajob", "luach"]);

/** @param {unknown} value */
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** @param {unknown} value */
function visibleText(value) {
  return decodeEntities(text(value).replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** @param {unknown} value */
function epoch(value) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** @param {unknown} value @param {string} fallback */
function safeJobUrl(value, fallback) {
  for (const candidate of [text(value), fallback]) {
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "https:" || parsed.protocol === "http:")
        return parsed.href;
    } catch {
      // Try the trusted fallback below.
    }
  }
  return "";
}

/** @param {string} block @param {string} tag */
function xmlTag(block, tag) {
  const match = new RegExp(
    `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,
    "i",
  ).exec(block);
  return visibleText(match?.[1]?.replace(/^<!\[CDATA\[|\]\]>$/g, "") || "");
}

/** @param {string} xml */
export function parseAllFrumRss(xml) {
  return [...String(xml || "").matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .map((match) => ({
      title: xmlTag(match[1], "title"),
      url: safeJobUrl(xmlTag(match[1], "link"), ""),
      company: "",
      location: "",
      description: xmlTag(match[1], "description"),
      postedAt: epoch(xmlTag(match[1], "pubDate")),
    }))
    .filter((job) => job.title && job.url);
}

/** @param {any} json */
export function parseYidJob(json) {
  if (!Array.isArray(json)) return [];
  return json
    .filter(
      (job) =>
        job &&
        job.active !== false &&
        job.is_filled !== true &&
        text(job.title),
    )
    .map((job) => ({
      title: text(job.title),
      url: `https://yidjob.com/JobDetail?id=${encodeURIComponent(String(job.id))}`,
      company: text(job.company_name),
      location: [text(job.city), text(job.state), text(job.zipcode)]
        .filter(Boolean)
        .join(", "),
      description: visibleText(job.description),
      postedAt: epoch(job.created_date || job.updated_date),
      salary: text(job.salary_display || job.salary_range || job.compensation),
    }));
}

/** @param {string} xml */
export function parseTrefSitemap(xml) {
  return [
    ...String(xml || "").matchAll(
      /<loc>(https:\/\/www\.trefajob\.com\/jobs\/[a-f0-9-]+)<\/loc>/gi,
    ),
  ].map((match) => match[1]);
}

/** @param {string} html @param {string} url */
export function parseTrefJobPage(html, url) {
  const source = String(html || "");
  if (/Job not found\s*\|\s*TrefAJob/i.test(source)) return null;
  const scripts = [
    ...source.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];
  for (const script of scripts) {
    try {
      const data = JSON.parse(script[1]);
      const values = Array.isArray(data) ? data : [data];
      const job = values.find((value) => value?.["@type"] === "JobPosting");
      if (!job || !text(job.title)) continue;
      const locations = Array.isArray(job.jobLocation)
        ? job.jobLocation
        : [job.jobLocation];
      const location = locations
        .map((item) => {
          const address = item?.address || {};
          return [
            text(address.addressLocality),
            text(address.addressRegion),
            text(address.addressCountry),
          ]
            .filter(Boolean)
            .join(", ");
        })
        .filter(Boolean)
        .join("; ");
      return {
        title: text(job.title),
        url,
        company: text(job.hiringOrganization?.name),
        location,
        description: visibleText(job.description),
        postedAt: epoch(job.datePosted),
        salary: text(job.baseSalary?.value?.value || job.baseSalary?.value),
      };
    } catch {
      // Ignore non-JSON structured-data blocks and continue looking.
    }
  }
  return null;
}

/** @param {string} html */
export function parseLuach(html) {
  const source = String(html || "");
  const starts = [
    ...source.matchAll(
      /<div class="[^"]*listing-container-list[^"]*"[^>]*data-url="([^"]+)"/gi,
    ),
  ];
  return starts
    .map((match, index) => {
      const block = source.slice(
        match.index,
        starts[index + 1]?.index ?? source.length,
      );
      const title = visibleText(
        /listing-title-list[\s\S]*?trunc-1[^>]*>([\s\S]*?)<\/div>/i.exec(
          block,
        )?.[1],
      );
      const description = visibleText(
        /listing-description-container[^>]*>([\s\S]*?)<\/div>/i.exec(
          block,
        )?.[1],
      );
      const location =
        visibleText(/Posted In:\s*([^<]+)/i.exec(block)?.[1]) ||
        (/all-loc-tag/i.test(block) ? "All Locations" : "");
      const date = /(\d{2}\/\d{2}\/\d{4})/.exec(block)?.[1];
      return {
        title,
        url: safeJobUrl(
          new URL(match[1], LUACH_ORIGIN).href,
          `${LUACH_ORIGIN}/full-time-jobs`,
        ),
        company: "",
        location,
        description,
        postedAt: epoch(date),
      };
    })
    .filter((job) => job.title && job.url);
}

/** @param {number} value @param {number} fallback @param {number} cap */
function bounded(value, fallback, cap) {
  return Number.isInteger(value) && value > 0 ? Math.min(value, cap) : fallback;
}

/** @type {Provider} */
export default {
  id: "frumjobs",

  detect(entry) {
    return entry?.provider === "frumjobs" && SUPPORTED.has(entry?.board)
      ? { url: entry.careers_url || entry.api || entry.board }
      : null;
  },

  async fetch(entry, ctx) {
    const board = text(entry?.board).toLowerCase();
    if (!SUPPORTED.has(board)) {
      throw new Error(`frumjobs: unsupported board ${JSON.stringify(board)}`);
    }
    const headers = { "User-Agent": BROWSER_LIKE_USER_AGENT };
    const opts = { headers, redirect: "error" };

    if (board === "allfrum") {
      const xml = await ctx.fetchText(ALLFRUM_RSS, opts);
      return parseAllFrumRss(xml);
    }

    if (board === "yidjob") {
      const query = encodeURIComponent(
        JSON.stringify({ active: true, is_filled: false }),
      );
      const json = await ctx.fetchJson(
        `${YIDJOB_API}?q=${query}&sort=-created_date&limit=100`,
        opts,
      );
      if (!Array.isArray(json))
        throw new Error("frumjobs/yidjob: expected a JSON array");
      return parseYidJob(json);
    }

    if (board === "trefajob") {
      // TrefAJob's robots.txt disallows /api/. Its public sitemap and /jobs/*
      // pages are allowed, so this provider deliberately uses only those.
      const sitemap = await ctx.fetchText(TREFAJOB_SITEMAP, opts);
      const urls = parseTrefSitemap(sitemap).slice(
        0,
        bounded(entry?.max_jobs, 100, 500),
      );
      const jobs = [];
      for (const url of urls) {
        const html = await ctx.fetchText(url, opts);
        const parsed = parseTrefJobPage(html, url);
        if (parsed) jobs.push(parsed);
      }
      return jobs;
    }

    const sections =
      Array.isArray(entry?.sections) && entry.sections.length
        ? entry.sections.filter((section) => /^[a-z-]+$/.test(section))
        : ["full-time-jobs"];
    const maxPages = Math.min(
      bounded(entry?.max_pages, 2, 10),
      bounded(ctx?.maxPages, 10, 10),
    );
    const jobs = [];
    const seen = new Set();
    for (const section of sections) {
      for (let page = 1; page <= maxPages; page++) {
        const suffix = page === 1 ? "" : `?page=${page}`;
        const html = await ctx.fetchText(
          `${LUACH_ORIGIN}/${section}${suffix}`,
          opts,
        );
        const parsed = parseLuach(html);
        if (!parsed.length) break;
        let added = 0;
        for (const job of parsed) {
          if (seen.has(job.url)) continue;
          seen.add(job.url);
          jobs.push(job);
          added++;
        }
        if (!added) break;
      }
    }
    return jobs;
  },
};
