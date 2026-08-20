# Deploy Career Ops Community

The hosted app is the existing Next.js app in `web/`, switched into its cloud-safe experience with one environment variable. Local-first career-ops remains the default for clones.

## 1. Create Supabase

1. Create a Supabase project in the region closest to the primary community.
2. Run `supabase/migrations/202608200001_community.sql` in the SQL editor, or link the CLI and run `supabase db push`.
3. Copy the Project URL and anon/publishable key.
4. In Authentication → URL Configuration, set the Site URL to the production domain and allow:
   - `http://localhost:3000/auth/callback`
   - `https://YOUR_DOMAIN/auth/callback`
   - the Vercel preview callback pattern you intentionally trust
5. Configure custom SMTP before a broad public launch so magic links do not depend on the default development sender.
6. Grant an administrator with server-side admin tooling, never from the browser:

   ```js
   await supabase.auth.admin.updateUserById(userId, {
     app_metadata: { role: "admin" },
   });
   ```

## 2. Configure Vercel

Import the Git repository, set Root Directory to `web`, then add the variables from `web/.env.example`.

Minimum:

```text
NEXT_PUBLIC_CAREER_OPS_MODE=community
NEXT_PUBLIC_SITE_URL=https://YOUR_DOMAIN
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OPENAI_API_KEY=...
```

Keep `OPENAI_API_KEY` server-only. Do not create a `NEXT_PUBLIC_` variant.

Recommended budget baseline:

```text
OPENAI_MODEL=gpt-5.6-luna
COMMUNITY_MAX_OUTPUT_TOKENS=700
NEXT_PUBLIC_COMMUNITY_DAILY_TOKEN_LIMIT=20000
OPENAI_INPUT_USD_PER_MTOK=0.20
OPENAI_OUTPUT_USD_PER_MTOK=1.20
```

The authoritative per-member limit lives in `profiles.daily_token_limit`, initialized to 20,000 by the migration. The public variable controls display fallback only.

## 3. Verify before invitations

From `web/`:

```bash
npm ci
npm test
npm run typecheck
NEXT_PUBLIC_CAREER_OPS_MODE=community npm run build
```

Then verify in production:

1. Magic-link sign-in returns to `/community`.
2. Profile and tracker rows are invisible between two test users.
3. A fit check creates one completed `usage_events` row without document text.
4. Lower a test member's limit and confirm the route returns HTTP 429 before an API call.
5. Admin aggregates work only after the admin claim is present in a newly refreshed session.
6. Sign out, mobile navigation, keyboard focus, light/dark themes, and external-source links work.

## 4. Nonprofit operations

- Set an OpenAI project monthly budget as a final backstop in addition to application quotas.
- Review aggregate usage weekly; do not add prompt logging for convenience.
- Rotate server secrets and use separate Supabase/OpenAI projects for preview and production.
- Publish a privacy notice, terms, contact route, and data-deletion process before a broad launch.
- Get written permission before ingesting or republishing a partner board's listings. Curated outbound links need no database copy.
- Keep application submission user-controlled.

## Rollback

Vercel can promote the previous deployment immediately. The migration is additive; rolling back the UI does not require dropping tables. Do not delete production tables as part of an application rollback.
