import { pass, fail, ROOT } from "../helpers.mjs";
import { join } from "path";
import { pathToFileURL } from "url";

console.log("\nProvider — Orthodox/Frum community boards");

try {
  const module = await import(
    pathToFileURL(join(ROOT, "providers/frumjobs.mjs")).href
  );
  const provider = module.default;

  if (provider.id === "frumjobs") pass("provider id is frumjobs");
  else fail(`provider id was ${JSON.stringify(provider.id)}`);

  const allFrum = module.parseAllFrumRss(`<rss><channel><item>
    <title>Operations Manager</title>
    <link>https://allfrumjobs.com/jobs/42/operations-manager</link>
    <description>Own operations and systems.</description>
    <pubDate>Thu, 20 Aug 2026 00:00:00 GMT</pubDate>
  </item></channel></rss>`);
  if (
    allFrum.length === 1 &&
    allFrum[0].url === "https://allfrumjobs.com/jobs/42/operations-manager" &&
    allFrum[0].description === "Own operations and systems." &&
    Number.isFinite(allFrum[0].postedAt)
  ) {
    pass("AllFrumJobs documented RSS rows normalize to canonical job URLs");
  } else fail(`AllFrumJobs parse mismatch: ${JSON.stringify(allFrum)}`);

  const yid = module.parseYidJob([
    {
      id: "abc",
      title: "Developer",
      active: true,
      is_filled: false,
      city: "Monsey",
      state: "NY",
      description: "<p>Build tools &amp; systems</p>",
    },
  ]);
  if (
    yid.length === 1 &&
    yid[0].url === "https://yidjob.com/JobDetail?id=abc" &&
    yid[0].description === "Build tools & systems" &&
    yid[0].location === "Monsey, NY"
  ) {
    pass("YidJob rows normalize detail URL, text and location");
  } else fail(`YidJob parse mismatch: ${JSON.stringify(yid)}`);

  const trefUrl =
    "https://www.trefajob.com/jobs/60787ff9-e00c-4f16-9318-254ce95bdee6";
  const tref = module.parseTrefJobPage(
    `<script type="application/ld+json">${JSON.stringify({
      "@type": "JobPosting",
      title: "Bookkeeper",
      datePosted: "2026-08-20",
      hiringOrganization: { name: "Acme" },
      jobLocation: {
        address: { addressLocality: "Lakewood", addressRegion: "NJ" },
      },
    })}</script>`,
    trefUrl,
  );
  if (
    tref?.url === trefUrl &&
    tref.company === "Acme" &&
    tref.location === "Lakewood, NJ"
  ) {
    pass("TrefAJob uses allowed sitemap/detail pages and JobPosting data");
  } else fail(`TrefAJob parse mismatch: ${JSON.stringify(tref)}`);

  const luachHtml = `
    <div class="listing-container-list listing-slug" data-url="/full-time-jobs/ops-manager">
      <div class="listing-title-list"><div class="trunc-1">Operations &amp; Systems Manager</div></div>
      <div class="listing-description-container trunc-3">Own systems and delivery.</div>
      <div>Posted In: Brooklyn, New York</div><span>08/20/2026</span>
    </div>`;
  const luach = module.parseLuach(luachHtml);
  if (
    luach.length === 1 &&
    luach[0].title === "Operations & Systems Manager" &&
    luach[0].url === "https://luach.com/full-time-jobs/ops-manager" &&
    luach[0].location === "Brooklyn, New York"
  ) {
    pass("Luach server-rendered rows normalize without copying contact data");
  } else fail(`Luach parse mismatch: ${JSON.stringify(luach)}`);

  const calls = [];
  const fetched = await provider.fetch(
    { provider: "frumjobs", board: "allfrum" },
    {
      fetchText: async (url, opts) => {
        calls.push({ url, opts });
        return "<rss><channel><item><title>Role</title><link>https://allfrumjobs.com/jobs/1/role</link></item></channel></rss>";
      },
    },
  );
  if (
    fetched.length === 1 &&
    calls.length === 1 &&
    calls[0].url === "https://allfrumjobs.com/rss.xml" &&
    calls.every((call) => call.opts.redirect === "error")
  ) {
    pass("AllFrumJobs uses its documented RSS feed and refuses redirects");
  } else
    fail(
      `AllFrumJobs fetch contract mismatch: ${JSON.stringify({ fetched, calls })}`,
    );

  if (
    provider.detect({ provider: "frumjobs", board: "yidjob" }) &&
    !provider.detect({ provider: "frumjobs", board: "unknown" })
  ) {
    pass("provider resolves only the four explicit community board ids");
  } else fail("provider detection accepted an unsupported board");
} catch (error) {
  fail(`frumjobs provider tests crashed: ${error.message}`);
}
