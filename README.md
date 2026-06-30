# OpenChat

Open-source Instagram **comment-to-DM automation with a follower gate**.

When someone comments a keyword on a creator's post, OpenChat sends them the
link/asset by DM — **but only if they follow the creator.**

This repo is a **single-creator vertical slice** plus a **local simulator**, so the
entire pipeline runs and is testable **before** you have any Meta API keys.

```bash
npm install
npm run simulate        # run the full pipeline end-to-end, no keys required
npm test                # scenario + unit tests
```

## The constraint that shapes the design

Meta's [User Profile API](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/user-profile/)
exposes `is_user_follow_business` — exactly the follower check we need — **but only
after the user gives consent** (they message you, tap a CTA, or use the persistent
menu). **A comment alone does not grant consent**, and there is no API to read
follow-status or a follower list at comment-time.

So the follower gate lives **inside the DM conversation**, not at comment-time. The
only no-consent actions allowed when someone comments are: one
[private reply](https://developers.facebook.com/docs/instagram-platform/private-replies/)
DM per comment (within 7 days), and a public reply on the comment.

### The flow (state machine)

```
Comment matches keyword
  ├─ (optional) public reply on the comment   "Sent you a DM! Make sure you're following 👀"
  └─ private-reply DM with a CTA              state: AWAITING_ENGAGEMENT
User taps / replies  →  CONSENT  →  read is_user_follow_business
  ├─ follows      → deliver the link                       state: DELIVERED
  └─ not following → nudge ("follow & reply 'done'")        state: AWAITING_FOLLOW
User replies again → re-check
  ├─ now follows  → deliver the link                       state: DELIVERED
  └─ still not    → re-nudge up to nudgeMax, then stop      state: AWAITING_FOLLOW / STOPPED
```

The link is delivered **only** on a confirmed `is_user_follow_business === true`.

## Architecture

- **Next.js (App Router)** — serverless API routes (webhook + OAuth callback), room
  for a dashboard later.
- **Supabase (Postgres)** — storage; deny-by-default RLS.
- All Instagram calls go through a `MetaClient` interface with two implementations:
  - `MockMetaClient` — tests + simulator (no keys).
  - `LiveMetaClient` — real Graph API (used automatically when `META_*` env vars are set).

```
src/
  app/api/webhooks/instagram/route.ts        GET verify + POST events (signature, dedupe, 200 fast, after() processing)
  app/api/oauth/instagram/callback/route.ts  OAuth code → long-lived token → store creator
  lib/
    meta/        client interface, mock, live, signature, oauth, payload types
    pipeline/    parse → match → process (state machine) → execute
    db/          repositories interface, in-memory impl, Supabase impl
    testing/     seeded in-memory harness + webhook payload builders
    config.ts    env loading (all secrets optional)
    runtime.ts   production wiring (Supabase + live/mock Meta client)
supabase/        migrations/0001_init.sql, seed.sql
scripts/         simulate.ts
tests/           pipeline + unit tests
```

## Run locally (no API keys)

```bash
npm run simulate -- follower            # one scenario
npm run simulate                        # all scenarios
npm test                                # 16 tests
npm run typecheck
```

Scenarios: `follower`, `non-follower`, `non-follower-stop`, `no-match`, `dedupe`.

## Going live (once you have Meta dev access)

1. **Create a Meta app** (Business type) → add the **Instagram** product with
   **Instagram Login** (no Facebook Page needed).
2. **Permissions** (App Review for advanced access / live use):
   `instagram_business_basic`, `instagram_business_manage_comments`,
   `instagram_business_manage_messages`.
3. **Webhooks**: set the callback URL to `https://<your-domain>/api/webhooks/instagram`
   and the verify token to your `META_VERIFY_TOKEN`; subscribe to the `comments` and
   `messages` fields.
4. **Supabase**: create a project, run `supabase/migrations/0001_init.sql`, optionally
   `supabase/seed.sql`.
5. **Env**: copy `.env.example` → `.env` and fill in the values.
6. **Connect a creator**: complete OAuth so a row lands in `creators` with a
   long-lived token (the `/api/oauth/instagram/callback` route handles the exchange).
7. Deploy, comment the keyword on a test post, and watch the DM arrive. The pipeline
   is identical to what the simulator exercised — only the `MetaClient` and storage
   change.

## License

MIT — see [LICENSE](LICENSE).
