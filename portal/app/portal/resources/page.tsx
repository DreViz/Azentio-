import Link from "next/link";
import { requireViewer, db } from "@/lib/session";
import { Badge, Empty, PageHeader, fmtDate, fmtTime } from "@/components/ui";
import { human } from "@/lib/labels";

export default async function Resources() {
  const v = await requireViewer();
  // Same query for everyone: the audience policy decides what each viewer receives.
  const rows = await db(v, (q) => q<{ id: string; kind: string; title: string; body: string; audience: string; starts_at: string | null; owner_name: string | null; review_date: string | null; media_id: string | null }>(
    "select id, kind, title, body, audience, starts_at, owner_name, review_date, media_id from content_items where audience <> 'public' order by starts_at nulls last, created_at desc"));
  const groups: [string, string[]][] = [["Live sessions & recordings", ["broadcast"]], ["Briefings & webinars", ["briefing"]], ["Experiments", ["experiment"]], ["Knowledge library", ["knowledge"]], ["Release notes", ["release_note"]]];
  return (
    <div>
      <PageHeader eyebrow={v.isEmployee ? "Employees" : v.activeOrg?.org_name} title={v.isEmployee ? "Live, experiments & library" : "Resources & sessions"}>
        Content restricted to your audience. Direct links and media files are checked on the server for every request.
      </PageHeader>
      {rows.length === 0 && <Empty title="No restricted resources for your workspace" />}
      {groups.map(([title, kinds]) => {
        const items = rows.filter((r) => kinds.includes(r.kind));
        if (!items.length) return null;
        return (
          <section key={title} className="mb-8">
            <h2 className="h2 mb-3">{title}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((r) => (
                <Link key={r.id} href={`/content/${r.id}`} className="card block hover:shadow-md">
                  <div className="flex justify-between gap-2"><p className="font-semibold text-ink">{r.title}</p><Badge tone="purple">{r.audience}</Badge></div>
                  <p className="muted mt-1 line-clamp-2">{r.body}</p>
                  <p className="mt-2 text-xs text-slate-500">{human(r.kind)}{r.starts_at && ` · ${fmtTime(r.starts_at)}`}{r.owner_name && ` · owner ${r.owner_name}`}{r.review_date && ` · review by ${fmtDate(r.review_date)}`}{r.media_id && " · has recording"}</p>
                </Link>))}
            </div>
          </section>);
      })}
    </div>
  );
}
