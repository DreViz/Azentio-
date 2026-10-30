# azentio.ai portal: what is built

Status: final for submission, 30 Oct 2026. Covers the code in `portal/`. All data is synthetic.

## 1. Summary

We built the azentio.ai website and a secure portal for employees and clients. It turns client market observations into governed collective learning.

The brief's whole illustrative scenario runs end to end in the real UI:
1. Three institutions report seasonal SME cash-flow problems.
2. A moderator de-identifies the reports with an AI copilot.
3. A theme forms, counted by distinct institutions.
4. A product owner opens an improvement idea that clients can follow.
5. The author withdraws the observation, and it disappears from search and AIRA within milliseconds.

The design principle is **enforce in the database, prove it live**. Every request runs as a restricted Postgres role under row-level security. A Trust Proof page attacks the system as each persona and shows every attempt being refused.

## 2. Who can do what

| Capability | Visitor | Employee | Moderator | Product owner | Publisher | Portal admin | Client member | Client admin |
|---|---|---|---|---|---|---|---|---|
| Public site, products, insights, public media, demo and hackathon forms | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| AIRA answers from public content | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| AIRA answers including approved shared learning | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Employee dashboard, Playground and seasonality experiment, internal broadcasts, library, federated lab | | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| Client dashboard, entitled sandboxes, briefings for their audience | | | | | | | ✓ | ✓ |
| Record observations, choose visibility and consents, submit, amend, withdraw, revise | | | | | | | ✓ | ✓ |
| Withdraw any observation of their own organisation | | | | | | | | ✓ |
| Shared learning feed, themes, client-safe idea status, report an item | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Moderation queue, copilot, return, reject, publish, unpublish, handle reports | | | ✓ | | | | | |
| Create themes from suggestions | | | ✓ | ✓ | | | | |
| Improvement ideas: create, link evidence, change status | | | | ✓ | | | | |
| Content studio with explicit audiences | | | | | ✓ | | | |
| Grants, employee provisioning, cohort threshold, audit log, model approval | | | | | | ✓ | | |
| Invite, revoke and change roles in their own organisation | | | | | | | | ✓ |

Columns other than visitor are additive grants on a verified employee, except the two client roles. Employee status alone grants nothing in the moderator, product owner, publisher or admin columns. No role can read another person's private draft, and that includes the portal administrator.

## 3. Screens

| Route | Who | What it does |
|---|---|---|
| `/` | All | Hero, product grid, governed-learning pitch, insights |
| `/products`, `/products/[id]` | All (employee-only offering returns 404 to others) | Catalogue from the reference prototype: eight products with capabilities and steps |
| `/solutions`, `/insights`, `/about` | All | Solution groupings and public insights |
| `/media` | All | Media listed per audience; every file served through `/api/media/[id]` after a policy check |
| `/connect`, `/hackathon/register` | All | Validated enquiry forms with a honeypot; nothing claims an email was sent |
| `/aira` | All | Permission-aware assistant with numbered citations and an engine label |
| `/trust` | All (live run in demo mode or for admins) | Promises, the live 24-check attack table, withdrawal and retention policy, what is simulated |
| `/login`, `/judge` | All (`/judge` only in demo mode) | Email-code sign-in; judging kit for seeded personas |
| `/invite/[token]` | Invitee | Shows organisation and role, the workspace terms, then accept |
| `/content/[id]` | Per audience | Article, session or briefing with gated media |
| `/portal` | Signed in | Employee or client dashboard by active workspace; "No workspace yet" otherwise |
| `/portal/contributions`, `/new`, `/[id]` | Clients | My and organisation observations; structured form; detail with the "who can see this" card, four permission toggles, consent history, review history, shared copy, versions |
| `/portal/learning` | Participants | Shared feed with full-text search, filters for offering, industry, region, type and period, suppressed facet counts and a report action |
| `/portal/themes` | Participants | Theme cards with observations, distinct institutions or "Withheld", confidence mix, period, offerings, limitations and linked ideas; suggestions for curators |
| `/portal/ideas` | Participants | Clients see the plain status projection. Employees see problem, outcome, internal priority, evidence count and audited history. Product owners create ideas and update status. |
| `/portal/moderation`, `/[id]` | Moderators | Queue, open reports, unpublished items; review screen with source text, copilot findings table, editable shared copy, return and reject |
| `/portal/sandbox` | Employees, entitled clients | Guided demo: choose offering and synthetic applicant, inspect a 24-month inflow chart, run, see metrics and evidence, leave structured feedback |
| `/portal/resources` | Employees, clients | Restricted content grouped as live sessions, briefings, experiments, library and release notes, with owner and review date |
| `/portal/org` | Client admins | Invite, revoke, change role or status of members of the active organisation |
| `/portal/admin` | Portal admins | Grant matrix, provisioning, cohort threshold, organisations, enquiries, audit log |
| `/portal/studio` | Publishers | Publish insights, banners, broadcasts, briefings and release notes to an explicit audience |
| `/portal/federated` | Employees (decisions by admins) | Rounds, rejections, dropouts, holdout metrics, per-client skew, controls, consent; approve, reject or roll back |
| `/portal/notifications` | Signed in | In-app notifications, mark all read |

