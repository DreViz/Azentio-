import Link from "next/link";
import { requireViewer, db } from "@/lib/session";
import { Empty, PageHeader, fmtTime } from "@/components/ui";
import { markNotificationsRead } from "@/app/actions/portal";

export default async function Notifications() {
  const v = await requireViewer();
  const rows = await db(v, (q) => q<{ id: number; message: string; link: string | null; read_at: string | null; created_at: string; channel: string }>("select id, message, link, read_at, created_at, channel from notifications order by id desc limit 50"));
  return (
    <div>
      <PageHeader title="Notifications" actions={<form action={markNotificationsRead}><button className="btn-ghost">Mark all read</button></form>}>In-app notifications. Email delivery is not enabled in this build, so nothing here is labelled as emailed.</PageHeader>
      {rows.length ? <div className="card divide-y p-0">{rows.map((n) => (
        <div key={n.id} className={`flex justify-between gap-3 px-5 py-3 text-sm ${n.read_at ? "" : "bg-indigo-50/60"}`}>
          <span>{n.link ? <Link href={n.link} className="hover:text-brand">{n.message}</Link> : n.message}</span>
          <span className="muted whitespace-nowrap">{fmtTime(n.created_at)} · in-app</span>
        </div>))}</div> : <Empty title="No notifications" />}
    </div>
  );
}
