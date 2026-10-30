import { requireViewer, db, can } from "@/lib/session";
import { Badge, Empty, Flash, PageHeader, fmtTime } from "@/components/ui";
import { provisionEmployee, setGrant, setSetting } from "@/app/actions/portal";

const GRANTS = ["moderator", "publisher", "product_owner", "portal_admin"];

export default async function Admin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const v = await requireViewer();
  if (!can(v, "portal_admin")) return <Empty title="Administration requires the portal administrator grant." />;
  const d = await db(v, async (q) => ({
    employees: await q<{ id: string; display_name: string; email: string; grants: string[] }>(
      `select u.id, u.display_name, u.email, coalesce(array_agg(g.grant_name) filter (where g.grant_name is not null), '{}') grants
         from users u join memberships m on m.user_id = u.id join organisations o on o.id = m.org_id and o.kind = 'azentio'
         left join grants g on g.user_id = u.id where m.status = 'active' group by u.id order by u.display_name`),
    orgs: await q<{ name: string; kind: string; members: number }>("select o.name, o.kind, (select count(*)::int from memberships m where m.org_id = o.id and m.status = 'active') members from organisations o order by kind, name"),
    k: (await q<{ k: number }>("select min_cohort() k"))[0].k,
    enquiries: await q<{ kind: string; name: string; email: string; company: string | null; created_at: string }>("select kind, name, email, company, created_at from enquiries order by created_at desc limit 10"),
    audit: await q<{ action: string; entity: string; entity_id: string | null; actor: string | null; created_at: string; detail: object }>(
      "select a.action, a.entity, a.entity_id, u.display_name actor, a.created_at, a.detail from audit_events a left join users u on u.id = a.actor_id order by a.id desc limit 60"),
  }));
  return (
    <div>
      <PageHeader eyebrow="Portal administrator" title="Administration">Privileged actions are audited. This role does not grant access to private client content: drafts and organisation-only observations remain invisible here.</PageHeader>
      <Flash sp={sp} />
      <section className="card">
        <h2 className="h2">Employee grants</h2>
        <p className="muted">Each permission is a separate grant. Employee status implies none of them.</p>
        <table className="mt-3 w-full text-sm">
          <thead><tr className="text-left text-slate-500"><th className="py-1">Employee</th>{GRANTS.map((g) => <th key={g}>{g.replace("_", " ")}</th>)}</tr></thead>
          <tbody>{d.employees.map((e) => (
            <tr key={e.id} className="border-t"><td className="py-2"><p className="font-medium">{e.display_name}</p><p className="muted text-xs">{e.email}</p></td>
              {GRANTS.map((g) => { const on = e.grants.includes(g); return (
                <td key={g}><form action={setGrant}><input type="hidden" name="user_id" value={e.id} /><input type="hidden" name="grant" value={g} /><input type="hidden" name="on" value={String(!on)} />
                  <button className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${on ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>{on ? "granted" : "none"}</button></form></td>); })}
            </tr>))}</tbody>
        </table>
      </section>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <form action={provisionEmployee} className="card space-y-3">
          <h2 className="h2">Provision an employee</h2>
          <p className="muted">Approved employee membership for a verified @azentio.com address. Starts with no grants.</p>
          <input name="email" type="email" required placeholder="name@azentio.com" className="input" aria-label="Email" />
          <input name="name" required minLength={2} placeholder="Display name" className="input" aria-label="Name" />
          <button className="btn">Provision</button>
        </form>
        <form action={setSetting} className="card space-y-3">
          <h2 className="h2">Aggregation threshold</h2>
          <p className="muted">Minimum distinct contributing organisations before any count is shown. Cannot go below 3. A production threshold needs approval before launch.</p>
          <input name="value" defaultValue={d.k} inputMode="numeric" className="input w-24" aria-label="Minimum cohort" />
          <button className="btn">Save</button>
        </form>
        <section className="card"><h2 className="h2 mb-2">Organisations</h2>{d.orgs.map((o) => <p key={o.name} className="flex justify-between border-b py-1.5 text-sm last:border-0"><span>{o.name}</span><span><Badge>{o.kind}</Badge> <span className="muted">{o.members} members</span></span></p>)}</section>
        <section className="card"><h2 className="h2 mb-2">Demo and event requests</h2>{d.enquiries.length ? d.enquiries.map((e, i) => <p key={i} className="border-b py-1.5 text-sm last:border-0"><Badge>{e.kind}</Badge> {e.name} · {e.email} {e.company && `· ${e.company}`} <span className="muted">{fmtTime(e.created_at)}</span></p>) : <p className="muted">None yet.</p>}</section>
      </div>
      <section className="card mt-6">
        <h2 className="h2 mb-2">Audit log</h2>
        <div className="max-h-[480px] overflow-auto text-xs">
          <table className="w-full"><tbody>{d.audit.map((a, i) => (
            <tr key={i} className="border-t align-top"><td className="whitespace-nowrap py-1 pr-3 text-slate-500">{fmtTime(a.created_at)}</td><td className="pr-3 font-mono">{a.action}</td><td className="pr-3">{a.actor ?? "system"}</td><td className="font-mono text-slate-500">{a.entity}:{a.entity_id?.slice(0, 8)} {JSON.stringify(a.detail) !== "{}" && JSON.stringify(a.detail)}</td></tr>))}</tbody></table>
        </div>
      </section>
    </div>
  );
}
