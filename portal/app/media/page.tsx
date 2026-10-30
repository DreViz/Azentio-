import { getViewer, db } from "@/lib/session";
import { Badge, PageHeader, Empty } from "@/components/ui";

export default async function Media() {
  const v = await getViewer();
  // Only media this viewer may access is listed; every file request is checked again by /api/media.
  const rows = await db(v, (q) => q<{ id: string; title: string; audience: string }>("select id, title, audience from media order by created_at"));
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <PageHeader eyebrow="Media & videos" title="Watch and explore">Signed-in employees and clients also see media for their audience here.</PageHeader>
      {rows.length === 0 ? <Empty title="No media available" /> : (
        <div className="grid gap-5 md:grid-cols-2">
          {rows.map((m) => (
            <figure key={m.id} className="card p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/media/${m.id}`} alt={m.title} className="w-full rounded-xl" />
              <figcaption className="mt-3 flex items-center justify-between"><span className="font-semibold">{m.title}</span><Badge tone={m.audience === "public" ? "green" : "purple"}>{m.audience}</Badge></figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
