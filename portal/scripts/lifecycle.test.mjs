// Functional lifecycle tests at the database layer, run as each persona through the restricted
// portal_app role. Every test runs in its own transaction that is rolled back, so data never changes.
// Usage: npm run test:lifecycle   (needs a seeded database)
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
for (const f of [".env.local", ".env"]) {
  const p = path.join(root, f);
  if (fs.existsSync(p)) for (const line of fs.readFileSync(p, "utf8").split("\n")) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
}
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const U = Object.fromEntries((await c.query("select split_part(email,'@',1) k, id from users")).rows.map((r) => [r.k, r.id]));
const O = Object.fromEntries((await c.query("select slug, id from organisations")).rows.map((r) => [r.slug, r.id]));
const HOME = { sam: "meridian", alex: "meridian", noor: "northwind", li: "lotus", priya: "azentio", maya: "azentio", omar: "azentio", pat: "azentio", ada: "azentio" };

const q = async (sql, p = []) => (await c.query(sql, p)).rows;
const one = async (sql, p = []) => (await q(sql, p))[0];
const as = (who, org = HOME[who]) => c.query("select set_config('app.user_id', $1, true), set_config('app.org_id', $2, true)", [who ? U[who] : "", org ? O[org] : ""]);
class Fail extends Error {}
const check = (cond, msg) => { if (!cond) throw new Fail(msg); };
/** Expects the statement to be refused by Postgres; the savepoint keeps the transaction usable. */
async function refused(sql, p = [], pattern) {
  await c.query("savepoint s");
  try { await c.query(sql, p); } catch (e) {
    await c.query("rollback to savepoint s");
    if (pattern && !pattern.test(e.message)) throw new Fail(`refused with unexpected message: ${e.message}`);
    return;
  }
  await c.query("rollback to savepoint s");
  throw new Fail(`expected refusal: ${sql.slice(0, 80)}`);
}
/** Creates a contribution as the current persona in its active org, with the given consents. */
async function draft(visibility = "proposed_shared", consents = { store: true, publish: true }, title = "Test observation about seasonal cash flow") {
  const { id } = await one(`insert into contributions(org_id, author_id, visibility, type, title, body, industry, region, period_start, period_end, evidence_type, confidence)
    values (app_org(), app_uid(), $1, 'market_observation', $2, 'A sufficiently long body describing what was observed in the market.', 'Banking', 'India', '2026-01-01', '2026-03-31', 'internal_data', 'medium') returning id`, [visibility, title]);
  for (const [k, v] of Object.entries(consents)) await q("select consent_set($1, $2, $3)", [id, k, v]);
  return id;
}
const PUB = JSON.stringify({ title: "Reviewed shared title", body: "Reviewed and de-identified body text for participants.", industry: "Banking", region_band: "India", period_label: "Q1 2026" });
const visibleTo = async (who, sql, p) => { await as(who); return (await one(sql, p)).n; };
const sharedCount = (sid) => one("select count(*)::int n from shared_items where id = $1", [sid]).then((r) => r.n);

const tests = [];
const t = (id, area, name, fn) => tests.push({ id, area, name, fn });

