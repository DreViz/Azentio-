import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer, db } from "@/lib/session";
import { Badge } from "@/components/ui";
import BrandArt from "@/components/BrandArt";
import Icon from "@/components/Icon";

export default async function Product({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await getViewer();
  // RLS hides employee-only offerings from everyone else, so a guessed URL returns 404.
  const [o] = await db(v, (q) => q<{ id: string; name: string; eyebrow: string; summary: string; capabilities: string[]; steps: string[]; audience: string }>(
    "select id, name, eyebrow, summary, capabilities, steps, audience from offerings where id = $1", [id]));
  if (!o) notFound();
  return (
    <>
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-10 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <Link href="/products" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><Icon name="arrow-left" className="h-4 w-4" accent={false} /> All products</Link>
          <p className="eyebrow mt-8">{o.eyebrow}</p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight tracking-[-0.01em] text-ink md:text-[3.4rem]"><span className="underline-mint">{o.name}</span></h1>
          <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-ink/85">{o.summary}</p>
          <div className="mt-5 flex gap-2"><Badge tone="amber">Development status: Prototype</Badge>{o.audience === "employee" && <Badge tone="purple">Employee only</Badge>}</div>
          <Link href={`/connect?product=${o.id}`} className="btn mt-8">Request a demo</Link>
        </div>
        <BrandArt className="mx-auto hidden w-full max-w-[400px] lg:block" />
      </section>
      <section className="bg-cloud">
        <div className="mx-auto max-w-7xl px-5 py-16">
          <p className="eyebrow">What we built</p>
          <h2 className="mt-2 text-3xl font-semibold text-ink">Capabilities</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {o.capabilities.map((c, i) => (
              <div key={c} className="card">
                <Icon name={(["check", "shield", "layers"] as const)[i % 3]} className="h-9 w-9 text-ink" />
                <p className="mt-4 font-semibold text-ink">{c}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-7xl px-5 py-16">
          <p className="text-sm text-white/80">How it works</p>
          <h2 className="mt-2 text-3xl font-semibold text-mint">From input to insight.</h2>
          <ol className="mt-10 grid gap-px overflow-hidden rounded-lg bg-white/15 md:grid-cols-5">
            {o.steps.map((s, i) => (
              <li key={s} className="bg-ink p-6">
                <span className="text-4xl font-light text-mint">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-3 text-[15px] font-medium">{s}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-sm text-white/70">Benefits describe intended outcomes, not verified performance claims.</p>
        </div>
      </section>
    </>
  );
}
