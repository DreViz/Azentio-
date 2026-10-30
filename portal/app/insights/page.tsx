import { getViewer, db } from "@/lib/session";
import { PageHeader, Tile } from "@/components/ui";

export default async function Insights() {
  const v = await getViewer();
  const rows = await db(v, (q) => q<{ id: string; title: string; body: string }>("select id, title, body from content_items where kind = 'insight' and audience = 'public' order by created_at"));
  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <PageHeader eyebrow="Insights" title="Perspectives on applied AI in financial services" />
      <div className="grid gap-4 md:grid-cols-2">{rows.map((r) => <Tile key={r.id} href={`/content/${r.id}`} title={r.title}><span className="line-clamp-3">{r.body}</span></Tile>)}</div>
    </div>
  );
}
