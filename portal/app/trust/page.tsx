import Link from "next/link";
import { getViewer, can } from "@/lib/session";
import { demoMode } from "@/lib/auth";
import { runTrustChecks } from "@/lib/trust";
import { Badge, Notice, PageHeader } from "@/components/ui";

const PROMISES = [
  ["Access is enforced by the database", "Every request runs as a restricted Postgres role with row-level security. Menus, URLs and client-side flags are never the control."],
  ["Deny by default", "Content needs an explicit audience. Public is a marked value, not a fallback for missing metadata."],
  ["Tenant isolation", "The active workspace lives in the server-side session and is re-validated against membership on every query."],
  ["Two copies, never one", "The private source and the reviewed shared copy are separate records. Shared payloads cannot even select the source link."],
  ["Four separate permissions", "Storing, publishing, attribution and model training are recorded separately in an append-only ledger."],
  ["Withdrawal that propagates", "Search and AIRA read the same policy-filtered table, so withdrawal applies in the same transaction. There is no second index to purge."],
  ["Counts that protect small groups", "Trend statistics count distinct institutions and are withheld below the configured minimum (at least 3)."],
  ["Everything is audited", "Lifecycle, consent, grant and setting changes write append-only audit events. Nobody can edit or delete them through the app role."],
];

export default async function Trust({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const v = await getViewer();
  const allowed = demoMode() || can(v, "portal_admin");
  const results = allowed && sp.run ? await runTrustChecks() : null;
  const passed = results?.filter((r) => r.pass).length ?? 0;
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <PageHeader eyebrow="Trust proof" title="Every privacy promise here has a test you can run.">
        The checks below sign in as each seeded persona and attempt the access the brief forbids, through the same database path the portal pages use. Probes that write are rolled back, so they never change data.
      </PageHeader>
      <div className="grid gap-3 md:grid-cols-4">
        {PROMISES.map(([t, d]) => <div key={t} className="card"><p className="font-semibold text-ink">{t}</p><p className="muted mt-1">{d}</p></div>)}
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        {allowed ? <Link href="/trust?run=1" className="btn">Run live checks</Link> : <Notice>Live checks are available to portal administrators.</Notice>}
        {results && <Badge tone={passed === results.length ? "green" : "red"}>{passed} / {results.length} passed</Badge>}
      </div>
      {results && (
        <div className="card mt-5 overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Test</th><th>Persona</th><th>Attempt</th><th>Expected</th><th>Actual</th><th className="pr-4">Result</th></tr></thead>
            <tbody>{results.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="px-4 py-2 font-mono text-xs">{r.id}</td><td className="py-2">{r.persona}</td><td className="py-2">{r.attempt}</td><td className="py-2 text-slate-600">{r.expected}</td>
                <td className="py-2 font-mono text-xs text-slate-600">{r.actual} <span className="text-slate-400">({r.ms} ms)</span></td>
                <td className="pr-4"><Badge tone={r.pass ? "green" : "red"}>{r.pass ? "PASS" : "FAIL"}</Badge></td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="card text-sm"><h2 className="h2 mb-2">Withdrawal and retention</h2>
          <p>Withdrawal removes a shared copy from the feed, search and AIRA in the same database transaction (measured in the live check above). Production target: under 60 seconds end to end, including any CDN or cache purge.</p>
          <p className="mt-2">Material already viewed by others, and copies made outside the portal, cannot be recalled. Consent history, the approved version and moderation decisions are retained as an audit record. Withdrawal never claims to undo a model that has already been trained.</p></div>
        <div className="card text-sm"><h2 className="h2 mb-2">What is simulated</h2>
          <p>All organisations, people and data are synthetic. Demo mode shows sign-in codes on screen for seeded personas. The federated programme runs on one machine and uses plain averaging, with no secure aggregation or differential privacy. Automated redaction is assistance, not a privacy guarantee.</p></div>
      </div>
    </div>
  );
}
