import { notFound } from "next/navigation";
import { getViewer, db } from "@/lib/session";
import { Badge, fmtDate, fmtTime } from "@/components/ui";
import { uuid } from "@/lib/validate";

export default async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await getViewer();
  let cid: string;
  try { cid = uuid(id); } catch { notFound(); }
  const [c] = await db(v, (q) => q<{ title: string; body: string; kind: string; audience: string; media_id: string | null; owner_name: string | null; review_date: string | null; starts_at: string | null }>(
    "select title, body, kind, audience, media_id, owner_name, review_date, starts_at from content_items where id = $1", [cid]));
  if (!c) notFound(); // same response whether it does not exist or the viewer may not see it
  return (
    <article className="mx-auto max-w-3xl px-5 py-12">
      <div className="flex gap-2"><Badge tone="blue">{c.kind.replace("_", " ")}</Badge><Badge tone={c.audience === "public" ? "green" : "purple"}>Audience: {c.audience}</Badge></div>
      <h1 className="h1 mt-3">{c.title}</h1>
      {c.starts_at && <p className="muted mt-1">Session: {fmtTime(c.starts_at)}</p>}
      <p className="mt-5 whitespace-pre-line text-slate-700">{c.body}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {c.media_id && <img src={`/api/media/${c.media_id}`} alt="" className="mt-6 w-full rounded-xl" />}
      {c.owner_name && <p className="muted mt-6">Owner: {c.owner_name}{c.review_date && ` · Next review ${fmtDate(c.review_date)}`}</p>}
    </article>
  );
}
