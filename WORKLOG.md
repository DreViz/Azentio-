# Special Challenge: approach and work log

Status: build complete and verified locally on 30 Oct 2026, 15:40 IST. Not yet deployed, not yet submitted.
Team: Vaibhav and Muzammil. Code: `portal/`. Original plan: `PLAN.md` (kept as written; the decisions below supersede it where they differ).

## 1. What Azentio asked for

The brief asks for the azentio.ai website plus a secure portal for employees and clients. Clients share market observations, and Azentio turns them into governed collective learning and product improvements. It reads like a website brief, but most of its rules are about who may see what:
- server-side access control
- tenant isolation
- separate grants
- separate private and shared copies
- four separate consents
- withdrawal within 60 seconds
- counts suppressed for small groups
- honest labels

The cover promises acceptance tests, but none are included, so we wrote our own.

## 2. Our angle

**"Every privacy promise on this portal has a test you can run."** Most teams will ship a good-looking site whose checks live in the menu. Ours enforces every rule in the database and proves it live. The Trust Proof page signs in as each persona and attempts what the brief forbids.

## 3. Key decisions

| Decision | Why |
|---|---|
| Plain Postgres with row-level security instead of Supabase (changed from `PLAN.md`) | No accounts were available to create a Supabase project, and the local Supabase stack is heavy. Plain Postgres keeps the same database-enforced model, runs anywhere, and deploys to any host. |
| Every user request runs as the restricted `portal_app` role with `SET LOCAL` context | One enforcement point. Page code cannot forget a check because it has none. |
| All lifecycle changes go through `SECURITY DEFINER` functions | Each function enforces allowed transitions, checks the grant, and writes the audit event and notification in one transaction. |
| Our own email-code sign-in, with SMTP optional | It is a real single-use, expiring code flow with no external account needed. Demo mode shows codes for seeded personas, clearly labelled. |
| Postgres full-text search, no vector database | There is no second index to purge, so withdrawal is synchronous by construction. |
| Claude is optional, with deterministic fallbacks | No API key is available here, and the demo must not depend on network access. The UI labels which engine answered. |
| Federated track in plain JavaScript | numpy would not install. One language, and results flow straight into the portal. |
| Code kept outside `hacky-culture` | That repo forbids code before the finale window. |

## 4. What was built

- **Public site.** Mirrors the prototype's routes and its eight products: home, products, solutions, insights, media, about, connect, hackathon registration, AIRA and Trust.
- **Identity.** Email-code sign-in, sessions, workspace switcher, invitations bound to the invited email, employee provisioning, and separate grants.
- **Employee portal.** Dashboard, guided Playground with a synthetic SME scenario, and the employee-only seasonality experiment. Also internal broadcasts with a gated recording, the knowledge library, release notes and the federated lab.
- **Client portal.**
  - Dashboard with entitled offerings and empty states.
  - Entitled sandboxes isolated by organisation.
  - "My observations" kept separate from the organisation's observations.
  - Organisation admin, and ideas without internal detail.
- **Collective learning.**
  - Structured form with validation on both sides and a draft-first flow.
  - Sensitive-content scan, a "who can see this" card and four separate consents.
  - Moderation with the AI redaction copilot: return, reject, publish, reports and unpublish.
  - Versioned revisions and verified withdrawal.
  - Shared feed with search and filters, suppressed facet counts, and a theme dashboard with suggestions.
  - Improvement ideas with audited status and contributor notifications.
- **Administration.** Grants, provisioning, a cohort threshold that cannot go below 3, enquiries and the audit log.
- **Federated track.** Five synthetic institutions with a consent gate, local training, clipping, outlier rejection, dropout and a minimum cohort. Evaluation runs against a baseline, and the result is registered as a candidate model that needs admin approval.

## 5. Verification (all passing at 15:40)

| Suite | Result | Command |
|---|---|---|
| Trust Proof, database-level persona attack probes | 24 / 24 | `/trust?run=1`, report in `portal/docs/trust-results.md` |
| Lifecycle functional tests (workflow, consent, ideas, invitations, grants, sandbox) | 41 / 41 | `npm run test:lifecycle`, report in `portal/docs/lifecycle-results.md` |
| HTTP acceptance, including direct media links | 21 / 21 | `npm run test:acceptance` |
| Every page as every persona | 0 server errors | `npm run test:smoke` |
| Scenario plus sign-in safeguards in Chrome | 30 / 30 steps | `node scripts/e2e.mjs` |
| Redaction rules self-check | pass | `npm run test:redact` |
| Production build and typecheck | pass | `npx next build`, `npx tsc --noEmit` |

The test case catalogue maps every brief requirement to its tests: `portal/docs/TEST-CASES.md`. The description of what is built is in `portal/docs/BUILD-DOCUMENT.md`.

### Bugs the tests caught and we fixed

