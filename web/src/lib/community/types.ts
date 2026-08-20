export type CommunityProfile = {
  id: string;
  display_name: string;
  target_roles: string[];
  locations: string[];
  work_modes: string[];
  salary_min: number | null;
  salary_max: number | null;
  include_community_sources: boolean;
  daily_token_limit: number;
};

export type CommunityApplication = {
  id: string;
  user_id: string;
  job_url: string;
  company: string;
  title: string;
  location: string;
  source: string;
  status:
    | "saved"
    | "evaluating"
    | "ready"
    | "applied"
    | "interview"
    | "offer"
    | "rejected"
    | "withdrawn"
    | "skipped";
  score: number | null;
  note: string;
  saved_at: string;
  updated_at: string;
};

export type FitEvaluation = {
  score: number;
  verdict: "strong" | "possible" | "stretch" | "skip";
  headline: string;
  strengths: string[];
  gaps: string[];
  next_step: string;
  caveat: string;
};
