import { notFound } from "next/navigation";
import { requireViewer, db, can } from "@/lib/session";
import { system } from "@/lib/db";
import { Badge, Empty, Flash, Notice, PageHeader } from "@/components/ui";
import { proposeRedaction } from "@/lib/redact";
import { human } from "@/lib/labels";
import { publishContribution, rejectContribution, returnContribution } from "@/app/actions/portal";
import { uuid } from "@/lib/validate";

export default async function Review({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const v = await requireViewer();
  if (!can(v, "moderator")) return <Empty title="Moderation requires the learning moderator grant." />;
  let cid: string;
  try { cid = uuid(id); } catch { notFound(); }
  const d = await db(v, async (q) => {
    const [c] = await q<{ id: string; title: string; body: string; industry: string; region: string; period_start: string; period_end: string; state: string; type: string; evidence_type: string; confidence: string; sensitive_flags: string[] }>(
      "select id, title, body, industry, region, period_start::text, period_end::text, state, type, evidence_type, confidence, sensitive_flags from contributions where id = $1", [cid]);
    if (!c) return null;
    return {
      c,
      consents: Object.fromEntries((await q<{ k: string; g: boolean }>("select k, consent_value($1, k) g from unnest(array['publish','attribution']) k", [cid])).map((r) => [r.k, r.g])),
      themes: await q<{ id: string; title: string }>("select id, title from themes order by updated_at desc"),
      notes: await q<{ note: string }>("select note from review_notes where contribution_id = $1 order by id desc", [cid]),
    };
  });
  if (!d) notFound();
  // Institution names are needed to scrub mentions of participants. They are read on the system path
  // and used only inside the redaction function; the moderator is not shown who the author is.
  const orgNames = (await system((q) => q<{ name: string }>("select regexp_replace(name, ' \\(fictional\\)', '') name from organisations where kind = 'client'"))).map((r) => r.name);
  const p = await proposeRedaction(d.c, orgNames);
  const actionable = d.c.state === "submitted";
  return (
    <div>
      <PageHeader eyebrow="Review" title={d.c.title}>
        <span className="flex gap-2"><Badge>{human(d.c.type)}</Badge><Badge>{human(d.c.state)}</Badge><Badge>evidence: {human(d.c.evidence_type)}</Badge><Badge>confidence: {d.c.confidence}</Badge></span>
      </PageHeader>
      <Flash sp={sp} />
      {!actionable && <div className="mb-4"><Notice>This contribution is {d.c.state}. Decisions are available once the author resubmits.</Notice></div>}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="h2">Submitted text <span className="muted font-normal">(private source, never published)</span></h2>
          <p className="mt-3 whitespace-pre-line text-sm text-slate-800">{d.c.body}</p>
          <p className="muted mt-3">{d.c.industry} · {d.c.region} · {d.c.period_start} to {d.c.period_end}</p>
          <h3 className="mt-5 font-semibold">Copilot findings <Badge tone={p.risk === "high" ? "red" : p.risk === "medium" ? "amber" : "green"}>re-identification risk: {p.risk}</Badge> <Badge tone="purple">{p.engine === "model" ? "Rules + model" : "Rules engine"}</Badge></h3>
          <ul className="mt-2 list-disc pl-5 text-sm">{p.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
          {p.flags.length > 0 && (
            <table className="mt-3 w-full text-left text-xs">
              <thead><tr className="text-slate-500"><th className="py-1">Found</th><th>Type</th><th>Proposed</th></tr></thead>
              <tbody>{p.flags.map((f, i) => <tr key={i} className="border-t"><td className="py-1 font-mono text-rose-700 line-through">{f.match}</td><td>{human(f.kind)}</td><td className="text-emerald-700">{f.replacement}</td></tr>)}</tbody>
            </table>)}
          <p className="muted mt-3">Automated findings are assistance, not a privacy guarantee. You decide what is published.</p>
          {d.notes.length > 0 && <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs"><p className="font-semibold">Internal reviewer notes</p>{d.notes.map((n, i) => <p key={i}>{n.note}</p>)}</div>}
        </section>

        <section className="card">
          <h2 className="h2">Shared copy to publish</h2>
          <p className="muted">Pre-filled by the copilot. Edit freely. Only these fields are copied into the shared record.</p>
          <form action={publishContribution} className="mt-4 space-y-3">
            <input type="hidden" name="id" value={d.c.id} />
            <div><label className="label" htmlFor="title">Title</label><input id="title" name="title" required minLength={5} maxLength={140} defaultValue={p.title} className="input" /></div>
            <div><label className="label" htmlFor="body">Body</label><textarea id="body" name="body" required minLength={20} maxLength={4000} rows={7} defaultValue={p.body} className="input" /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="label" htmlFor="industry">Industry</label><input id="industry" name="industry" required defaultValue={p.industry} className="input" /></div>
              <div><label className="label" htmlFor="region_band">Region band</label><input id="region_band" name="region_band" required defaultValue={p.region_band} className="input" /></div>
              <div><label className="label" htmlFor="period_label">Period</label><input id="period_label" name="period_label" required defaultValue={p.period_label} className="input" /></div>
            </div>
            <div><label className="label" htmlFor="theme_id">Theme (optional)</label>
              <select id="theme_id" name="theme_id" className="input"><option value="">No theme yet</option>{d.themes.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></div>
            <div><label className="label" htmlFor="attribution_label">Attribution label</label>
              <input id="attribution_label" name="attribution_label" disabled={!d.consents.attribution} placeholder={d.consents.attribution ? "e.g. A bank in India" : "Author has not opted in to attribution"} className="input" /></div>
            <div><label className="label" htmlFor="note">Internal note (moderators only)</label><input id="note" name="note" maxLength={1000} className="input" /></div>
            <label className="flex gap-2 text-sm"><input type="checkbox" name="confirm" required /> I reviewed the shared copy for names, identifiers, precise places, dates, amounts and rare details.</label>
            <button className="btn" disabled={!actionable || !d.consents.publish}>Publish shared copy</button>
            {!d.consents.publish && <p className="text-sm text-rose-700">The author has not granted publication consent.</p>}
          </form>
          <div className="mt-6 grid gap-3 border-t pt-4 md:grid-cols-2">
            <form action={returnContribution} className="space-y-2">
              <input type="hidden" name="id" value={d.c.id} />
              <label className="label" htmlFor="ret">Request clarification</label>
              <textarea id="ret" name="reason" required minLength={5} rows={2} className="input" placeholder="What should the author clarify?" />
              <button className="btn-ghost" disabled={!actionable}>Return to author</button>
            </form>
            <form action={rejectContribution} className="space-y-2">
              <input type="hidden" name="id" value={d.c.id} />
              <label className="label" htmlFor="rej">Reject (reason sent to author)</label>
              <textarea id="rej" name="reason" required minLength={5} rows={2} className="input" placeholder="Duplicate, unsafe or out of scope" />
              <input name="note" placeholder="Internal note (optional)" className="input" />
              <button className="btn-danger" disabled={!actionable}>Reject</button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
