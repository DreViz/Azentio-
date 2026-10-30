import Link from "next/link";
import { requireViewer, db, can } from "@/lib/session";
import { Badge, Empty, Flash, PageHeader, fmtTime } from "@/components/ui";
import { STATE_TONE, human } from "@/lib/labels";
import { setSharedStatus } from "@/app/actions/portal";

export default async function Moderation({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const v = await requireViewer();
  if (!can(v, "moderator")) return <Empty title="Moderation requires the learning moderator grant." />;
  const d = await db(v, async (q) => ({
    queue: await q<{ id: string; title: string; state: string; updated_at: string; sensitive_flags: string[]; version: number }>(
      "select id, title, state, updated_at, sensitive_flags, version from contributions where state in ('submitted','returned') order by updated_at"),
    reports: await q<{ id: string; shared_item_id: string; reason: string; details: string | null; created_at: string; title: string; status: string }>(
      "select r.id, r.shared_item_id, r.reason, r.details, r.created_at, s.title, s.status from reports r join shared_items s on s.id = r.shared_item_id where r.status = 'open' order by r.created_at"),
    unpublished: await q<{ id: string; title: string }>("select id, title from shared_items where status = 'unpublished'"),
    recent: await q<{ id: string; title: string; status: string; published_at: string }>("select id, title, status, published_at from shared_items order by updated_at desc limit 8"),
  }));
  return (
    <div>
      <PageHeader eyebrow="Learning moderator" title="Moderation">Review proposed contributions. You see the text proposed for sharing, but not who wrote it, and never anyone&apos;s unsubmitted drafts.</PageHeader>
      <Flash sp={sp} />
      <h2 className="h2 mb-3">Review queue</h2>
      {d.queue.length ? (
        <div className="card divide-y p-0">
          {d.queue.map((c) => (
            <Link key={c.id} href={`/portal/moderation/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-slate-50">
              <span className="font-medium">{c.title}{c.version > 1 && <span className="muted"> · revision v{c.version}</span>}</span>
              <span className="flex gap-2">{c.sensitive_flags.length > 0 && <Badge tone="red">{c.sensitive_flags.length} flags</Badge>}<Badge tone={STATE_TONE[c.state]}>{human(c.state)}</Badge><span className="muted">{fmtTime(c.updated_at)}</span></span>
            </Link>))}
        </div>) : <Empty title="Nothing waiting for review" />}

      <h2 className="h2 mb-3 mt-8">Open reports</h2>
      {d.reports.length ? d.reports.map((r) => (
        <div key={r.id} className="card mb-3">
          <div className="flex justify-between"><p className="font-semibold">{r.title}</p><Badge tone="red">{r.reason}</Badge></div>
          {r.details && <p className="muted mt-1">{r.details}</p>}
          <form action={setSharedStatus} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="sid" value={r.shared_item_id} />
            <div className="flex-1"><label className="label" htmlFor={`reason-${r.id}`}>Decision reason (sent to the contributor)</label><input id={`reason-${r.id}`} name="reason" required minLength={5} className="input" /></div>
            {r.status === "published" && <button name="status" value="unpublished" className="btn-ghost">Unpublish during review</button>}
            <button name="status" value="published" className="btn-ghost">Dismiss and keep published</button>
            <button name="status" value="withdrawn" className="btn-danger">Remove</button>
          </form>
        </div>)) : <Empty title="No open reports" />}

      {d.unpublished.length > 0 && <><h2 className="h2 mb-3 mt-8">Temporarily unpublished</h2>{d.unpublished.map((u) => <p key={u.id} className="card mb-2 text-sm">{u.title}</p>)}</>}

      <h2 className="h2 mb-3 mt-8">Recently changed shared items</h2>
      <div className="card divide-y p-0">{d.recent.map((s) => <div key={s.id} className="flex justify-between px-5 py-2 text-sm"><span>{s.title}</span><Badge tone={STATE_TONE[s.status]}>{s.status}</Badge></div>)}</div>
    </div>
  );
}