// ---------------------------------------------------------------- capture
t("LC-01", "Capture", "Saving creates a private draft visible only to its author", async () => {
  await as("sam"); const id = await draft("private", { store: true });
  check((await one("select state, visibility from contributions where id = $1", [id])).state === "draft", "not a draft");
  for (const who of ["alex", "li", "maya", "ada"]) { await as(who); check(!(await q("select 1 from contributions where id = $1", [id])).length, `${who} can see a private draft`); }
});
t("LC-02", "Capture", "A contribution cannot be created in another organisation", async () => {
  await as("sam");
  await refused(`insert into contributions(org_id, author_id, type, title, body, industry, region, period_start, period_end, evidence_type, confidence)
    values ($1, app_uid(), 'market_observation', 'Wrong org test', 'A sufficiently long body for the check constraint.', 'Banking', 'India', '2026-01-01', '2026-02-01', 'anecdotal', 'low')`, [O.lotus], /row-level security/);
});
t("LC-03", "Capture", "A contribution cannot be created on behalf of another user", async () => {
  await as("sam");
  await refused(`insert into contributions(org_id, author_id, type, title, body, industry, region, period_start, period_end, evidence_type, confidence)
    values (app_org(), $1, 'market_observation', 'Impersonation test', 'A sufficiently long body for the check constraint.', 'Banking', 'India', '2026-01-01', '2026-02-01', 'anecdotal', 'low')`, [U.alex], /row-level security/);
});
t("LC-04", "Capture", "A contribution cannot be inserted directly as published", async () => {
  await as("sam");
  await refused(`insert into contributions(org_id, author_id, state, type, title, body, industry, region, period_start, period_end, evidence_type, confidence)
    values (app_org(), app_uid(), 'published', 'market_observation', 'Shortcut test', 'A sufficiently long body for the check constraint.', 'Banking', 'India', '2026-01-01', '2026-02-01', 'anecdotal', 'low')`, [], /row-level security/);
});
t("LC-05", "Capture", "Database rejects too-short body and a period that ends before it starts", async () => {
  await as("sam");
  await refused(`insert into contributions(org_id, author_id, type, title, body, industry, region, period_start, period_end, evidence_type, confidence)
    values (app_org(), app_uid(), 'market_observation', 'Short body', 'too short', 'Banking', 'India', '2026-01-01', '2026-02-01', 'anecdotal', 'low')`, [], /check constraint/);
  await refused(`insert into contributions(org_id, author_id, type, title, body, industry, region, period_start, period_end, evidence_type, confidence)
    values (app_org(), app_uid(), 'market_observation', 'Bad period', 'A sufficiently long body for the check constraint.', 'Banking', 'India', '2026-03-01', '2026-02-01', 'anecdotal', 'low')`, [], /check constraint/);
});
t("LC-06", "Capture", "Organisation visibility is visible to colleagues at once, never to other clients", async () => {
  await as("sam"); const id = await draft("org", { store: true });
  check(await visibleTo("alex", "select count(*)::int n from contributions where id = $1", [id]) === 1, "colleague cannot see org item");
  check(await visibleTo("li", "select count(*)::int n from contributions where id = $1", [id]) === 0, "other client sees org item");
  check(await visibleTo("maya", "select count(*)::int n from contributions where id = $1", [id]) === 0, "moderator sees org-only item");
});

// ---------------------------------------------------------------- consent and submission
t("LC-07", "Consent", "Submitting requires publication consent", async () => {
  await as("sam"); const id = await draft("proposed_shared", { store: true, publish: false });
  await refused("select contribution_submit($1)", [id], /publishing consent is required/);
});
t("LC-08", "Consent", "Only items proposed for community sharing can be submitted", async () => {
  await as("sam"); const id = await draft("org", { store: true, publish: true });
  await refused("select contribution_submit($1)", [id], /only contributions proposed/);
});
t("LC-09", "Workflow", "Submission notifies moderators, writes audit, and becomes visible to org and moderators", async () => {
  await as("sam"); const id = await draft();
  check(await visibleTo("alex", "select count(*)::int n from contributions where id = $1", [id]) === 0, "colleague sees an unsubmitted proposal");
  await as("sam"); await q("select contribution_submit($1)", [id]);
  check(await visibleTo("alex", "select count(*)::int n from contributions where id = $1", [id]) === 1, "colleague cannot see submitted proposal");
  check(await visibleTo("maya", "select count(*)::int n from contributions where id = $1 and state = 'submitted'", [id]) === 1, "moderator cannot see submission");
  check(await visibleTo("maya", "select count(*)::int n from notifications where message like 'New contribution waiting%' and link like '%' || $1", [id]) === 1, "moderator not notified");
  await as("ada"); // the audit log is readable by portal administrators only
  check((await one("select count(*)::int n from audit_events where entity_id = $1 and action = 'contribution.submitted'", [id])).n === 1, "no audit event");
});
t("LC-10", "Workflow", "Only the author can submit", async () => {
  await as("sam"); const id = await draft();
  await as("alex"); await refused("select contribution_submit($1)", [id], /not allowed/);
});

