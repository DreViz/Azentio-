"use server";
import { redirect } from "next/navigation";
import { requireViewer, db, Viewer } from "@/lib/session";
import { Q, dbMessage } from "@/lib/db";
import { setActiveOrg } from "@/lib/auth";
import { sha256, token } from "@/lib/crypto";
import { InputError, str, opt, oneOf, date, email, uuid } from "@/lib/validate";
import { CONTRIB_TYPES, EVIDENCE, CONFIDENCE, VISIBILITY, IDEA_STATUS } from "@/lib/labels";
import { scanForAuthor } from "@/lib/redact";
import { APPLICANTS, runSeasonal, runStandard } from "@/lib/playground";

type Result = { to?: string; msg?: string } | void;
const withParam = (path: string, k: string, v: string) => `${path}${path.includes("?") ? "&" : "?"}${k}=${encodeURIComponent(v)}`;

/**
 * Runs a mutation as the signed-in viewer inside one RLS-scoped transaction.
 * Errors from validation or from policy functions come back as a readable message on `back`.
 */
async function act(back: string, fn: (v: Viewer, q: Q) => Promise<Result>) {
  const v = await requireViewer();
  let r: Result;
  try {
    r = await db(v, (q) => fn(v, q));
  } catch (e) {
    redirect(withParam(back, "error", e instanceof InputError ? e.message : dbMessage(e)));
  }
  const to = r?.to ?? back;
  redirect(r?.msg ? withParam(to, "msg", r.msg) : to);
}

const checked = (f: FormData, n: string) => f.get(n) === "on";

// ---------------------------------------------------------------- contributions
function contributionFields(f: FormData) {
  const start = date(f, "period_start"), end = date(f, "period_end");
  if (end < start) throw new InputError("The observation period must end after it starts.");
  return {
    type: oneOf(f, "type", CONTRIB_TYPES), title: str(f, "title", 5, 140), body: str(f, "body", 20, 4000),
    offering_id: opt(f, "offering_id", 80), industry: str(f, "industry", 2, 80), region: str(f, "region", 2, 120),
    period_start: start, period_end: end, evidence_type: oneOf(f, "evidence_type", EVIDENCE), confidence: oneOf(f, "confidence", CONFIDENCE),
    visibility: oneOf(f, "visibility", VISIBILITY),
  };
}

export async function createContribution(f: FormData) {
  return act("/portal/contributions/new", async (v, q) => {
    if (!checked(f, "consent_store")) throw new InputError("We need your permission to store and process the contribution before saving it.");
    const c = contributionFields(f);
    const flags = [...new Set(scanForAuthor(`${c.title}\n${c.body}`).map((x) => x.kind))];
    const [row] = await q<{ id: string }>(
      `insert into contributions(org_id, author_id, visibility, type, title, body, offering_id, industry, region, period_start, period_end, evidence_type, confidence, sensitive_flags)
       values (app_org(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) returning id`,
      [v.id, c.visibility, c.type, c.title, c.body, c.offering_id, c.industry, c.region, c.period_start, c.period_end, c.evidence_type, c.confidence, flags]);
    for (const k of ["store", "publish", "attribution", "training"]) await q("select consent_set($1, $2, $3)", [row.id, k, checked(f, `consent_${k}`)]);
    await q("select audit('contribution.created', 'contribution', $1, '{}')", [row.id]);
    return { to: `/portal/contributions/${row.id}`, msg: flags.length ? `Saved as a private draft. Automated checks flagged possible sensitive details (${flags.join(", ")}). Please review before submitting.` : "Saved as a draft. Nothing is shared until you submit it for review." };
  });
}

export async function updateContribution(f: FormData) {
  const id = uuid(f.get("id"));
  return act(`/portal/contributions/${id}`, async (_v, q) => {
    const c = contributionFields(f);
    const flags = [...new Set(scanForAuthor(`${c.title}\n${c.body}`).map((x) => x.kind))];
    const r = await q(`update contributions set type=$2, title=$3, body=$4, offering_id=$5, industry=$6, region=$7, period_start=$8, period_end=$9,
                       evidence_type=$10, confidence=$11, visibility=$12, sensitive_flags=$13, updated_at=now() where id = $1 returning id`,
      [id, c.type, c.title, c.body, c.offering_id, c.industry, c.region, c.period_start, c.period_end, c.evidence_type, c.confidence, c.visibility, flags]);
    if (!r.length) throw new InputError("Only your own drafts or returned contributions can be edited.");
    await q("select audit('contribution.edited', 'contribution', $1, '{}')", [id]);
    return { msg: "Changes saved." };
  });
}

