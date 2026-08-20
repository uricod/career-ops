# Career Ops Community — nonprofit cloud product spec

Status: implementation baseline
Product mode: `NEXT_PUBLIC_CAREER_OPS_MODE=community`
Deployment: Vercel (`web/`) + Supabase Auth/Postgres

## Mission

Give job seekers a free, calm, privacy-respecting place to discover roles, assess fit, and keep a small application pipeline. Community mode is a public benefit layer over career-ops; it does not replace or weaken the existing local-first CLI.

The service optimizes for a small number of good applications. It never submits an application, never invents candidate facts, and never classifies a person or employer by religion. Orthodox/Frum job sources are an explicit, user-selected source collection.

## Product promise

1. Find useful roles from mainstream ATS boards and community-focused job boards.
2. Get a concise, source-grounded fit check before spending time applying.
3. Save only the minimum pipeline metadata needed to stay organized.
4. Show every user their daily AI allowance and actual token use.
5. Keep the service free through hard, fair, database-enforced limits.

## Primary journeys

### Visitor

- Understand the nonprofit mission and privacy model.
- Browse the verified job-source directory without an account.
- Open every source on its original site; Career Ops never impersonates the source.

### Member

- Sign in with an email magic link.
- Set role, location, work-mode, salary, and community-source preferences.
- Keep resume text in the browser unless they intentionally send it for one analysis.
- Save a job with title, company, URL, source, status, and optional private notes.
- Run a fit check; the request is not stored and OpenAI persistence is disabled.
- See token usage and remaining daily allowance.
- Export or delete their records.

### Nonprofit administrator

- See aggregate users, requests, tokens, and estimated cost only.
- Change a member's daily limit within the organization ceiling.
- Suspend abusive access without reading resumes, job descriptions, or AI output.
- Maintain the source directory and publish service notices.

## Data minimization

Stored:

- Supabase Auth identity and email.
- Profile preferences: display name, role/location/work-mode targets, optional salary range, and selected source groups.
- Saved-job/application metadata: company, title, canonical URL, source, status, dates, and an optional short user note.
- AI telemetry: user, operation, model, input/output/total token counts, estimated cost, status, timestamps, and opaque request ID.
- Daily usage bucket: used and temporarily reserved tokens.

Not stored:

- Resume/CV text.
- Full job descriptions.
- Prompts, model outputs, cover letters, or application answers.
- Religious identity or observance.
- Browsing history outside explicitly saved job URLs.

The hosted AI route sends user-supplied CV/JD text to the model for the current request only with `store: false`. Application submission remains a human action on the employer's site.

## Architecture

```text
Browser
  ├─ public source directory (no login)
  ├─ Supabase Auth session (httpOnly cookie via SSR helper)
  ├─ profile + saved jobs (RLS-scoped CRUD)
  └─ transient fit-check request
       └─ Vercel route
            ├─ validates auth and input size
            ├─ atomically reserves daily token budget in Postgres
            ├─ calls OpenAI Responses API (`store: false`, capped output)
            └─ finalizes token counters; never stores request/output text

Supabase
  ├─ profiles
  ├─ applications
  ├─ usage_buckets
  ├─ usage_events
  └─ Postgres functions for atomic reserve/finalize/release
```

Local mode continues to use markdown/files and CLI workers. Community mode uses only cloud-safe modules and routes.

## Budget controls

- Default allowance: `COMMUNITY_DAILY_TOKEN_LIMIT` (recommended 20,000 tokens/member/day).
- Per-request reservation: conservative input estimate plus `COMMUNITY_MAX_OUTPUT_TOKENS`.
- Database transaction locks one `(user, UTC day)` bucket before granting a reservation.
- A request cannot begin if `used + reserved + requested` exceeds the effective limit.
- Completion replaces the reservation with actual API usage; failure releases it.
- Request body limits prevent very large CV/JD payloads.
- Admin aggregate views contain no prompt content.
- Vercel/platform rate limits and Supabase Auth rate limits remain a second layer, not the quota source of truth.

## Community job sources

Initial verified directory:

- All Frum Jobs — aggregator/source index for Frum-focused listings.
- YidJob — roles from employers accommodating Orthodox Jewish cultural needs.
- TrefAJob — Frum American jobs with schedule/location filters.
- Luach.com Jobs — community classifieds and employment listings.
- JewishJobs.com — nonprofit Jewish communal roles.
- JewishJob.com — Jewish education and nonprofit roles.
- Orthodox Union Careers — direct OU opportunities.
- JCareers — Jewish communal and education roles.
- Nefesh B'Nefesh Job Board — Israel jobs and Olim-focused employment support.

Source entries are curated links, not copied listings. Before any future ingestion, obtain permission or use a documented public API/RSS feed, respect robots/terms, preserve attribution, and link to the original application.

## Security and abuse controls

- Row Level Security on every user table.
- Service-role key is server-only and not required by normal member flows.
- Security-definer quota functions use an empty `search_path`, schema-qualified references, explicit grants, and authenticated identity checks.
- Admin access derives from a private `app_metadata.role=admin` claim or an explicit server allowlist; members cannot self-promote.
- No HTML from a job description is rendered; output is structured JSON and React-escaped.
- URL validation permits only `http`/`https` saved jobs.
- CSP/security headers, frame denial, referrer policy, and permissions policy are set by Next.js.
- Delete-account workflow removes profile/application/usage records through FK cascades; Auth-user deletion is an admin/server action.

## Accessibility and UX bar

- WCAG AA contrast, keyboard-visible focus, semantic form labels, 44px mobile targets.
- Responsive sidebar/compact mobile navigation.
- Reduced-motion support.
- Plain-language budget meter: tokens used, percentage, and UTC reset.
- Empty/error/loading states always explain the next action.
- Community-source language is inclusive and opt-in.

## Environments

Required in hosted mode:

- `NEXT_PUBLIC_CAREER_OPS_MODE=community`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`

Recommended:

- `OPENAI_MODEL`
- `COMMUNITY_DAILY_TOKEN_LIMIT`
- `COMMUNITY_MAX_OUTPUT_TOKENS`
- `COMMUNITY_ADMIN_EMAILS`
- `NEXT_PUBLIC_SITE_URL`

Run `supabase/migrations/202608200001_community.sql`, add the production and preview callback URLs in Supabase Auth, set Vercel's Root Directory to `web`, then deploy.

## Definition of done

- Local career-ops builds and tests still pass.
- Community mode builds with and without configured cloud credentials.
- Public source directory works without auth.
- Magic-link auth, RLS profile/application CRUD, fit evaluation, usage display, and quota denial work against Supabase.
- No CV/JD/output text appears in database telemetry or logs.
- A clean Vercel build succeeds from `web/`.
- Admin aggregate page reveals no member content.

## Deliberate follow-ons

- Partner-approved RSS/API ingestion with source-specific adapters.
- Community organization sponsorships and pooled monthly budgets.
- Multilingual UI and RTL QA.
- Accessible PDF generation in an isolated worker.
- Data-export and self-service Auth-account deletion endpoints.
- Observability with content-free structured events and retention limits.
