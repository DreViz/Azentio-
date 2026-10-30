import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer, db } from "@/lib/session";
import { Badge, Flash, Notice, PageHeader, fmtTime } from "@/components/ui";
import ContributionForm from "@/components/ContributionForm";
import { STATE_TONE, VISIBILITY_TEXT, human } from "@/lib/labels";
import { reviseContribution, setConsent, submitContribution, updateContribution, withdrawContribution } from "@/app/actions/portal";
import { uuid } from "@/lib/validate";

type C = {
  id: string; org_id: string; author_id: string; parent_id: string | null; version: number; visibility: string; state: string; type: string; title: string; body: string;
  offering_id: string | null; industry: string; region: string; period_start: string; period_end: string; evidence_type: string; confidence: string;
  sensitive_flags: string[]; return_reason: string | null; updated_at: string;
};

const CONSENTS = [
  ["store", "Store and process", "Keep this record in your workspace and run automated checks on it."],
  ["publish", "Publish shared copy", "Allow a reviewed, de-identified copy to be shown to approved participants."],
  ["attribution", "Attribution", "Show your organisation's name on the shared copy. Opt-in and still reviewed."],
  ["training", "Model training", "Allow use in a future, separately approved training or federated-learning programme. No such programme uses it today."],
] as const;

export default async function ContributionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const v = await requireViewer();
  let cid: string;
  try { cid = uuid(id); } catch { notFound(); }
  const d = await db(v, async (q) => {
    const [c] = await q<C>("select * from contributions where id = $1", [cid]);
    if (!c) return null;
    return {
      c,
      consents: await q<{ kind: string; granted: boolean }>("select k kind, consent_value($1, k) granted from unnest(array['store','publish','attribution','training']) k", [cid]),
      history: await q<{ kind: string; granted: boolean; created_at: string }>("select kind, granted, created_at from consents where contribution_id = $1 order by id desc limit 12", [cid]),
      reviews: await q<{ decision: string; reason: string | null; created_at: string }>("select decision, reason, created_at from reviews where contribution_id = $1 order by id desc", [cid]),
      shared: await q<{ id: string; title: string; body: string; region_band: string; period_label: string; status: string; attribution_label: string | null }>(
        "select id, title, body, region_band, period_label, status, attribution_label from shared_items where id in (select shared_for_contribution($1)) order by published_at desc", [cid]),
      versions: await q<{ id: string; version: number; state: string }>("select id, version, state from contributions where (parent_id = $1 or id = $2) and id <> $1 order by version", [cid, (await q<{ p: string | null }>("select parent_id p from contributions where id = $1", [cid]))[0]?.p]),
      offerings: await q<{ id: string; name: string }>("select id, name from offerings where audience = 'public' order by name"),
      isAdmin: (await q<{ r: string | null }>("select member_role(org_id) r from contributions where id = $1", [cid]))[0]?.r === "client_admin",
    };
  });
  if (!d) notFound(); // not found and not permitted look the same
  const { c } = d;
  const mine = c.author_id === v.id;
  const editable = mine && (c.state === "draft" || c.state === "returned");
  const consent = Object.fromEntries(d.consents.map((x) => [x.kind, x.granted]));
  const canWithdraw = (mine || d.isAdmin) && ["submitted", "returned", "published"].includes(c.state);
  const shownShared = d.shared.find((s) => s.status === "published");

  return (
    <div>
      <PageHeader eyebrow={`Observation · version ${c.version}`} title={c.title}>
        <span className="flex flex-wrap gap-2"><Badge tone={STATE_TONE[c.state]}>{human(c.state)}</Badge><Badge>{VISIBILITY_TEXT[c.visibility].label}</Badge><Badge tone="slate">{human(c.type)}</Badge></span>
      </PageHeader>
      <Flash sp={sp} />
      {c.state === "returned" && c.return_reason && <div className="mb-4"><Notice>A moderator asked for clarification: <strong>{c.return_reason}</strong> Edit below and submit again.</Notice></div>}
      {c.sensitive_flags.length > 0 && editable && <div className="mb-4"><Notice>Automated checks flagged possible sensitive details: {c.sensitive_flags.map(human).join(", ")}. A moderator will also review before any sharing.</Notice></div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {editable ? (
            <ContributionForm action={updateContribution} offerings={d.offerings} c={c} />
          ) : (
            <div className="card">
              <p className="whitespace-pre-line text-slate-800">{c.body}</p>
              <p className="muted mt-4">{c.industry} · {c.region} · {c.period_start.toString().slice(0, 10)} to {c.period_end.toString().slice(0, 10)} · evidence: {human(c.evidence_type)} · confidence: {c.confidence}</p>
            </div>
          )}
          {d.shared.length > 0 && (
            <div className="card">
              <h2 className="h2">Shared copy that participants see</h2>
              {d.shared.map((s) => (
                <div key={s.id} className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="flex justify-between"><p className="font-semibold">{s.title}</p><Badge tone={STATE_TONE[s.status]}>{s.status}</Badge></div>
                  <p className="mt-1 text-sm">{s.body}</p>
                  <p className="muted mt-2">{s.region_band} · {s.period_label} · {s.attribution_label ?? "Not attributed"}</p>
                </div>))}
              <p className="muted mt-3">The shared copy holds only the reviewed fields. Your original text, organisation, name and the reviewer&apos;s internal notes are never included.</p>
            </div>
          )}
          {d.reviews.length > 0 && (
            <div className="card">
              <h2 className="h2 mb-2">Review history</h2>
              {d.reviews.map((r, i) => <p key={i} className="border-b py-2 text-sm last:border-0"><Badge tone={STATE_TONE[r.decision] ?? "slate"}>{r.decision}</Badge> <span className="muted">{fmtTime(r.created_at)}</span> {r.reason}</p>)}
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="card">
            <h2 className="h2">Who can see this</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div><dt className="font-semibold">This version (original)</dt><dd className="muted">{VISIBILITY_TEXT[c.visibility].who}{c.visibility === "proposed_shared" && c.state === "draft" && " Not yet submitted, so only you can see it."}</dd></div>
              <div><dt className="font-semibold">Shared copy</dt><dd className="muted">{shownShared ? "Visible to verified client members and Azentio employees in the shared learning feed, search and AIRA. De-identified." : "None. Nothing from this observation is visible outside the audience above."}</dd></div>
              <div><dt className="font-semibold">How it may be used</dt><dd className="muted">{consent.training ? "May be considered for a future approved training programme. Withdrawal stops future use; it cannot undo a model already trained." : "Not used for model training."}</dd></div>
            </dl>
            {mine && c.visibility === "proposed_shared" && editable && (
              <form action={submitContribution} className="mt-4">
                <input type="hidden" name="id" value={c.id} />
                <button className="btn w-full justify-center" disabled={!consent.publish}>Submit for review</button>
                {!consent.publish && <p className="muted mt-1">Grant &quot;Publish shared copy&quot; first.</p>}
              </form>
            )}
            {canWithdraw && (
              <form action={withdrawContribution} className="mt-3">
                <input type="hidden" name="id" value={c.id} />
                <button className="btn-danger w-full justify-center">Withdraw from sharing</button>
                <p className="muted mt-1">Removes the shared copy from the feed, search and AIRA immediately. Copies people have already read cannot be recalled.</p>
              </form>
            )}
            {mine && c.state === "published" && (
              <form action={reviseContribution} className="mt-3"><input type="hidden" name="id" value={c.id} /><button className="btn-ghost w-full justify-center">Revise (creates a new version for review)</button></form>
            )}
          </div>

          {mine && (
            <div className="card">
              <h2 className="h2">Permissions</h2>
              <p className="muted mt-1">Four separate choices. Membership, publishing and training are never implied by each other.</p>
              {CONSENTS.map(([k, label, help]) => (
                <form key={k} action={setConsent} className="mt-3 flex items-start justify-between gap-2 border-t pt-3">
                  <input type="hidden" name="id" value={c.id} /><input type="hidden" name="kind" value={k} /><input type="hidden" name="granted" value={String(!consent[k])} />
                  <div><p className="text-sm font-semibold">{label} <Badge tone={consent[k] ? "green" : "slate"}>{consent[k] ? "Granted" : "Not granted"}</Badge></p><p className="muted text-xs">{help}</p></div>
                  <button className="btn-ghost px-2 py-1 text-xs">{consent[k] ? "Revoke" : "Grant"}</button>
                </form>
              ))}
              <details className="mt-3 text-xs"><summary className="cursor-pointer text-slate-500">Consent history</summary>
                {d.history.map((h, i) => <p key={i} className="muted">{fmtTime(h.created_at)}: {h.kind} {h.granted ? "granted" : "revoked"}</p>)}
              </details>
            </div>
          )}
          {d.versions.length > 0 && (
            <div className="card">
              <h2 className="h2 mb-2">Other versions</h2>
              {d.versions.map((x) => <Link key={x.id} href={`/portal/contributions/${x.id}`} className="link block text-sm">Version {x.version} · {human(x.state)}</Link>)}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
