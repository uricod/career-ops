export type HostedSearchResult = {
  id: string;
  url: string;
  company: string;
  title: string;
  location: string;
  source: string;
  sourceLabel: string;
  postedAt: string;
  description: string;
  matchedTerms: string[];
};

export type HostedSearchSource = {
  id: string;
  label: string;
  detail: string;
};

export const HOSTED_SEARCH_SOURCES: HostedSearchSource[] = [
  {
    id: "atsindex",
    label: "Global ATS index",
    detail: "20,000+ public company boards",
  },
  { id: "allfrum", label: "All Frum Jobs", detail: "community board" },
  { id: "yidjob", label: "YidJob", detail: "community board" },
  { id: "trefajob", label: "TrefAJob", detail: "community board" },
  { id: "luach", label: "Luach", detail: "community board" },
];

export type HostedSearchEvent =
  | {
      kind: "start";
      sources: HostedSearchSource[];
      boardCount: number;
      aiConfigured: boolean;
      aiProvider: string;
      searchedLocation?: string;
      indexedJobs?: number;
    }
  | { kind: "sourceStart"; source: string; boards: number }
  | {
      kind: "sourceProgress";
      source: string;
      checked: number;
      total: number;
      matches: number;
    }
  | {
      kind: "sourceDone";
      source: string;
      checked: number;
      matches: number;
      failed: number;
    }
  | { kind: "result"; result: HostedSearchResult }
  | { kind: "warning"; source: string; message: string }
  | {
      kind: "done";
      resultCount: number;
      boardsChecked: number;
      failedBoards: number;
      tokens: 0;
    };

export type RankedSearchResult = {
  id: string;
  score: number;
  reason: string;
};

export function cleanSearchText(value: unknown, max = 120) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