Screenshots of most of these are in `docs/screenshots/`.

## 4. How access is enforced

1. **Sign-in.** The sign-in path in `lib/auth.ts` issues a six-digit code. It stores only a hash, expires in 10 minutes, and works once. It locks after 5 wrong attempts and allows at most 5 code requests per 15 minutes. A verified email creates a user record, but never a membership.
2. **Session.** A random token sits in an httpOnly cookie and only its hash is stored. The active workspace is stored server-side in the session and changes only after a membership check.
3. **Every request.** `asUser()` in `lib/db.ts` opens a transaction, runs `SET LOCAL ROLE portal_app`, and sets `app.user_id` and `app.org_id`. `portal_app` does not own the tables, so every row-level security policy in `db/schema.sql` applies to every read, including search, AIRA retrieval, facet counts and media lookups.
4. **Helpers.**
   - `app_org()` returns the active organisation only if the membership is active.
   - `has_grant()` requires an active employee membership as well as the grant row.
   - `audience_ok()` implements the audience rule. Values are public, employee, clients, org and entitled, and there is no fallback.
5. **Writes.**
   - Lifecycle changes go only through `SECURITY DEFINER` functions. Each one checks the caller, enforces the allowed transition, and writes the audit event and notification in the same transaction.
   - Column grants stop the app role from updating `state` or selecting `shared_items.contribution_id`.
   - The audit table has no insert, update or delete grant for the app role.
6. **Media.** Files live in `storage/`, outside `public/`. They are served only by `/api/media/[id]` after a policy-filtered lookup, with `no-store` caching and a restrictive CSP. Not-permitted and not-found both return 404.

## 5. Collective-learning workflow

```
draft ──submit──▶ submitted ──publish──▶ published ──withdraw──▶ withdrawn
  ▲                  │  │                    │
  └──amend── returned◀┘  └──reject──▶ rejected  └─revise─▶ new version (draft) … publish ⇒ old copy superseded
shared copy: published ⇄ unpublished (report under review) ─▶ removed
```

- **Visibility.** The choices are private, my organisation, or propose to the community. Organisation visibility applies at once. A proposal stays author-only until it is submitted.
- **Consents.** Store/process, publish, attribution and training are append-only rows.
  - Submitting needs publication consent.
  - Revoking publication consent withdraws the shared copy.
  - Revoking attribution clears the label.
  - Training consent has no effect today and is shown as such.
- **Publishing** creates a new `shared_items` row containing only the reviewed fields: title, body, industry, region band, period label, type, evidence, confidence, optional theme and opt-in attribution.
- **Withdrawal** sets the shared copy's status. Feed, search and AIRA all read the same policy-filtered table, so the item disappears at commit. The UI re-queries and reports the measured time.

## 6. Aggregation safeguards

- **Theme counts.** `theme_stats()` counts distinct organisations per theme. It returns no count below `min_cohort_orgs`, which defaults to 3 and which `setting_set` refuses to lower below 3.
- **Facet counts.** `facet_counts(dimension)` returns only values backed by at least the threshold. It works one dimension at a time, so stacked filters cannot be used for differencing.
- **Theme cards.** Each card shows a limitations line and the confidence mix. The UI never claims prevalence or causation.

## 7. AI components

| Component | File | With a Claude key | Without a key | Data sent to the model |
|---|---|---|---|---|
| AIRA | `lib/aira.ts` | Grounded answer citing numbered passages | Extractive answer from the top passages | Only passages the user can already read, framed as data |
| Moderation copilot | `lib/redact.ts` | Rules first, then a Claude rewrite for re-identification risk, then the rules again on the output | Rules only | Rule-scrubbed text only |
| Theme suggestions | `lib/themes.ts` | Claude Haiku groups items with their IDs | Keyword groups with written summaries | Approved, de-identified shared items |

**The rules** remove emails, account numbers, phone numbers, amounts, exact dates, named businesses, people and participating institution names. They also coarsen cities to region bands and periods to a quarter, half-year or year. A self-test, including a false-positive guard, covers them.