// ---------------------------------------------------------------- moderation
t("LC-11", "Moderation", "Return requires a reason, notifies the author, and allows edit and resubmission", async () => {
  await as("sam"); const id = await draft(); await q("select contribution_submit($1)", [id]);
  await as("maya"); await refused("select contribution_return($1, 'x')", [id], /reason is required/);
  await q("select contribution_return($1, 'Please clarify the period.')", [id]);
  await as("sam");
  check((await one("select state, return_reason from contributions where id = $1", [id])).return_reason === "Please clarify the period.", "reason not stored");
  check((await q("select 1 from notifications where message like 'Clarification requested%'")).length >= 1, "author not notified");
  await q("update contributions set body = body || ' Clarified.' where id = $1", [id]);
  await q("select contribution_submit($1)", [id]);
  check((await one("select state from contributions where id = $1", [id])).state === "submitted", "resubmission failed");
});
t("LC-12", "Moderation", "Publishing copies only reviewed fields; the shared copy carries no source, org or author", async () => {
  await as("sam"); const id = await draft(); await q("select contribution_submit($1)", [id]);
  await as("maya"); const { sid } = await one("select contribution_publish($1, $2, 'internal note') sid", [id, PUB]);
  await as("li");
  const s = await one("select title, body, attribution_label from shared_items where id = $1", [sid]);
  check(s?.title === "Reviewed shared title" && s.attribution_label === null, "shared copy wrong or invisible");
  await refused("select contribution_id from shared_items where id = $1", [sid], /permission denied/);
  await as("sam");
  check((await one("select count(*)::int n from review_notes where contribution_id = $1", [id])).n === 0, "author can read internal reviewer notes");
});
t("LC-13", "Moderation", "Only moderators can publish, return or reject", async () => {
  await as("sam"); const id = await draft(); await q("select contribution_submit($1)", [id]);
  for (const who of ["priya", "omar", "ada", "alex"]) {
    await as(who);
    await refused("select contribution_publish($1, $2, '')", [id, PUB], /not allowed/);
    await refused("select contribution_return($1, 'Please clarify this.')", [id], /not allowed/);
  }
});
t("LC-14", "Moderation", "Illegal transitions are refused (draft to published, published to returned)", async () => {
  await as("sam"); const id = await draft();
  await as("maya"); await refused("select contribution_publish($1, $2, '')", [id, PUB], /illegal transition/);
  await as("sam"); await q("select contribution_submit($1)", [id]);
  await as("maya"); await q("select contribution_publish($1, $2, '')", [id, PUB]);
  await refused("select contribution_return($1, 'Too late to return.')", [id], /illegal transition/);
});
t("LC-15", "Moderation", "Attribution needs the author's attribution consent", async () => {
  await as("sam"); const id = await draft("proposed_shared", { store: true, publish: true, attribution: false }); await q("select contribution_submit($1)", [id]);
  await as("maya");
  await refused("select contribution_publish($1, $2, '')", [id, JSON.stringify({ ...JSON.parse(PUB), attribution_label: "Meridian Bank" })], /attribution requires/);
});
t("LC-16", "Moderation", "Rejection stores the reason for the author and keeps the internal note private", async () => {
  await as("sam"); const id = await draft(); await q("select contribution_submit($1)", [id]);
  await as("maya"); await q("select contribution_reject($1, 'Duplicate of an existing item.', 'seen before')", [id]);
  await as("sam");
  check((await one("select reason from reviews where contribution_id = $1 and decision = 'rejected'", [id]))?.reason === "Duplicate of an existing item.", "author cannot see reason");
  check((await one("select count(*)::int n from review_notes where contribution_id = $1", [id])).n === 0, "author sees internal note");
});

