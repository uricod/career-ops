export type CommunityJobSource = {
  id: string;
  name: string;
  url: string;
  description: string;
  coverage: string;
  tags: string[];
  kind: "frum" | "jewish" | "orthodox" | "israel";
  verifiedOn: string;
};

// Curated links only. We do not scrape or republish listings without a documented
// API/feed or explicit partner permission. Each application stays on its source.
export const COMMUNITY_JOB_SOURCES: CommunityJobSource[] = [
  {
    id: "all-frum-jobs",
    name: "All Frum Jobs",
    url: "https://allfrumjobs.com/",
    description:
      "A high-coverage search across Frum-focused sources, with remote and ZIP-radius filters.",
    coverage: "US, Israel & remote",
    tags: ["Aggregator", "Remote", "Community"],
    kind: "frum",
    verifiedOn: "2026-08-20",
  },
  {
    id: "yidjob",
    name: "YidJob",
    url: "https://yidjob.com/",
    description:
      "Roles from businesses that accommodate the cultural needs of Orthodox Jewish candidates.",
    coverage: "US & remote",
    tags: ["Frum-friendly", "Business", "Alerts"],
    kind: "orthodox",
    verifiedOn: "2026-08-20",
  },
  {
    id: "trefajob",
    name: "TrefAJob",
    url: "https://www.trefajob.com/",
    description:
      "A Frum American platform with practical schedule, location, and work-mode filters.",
    coverage: "NY/NJ & US",
    tags: ["Frum", "Verified listings", "Schedule filters"],
    kind: "frum",
    verifiedOn: "2026-08-20",
  },
  {
    id: "luach",
    name: "Luach.com Jobs",
    url: "https://luach.com/full-time-jobs",
    description:
      "Long-running Jewish community classifieds with full-time, part-time, freelance, and one-time jobs.",
    coverage: "NY/NJ & US",
    tags: ["Classifieds", "Local", "Flexible work"],
    kind: "jewish",
    verifiedOn: "2026-08-20",
  },
  {
    id: "jewishjobs",
    name: "JewishJobs.com",
    url: "https://www.jewishjobs.com/search/Default.aspx",
    description:
      "A large clearinghouse for nonprofit Jewish communal, education, synagogue, and leadership roles.",
    coverage: "US & international",
    tags: ["Nonprofit", "Education", "Communal"],
    kind: "jewish",
    verifiedOn: "2026-08-20",
  },
  {
    id: "jewishjob",
    name: "JewishJob.com",
    url: "https://www.jewishjob.com/jobs/",
    description:
      "Jewish education and nonprofit opportunities with location, salary, and remote discovery.",
    coverage: "US, Canada & remote",
    tags: ["Nonprofit", "Schools", "Salary filters"],
    kind: "jewish",
    verifiedOn: "2026-08-20",
  },
  {
    id: "ou-careers",
    name: "Orthodox Union Careers",
    url: "https://careers.ou.org/",
    description:
      "Direct openings across OU programs, education, community services, operations, and technology.",
    coverage: "US & Canada",
    tags: ["Orthodox", "Direct employer", "Nonprofit"],
    kind: "orthodox",
    verifiedOn: "2026-08-20",
  },
  {
    id: "jcareers",
    name: "JCareers",
    url: "https://jcareers.org/",
    description:
      "Jewish communal leadership, education, engagement, and nonprofit opportunities.",
    coverage: "US & international",
    tags: ["Communal", "Education", "Leadership"],
    kind: "jewish",
    verifiedOn: "2026-08-20",
  },
  {
    id: "nbn",
    name: "Nefesh B’Nefesh Job Board",
    url: "https://www.nbn.org.il/jobboard/",
    description:
      "A broad Israel job board plus employment resources for Olim and English-speaking professionals.",
    coverage: "Israel",
    tags: ["Israel", "Olim", "1,000+ roles"],
    kind: "israel",
    verifiedOn: "2026-08-20",
  },
];

export function sourceSearchUrl(source: CommunityJobSource, query: string) {
  const q = query.trim();
  if (!q) return source.url;
  const site = new URL(source.url).hostname.replace(/^www\./, "");
  return `https://www.google.com/search?q=${encodeURIComponent(`site:${site} ${q}`)}`;
}
