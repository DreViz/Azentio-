import { requireViewer, db, can } from "@/lib/session";
import { Badge, Empty, Flash, Notice, PageHeader, fmtTime } from "@/components/ui";
import { decideModel } from "@/app/actions/portal";

type Round = { round: number; participants: string[]; rejected: { client: string; reason: string }[]; dropped: string[]; skipped?: boolean; globalAuc: number };
type Summary = {
  task: string; model: string; features: string[]; weighting: string; clipNorm: number; rounds: Round[];
  baseline: { name: string; auc: number }[]; final: { auc: number; perClient: { client: string; localOnlyAuc: number; globalAuc: number; n: number; seasonalShare: number }[] };
  controls: { name: string; status: string }[]; consent: { client: string; programmeConsent: boolean }[]; notes: string[];
};

export default async function Federated({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const v = await requireViewer();
  if (!v.isEmployee) return <Empty title="The federated lab is for employees." />;
  const runs = await db(v, (q) => q<{ id: string; summary: Summary; status: string; created_at: string }>("select id, summary, status, created_at from fl_runs order by created_at desc"));
  const r = runs[0];
  return (
    <div>
      <PageHeader eyebrow="Advanced track · simulated" title="Federated learning lab">A separate, opt-in programme. Three isolated synthetic client datasets train locally; only clipped model updates reach the coordinator.</PageHeader>
      <Flash sp={sp} />
      <Notice>Simulation on one machine with synthetic data. Plain weighted averaging: no secure aggregation and no formal differential privacy. Local data retention alone does not give confidentiality, anonymity or regulatory compliance.</Notice>
      {!r ? <div className="mt-5"><Empty title="No federated run recorded">Run <code>npm run fl</code> to execute the programme.</Empty></div> : (
        <div className="mt-5 space-y-6">
          <section className="card">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="h2">Candidate model · {fmtTime(r.created_at)}</h2><Badge tone={r.status === "approved" ? "green" : r.status === "candidate" ? "amber" : "slate"}>{r.status}</Badge></div>
            <p className="mt-2 text-sm"><strong>Task:</strong> {r.summary.task}</p>
            <p className="text-sm"><strong>Model:</strong> {r.summary.model} · <strong>Weighting:</strong> {r.summary.weighting} · <strong>Update clip norm:</strong> {r.summary.clipNorm}</p>
            <p className="muted mt-1">Features: {r.summary.features.join(", ")}</p>
            {can(v, "portal_admin") ? (
              <form action={decideModel} className="mt-4 flex gap-2"><input type="hidden" name="id" value={r.id} />
                <button name="status" value="approved" className="btn">Approve for deployment</button><button name="status" value="rejected" className="btn-ghost">Reject</button><button name="status" value="rolled_back" className="btn-ghost">Roll back to previous</button></form>
            ) : <p className="muted mt-3">Deployment decisions require a portal administrator. Nothing deploys automatically.</p>}
          </section>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card"><h2 className="h2 mb-2">Rounds</h2>
              {r.summary.rounds.map((x) => <div key={x.round} className="border-b py-2 text-sm last:border-0"><p><strong>Round {x.round}</strong> · global AUC {x.globalAuc.toFixed(3)} · participants: {x.participants.join(", ")}</p>
                {x.dropped.length > 0 && <p className="text-amber-700">Dropped out: {x.dropped.join(", ")} (round continued with the minimum cohort)</p>}
                {x.rejected.map((j) => <p key={j.client} className="text-rose-700">Rejected update from {j.client}: {j.reason}</p>)}
                {x.skipped && <p className="font-semibold text-amber-700">Aggregation skipped: fewer than 3 valid updates. The global model was left unchanged.</p>}</div>)}
            </section>
            <section className="card"><h2 className="h2 mb-2">Evaluation on a separate synthetic holdout</h2>
              <table className="w-full text-sm"><tbody>
                {r.summary.baseline.map((b) => <tr key={b.name} className="border-t"><td className="py-1">{b.name}</td><td className="text-right font-mono">{b.auc.toFixed(3)}</td></tr>)}
                <tr className="border-t font-semibold"><td className="py-1">Federated global model</td><td className="text-right font-mono">{r.summary.final.auc.toFixed(3)}</td></tr>
              </tbody></table>
              <h3 className="mt-4 font-semibold">Per client (skew effects)</h3>
              <table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th>Client</th><th>n</th><th>seasonal share</th><th>local-only</th><th>global</th></tr></thead><tbody>
                {r.summary.final.perClient.map((c) => <tr key={c.client} className="border-t"><td className="py-1">{c.client}</td><td>{c.n}</td><td>{Math.round(c.seasonalShare * 100)}%</td><td className="font-mono">{c.localOnlyAuc.toFixed(3)}</td><td className="font-mono">{c.globalAuc.toFixed(3)}</td></tr>)}
              </tbody></table>
            </section>
          </div>
          <section className="card"><h2 className="h2 mb-2">Controls</h2>
            <div className="grid gap-2 md:grid-cols-2">{r.summary.controls.map((c) => <p key={c.name} className="text-sm"><Badge tone={c.status.startsWith("implemented") ? "green" : "amber"}>{c.status}</Badge> {c.name}</p>)}</div>
            <h3 className="mt-4 font-semibold">Programme consent</h3><p className="text-sm">{r.summary.consent.map((c) => `${c.client}: ${c.programmeConsent ? "opted in" : "not opted in"}`).join(" · ")}</p>
            <ul className="mt-3 list-disc pl-5 text-sm text-slate-700">{r.summary.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </section>
        </div>
      )}
    </div>
  );
}