// ---------------------------------------------------------------- withdrawal, consent changes, versions
t("LC-17", "Withdrawal", "Revoking publication consent on a published item withdraws it", async () => {
  await as("sam"); const id = await draft(); await q("select contribution_submit($1)", [id]);
  await as("maya"); const { sid } = await one("select contribution_publish($1, $2, '') sid", [id, PUB]);
  await as("sam"); await q("select consent_set($1, 'publish', false)", [id]);
  await as("li"); check(await sharedCount(sid) === 0, "still visible after consent revoked");
});
t("LC-18", "Withdrawal", "A client admin of the same organisation can withdraw; another organisation's admin cannot", async () => {
  await as("sam"); const id = await draft(); await q("select contribution_submit($1)", [id]);
  await as("noor", "northwind"); await refused("select contribution_withdraw($1)", [id], /not allowed/);
  await as("alex"); await q("select contribution_withdraw($1)", [id]);
  check((await one("select state from contributions where id = $1", [id])).state === "withdrawn", "not withdrawn");
});
t("LC-18b", "Withdrawal", "Anonymous callers cannot submit, withdraw or change consent on any contribution", async () => {
  await as("sam"); const id = await draft();
  await as(null, null);
  await refused("select contribution_submit($1)", [id], /not allowed/);
  await refused("select consent_set($1, 'publish', true)", [id], /not allowed/);
  await as("sam"); await q("select contribution_submit($1)", [id]);
  await as(null, null); await refused("select contribution_withdraw($1)", [id], /not allowed/);
});
t("LC-19", "Withdrawal", "Withdrawal is not possible from draft", async () => {
  await as("sam"); const id = await draft();
  await refused("select contribution_withdraw($1)", [id], /illegal transition/);
});
t("LC-20", "Versions", "Revising a published item keeps the old copy live until the new version is reviewed", async () => {
  await as("sam"); const id = await draft(); await q("select contribution_submit($1)", [id]);
  await as("maya"); const { sid: old } = await one("select contribution_publish($1, $2, '') sid", [id, PUB]);
  await as("sam"); const { nid } = await one("select contribution_new_version($1) nid", [id]);
  check((await one("select version, state from contributions where id = $1", [nid])).version === 2, "not version 2");
  await refused("select contribution_new_version($1)", [id], /already in progress/);
  await q("select contribution_submit($1)", [nid]);
  await as("li"); check(await sharedCount(old) === 1, "old copy hidden before re-review");
  await as("maya"); const { sid: neu } = await one("select contribution_publish($1, $2, '') sid", [nid, PUB]);
  await as("li"); check(await sharedCount(old) === 0 && await sharedCount(neu) === 1, "old copy not superseded");
});
t("LC-21", "Consent", "Revoking attribution consent removes the attribution label", async () => {
  await as("sam"); const id = await draft("proposed_shared", { store: true, publish: true, attribution: true }); await q("select contribution_submit($1)", [id]);
  await as("maya"); const { sid } = await one("select contribution_publish($1, $2, '') sid", [id, JSON.stringify({ ...JSON.parse(PUB), attribution_label: "A bank in India" })]);
  await as("sam"); await q("select consent_set($1, 'attribution', false)", [id]);
  await as("li"); check((await one("select attribution_label from shared_items where id = $1", [sid])).attribution_label === null, "label kept");
});
t("LC-22", "Consent", "Consent history is append-only and only the author can change it", async () => {
  await as("sam"); const id = await draft();
  await q("select consent_set($1, 'training', true)", [id]); await q("select consent_set($1, 'training', false)", [id]);
  check((await one("select count(*)::int n from consents where contribution_id = $1 and kind = 'training'", [id])).n === 2, "history not kept");
  await refused("delete from consents where contribution_id = $1", [id], /permission denied/);
  await as("alex"); await refused("select consent_set($1, 'publish', true)", [id], /not allowed/);
});

// ---------------------------------------------------------------- reports
t("LC-23", "Reports", "A client can report a shared item; moderators can unpublish, republish and dismiss", async () => {
  await as("li"); const { id: sid } = await one("select id from shared_items where status = 'published' limit 1");
  await q("select report_item($1, 'misleading', 'Looks off')", [sid]);
  await as("sam"); check((await one("select count(*)::int n from reports where shared_item_id = $1", [sid])).n === 0, "another client sees the report");
  await as("li"); await refused("select shared_set_status($1, 'unpublished', 'Not a moderator.')", [sid], /not allowed/);
  await as("maya"); await q("select shared_set_status($1, 'unpublished', 'Checking the report.')", [sid]);
  await as("li"); check(await sharedCount(sid) === 0, "unpublished item still visible");
  await as("maya"); await q("select shared_set_status($1, 'published', 'Report dismissed after review.')", [sid]);
  check((await one("select status from reports where shared_item_id = $1 order by created_at desc limit 1", [sid])).status === "dismissed", "report not closed");
  await as("li"); check(await sharedCount(sid) === 1, "republished item not visible");
});

