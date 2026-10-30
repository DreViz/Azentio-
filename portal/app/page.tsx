import Link from "next/link";
import { getViewer, db } from "@/lib/session";
import BrandArt from "@/components/BrandArt";
import Icon from "@/components/Icon";

// One icon per product family, as on the azentio.com product row.
const ICONS: Record<string, Parameters<typeof Icon>[0]["name"]> = {
  "credit-strategy-simulator": "chart", "sme-credit-decisioning": "bank", "similar-portfolio-intelligence": "network", "rejection-intelligence": "layers",
  riva: "document", "financial-analysis": "chart", "document-intelligence": "document", "persona-newsroom": "spark",
};

export default async function Home() {
  const v = await getViewer();
  const { offerings, insights } = await db(v, async (q) => ({
    offerings: await q<{ id: string; name: string; summary: string; category: string }>("select id, name, summary, category from offerings where audience = 'public' order by category, name"),
    insights: await q<{ id: string; title: string; body: string }>("select id, title, body from content_items where kind = 'insight' and audience = 'public' order by created_at limit 3"),
  }));
  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-14 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
        <div>
          <h1 className="text-[2.75rem] font-semibold leading-[1.08] tracking-[-0.02em] text-ink sm:text-6xl lg:text-[4.1rem]">
            Build intelligence. <span className="underline-mint">Create shared value.</span>
          </h1>
          <p className="mt-7 max-w-xl text-[17px] leading-relaxed text-ink/85">
            azentio.ai brings applied AI to banking, insurance and capital markets. Every client works in a private workspace, and what clients choose to share becomes reviewed, de-identified learning that improves our offerings.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/products" className="btn">Explore our products</Link>
            <Link href="/connect" className="btn-ghost">Request a demo</Link>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-[520px]">
          <BrandArt className="w-full" />
          <div className="absolute bottom-10 left-6 hidden w-80 items-center gap-4 rounded-xl bg-ink/90 p-5 text-white shadow-xl backdrop-blur sm:flex">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-ink"><Icon name="shield" /></span>
            <span><span className="block text-lg font-medium text-mint">Collective learning</span><span className="text-[15px] text-white/90">Shared only by choice, reviewed before anyone sees it.</span></span>
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="mx-auto max-w-7xl px-5 pb-20">
        <p className="eyebrow">Our products</p>
        <h2 className="mt-2 text-3xl font-semibold text-ink md:text-[2.6rem] md:leading-tight"><span className="underline-mint">Applied AI.</span> Built for financial services.</h2>
        <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-ink/85">Prototypes for credit, reporting and documents, explored with clients in governed sandboxes using synthetic data.</p>
        <div className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {offerings.map((o) => (
            <Link key={o.id} href={`/products/${o.id}`} className="group flex flex-col">
              <Icon name={ICONS[o.id] ?? "spark"} className="h-11 w-11 text-ink" />
              <p className="mt-5 font-semibold text-ink">{o.name}</p>
              <p className="mt-3 flex-1 text-[15px] leading-relaxed text-ink/80">{o.summary}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-[15px] font-semibold text-ink">Find out more <Icon name="arrow-right" className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
            </Link>
          ))}
        </div>
      </section>

      {/* AIRA band */}
      <section className="bg-tint">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-5 py-12">
          <div>
            <h2 className="text-3xl font-semibold text-ink">Ask AIRA in seconds</h2>
            <p className="mt-2 text-[15px] text-ink/85">Answers are drawn only from content you are allowed to see, and every answer cites its sources.</p>
          </div>
          <form action="/aira" className="flex w-full max-w-xl gap-2">
            <label htmlFor="home-q" className="sr-only">Question for AIRA</label>
            <input id="home-q" name="q" placeholder="What does SME Credit Decisioning do?" className="input mt-0 flex-1 rounded-full px-5" />
            <button className="btn-dark">Ask AIRA</button>
          </form>
        </div>
      </section>

      {/* Key facts */}
      <section className="bg-ink text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-20 lg:grid-cols-2">
          <div>
            <p className="text-sm text-white/80">How collective learning works</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight text-mint md:text-[2.75rem]">Private by default.<br />Shared by choice.</h2>
            <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-white/85">Clients keep their original. Moderators publish a reviewed, de-identified copy. Trends are counted by institution, never by post, and withdrawal is applied at once everywhere it is read.</p>
            <div className="mt-12 flex gap-10">
              <div><p className="text-6xl font-light">2</p><p className="mt-2 text-[15px] text-white/85">copies of every<br />shared observation</p></div>
              <div className="w-px bg-white/30" />
              <div><p className="text-6xl font-light">0</p><p className="mt-2 text-[15px] text-white/85">private drafts visible<br />to anyone else</p></div>
            </div>
          </div>
          <div className="relative mx-auto h-[440px] w-full max-w-[480px]">
            <div className="absolute right-0 top-0 h-[360px] w-[62%] bg-white p-6 text-ink"><p className="text-6xl font-light">24</p><p className="mt-2 text-xl leading-snug">live access checks<br />on every run</p></div>
            <div className="absolute left-0 top-[150px] flex h-[290px] w-[72%] items-start justify-between gap-3 bg-fog p-5 text-ink"><p className="text-6xl font-light leading-none">3</p><p className="text-right text-lg leading-snug">institutions before<br />any trend count</p></div>
            <div className="absolute bottom-0 left-[12%] flex h-[190px] w-[64%] items-start justify-between gap-3 bg-green p-5 text-white"><p className="text-6xl font-light leading-none">4</p><p className="text-right text-lg leading-snug">separate<br />permissions</p></div>
          </div>
        </div>
      </section>

      {/* Insights */}
      <section className="bg-tint">
        <div className="mx-auto max-w-7xl px-5 py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="eyebrow">Insights</p><h2 className="mt-2 text-3xl font-semibold text-ink md:text-[2.6rem]"><span className="underline-mint">Explore</span> our insights</h2></div>
            <Link href="/insights" className="btn-dark">View all</Link>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {insights.map((i, n) => (
              <Link key={i.id} href={`/content/${i.id}`} className="group overflow-hidden rounded-lg bg-white shadow-[0_2px_10px_rgba(22,48,61,0.08)] transition-shadow hover:shadow-[0_8px_26px_rgba(22,48,61,0.14)]">
                <div className="relative h-40 overflow-hidden bg-ink">
                  <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full border-[18px] border-green/80" style={{ transform: `translateX(${n * -40}px)` }} />
                  <div className="absolute bottom-0 left-8 h-16 w-6 bg-mint" /><div className="absolute bottom-0 left-[4.5rem] h-24 w-6 bg-green" />
                </div>
                <div className="p-6">
                  <p className="text-sm text-muted">Insight</p>
                  <p className="mt-2 text-lg font-medium leading-snug text-ink">{i.title}</p>
                  <p className="mt-3 line-clamp-3 text-[15px] leading-relaxed text-ink/80">{i.body}</p>
                  <span className="mt-5 inline-block text-[15px] font-semibold text-ink">Read more</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="bg-fog">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-20 md:grid-cols-2">
          <div>
            <p className="eyebrow">Connect with azentio.ai</p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight text-ink md:text-[2.6rem]">Let&apos;s begin our <span className="underline-mint">journey together.</span></h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink/85">See a product with synthetic data, or bring your team to the azentio.ai Build Labs hackathon.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 md:justify-end">
            <Link href="/connect" className="btn">Talk to an expert</Link>
            <Link href="/hackathon/register" className="btn-dark">Join the hackathon</Link>
          </div>
        </div>
      </section>
    </>
  );
}