export async function submitContribution(f: FormData) {
  const id = uuid(f.get("id"));
  return act(`/portal/contributions/${id}`, async (_v, q) => {
    await q("select contribution_submit($1)", [id]);
    return { msg: "Submitted for review. A moderator will check and de-identify it before anything is shared." };
  });
}

export async function withdrawContribution(f: FormData) {
  const id = uuid(f.get("id"));
  return act(`/portal/contributions/${id}`, async (_v, q) => {
    const t0 = performance.now();
    await q("select contribution_withdraw($1)", [id]);
    // Verify inside the same transaction that every read path now excludes the shared copy.
    const sids = (await q<{ s: string }>("select shared_for_contribution($1) s", [id])).map((r) => r.s);
    const [{ n }] = await q<{ n: number }>("select count(*)::int n from shared_items where id = any($1::uuid[]) and status = 'published'", [sids]);
    const ms = Math.round(performance.now() - t0);
    return { msg: n === 0 ? `Withdrawn. Verified removed from the shared feed, search and AIRA retrieval in ${ms} ms. Copies already viewed by others cannot be recalled.` : "Withdrawn, but verification found a remaining copy. Please report this." };
  });
}

export async function reviseContribution(f: FormData) {
  const id = uuid(f.get("id"));
  return act(`/portal/contributions/${id}`, async (_v, q) => {
    const [{ nid }] = await q<{ nid: string }>("select contribution_new_version($1) nid", [id]);
    return { to: `/portal/contributions/${nid}`, msg: "New version created as a draft. The published version stays unchanged until this one is reviewed." };
  });
}

export async function setConsent(f: FormData) {
  const id = uuid(f.get("id"));
  const kind = oneOf(f, "kind", ["store", "publish", "attribution", "training"] as const);
  const granted = f.get("granted") === "true";
  return act(`/portal/contributions/${id}`, async (_v, q) => {
    await q("select consent_set($1, $2, $3)", [id, kind, granted]);
    return { msg: `${kind[0].toUpperCase() + kind.slice(1)} permission ${granted ? "granted" : "withdrawn"}. Recorded in the consent history.` };
  });
}

// ---------------------------------------------------------------- moderation
export async function publishContribution(f: FormData) {
  const id = uuid(f.get("id"));
  return act(`/portal/moderation/${id}`, async (_v, q) => {
    if (!checked(f, "confirm")) throw new InputError("Confirm that you reviewed the shared copy for identifying details.");
    const p = {
      title: str(f, "title", 5, 140), body: str(f, "body", 20, 4000), industry: str(f, "industry", 2, 80),
      region_band: str(f, "region_band", 2, 80), period_label: str(f, "period_label", 2, 40),
      attribution_label: opt(f, "attribution_label", 120) ?? "", theme_id: opt(f, "theme_id", 40) ?? "",
    };
    await q("select contribution_publish($1, $2, $3)", [id, JSON.stringify(p), opt(f, "note", 1000) ?? ""]);
    return { to: "/portal/moderation", msg: "Published. Only the reviewed fields are visible to participants." };
  });
}

export async function returnContribution(f: FormData) {
  const id = uuid(f.get("id"));
  return act(`/portal/moderation/${id}`, async (_v, q) => {
    await q("select contribution_return($1, $2)", [id, str(f, "reason", 5, 1000)]);
    return { to: "/portal/moderation", msg: "Returned to the author with your clarification request." };
  });
}

export async function rejectContribution(f: FormData) {
  const id = uuid(f.get("id"));
  return act(`/portal/moderation/${id}`, async (_v, q) => {
    await q("select contribution_reject($1, $2, $3)", [id, str(f, "reason", 5, 1000), opt(f, "note", 1000) ?? ""]);
    return { to: "/portal/moderation", msg: "Rejected. The author was told why." };
  });
}