// ---------------------------------------------------------------- themes, aggregation, ideas
t("LC-24", "Aggregation", "Facet counts only show values backed by at least 3 institutions", async () => {
  await as("li");
  const rows = await q("select * from facet_counts('region_band')");
  check(rows.every((r) => r.orgs >= 3), "a small cohort was returned");
  await refused("select * from facet_counts('contribution_id')", [], /unsupported facet/);
});
t("LC-25", "Aggregation", "The cohort threshold cannot be lowered below 3, and only admins can change it", async () => {
  await as("ada"); await refused("select setting_set('min_cohort_orgs', '2')", [], /cannot go below 3/);
  await as("maya"); await refused("select setting_set('min_cohort_orgs', '5')", [], /not allowed/);
  await as("ada"); await q("select setting_set('min_cohort_orgs', '4')");
  await as("li"); check((await q("select * from theme_stats() where orgs is not null")).length === 0, "counts shown below the new threshold");
});
t("LC-26", "Themes", "Only moderators and product owners can assign themes", async () => {
  await as("li"); const { id: sid } = await one("select id from shared_items where status = 'published' limit 1");
  const { id: tid } = await one("select id from themes limit 1");
  await refused("select theme_assign($1, $2)", [sid, tid], /not allowed/);
  await as("priya"); await refused("select theme_assign($1, $2)", [sid, tid], /not allowed/);
  await as("omar"); await q("select theme_assign($1, $2)", [sid, tid]);
});
t("LC-27", "Ideas", "Only product owners create ideas; withdrawn items cannot be linked as evidence", async () => {
  await as("maya"); await refused("select idea_create('Idea title here', 'Problem text long', null, 'Outcome text long', 'Team', 'low', null, '{}')", [], /not allowed/);
  await as("sam"); const id = await draft(); await q("select contribution_submit($1)", [id]);
  await as("maya"); const { sid } = await one("select contribution_publish($1, $2, '') sid", [id, PUB]);
  await as("sam"); await q("select contribution_withdraw($1)", [id]);
  await as("omar"); const { iid } = await one("select idea_create('Idea title here', 'Problem text long', null, 'Outcome text long', 'Team', 'low', null, $1) iid", [[sid]]);
  check((await one("select count(*)::int n from idea_evidence where idea_id = $1", [iid])).n === 0, "withdrawn evidence linked");
});
t("LC-28", "Ideas", "Proposed ideas stay internal; later statuses reach clients and notify evidence authors", async () => {
  await as("li"); const { id: sid } = await one("select s.id from shared_items s where s.status = 'published' and s.title = 'Manual re-mapping for revised returns' ");
  await as("omar"); const { iid } = await one("select idea_create('Fresh idea for testing', 'Problem text long', 'riva', 'Outcome text long', 'Team', 'high', null, $1) iid", [[sid]]);
  await as("li"); check(!(await q("select 1 from ideas_public() where id = $1", [iid])).length, "Proposed idea visible to client");
  await as("omar"); await q("select idea_set_status($1, 'Under review', 'Being assessed by the team.')", [iid]);
  await as("li");
  const pub = await one("select * from ideas_public() where id = $1", [iid]);
  check(pub && !("priority" in pub), "client projection wrong");
  check((await one("select count(*)::int n from notifications where message like '%Fresh idea for testing%'")).n >= 1, "evidence author not notified");
  await as("omar"); check((await one("select count(*)::int n from idea_status_history where idea_id = $1", [iid])).n === 2, "status history missing");
});
t("LC-29", "Ideas", "Status changes require the product owner grant", async () => {
  await as("omar"); const { id } = await one("select id from ideas limit 1");
  await as("maya"); await refused("select idea_set_status($1, 'Released', 'Should not work.')", [id], /not allowed/);
});