## 8. Employee Playground and client sandboxes

- **Applicants.** Four synthetic SME applicants, each with 24 months of inflows: agri-seasonal, festive retail, stable services and a declining distributor.
- **Standard view.** Month-to-month volatility and debt-service cover.
- **Seasonality experiment (employees only).** Removes the annual pattern, then judges the residual volatility, year-on-year trend and annualised cover.
- **Labelling and feedback.** Every output is labelled as simulated and as not a credit decision. Runs are stored per user and organisation and accept structured feedback.
- **Entitlements.** Clients can run only offerings their active organisation is entitled to, and the database policy enforces this.

## 9. Federated learning track

- **Implementation.** `fl/federated.mjs`, with results shown on `/portal/federated`.
- **Participants.** Five synthetic institutions with different seasonal mixes. One has not consented and is excluded before training.
- **Training.** Local logistic regression on data that never leaves the client's directory. Only weight deltas reach the coordinator.
- **Coordinator controls.**
  - Schema and shape validation.
  - Outlier rejection at four times the median norm.
  - L2 clipping to 1.5.
  - A minimum cohort of 3.
  - Sample-weighted averaging.
- **Failure scenarios.** One participant drops out in rounds 2 and 3. A poisoned update in round 3 is rejected, and that round is skipped because too few valid updates remain.
- **Evaluation.** On a separate holdout, the global model reaches an AUC of about 0.78. The raw-volatility rule reaches about 0.56, and every local-only model scores lower than the global model.
- **Governance.** The model is registered as a candidate. Admin approval, rejection or rollback are all audited.
- **Honest limits.** No secure aggregation, no differential privacy, no authenticated transport, and no "untraining".

## 10. Data model

| Table | Purpose |
|---|---|
| `users`, `organisations`, `memberships`, `grants` | Identity, tenancy, client roles, separate platform grants |
| `invitations`, `login_codes`, `sessions` | Hashed single-use tokens and codes, server-side sessions |
| `offerings`, `entitlements` | Catalogue with audience; per-organisation product entitlements |
| `content_items`, `media` | Audience-scoped content and files (public, employee, clients, org, entitled) |
| `contributions`, `consents` | Private source records and the append-only consent ledger |
| `shared_items`, `themes` | Reviewed shared copies (source link hidden) and themes |
| `reviews`, `review_notes`, `reports` | Author-visible decisions, moderator-only notes, reports |
| `ideas`, `idea_evidence`, `idea_status_history` | Improvement loop with linked evidence and audited status |
| `notifications`, `audit_events`, `settings` | In-app outbox, append-only audit, cohort threshold |
| `playground_runs`, `enquiries`, `fl_runs` | Sandbox runs, public requests, federated candidates |

## 11. Quality

- **Automated suites.**
  - 24 Trust Proof checks.
  - 41 lifecycle tests.
  - 21 HTTP checks.
  - 30 browser steps.
  - A smoke render of every page as every persona.
  - A redaction self-test and federated self-checks.
- **Catalogue.** Mapped to the brief in `docs/TEST-CASES.md`.
- **Real defects the suites caught before submission:**
  - Organisation visibility was wrong.
  - Sign-in failed on an audit insert.
  - Date fields broke editing.
  - Two redaction pattern errors.
  - A NULL-logic hole let another organisation's admin withdraw a contribution.
  - The brute-force lockout was silently rolled back.
  - A check passed for the wrong reason.

## 12. Known limits

- **Not deployed.** Deployment steps are in the README.
- **Claude unverified.** The Claude path has not been run with a real key in this environment.
- **Email.** Sign-in emails use SMTP if configured. Notifications are in-app only, and the persisted outbox exists but has no provider-backed delivery.
- **Not implemented** (the brief allows omitting attachments in P0):
  - attachments
  - comments
  - saved searches and bookmarks
  - support-ticket integration
  - Entra ID
  - real video streaming
  - hackathon team spaces
- **Owner connection.** The app server holds the owner connection for sign-in and seeding. In production, sign-in would move to a separate service with its own credentials.

## 13. File map

```
portal/
  db/schema.sql            tables, RLS policies, helpers, lifecycle and admin functions
  lib/                     db (asUser/system), auth, session, aira, redact, themes, playground, trust, validate
  app/                     public pages, /portal pages, /api/media, server actions in app/actions
  components/              header, UI primitives, contribution and enquiry forms
  fl/federated.mjs         federated programme and coordinator
  scripts/                 seed, lifecycle, acceptance, smoke, e2e, redaction tests
  storage/                 private demo media (served only through the policy check)
  docs/                    this document, TEST-CASES, result reports, screenshots
```
