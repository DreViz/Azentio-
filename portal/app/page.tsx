import Link from "next/link";
import { getViewer, db } from "@/lib/session";

export default async function Home() {
  const v = await getViewer();
  const { offerings, insights } = await db(v, async (q) => ({
    offerings: await q<{ id: string; name: string; eyebrow: string; summary: string; category: string }>("select id, name, eyebrow, summary, category from offerings where audience = 'public' order by category, name"),
    insights: await q<{ id: string; title: string; body: string }>("select id, title, body from content_items where kind = 'insight' and audience = 'public' order by created_at limit 3"),
  }));
  return (
    <>
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand/30 blur-3xl" />
        <div className="absolute -bottom-40 left-0 h-[420px] w-[420px] rounded-full bg-brand-2/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-5 py-24">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-2">azentio.ai</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-extrabold leading-tight tracking-tight">Build intelligence. Create shared value.</h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-300">Applied AI for credit, reporting and documents. A private workspace for every client. Governed collective learning that turns what our clients observe into better offerings, without exposing anyone&apos;s private information.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/products" className="btn">Explore products</Link>
            <Link href="/connect" className="rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold hover:bg-white/10">Request a demo</Link>
            <Link href="/hackathon/register" className="rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold hover:bg-white/10">Join the hackathon</Link>
          </div>
          <div className="mt-14 grid max-w-4xl gap-4 sm:grid-cols-3">
            {[["Public discovery", "Products, insights and media for every visitor."], ["Employee innovation", "Playgrounds, experiments and internal sessions."], ["Client collaboration", "Private workspaces and reviewed, de-identified shared learning."]].map(([t, d]) => (
              <div key={t} className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="font-semibold">{t}</p><p className="mt-1 text-sm text-slate-400">{d}</p></div>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-16">
        <div className="flex items-end justify-between"><h2 className="text-2xl font-bold text-ink">Intelligent products. Real-world purpose.</h2><Link href="/products" className="link text-sm">All products →</Link></div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {offerings.map((o) => (
            <Link key={o.id} href={`/products/${o.id}`} className="card transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand">{o.eyebrow}</p>
              <p className="mt-1 font-semibold text-ink">{o.name}</p>
              <p className="muted mt-2 line-clamp-3">{o.summary}</p>
            </Link>
          ))}
        </div>
      </section>
      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand">Collective learning, governed</p>
            <h2 className="mt-2 text-2xl font-bold text-ink">Every privacy promise here has a test you can run.</h2>
            <p className="mt-3 text-slate-600">Clients share market observations by explicit choice. Moderators publish only reviewed, de-identified copies. Trends are counted by distinct organisations and withheld for small groups. Withdrawal removes an item from search and AIRA immediately. Access is enforced by the database, not the menu.</p>
            <Link href="/trust" className="btn mt-5">See the live proof</Link>
          </div>
          <div className="space-y-3">
            {insights.map((i) => (
              <Link key={i.id} href={`/content/${i.id}`} className="card block hover:shadow-md"><p className="font-semibold text-ink">{i.title}</p><p className="muted mt-1 line-clamp-2">{i.body}</p></Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
