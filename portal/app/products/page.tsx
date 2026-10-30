import Link from "next/link";
import { getViewer, db } from "@/lib/session";
import { PageHeader } from "@/components/ui";

export default async function Products() {
  const v = await getViewer();
  const rows = await db(v, (q) => q<{ id: string; name: string; eyebrow: string; summary: string; category: string }>("select id, name, eyebrow, summary, category from offerings where audience = 'public' order by category, name"));
  const cats = [...new Set(rows.map((r) => r.category))];
  return (
    <div className="mx-auto max-w-7xl px-5 py-12">
      <PageHeader eyebrow="Our products" title="Intelligent products. Real-world purpose.">Explore applied AI experiences, from credit decisioning to reporting and document intelligence.</PageHeader>
      {cats.map((c) => (
        <section key={c} className="mb-10">
          <h2 className="h2 mb-4">{c}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rows.filter((r) => r.category === c).map((o) => (
              <Link key={o.id} href={`/products/${o.id}`} className="card hover:shadow-md">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand">{o.eyebrow}</p>
                <p className="mt-1 text-lg font-semibold text-ink">{o.name}</p>
                <p className="muted mt-2">{o.summary}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
      <p className="muted">Product capabilities and release readiness must be validated before public marketing or customer commitments.</p>
    </div>
  );
}
