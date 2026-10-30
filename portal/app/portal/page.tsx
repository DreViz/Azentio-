import Link from "next/link";
import { requireViewer, db, can } from "@/lib/session";
import { Badge, Empty, Flash, Notice, PageHeader, Tile, fmtDate } from "@/components/ui";
import { STATE_TONE, human } from "@/lib/labels";

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const v = await requireViewer();
  if (!v.activeOrg) {
    return (
      <div>
        <PageHeader title="No workspace yet">You are signed in as {v.email}, but you have no approved membership.</PageHeader>
        <Flash sp={sp} />
        <Notice tone="blue">Employees are provisioned by a portal administrator. Clients join through a single-use invitation from their organisation&apos;s administrator. A verified email alone never creates access to a workspace.</Notice>
      </div>
    );
  }
  if (v.activeOrg.kind === "azentio") return <EmployeeDashboard sp={sp} />;
  return <ClientDashboard sp={sp} />;
}

async function EmployeeDashboard({ sp }: { sp: Record<string, string | undefined> }) {
  const v = await requireViewer();
  const d = await db(v, async (q) => ({
    broadcasts: await q<{ id: string; title: string; starts_at: string | null; kind: string }>("select id, title, starts_at, kind from content_items where audience = 'employee' order by created_at desc limit 5"),
    queue: can(v, "moderator") ? (await q<{ n: number }>("select count(*)::int n from contributions where state = 'submitted'"))[0].n : null,
    reports: can(v, "moderator") ? (await q<{ n: number }>("select count(*)::int n from reports where status = 'open'"))[0].n : null,
    ideas: await q<{ id: string; title: string; status: string }>("select id, title, status from ideas order by updated_at desc limit 5"),
    runs: (await q<{ n: number }>("select count(*)::int n from playground_runs"))[0].n,
  }));
  return (
    <div>
      <PageHeader eyebrow="Employee portal" title={`Welcome, ${v.name.split(" ")[0]}`}>Internal experiments, sessions and the collective-learning loop. Employee-only content never appears in client views, public search or AIRA answers for non-employees.</PageHeader>
      <Flash sp={sp} />
      <div className="grid gap-4 md:grid-cols-3">
        <Tile href="/portal/sandbox" title="Playground" tag={<Badge tone="amber">Synthetic data</Badge>}>Run guided demos, including the employee-only seasonality experiment. You have {d.runs} saved runs.</Tile>
        <Tile href="/portal/resources" title="Live, experiments & library">Internal broadcasts, recordings, experiment notes and the knowledge library.</Tile>
        <Tile href="/portal/learning" title="Shared learning">Approved, de-identified observations from client organisations.</Tile>
        {d.queue !== null && <Tile href="/portal/moderation" title="Moderation queue" tag={<Badge tone={d.queue ? "blue" : "slate"}>{d.queue} waiting</Badge>}>{d.reports} open reports.</Tile>}
        {can(v, "product_owner") && <Tile href="/portal/ideas" title="Improvement ideas">Link approved themes to ideas and keep contributors informed.</Tile>}
        {can(v, "portal_admin") && <Tile href="/portal/admin" title="Administration">Grants, provisioning, settings and the audit log.</Tile>}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="h2 mb-3">Internal sessions and notes</h2>
          {d.broadcasts.map((b) => <Link key={b.id} href={`/content/${b.id}`} className="flex justify-between border-b py-2 text-sm last:border-0 hover:text-brand"><span>{b.title}</span><span className="muted">{b.starts_at ? fmtDate(b.starts_at) : human(b.kind)}</span></Link>)}
        </section>
        <section className="card">
          <h2 className="h2 mb-3">Improvement ideas</h2>
          {d.ideas.length ? d.ideas.map((i) => <div key={i.id} className="flex justify-between border-b py-2 text-sm last:border-0"><span>{i.title}</span><Badge tone={STATE_TONE[i.status]}>{i.status}</Badge></div>) : <p className="muted">No ideas yet.</p>}
        </section>
      </div>
    </div>
  );
}

async function ClientDashboard({ sp }: { sp: Record<string, string | undefined> }) {
  const v = await requireViewer();
  const d = await db(v, async (q) => ({
    offerings: await q<{ id: string; name: string; summary: string }>("select o.id, o.name, o.summary from entitlements e join offerings o on o.id = e.offering_id where e.org_id = app_org() order by o.name"),
    mine: await q<{ id: string; title: string; state: string; visibility: string }>("select id, title, state, visibility from contributions where author_id = app_uid() order by updated_at desc limit 6"),
    sessions: await q<{ id: string; title: string; starts_at: string | null; audience: string }>("select id, title, starts_at, audience from content_items where audience in ('clients','org','entitled') order by starts_at nulls last, created_at desc limit 5"),
    ideas: await q<{ id: string; title: string; status: string; updated_at: string }>("select id, title, status, updated_at from ideas_public() limit 4"),
  }));
  return (
    <div>
      <PageHeader eyebrow="Client workspace" title={v.activeOrg!.org_name}>Your private workspace. Content here is isolated to your organisation and entitlements.</PageHeader>
      <Flash sp={sp} />
      <section>
        <h2 className="h2 mb-3">Entitled offerings</h2>
        {d.offerings.length ? (
          <div className="grid gap-4 md:grid-cols-3">{d.offerings.map((o) => <Tile key={o.id} href={`/portal/sandbox?offering=${o.id}`} title={o.name} tag={<Badge tone="green">Entitled</Badge>}><span className="line-clamp-2">{o.summary}</span></Tile>)}</div>
        ) : <Empty title="No entitled offerings yet">Your Azentio contact can enable sandboxes for your organisation.</Empty>}
      </section>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card">
          <div className="mb-3 flex items-center justify-between"><h2 className="h2">My observations</h2><Link href="/portal/contributions/new" className="btn">New observation</Link></div>
          {d.mine.length ? d.mine.map((c) => (
            <Link key={c.id} href={`/portal/contributions/${c.id}`} className="flex items-center justify-between gap-2 border-b py-2 text-sm last:border-0 hover:text-brand">
              <span className="truncate">{c.title}</span><Badge tone={STATE_TONE[c.state]}>{human(c.state)}</Badge>
            </Link>)) : <p className="muted">You have not recorded any observations yet.</p>}
        </section>
        <section className="card">
          <h2 className="h2 mb-3">Sessions and briefings</h2>
          {d.sessions.length ? d.sessions.map((s) => <Link key={s.id} href={`/content/${s.id}`} className="flex justify-between border-b py-2 text-sm last:border-0 hover:text-brand"><span>{s.title}</span><Badge>{s.audience}</Badge></Link>) : <p className="muted">No sessions are assigned to your organisation.</p>}
        </section>
        <section className="card lg:col-span-2">
          <h2 className="h2 mb-3">Improvement ideas from shared learning</h2>
          {d.ideas.length ? d.ideas.map((i) => <div key={i.id} className="flex justify-between border-b py-2 text-sm last:border-0"><span>{i.title}</span><span className="flex items-center gap-2"><span className="muted">{fmtDate(i.updated_at)}</span><Badge tone={STATE_TONE[i.status]}>{i.status}</Badge></span></div>) : <p className="muted">No ideas to show yet.</p>}
          <Link href="/portal/ideas" className="link mt-3 inline-block text-sm">All ideas →</Link>
        </section>
      </div>
    </div>
  );
}