// ---------------------------------------------------------------- identity administration
t("LC-30", "Invitations", "Members cannot invite; admins invite client roles only", async () => {
  await as("sam"); await refused("select invite_create('x@meridian.example', 'client_member', 'h1', now() + interval '1 day')", [], /only a client administrator/);
  await as("alex"); await refused("select invite_create('x@meridian.example', 'employee', 'h2', now() + interval '1 day')", [], /role not allowed/);
  await q("select invite_create('x@meridian.example', 'client_member', 'h3', now() + interval '1 day')");
  check((await one("select count(*)::int n from invitations where token_hash = 'h3'")).n === 1, "invitation not visible to its admin");
  await as("noor", "northwind"); check((await one("select count(*)::int n from invitations where token_hash = 'h3'")).n === 0, "other org admin sees invitation");
});
t("LC-31", "Invitations", "Invitations are bound to the email, single-use, and expire", async () => {
  await c.query("reset role"); // test setup: a verified user who has no membership yet
  const { id: xid } = await one("insert into users(email, display_name) values ('x@meridian.example', 'X') returning id");
  await c.query("set local role portal_app");
  await as("alex"); await q("select invite_create('x@meridian.example', 'client_member', 'h4', now() + interval '1 day')");
  await q("select invite_create('x@meridian.example', 'client_member', 'h5', now() - interval '1 minute')");
  await as("li"); await refused("select invite_accept('h4')", [], /different email/);
  await as(null, null); await refused("select invite_accept('h4')", [], /different email/);
  await c.query("select set_config('app.user_id', $1, true), set_config('app.org_id', '', true)", [xid]);
  await refused("select invite_accept('h5')", [], /not valid/);
  await q("select invite_accept('h4')");
  check((await one("select is_member($1) m", [O.meridian])).m === true, "membership not created");
  await refused("select invite_accept('h4')", [], /not valid/);
});
t("LC-32", "Members", "Client admins manage only client members of their own org and not themselves", async () => {
  await as("alex");
  await refused("select member_set($1, 'client_member', 'active')", [U.alex], /own membership/);
  await refused("select member_set($1, 'client_member', 'revoked')", [U.li], /member not found/);
  await q("select member_set($1, 'client_member', 'revoked')", [U.sam]);
  await as("sam"); check((await one("select is_member($1) m", [O.meridian])).m === false, "revoked member still active");
});
t("LC-33", "Grants", "Admins grant platform roles to employees only, and cannot remove their own admin grant", async () => {
  await as("ada");
  await q("select grant_set($1, 'moderator', true)", [U.priya]);
  await refused("select grant_set($1, 'moderator', true)", [U.sam], /verified employees only/);
  await refused("select grant_set($1, 'portal_admin', false)", [U.ada], /own admin grant/);
  await as("priya"); check((await one("select has_grant('moderator') g")).g === true, "grant not effective");
});
t("LC-34", "Grants", "A grant row on a non-employee has no effect", async () => {
  await c.query("reset role"); await c.query("insert into grants(user_id, grant_name) values ($1, 'moderator')", [U.sam]); await c.query("set local role portal_app");
  await as("sam"); check((await one("select has_grant('moderator') g")).g === false, "client gained moderator power");
});
t("LC-35", "Provisioning", "Only admins provision employees, and only @azentio.com addresses", async () => {
  await as("maya"); await refused("select employee_provision('new@azentio.com', 'New')", [], /not allowed/);
  await as("ada"); await refused("select employee_provision('new@gmail.com', 'New')", [], /azentio\.com/);
  await q("select employee_provision('new@azentio.com', 'New')");
});

// ---------------------------------------------------------------- sandbox, content, misc
t("LC-36", "Sandbox", "Clients can run only entitled offerings in their own workspace; employees run internally", async () => {
  const run = (org, off) => q("insert into playground_runs(user_id, org_id, offering_id, scenario, output) values (app_uid(), $1, $2, 'agro:standard', '{}')", [org, off]);
  await as("li"); await run(O.lotus, "sme-credit-decisioning");
  await refused("insert into playground_runs(user_id, org_id, offering_id, scenario, output) values (app_uid(), $1, 'riva', 'x', '{}')", [O.lotus], /row-level security/);
  await refused("insert into playground_runs(user_id, org_id, offering_id, scenario, output) values (app_uid(), null, 'sme-credit-decisioning', 'x', '{}')", [], /row-level security/);
  await as("priya"); await run(null, "seasonality-lab");
  await as("sam"); check((await one("select count(*)::int n from playground_runs")).n === 0, "runs leak across users");
});
t("LC-37", "Content", "Only publishers publish content, and every item needs an audience", async () => {
  await as("priya"); await refused("insert into content_items(kind, title, body, audience, created_by) values ('insight','T','Body text here','public', app_uid())", [], /row-level security/);
  await as("pat"); await q("insert into content_items(kind, title, body, audience, created_by) values ('insight','T','Body text here','employee', app_uid())");
  await refused("insert into content_items(kind, title, body, audience, created_by) values ('briefing','T','Body text here','org', app_uid())", [], /check constraint/);
});
t("LC-38", "Public", "Anonymous visitors can submit enquiries but cannot read them", async () => {
  await as(null, null);
  await q("insert into enquiries(kind, name, email) values ('demo', 'Visitor', 'v@example.com')");
  check((await one("select count(*)::int n from enquiries")).n === 0, "anonymous can read enquiries");
  await refused("insert into enquiries(kind, name, email) values ('demo', 'V', 'v@example.com')", [], /check constraint/);
});
t("LC-39", "Notifications", "Notifications are private to their recipient", async () => {
  await as("li"); check((await one("select count(*)::int n from notifications where user_id <> app_uid()")).n === 0, "sees other users' notifications");
  await refused("update notifications set message = 'x'", [], /permission denied/);
});
t("LC-40", "Federated", "Model runs are visible to employees only and decisions need a portal admin", async () => {
  await as("li"); check((await one("select count(*)::int n from fl_runs")).n === 0, "client sees model runs");
  await as("priya"); const r = await one("select id from fl_runs limit 1");
  if (r) { await refused("select fl_decide($1, 'approved')", [r.id], /portal administrator/); await as("ada"); await q("select fl_decide($1, 'approved')", [r.id]); }
});

