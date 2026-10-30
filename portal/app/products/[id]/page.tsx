import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer, db } from "@/lib/session";
import { Badge } from "@/components/ui";

export default async function Product({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await getViewer();
  // RLS hides employee-only offerings from everyone else, so a guessed URL returns 404.
  const [o] = await db(v, (q) => q<{ id: string; name: string; eyebrow: string; summary: string; capabilities: string[]; steps: string[]; audience: string }>(
    "select id, name, eyebrow, summary, capabilities, steps, audience from offerings where id = $1", [id]));
  if (!o) notFound();
  return (
    <>
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-5xl px-5 py-16">
          <Link href="/products" className="text-sm text-slate-400 hover:text-white">← All products</Link>
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-brand-2">{o.eyebrow}</p>
          <h1 className="mt-2 text-4xl font-extrabold">{o.name}</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-300">{o.summary}</p>
          <div className="mt-4 flex gap-2"><Badge tone="amber">Development status: Prototype</Badge>{o.audience === "employee" && <Badge tone="purple">Employee only</Badge>}</div>
          <Link href={`/connect?product=${o.id}`} className="btn mt-6">Request a demo</Link>
        </div>
      </section>
      <div className="mx-auto max-w-5xl px-5 py-12">
        <h2 className="h2">What we built</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">{o.capabilities.map((c) => <div key={c} className="card font-semibold text-ink">{c}</div>)}</div>
        <h2 className="h2 mt-10">How it works</h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-5">{o.steps.map((s, i) => <li key={s} className="card"><span className="text-xs font-bold text-brand">0{i + 1}</span><p className="mt-1 text-sm font-semibold">{s}</p></li>)}</ol>
        <p className="muted mt-8">Benefits describe intended outcomes, not verified performance claims.</p>
      </div>
    </>
  );
}