export async function setSharedStatus(f: FormData) {
  const sid = uuid(f.get("sid"));
  const st = oneOf(f, "status", ["published", "unpublished", "withdrawn"] as const);
  return act("/portal/moderation", async (_v, q) => {
    await q("select shared_set_status($1, $2, $3)", [sid, st, str(f, "reason", 5, 1000)]);
    return { msg: `Shared item ${st === "withdrawn" ? "removed" : st}. The contributor was informed.` };
  });
}

export async function reportItem(f: FormData) {
  const sid = uuid(f.get("sid"));
  return act("/portal/learning", async (_v, q) => {
    await q("select report_item($1, $2, $3)", [sid, oneOf(f, "reason", ["misleading", "confidential", "inappropriate", "duplicate"] as const), opt(f, "details", 1000) ?? ""]);
    return { msg: "Thank you. A moderator will review the report. You did not need to name anyone." };
  });
}

// ---------------------------------------------------------------- themes and ideas
export async function createTheme(f: FormData) {
  return act("/portal/themes", async (v, q) => {
    const [t] = await q<{ id: string }>("insert into themes(title, summary, limitations, created_by) values ($1,$2,$3,$4) returning id",
      [str(f, "title", 3, 120), str(f, "summary", 10, 600), str(f, "limitations", 10, 400), v.id]);
    const items = f.getAll("item").map(uuid);
    for (const sid of items) await q("select theme_assign($1, $2)", [sid, t.id]);
    await q("select audit('theme.created', 'theme', $1, $2)", [t.id, JSON.stringify({ items })]);
    return { msg: `Theme created with ${items.length} linked observations.` };
  });
}

export async function createIdea(f: FormData) {
  return act("/portal/ideas", async (_v, q) => {
    const evidence = f.getAll("evidence").map(uuid);
    await q("select idea_create($1,$2,$3,$4,$5,$6,$7,$8)", [
      str(f, "title", 5, 140), str(f, "problem", 10, 2000), opt(f, "offering_id", 80), str(f, "proposed_outcome", 10, 2000),
      str(f, "owner_team", 2, 120), oneOf(f, "priority", ["low", "medium", "high"] as const), opt(f, "theme_id", 40), evidence]);
    return { msg: "Improvement idea created as Proposed. Clients see it only once it moves to Under review or later." };
  });
}

export async function setIdeaStatus(f: FormData) {
  const id = uuid(f.get("id"));
  return act("/portal/ideas", async (_v, q) => {
    await q("select idea_set_status($1, $2, $3)", [id, oneOf(f, "status", IDEA_STATUS), str(f, "public_note", 5, 600)]);
    return { msg: "Status updated, audited, and contributors of linked evidence were notified." };
  });
}

// ---------------------------------------------------------------- client administration
export async function createInvite(f: FormData) {
  return act("/portal/org", async (_v, q) => {
    const raw = token();
    await q("select invite_create($1, $2, $3, now() + interval '72 hours')", [email(f), oneOf(f, "role", ["client_member", "client_admin"] as const), sha256(raw)]);
    // The link is shown once. Only its hash is stored. In production it is emailed through the outbox.
    return { msg: `Invitation created. Single-use link, valid for 72 hours: /invite/${raw}` };
  });
}

export async function revokeInvite(f: FormData) {
  return act("/portal/org", async (_v, q) => {
    await q("select invite_revoke($1)", [uuid(f.get("id"))]);
    return { msg: "Invitation revoked." };
  });
}

export async function setMember(f: FormData) {
  return act("/portal/org", async (_v, q) => {
    await q("select member_set($1, $2, $3)", [uuid(f.get("user_id")), oneOf(f, "role", ["client_member", "client_admin"] as const), oneOf(f, "status", ["active", "revoked"] as const)]);
    return { msg: "Membership updated." };
  });
}

export async function acceptInvite(f: FormData) {
  const raw = String(f.get("token") ?? "");
  const v = await requireViewer();
  let orgId: string;
  try {
    orgId = (await db(v, (q) => q<{ o: string }>("select invite_accept($1) o", [sha256(raw)])))[0].o;
    await setActiveOrg(v.id, orgId);
  } catch (e) {
    redirect(withParam(`/invite/${encodeURIComponent(raw)}`, "error", dbMessage(e)));
  }
  redirect(withParam("/portal", "msg", "Welcome to your workspace. Joining does not share any of your data."));
}

