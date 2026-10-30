import { requireViewer, db, can } from "@/lib/session";
import { Badge, Empty, Flash, PageHeader, fmtDate } from "@/components/ui";
import { createContent } from "@/app/actions/portal";

export default async function Studio({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const v = await requireViewer();
  if (!can(v, "publisher")) return <Empty title="The content studio requires the publisher grant." />;
  const d = await db(v, async (q) => ({
    items: await q<{ id: string; kind: string; title: string; audience: string; created_at: string }>("select id, kind, title, audience, created_at from content_items order by created_at desc"),
    offerings: await q<{ id: string; name: string }>("select id, name from offerings where audience = 'public' order by name"),
  }));
  return (
    <div>
      <PageHeader eyebrow="Content publisher" title="Content studio">Publish banners, insights, broadcasts and briefings. Every item needs an explicit audience; nothing defaults to public.</PageHeader>
      <Flash sp={sp} />
      <form action={createContent} className="card grid gap-3 md:grid-cols-2">
        <div><label className="label" htmlFor="kind">Type</label><select id="kind" name="kind" className="input"><option value="insight">Insight</option><option value="banner">Banner</option><option value="broadcast">Live broadcast</option><option value="briefing">Briefing / webinar</option><option value="release_note">Release note</option></select></div>
        <div><label className="label" htmlFor="audience">Audience</label><select id="audience" name="audience" required defaultValue="" className="input"><option value="" disabled>Choose an audience</option><option value="public">Public</option><option value="employee">Employees only</option><option value="clients">All client members</option><option value="entitled">Clients entitled to an offering</option></select></div>
        <div className="md:col-span-2"><label className="label" htmlFor="title">Title</label><input id="title" name="title" required minLength={3} maxLength={160} className="input" /></div>
        <div className="md:col-span-2"><label className="label" htmlFor="body">Body</label><textarea id="body" name="body" required minLength={10} maxLength={4000} rows={4} className="input" /></div>
        <div><label className="label" htmlFor="offering_id">Offering (for entitled audience)</label><select id="offering_id" name="offering_id" className="input"><option value="">None</option>{d.offerings.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
        <div><label className="label" htmlFor="starts_at">Session time (optional)</label><input id="starts_at" name="starts_at" type="datetime-local" className="input" /></div>
        <button className="btn md:w-fit">Publish</button>
      </form>
      <h2 className="h2 mb-3 mt-8">Published content</h2>
      <div className="card divide-y p-0">{d.items.map((i) => <div key={i.id} className="flex justify-between px-5 py-2 text-sm"><span>{i.title}</span><span className="flex gap-2"><Badge>{i.kind}</Badge><Badge tone={i.audience === "public" ? "green" : "purple"}>{i.audience}</Badge><span className="muted">{fmtDate(i.created_at)}</span></span></div>)}</div>
    </div>
  );
}
