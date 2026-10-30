import { requireViewer, db } from "@/lib/session";
import { Badge, Empty, Flash, Notice, PageHeader, fmtTime } from "@/components/ui";
import { APPLICANTS } from "@/lib/playground";
import { runSandbox, sandboxFeedback } from "@/app/actions/portal";
import type { RunOutput } from "@/lib/playground";

export default async function Sandbox({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const v = await requireViewer();
  const client = v.activeOrg?.kind === "client";
  const d = await db(v, async (q) => ({
    offerings: client
      ? await q<{ id: string; name: string }>("select o.id, o.name from entitlements e join offerings o on o.id = e.offering_id where e.org_id = app_org() order by o.name")
      : await q<{ id: string; name: string }>("select id, name from offerings where id in ('sme-credit-decisioning','financial-analysis','seasonality-lab') order by name"),
    run: sp.run && /^[0-9a-f-]{36}$/.test(sp.run) ? (await q<{ id: string; output: RunOutput; rating: string | null; created_at: string }>("select id, output, rating, created_at from playground_runs where id = $1", [sp.run]))[0] : null,
    recent: await q<{ id: string; scenario: string; offering_id: string; created_at: string }>("select id, scenario, offering_id, created_at from playground_runs order by created_at desc limit 6"),
  }));
  const r = d.run?.output;
  return (
    <div>
      <PageHeader eyebrow={client ? `${v.activeOrg!.org_name} sandbox` : "Employee Playground"} title="Guided sandbox">
        Choose an offering, inspect synthetic inputs, run a deterministic demonstration and review the evidence. {client ? "Runs are isolated to you and your organisation." : "Employees also see the internal seasonality experiment."}
      </PageHeader>
      <Flash sp={sp} />
      <Notice>All applicants are synthetic. Outputs are simulated and are not an approved credit or business decision.</Notice>
      {d.offerings.length === 0 ? <div className="mt-5"><Empty title="No sandboxes are entitled for your organisation" /></div> : (
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <form action={runSandbox} className="card space-y-4">
            <div><label className="label" htmlFor="offering_id">1. Offering</label>
              <select id="offering_id" name="offering_id" defaultValue={sp.offering} className="input">{d.offerings.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
            <fieldset><legend className="label">2. Synthetic applicant (inspect inputs)</legend>
              {APPLICANTS.map((a, i) => (
                <label key={a.id} className="mt-2 block cursor-pointer rounded-xl border p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-indigo-50">
                  <span className="flex items-center gap-2"><input type="radio" name="applicant" value={a.id} defaultChecked={i === 0} /> <strong>{a.name}</strong> <Badge>{a.sector}</Badge></span>
                  <span className="mt-2 flex h-10 items-end gap-0.5" aria-label="Monthly inflows, last 24 months">
                    {a.inflows.map((x, k) => <span key={k} className="w-full rounded-sm bg-indigo-300" style={{ height: `${Math.max(6, (x / Math.max(...a.inflows)) * 100)}%` }} />)}
                  </span>
                  <span className="muted text-xs">Instalment {a.emi.toLocaleString("en-IN")} per month</span>
                </label>))}
            </fieldset>
            <fieldset><legend className="label">3. Method</legend>
              <label className="mr-4 text-sm"><input type="radio" name="mode" value="standard" defaultChecked /> Standard volatility view</label>
              {v.isEmployee && <label className="text-sm"><input type="radio" name="mode" value="seasonality" /> Seasonality-aware <Badge tone="purple">experiment, employees only</Badge></label>}
            </fieldset>
            <button className="btn">Run demonstration</button>
          </form>
          <div className="space-y-4">
            {r ? (
              <div className="card">
                <div className="flex flex-wrap items-center gap-2"><Badge tone="amber">{r.label}</Badge><span className="muted">{fmtTime(d.run!.created_at)}</span></div>
                <p className="mt-2 font-semibold">{r.applicant}</p>
                <p className="mt-2 rounded-lg bg-slate-50 p-3 text-lg font-semibold text-ink">{r.indicative}</p>
                <table className="mt-3 w-full text-sm"><tbody>{r.metrics.map((m) => <tr key={m.name} className="border-t"><td className="py-1.5">{m.name}</td><td className="text-right font-mono">{m.value}</td></tr>)}</tbody></table>
                <h3 className="mt-3 font-semibold">Evidence</h3><ul className="list-disc pl-5 text-sm">{r.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
                <p className="mt-3 text-xs font-semibold text-rose-700">{r.caution}</p>
                <form action={sandboxFeedback} className="mt-4 space-y-2 border-t pt-3">
                  <input type="hidden" name="id" value={d.run!.id} />
                  <p className="label">Structured feedback</p>
                  <div className="flex gap-3 text-sm">{[["useful", "Useful"], ["needs_evidence", "Needs evidence"], ["wrong", "Looks wrong"]].map(([k, l]) => <label key={k}><input type="radio" name="rating" value={k} defaultChecked={d.run!.rating === k} required /> {l}</label>)}</div>
                  <input name="feedback" maxLength={1000} placeholder="What would make this more useful?" className="input" />
                  <button className="btn-ghost">Save feedback</button>
                </form>
              </div>) : <Empty title="Run a demonstration to see the output" />}
            <div className="card"><h2 className="font-semibold">Your recent runs</h2>
              {d.recent.length ? d.recent.map((x) => <a key={x.id} href={`/portal/sandbox?run=${x.id}`} className="link block text-sm">{x.offering_id} · {x.scenario} · {fmtTime(x.created_at)}</a>) : <p className="muted">None yet.</p>}</div>
          </div>
        </div>
      )}
    </div>
  );
}
