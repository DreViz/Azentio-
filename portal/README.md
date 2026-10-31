# azentio.ai: website, secure portal and governed collective learning

Submission for the Azentio.ai Build Labs Special Challenge.

**Every privacy promise on this portal has a test you can run.** Access is enforced by Postgres row-level security, not by menus. The private source and the shared copy are separate records. Withdrawal propagates to search and AIRA in the same transaction, and trend counts are withheld for small groups. A live Trust Proof page signs in as each persona and attempts what the brief forbids.

All organisations, people and data are synthetic.

**Documents:** [What is built](docs/BUILD-DOCUMENT.md) · [Test cases mapped to the brief](docs/TEST-CASES.md) · results: [trust](docs/trust-results.md), [lifecycle](docs/lifecycle-results.md), [HTTP](docs/acceptance-http-results.md) · [screenshots](docs/screenshots/)

## What you can do

| Persona | Demo account | What to try |
|---|---|---|
| Public visitor | none | Products, insights, media, AIRA, demo request, hackathon registration, `/trust` |
| Employee | priya@azentio.com | Playground with the employee-only seasonality experiment, internal broadcasts and recordings, knowledge library |
| Learning moderator | maya@azentio.com | Moderation queue, AI redaction copilot, return / reject / publish, reports, unpublish |
| Product owner | omar@azentio.com | Theme suggestions, improvement ideas linked to approved evidence, audited status changes |
| Content publisher | pat@azentio.com | Content studio with explicit audiences |
| Portal administrator | ada@azentio.com | Separate grants, employee provisioning, cohort threshold, audit log, federated model approval |
| Client admin, Meridian Bank | alex@meridian.example | Invite and manage members of Meridian only |
| Client member, Meridian Bank | sam@meridian.example | Private drafts, four separate permissions, "who can see this", withdraw, revise |
| Northwind admin and Lotus member | noor@northwind.example | Workspace switcher; entitlements follow the active workspace |
| Client member, Lotus Microfinance | li@lotus.example | Entitled sandbox, shared learning, ideas without internal detail |

Sign-in is a real email-code flow. With `DEMO_MODE=true`, the `/judge` page and the login page display the code on screen, because seeded inboxes do not exist. Any other address can sign in normally, and it sees no workspace until invited or provisioned.

## The judging scenario, end to end

1. Three fictional institutions submit observations about seasonal SME cash flow. One contains a customer name, an account number, a city, an exact date and an amount.
2. The moderator opens the copilot. Rules scrub direct identifiers locally. The configured model rewrites the text to reduce re-identification risk. The moderator requests clarification on one item and publishes the other two.
3. The author amends the item and resubmits it, and the moderator publishes it.
4. The product owner accepts a suggested "Seasonality context" theme. It shows 3 distinct institutions, a confidence mix and a small-sample warning. The product owner creates an idea for Financial Analysis Intelligence and moves it to Under review.
5. Another client sees the theme and the idea's plain status, without priority, source text or anyone's identity.
6. The author withdraws the item. Withdrawal is verified gone from the feed, search and AIRA within milliseconds.

`scripts/e2e.mjs` runs exactly this in Chrome and saves the screenshots in `docs/screenshots/`.

## Architecture

```mermaid
flowchart LR
  B[Browser] -->|pages, server actions| N[Next.js 16 server]
  N -->|"BEGIN; SET LOCAL ROLE portal_app; app.user_id, app.org_id"| P[(Postgres<br/>row-level security<br/>SECURITY DEFINER lifecycle functions<br/>append-only audit)]
  N -->|"system path: sign-in and sessions only"| P
  N -->|"private media after policy check"| S[storage/]
  N -->|"rule-scrubbed text, permitted passages only"| C[Model API (Anthropic-compatible), optional]
  F[fl/federated.mjs coordinator] -->|"clipped deltas only"| F
  F -->|candidate model| P
```

