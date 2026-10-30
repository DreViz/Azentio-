import { requireViewer, db, can } from "@/lib/session";
import { Badge, Empty, Flash, PageHeader, fmtDate, fmtTime } from "@/components/ui";
import { IDEA_STATUS, STATE_TONE } from "@/lib/labels";
import { createIdea, setIdeaStatus } from "@/app/actions/portal";

type Idea = { id: string; title: string; problem: string; offering_id: string | null; proposed_outcome: string; owner_team: string; priority: string; status: string; public_note: string; updated_at: string; evidence: number };

export default async function Ideas({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const v = await requireViewer();
  const po = can(v, "product_owner");
  if (!v.isEmployee) {
    // Clients get the safe projection only: plain status, owner team, public note. No priority, no evidence links.
    const ideas = await db(v, (q) => q<{ id: string; title: string; offering_id: string | null; owner_team: string; status: string; public_note: string; updated_at: string }>("select * from ideas_public()"));
    return (
      <div>
        <PageHeader eyebrow="Closing the loop" title="Improvement ideas">What Azentio is doing with themes from shared learning. Status is not a delivery commitment unless stated.</PageHeader>
        {ideas.length ? <div className="space-y-3">{ideas.map((i) => (
          <div key={i.id} className="card"><div className="flex justify-between gap-2"><p className="font-semibold">{i.title}</p><Badge tone={STATE_TONE[i.status]}>{i.status}</Badge></div>
            <p className="mt-1 text-sm text-slate-700">{i.public_note}</p><p className="muted mt-2">{i.owner_team} · {i.offering_id} · last update {fmtDate(i.updated_at)}</p></div>))}</div>
          : <Empty title="No improvement ideas shared yet" />}
      </div>
    );
  }
  const d = await db(v, async (q) => ({
    ideas: await q<Idea>("select i.*, (select count(*)::int from idea_evidence e where e.idea_id = i.id) evidence from ideas i order by updated_at desc"),
    history: await q<{ idea_id: string; from_status: string | null; to_status: string; note: string | null; created_at: string }>("select idea_id, from_status, to_status, note, created_at from idea_status_history order by id desc"),
    items: await q<{ id: string; title: string; theme: string | null }>("select s.id, s.title, t.title theme from shared_items s left join themes t on t.id = s.theme_id where s.status = 'published' order by t.title nulls last"),
    themes: await q<{ id: string; title: string }>("select id, title from themes order by title"),
    offerings: await q<{ id: string; name: string }>("select id, name from offerings order by name"),
  }));
  return (
    <div>
      <PageHeader eyebrow="Product owners" title="Improvement ideas">Link approved evidence to ideas. Clients see only the status, owner team and your public note, and only from &quot;Under review&quot; onward.</PageHeader>
      <Flash sp={sp} />
      <div className="space-y-4">
        {d.ideas.map((i) => (
          <section key={i.id} className="card">
            <div className="flex flex-wrap justify-between gap-2"><h2 className="text-lg font-semibold">{i.title}</h2><span className="flex gap-2"><Badge tone="red">priority {i.priority} (internal)</Badge><Badge tone={STATE_TONE[i.status]}>{i.status}</Badge></span></div>
            <p className="mt-1 text-sm"><strong>Problem:</strong> {i.problem}</p>
            <p className="text-sm"><strong>Proposed outcome:</strong> {i.proposed_outcome}</p>
            <p className="muted mt-1">{i.owner_team} · {i.offering_id} · {i.evidence} linked approved observations · updated {fmtDate(i.updated_at)}</p>
            <p className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-900">Client-visible note: {i.public_note || "(none)"}</p>
            <details className="mt-2 text-sm"><summary className="cursor-pointer text-slate-500">Status history (audited)</summary>
              {d.history.filter((h) => h.idea_id === i.id).map((h, k) => <p key={k} className="muted">{fmtTime(h.created_at)}: {h.from_status ?? "new"} → {h.to_status}. {h.note}</p>)}
            </details>
            {po && (
              <form action={setIdeaStatus} className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3">
                <input type="hidden" name="id" value={i.id} />
                <div><label className="label" htmlFor={`st-${i.id}`}>Status</label><select id={`st-${i.id}`} name="status" defaultValue={i.status} className="input">{IDEA_STATUS.map((s) => <option key={s}>{s}</option>)}</select></div>
                <div className="flex-1"><label className="label" htmlFor={`pn-${i.id}`}>Public note for contributors</label><input id={`pn-${i.id}`} name="public_note" required minLength={5} maxLength={600} defaultValue={i.public_note} className="input" /></div>
                <button className="btn">Update</button>
              </form>)}
          </section>))}
      </div>
      {po && (
        <form action={createIdea} className="card mt-8 space-y-3">
          <h2 className="h2">New improvement idea</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div><label className="label" htmlFor="title">Title</label><input id="title" name="title" required minLength={5} maxLength={140} className="input" placeholder="Seasonality-aware comparison explanation" /></div>
            <div><label className="label" htmlFor="offering_id">Offering</label><select id="offering_id" name="offering_id" className="input">{d.offerings.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
            <div><label className="label" htmlFor="owner_team">Owner team</label><input id="owner_team" name="owner_team" required className="input" defaultValue="Financial Analysis product team" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label" htmlFor="priority">Priority (internal)</label><select id="priority" name="priority" className="input"><option>medium</option><option>high</option><option>low</option></select></div>
              <div><label className="label" htmlFor="theme_id">Theme</label><select id="theme_id" name="theme_id" className="input"><option value="">None</option>{d.themes.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></div>
            </div>
          </div>
          <div><label className="label" htmlFor="problem">Problem statement</label><textarea id="problem" name="problem" required minLength={10} rows={2} className="input" /></div>
          <div><label className="label" htmlFor="proposed_outcome">Proposed outcome</label><textarea id="proposed_outcome" name="proposed_outcome" required minLength={10} rows={2} className="input" /></div>
          <fieldset><legend className="label">Supporting approved observations</legend>
            <div className="mt-1 max-h-56 overflow-auto rounded-lg border p-2 text-sm">{d.items.map((s) => <label key={s.id} className="flex gap-2 py-0.5"><input type="checkbox" name="evidence" value={s.id} /> <span>{s.title} {s.theme && <span className="muted">· {s.theme}</span>}</span></label>)}</div>
          </fieldset>
          <button className="btn">Create as Proposed</button>
        </form>
      )}
      {!d.ideas.length && !po && <Empty title="No ideas yet" />}
    </div>
  );
}
