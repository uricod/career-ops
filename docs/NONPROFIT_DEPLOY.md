# Deploy Career Ops Community

The hosted app is the existing Next.js app in `web/`, switched into its cloud-safe experience with one environment variable. Local-first career-ops remains the default for clones.

## 1. Create Supabase

1. Create a Supabase project in the region closest to the primary community.
2. Run all migrations in order, or link the CLI and run `supabase db push`:
   - `supabase/migrations/202608200001_community.sql`
   - `supabase/migrations/202608210001_invite_only.sql`
   - `supabase/migrations/202608210002_security_hardening.sql`
3. Copy the Project URL, publishable key, and a dedicated backend secret key.
4. In Authentication → URL Configuration, set the Site URL to the production domain and allow:
   - `http://localhost:3000/auth/callback`
   - `https://YOUR_DOMAIN/auth/callback`
   - the Vercel preview callback pattern you intentionally trust
5. In Authentication settings, turn the global **Allow new users to sign up** option off, but keep the **Email** provider enabled. The app pre-creates invited users through its server-only admin route, then Email provides passwordless sign-in for those existing users; public account creation remains disabled globally.
6. Configure custom SMTP before a broad public launch so magic links do not depend on the default development sender.
7. Create the first Auth user in the Supabase dashboard, then grant the administrator claim with server-side admin tooling and set that profile active. Never expose the secret/service-role key in the browser:

   ```js
   await supabase.auth.admin.updateUserById(userId, {
     app_metadata: { role: "admin", invited: true },
   });
   await supabase.from("profiles").update({
     membership_status: "active",
   }).eq("id", userId);
   ```

## 2. Configure Vercel

Import the Git repository, set Root Directory to `web`, then add the variables from `web/.env.example`.

Minimum:

```text
NEXT_PUBLIC_CAREER_OPS_MODE=community
NEXT_PUBLIC_SITE_URL=https://YOUR_DOMAIN
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
COMMUNITY_RATE_LIMIT_SECRET=...
OPENAI_API_KEY=...
```

Keep `OPENAI_API_KEY`, `SUPABASE_SECRET_KEY`, and `COMMUNITY_RATE_LIMIT_SECRET` server-only. Do not create `NEXT_PUBLIC_` variants. The legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` names remain supported during migration, but new Supabase publishable/secret keys are preferred.

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

1. `/`, `/login`, and the invitation request endpoint are the only public Community surfaces.
2. `/community`, `/community/jobs`, and protected APIs redirect or return 401/403 without an active invitation.
3. Create an invitation in `/community/admin`, copy its private link, and confirm that only the bound email can redeem it.
4. Confirm the same invitation cannot be redeemed twice and that revoke/suspend take effect immediately.
5. Profile and tracker rows are invisible between two test users **and** to an authenticated user who has not redeemed an invitation.
6. A fit check creates one completed `usage_events` row without document text.
7. Lower a test member's limit and confirm the route returns HTTP 429 before an API call.
8. Sign out, mobile navigation, keyboard focus, light/dark themes, and original-source links work.
9. Repeated invalid sign-in requests return HTTP 429, cross-origin POST requests return HTTP 403, and invitation/admin responses carry `Cache-Control: no-store`.

## 4. Nonprofit operations

- Set an OpenAI project monthly budget as a final backstop in addition to application quotas.
- Review aggregate usage weekly; do not add prompt logging for convenience.
- Rotate server secrets and use separate Supabase/OpenAI projects for preview and production.
- Publish a privacy notice, terms, contact route, and data-deletion process before a broad launch.
- Get written permission before ingesting or republishing a partner board's listings. Curated outbound links need no database copy.
- Keep application submission user-controlled.

## Rollback

Vercel can promote the previous deployment immediately. The migration is additive; rolling back the UI does not require dropping tables. Do not delete production tables as part of an application rollback.