- **One enforcement point.** Every user request runs in a transaction that switches to the restricted `portal_app` role and sets the user and active organisation. Postgres policies then decide every read, including search, AIRA retrieval, facet counts and media lookups. Page code has no authorisation logic of its own to forget.
- **Lifecycle functions.** State changes go through `SECURITY DEFINER` functions such as `contribution_submit`, `contribution_publish` and `contribution_withdraw`. They check the grant, enforce the allowed transition, and write the audit event and in-app notification in the same transaction. The app role has no `UPDATE` grant on `state`.
- **Two copies.** `contributions` holds the private source. `shared_items` holds only reviewed fields, and the app role cannot select its `contribution_id` column. Moderators see the proposed text but not the author or the organisation.
- **Active workspace.** The active workspace lives in the server-side session. `app_org()` returns it only if the membership is active, so a forged value yields nothing.
- **Aggregation.** `theme_stats()` and `facet_counts()` count distinct organisations and withhold anything below `min_cohort_orgs`, which cannot be set below 3. Facets are computed one dimension at a time to blunt differencing.
- **Withdrawal SLA.** Search and AIRA read the same policy-filtered table, so there is no second index to purge and withdrawal applies at commit. The production target is under 60 seconds end to end, including any CDN or cache purge. Content that was already read cannot be recalled.

## Requirement coverage

| Brief section | Where |
|---|---|
| IAM-01/02: server-side RBAC, tenant, audience and entitlement checks, least privilege | `db/schema.sql` policies and helpers; AT-03..AT-10, AT-24, AT-25; HTTP-01..14 |
| Authentication, invitations and terms | `lib/auth.ts`, `invite_*` functions, `/invite/[token]`; E2E 02-06 and 24-28, LC-30..32 |
| Employee portal: dashboard, Playground, internal live and recordings, ideas, library | `/portal`, `/portal/sandbox`, `/portal/resources`, `/portal/ideas` |
| Client portal: dashboard, entitled sandboxes, my and organisation observations, shared feed, filters, admin, ideas | `/portal`, `/portal/contributions`, `/portal/learning`, `/portal/org`, `/portal/ideas` |
| Observation capture: structured form, validation both sides, draft first, sensitive-content prompts | `components/ContributionForm.tsx`, `lib/validate.ts`, DB checks, `scanForAuthor` |
| Review, publication, versions, reports, withdrawal, notifications | lifecycle functions, `/portal/moderation`; AT-14, AT-19 |
| Sharing, four consents, de-identification, aggregation safeguards | `consents` ledger, `lib/redact.ts`, `theme_stats`; AT-12, AT-15, AT-16 |
| Insights and improvement loop | `/portal/themes`, `/portal/ideas`, `ideas_public()`; AT-22 |
| Advanced track: federated learning | `fl/federated.mjs`, `/portal/federated` |

## Federated learning track (simulated)

- **Task.** Five synthetic institutions predict 90-day SME repayment stress from six cash-flow features under a published schema, `sme-stress-v1`.
- **Consent and isolation.** One institution never opted in and is excluded before training. Each client trains logistic regression on data in its own directory and sends only a weight delta.
- **Coordinator controls.** The coordinator validates schema and shape, rejects outliers whose update norm exceeds four times the cohort median, clips updates to an L2 norm of 1.5, and requires at least 3 accepted updates. It then runs sample-weighted FedAvg.
- **Failure scenarios.** One participant drops out in rounds 2 and 3. A compromised participant sends a sign-flipped, scaled update in round 3, which is rejected. That round is skipped because only 2 valid updates remain.
- **Results.** On a separate synthetic holdout, the global model beats the raw-volatility rule and every local-only model. Per-client results show the effect of skewed seasonality.
- **Approval.** The result is registered as a candidate. Only a portal administrator can approve, reject or roll it back, and every decision is audited.

| Model on holdout | AUC |
|---|---|
| Raw volatility rule | 0.562 |
| Local-only models (four institutions) | 0.772 to 0.780 |
| Federated global model | 0.781, highest, by a small margin |