// ---------------------------------------------------------------- review hardening
t("LC-41", "Moderation", "A moderator cannot review their own contribution", async () => {
  await as("maya"); const id = await draft(); await q("select contribution_submit($1)", [id]);
  await refused("select contribution_publish($1, $2, '')", [id, PUB], /own contribution/);
  await refused("select contribution_return($1, 'Please clarify this.')", [id], /own contribution/);
  await refused("select contribution_reject($1, 'Not suitable here.', '')", [id], /own contribution/);
});
t("LC-42", "Versions", "Publishing a revision does not rewrite a withdrawn parent as superseded", async () => {
  await as("sam"); const id = await draft(); await q("select contribution_submit($1)", [id]);
  await as("maya"); await q("select contribution_publish($1, $2, '')", [id, PUB]);
  await as("sam"); const { nid } = await one("select contribution_new_version($1) nid", [id]);
  await q("select contribution_withdraw($1)", [id]);
  await q("select consent_set($1, 'publish', true)", [nid]); await q("select contribution_submit($1)", [nid]);
  await as("maya"); await q("select contribution_publish($1, $2, '')", [nid, PUB]);
  await as("sam"); check((await one("select state from contributions where id = $1", [id])).state === "withdrawn", "withdrawn parent was rewritten");
});
t("LC-43", "Consent", "Consent state is visible only to the author or a moderator, and notify() is not callable", async () => {
  await as("sam"); const id = await draft("org", { store: true, publish: true });
  check((await one("select consent_value($1, 'publish') v", [id])).v === true, "author cannot read own consent");
  await as("alex"); check((await one("select consent_value($1, 'publish') v", [id])).v === false, "colleague can read consent state");
  await as("li"); check((await one("select consent_value($1, 'publish') v", [id])).v === false, "other client can read consent state");
  await refused("select notify($1, 'spoofed message', null)", [U.sam], /permission denied/);
});

// ---------------------------------------------------------------- runner
let pass = 0;
const rows = [];
for (const x of tests) {
  await c.query("begin");
  await c.query("set local role portal_app");
  let result = "PASS", detail = "";
  try { await x.fn(); pass++; } catch (e) { result = "FAIL"; detail = e.message; }
  await c.query("rollback");
  rows.push(`| ${x.id} | ${x.area} | ${x.name} | ${result}${detail ? `: ${detail.replace(/\|/g, "/")}` : ""} |`);
  console.log(`${result}  ${x.id}  ${x.name}${detail ? `  -> ${detail}` : ""}`);
}
await c.end();
fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs", "lifecycle-results.md"),
  `# Lifecycle test results\n\nRun ${new Date().toISOString()}. ${pass}/${tests.length} passed. Each test runs as personas through the portal_app role in a rolled-back transaction.\n\n| Test | Area | Scenario | Result |\n|---|---|---|---|\n${rows.join("\n")}\n`);
console.log(`\n${pass}/${tests.length} passed`);
process.exit(pass === tests.length ? 0 : 1);
