import Link from "next/link";
import { requireViewer, db } from "@/lib/session";
import { Badge, Empty, Flash, PageHeader, fmtDate } from "@/components/ui";
import { STATE_TONE, VISIBILITY_TEXT, human } from "@/lib/labels";

type Row = { id: string; title: string; state: string; visibility: string; updated_at: string; version: number; mine: boolean };

export default async function Contributions({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const v = await requireViewer();
  const rows = await db(v, (q) => q<Row>(`select id, title, state, visibility, updated_at, version, author_id = app_uid() mine
    from contributions where org_id = app_org() order by updated_at desc`));
  const list = (items: Row[], empty: string) => items.length ? (
    <div className="card divide-y p-0">
      {items.map((c) => (
        <Link key={c.id} href={`/portal/contributions/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-slate-50">
          <span className="font-medium">{c.title}{c.version > 1 && <span className="muted"> · v{c.version}</span>}</span>
          <span className="flex items-center gap-2"><Badge>{VISIBILITY_TEXT[c.visibility].label}</Badge><Badge tone={STATE_TONE[c.state]}>{human(c.state)}</Badge><span className="muted">{fmtDate(c.updated_at)}</span></span>
        </Link>))}
    </div>) : <Empty title={empty} />;
  return (
    <div>
      <PageHeader eyebrow={v.activeOrg?.org_name} title="Observations" actions={<Link href="/portal/contributions/new" className="btn">New observation</Link>}>
        Your private drafts and your organisation&apos;s observations. This is separate from the cross-client <Link href="/portal/learning" className="link">shared learning feed</Link>.
      </PageHeader>
      <Flash sp={sp} />
      <h2 className="h2 mb-3">My observations</h2>
      {list(rows.filter((r) => r.mine), "No observations yet")}
      <h2 className="h2 mb-3 mt-8">Our organisation&apos;s observations</h2>
      {list(rows.filter((r) => !r.mine), "Nothing shared within your organisation yet")}
    </div>
  );
}