This track is labelled honestly. It uses plain averaging, with no secure aggregation and no differential privacy accounting. Updates can leak information and clients can poison training. Withdrawal stops future participation but does not "untrain" a model. Authenticated participants, secure aggregation and differential privacy are designed but not implemented.

## Threat model and limits

- **Compromised app server.** The app server holds the owner connection, used for sign-in and seeding. A compromised server could bypass row-level security. Production would split the credentials: a non-owner login role for requests and a separate auth service.
- **Audit helper.** The `audit()` helper is callable by the app role so that actions can log. The browser cannot call it directly, because all SQL is server-side and parameterised.
- **Redaction limits.** Automated redaction cannot guarantee anonymity. A human must approve every shared copy, and the UI says so.
- **Email.** Sign-in codes use SMTP when configured. Notifications are in-app only and are never labelled as emailed. A persisted outbox with provider-backed email is the next step.
- **Out of scope.** Attachments, comments, saved searches, support tickets, Entra ID, real video streaming and production deployment of trained models. The brief allows links instead of attachments in P0.

## Run it

```bash
nvm use 22
docker run -d --name azp-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=portal -p 54329:5432 postgres:16
cp .env.example .env.local          # DATABASE_URL, DEMO_MODE=true, optional ANTHROPIC_API_KEY / SMTP_*
npm install
npm run db:seed                     # applies db/schema.sql and loads synthetic data (resets the schema)
npm run fl                          # runs the federated programme and registers a candidate model
npm run dev                         # http://localhost:3100, judging kit at /judge
```

**Verify everything:**

```bash
npm run verify
```

This runs the redaction and redirect self-checks, reseeds, and runs 44 lifecycle tests and 21 HTTP checks. It then renders every page as every persona, runs the 30-step browser scenario including sign-in safeguards, and reseeds. It needs the dev server running and Chrome at `/usr/bin/google-chrome`. The reports land in `docs/`.

**Deploy (Vercel and any Postgres 14+):**
1. Run `npm run db:seed` against the hosted database once. The owner needs the `CREATEROLE` privilege.
2. Set `DATABASE_URL`, `DEMO_MODE`, `NEXT_PUBLIC_SITE_URL` and optionally `ANTHROPIC_API_KEY` (with `ANTHROPIC_BASE_URL`, `AI_MODEL` and `AI_FAST_MODEL` for a non-Anthropic endpoint) in the Vercel project.
   - With `DEMO_MODE=true`, sign-in codes are shown on screen only for the seeded personas and reserved `.example` addresses, so real mailboxes cannot be taken over. Anyone with the URL can still sign in as a seeded persona, including the admin, so treat a public demo database as disposable and reseed it after judging.
3. Transaction-mode connection pooling is compatible, because the role and context are set with `SET LOCAL` per transaction.

## AI disclosure

- **Built with Claude Code.** The team reviewed the code, and both members can explain every part.
- **Runtime AI is optional.** An Anthropic-compatible Messages API is used for AIRA answers, the moderation copilot and theme suggestions.
  - Models are `claude-sonnet-5` and `claude-haiku-4-5-20251001`, configurable through `AI_MODEL` and `AI_FAST_MODEL`.
  - Without a key, AIRA returns an extractive answer, the copilot runs rules only, and themes use keyword grouping. The UI labels which engine answered.
- **Key prompts.** Each prompt sits in the file that uses it.
  - The AIRA system prompt in `lib/aira.ts` answers only from permitted passages, cites them, treats passages as data rather than instructions, and makes no prevalence claims.
  - The copilot prompt in `lib/redact.ts` generalises rather than deletes, adds no facts, and returns JSON.
  - The theme prompt in `lib/themes.ts` groups items only when they share a problem, keeps the evidence IDs, and states that output is neutral.
- **What reaches the model.** Nothing private is sent unless that processing is permitted. AIRA sends only passages the user can already read. The copilot sends text only after local rules strip direct identifiers.