- **Organisation visibility.** Organisation-visible observations were hidden from colleagues while in draft. The policy was rewritten so that "my organisation" is visible at once, while "propose to community" stays private until submitted.
- **Sign-in audit insert.** The audit insert reused one parameter as both a user ID and text, which broke sign-in.
- **Edit form dates.** Postgres dates arrived as JavaScript Date objects, which broke the edit form's date fields. The fix returns DATE columns as plain strings.
- **Amount pattern.** The amount rule matched "rs." inside "years." and garbled ordinary text.
- **Phone pattern.** The phone rule missed numbers with three digit groups.
- **Security: cross-organisation withdrawal.** A NULL-logic hole let a client admin of another organisation withdraw a contribution. All permission checks in functions are now NULL-safe, and an anonymous-caller test was added.
- **Security: brute-force lockout.** The wrong-code counter was rolled back with the error, so the five-attempt lockout never worked. The failure is now committed before the error is returned.
- **AT-19 false pass.** AT-19 passed for the wrong reason, a harness error after the scenario. Only real Postgres refusals now count as "denied".

## 6. Remaining before submission (owner, status)

1. **Deploy (Muzammil).**
   - Create a hosted Postgres, such as Neon or Supabase, and run `npm run db:seed` and `npm run fl` against it.
   - Deploy `portal/` to Vercel with `DATABASE_URL` and `DEMO_MODE=true`.
   - Add `ANTHROPIC_API_KEY` to enable Claude.
   - Run `BASE_URL=<url> npm run test:acceptance` against the deployment.
2. **Push the repo (Muzammil).** Commit under his own identity so both members show in history. The `.env.local` file is git-ignored.
3. **Test with a Claude key (both).** The Claude code path is untested because there was no key. With a key, open one moderation review and one AIRA answer, and confirm the "Claude" badge appears.
4. **Record the demo video (Vaibhav).** Follow the script in section 7.
5. **Publish the LinkedIn posts (both).** Use the draft in section 8 and tag Azentio and HackCulture.
6. **Submit (both).** Use the organisers' link and instructions, which arrive by end of day.

## 7. Demo video script (about 3.5 minutes)

1. **Home and AIRA, 0:00.** A public question gets a cited answer. Asking about internal experiments returns nothing internal.
2. **Moderation, 0:25.** Log in at `/judge` as the moderator. The copilot strikes out the account number, customer name, city, date and amount, and rates re-identification risk as high. Request clarification.
3. **Author, 1:00.** The Meridian analyst sees the request, amends the item and resubmits. Show the "who can see this" card and the four permissions.
4. **Publish, 1:30.** The moderator publishes the shared copy, then the other two items.
5. **Product owner, 1:50.** Accept the "Seasonality context" theme with 3 institutions. Show that the two-institution theme count is withheld. Create the idea and move it to Under review.
6. **Lotus client, 2:30.** The idea shows a plain status with no priority. The feed contains no names.
7. **Withdrawal, 2:50.** Withdraw the item. The confirmation reads "Verified removed … in 3 ms". AIRA no longer cites it.
8. **Trust Proof, 3:10.** Click "Run live checks" and show 24 of 24 green. End on the federated lab with the rejected poisoned update.

## 8. LinkedIn post draft

> Most portals promise privacy. We built one where every promise has a test you can run.
>
> For the Azentio.ai Build Labs Special Challenge, our team (Vaibhav and Muzammil) built azentio.ai: a public site, private workspaces for employees and clients, and a governed "collective learning" loop where banks share market observations without exposing themselves.
>
> Three design choices we're proud of:
> 🔒 Access is enforced by the database (Postgres row-level security), not the menu. A forged workspace or a guessed URL returns nothing.
> 🧾 Two copies, never one. Clients keep their original; moderators publish a reviewed, de-identified copy, helped by an AI redaction copilot that never makes the final call.
> ⏱️ Withdrawal that actually propagates: gone from search and the AI assistant in milliseconds, verified on screen.
>
> Trend counts only appear when at least 3 institutions contribute, and we even added a small federated-learning simulation with update clipping and a rejected poisoned update, labelled honestly as a simulation.
>
> The live Trust Proof page runs 24 attack checks as different personas. All green.
>
> All data is synthetic. Thanks @Azentio and @HackCulture for a brief that rewards getting the hard parts right.
> #AzentioBuildLabs #AI #FinTech #PrivacyByDesign #Hackathon

Attach: `12-trust-proof.png`, `04-moderation-copilot.png`, `06-themes.png`, `13-federated.png`, or a 45-second screen recording of the withdrawal and the Trust Proof run.

## 9. Log

- **11:48.** Requirements document received. Read and analysed, with the prototype's routes and products captured.
- **12:00.** `PLAN.md` written.
- **12:30.** Scaffolded Next.js 16 with Node 22. Local Postgres 16 runs in Docker as `azp-db` on port 54329.
- **13:00.** Schema, policies and lifecycle functions written. The policies were verified with persona transactions in `psql`.
- **13:30.** Seed written: 4 organisations, 9 personas, 8 products, gated media, the scenario, and private and organisation-only items.
- **14:00.** Public site, sign-in, the portal pages, AIRA, the copilot, themes, ideas, sandbox, admin and studio.
- **14:30.** Federated track, the Trust Proof checks and the HTTP acceptance suite.
- **15:00.** Browser end-to-end run of the full scenario, which surfaced the bugs listed in section 5. Production build passes.
- **15:15.** README, approach and work log.
- **15:40.** Added the 41-test lifecycle suite, sign-in safeguard tests and mobile navigation. Fixed the two security bugs above. Wrote the build document and test case catalogue.