// ---------------------------------------------------------------- portal administration
export async function setGrant(f: FormData) {
  return act("/portal/admin", async (_v, q) => {
    await q("select grant_set($1, $2, $3)", [uuid(f.get("user_id")), oneOf(f, "grant", ["moderator", "publisher", "portal_admin", "product_owner"] as const), f.get("on") === "true"]);
    return { msg: "Grant updated and audited." };
  });
}

export async function provisionEmployee(f: FormData) {
  return act("/portal/admin", async (_v, q) => {
    await q("select employee_provision($1, $2)", [email(f), str(f, "name", 2, 120)]);
    return { msg: "Employee provisioned with a plain employee membership and no grants." };
  });
}

export async function setSetting(f: FormData) {
  return act("/portal/admin", async (_v, q) => {
    const v = str(f, "value", 1, 3);
    if (!/^\d+$/.test(v)) throw new InputError("Enter a whole number.");
    await q("select setting_set('min_cohort_orgs', $1)", [v]);
    return { msg: "Minimum cohort updated and audited." };
  });
}

export async function decideModel(f: FormData) {
  return act("/portal/federated", async (_v, q) => {
    await q("select fl_decide($1, $2)", [uuid(f.get("id")), oneOf(f, "status", ["approved", "rejected", "rolled_back"] as const)]);
    return { msg: "Decision recorded in the model lineage and audit log." };
  });
}

// ---------------------------------------------------------------- publishing
export async function createContent(f: FormData) {
  return act("/portal/studio", async (v, q) => {
    const audience = oneOf(f, "audience", ["public", "employee", "clients", "org", "entitled"] as const);
    const orgId = audience === "org" ? uuid(f.get("org_id")) : null;
    const off = audience === "entitled" ? str(f, "offering_id", 2, 80) : null;
    await q(`insert into content_items(kind, title, body, audience, org_id, offering_id, starts_at, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [oneOf(f, "kind", ["insight", "banner", "broadcast", "briefing", "release_note"] as const), str(f, "title", 3, 160), str(f, "body", 10, 4000),
       audience, orgId, off, opt(f, "starts_at", 30), v.id]);
    await q("select audit('content.created', 'content', null, $1)", [JSON.stringify({ audience })]);
    return { msg: `Published to audience: ${audience}.` };
  });
}

// ---------------------------------------------------------------- sandbox and notifications
export async function runSandbox(f: FormData) {
  return act("/portal/sandbox", async (v, q) => {
    const offering = str(f, "offering_id", 2, 80);
    const mode = oneOf(f, "mode", ["standard", "seasonality"] as const);
    const a = APPLICANTS.find((x) => x.id === f.get("applicant"));
    if (!a) throw new InputError("Choose a synthetic applicant.");
    if (mode === "seasonality" && !v.isEmployee) throw new InputError("This experimental method is available to employees only.");
    const out = mode === "seasonality" ? runSeasonal(a) : runStandard(a);
    // Employees run in the internal sandbox; clients run in their own workspace, which must be entitled.
    const orgId = v.activeOrg?.kind === "client" ? v.activeOrg.org_id : null;
    const [r] = await q<{ id: string }>("insert into playground_runs(user_id, org_id, offering_id, scenario, output) values ($1,$2,$3,$4,$5) returning id",
      [v.id, orgId, offering, `${a.id}:${mode}`, JSON.stringify(out)]);
    return { to: `/portal/sandbox?run=${r.id}` };
  });
}

export async function sandboxFeedback(f: FormData) {
  const id = uuid(f.get("id"));
  return act(`/portal/sandbox?run=${id}`, async (_v, q) => {
    await q("update playground_runs set rating = $2, feedback = $3 where id = $1", [id, oneOf(f, "rating", ["useful", "needs_evidence", "wrong"] as const), opt(f, "feedback", 1000)]);
    return { msg: "Feedback recorded. Thank you." };
  });
}

export async function markNotificationsRead() {
  return act("/portal/notifications", async (_v, q) => {
    await q("update notifications set read_at = now() where read_at is null");
  });
}
