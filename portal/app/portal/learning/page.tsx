import { requireViewer, db } from "@/lib/session";
import { toTsQuery } from "@/lib/aira";
import { Badge, Empty, Flash, PageHeader, fmtDate } from "@/components/ui";
import { human } from "@/lib/labels";
import { reportItem } from "@/app/actions/portal";

type Item = { id: string; title: string; body: string; type: string; offering_id: string | null; industry: string; region_band: string; period_label: string; evidence_type: string; confidence: string; attribution_label: string | null; published_at: string; theme: string | null };
const FILTERS = ["offering_id", "industry", "region_band", "type"] as const;

export default async function Learning({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const v = await requireViewer();
  const where: string[] = ["s.status = 'published'"];
  const args: unknown[] = [];
  const tsq = toTsQuery(sp.q ?? "");
  if (tsq) { args.push(tsq); where.push(`s.search @@ to_tsquery('english', $${args.length})`); }
  for (const f of FILTERS) if (sp[f]) { args.push(sp[f]); where.push(`s.${f} = $${args.length}`); }
  if (sp.period) { args.push(`%${sp.period}%`); where.push(`s.period_label like $${args.length}`); }
  const d = await db(v, async (q) => ({
    items: await q<Item>(`select s.id, s.title, s.body, s.type, s.offering_id, s.industry, s.region_band, s.period_label, s.evidence_type, s.confidence, s.attribution_label, s.published_at, t.title theme
      from shared_items s left join themes t on t.id = s.theme_id where ${where.join(" and ")} order by s.published_at desc limit 100`, args),
    // Facet counts come from a function that withholds any value backed by too few organisations.
    facets: Object.fromEntries(await Promise.all(FILTERS.map(async (f) => [f, await q<{ value: string; items: number; orgs: number | null }>("select * from facet_counts($1)", [f])]))) as Record<string, { value: string; items: number; orgs: number | null }[]>,
    options: Object.fromEntries(await Promise.all(FILTERS.map(async (f) => [f, (await q<{ v: string }>(`select distinct ${f} v from shared_items where status = 'published' and ${f} is not null order by 1`)).map((r) => r.v)]))) as Record<string, string[]>,
  }));
  return (
    <div>
      <PageHeader eyebrow="Collective learning" title="Shared learning feed">Approved, de-identified observations from participating institutions. This is separate from your organisation&apos;s private observations.</PageHeader>
      <Flash sp={sp} />
      <form className="card mb-5 grid gap-3 md:grid-cols-6" action="/portal/learning">
        <div className="md:col-span-2"><label className="label" htmlFor="q">Search</label><input id="q" name="q" defaultValue={sp.q} className="input" placeholder="seasonal cash flow" /></div>
        {FILTERS.map((f) => (
          <div key={f}><label className="label" htmlFor={f}>{human(f.replace("_id", "").replace("_band", ""))}</label>
            <select id={f} name={f} defaultValue={sp[f] ?? ""} className="input"><option value="">Any</option>{d.options[f].map((o) => <option key={o} value={o}>{human(o)}</option>)}</select></div>
        ))}
        <div><label className="label" htmlFor="period">Period</label><input id="period" name="period" defaultValue={sp.period} placeholder="2026" className="input" /></div>
        <div className="flex items-end gap-2 md:col-span-5"><button className="btn">Apply</button><a href="/portal/learning" className="btn-ghost">Clear</a><span className="muted ml-auto">{d.items.length} observations</span></div>
      </form>
      <div className="grid gap-6 lg:grid-cols-4">
        <div className="space-y-4 lg:col-span-3">
          {d.items.length ? d.items.map((s) => (
            <article id={s.id} key={s.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="font-semibold text-ink">{s.title}</h2>{s.theme && <Badge tone="purple">{s.theme}</Badge>}</div>
              <p className="mt-2 text-sm text-slate-700">{s.body}</p>
              <div className="mt-3 flex flex-wrap gap-2"><Badge>{human(s.type)}</Badge><Badge>{s.industry}</Badge><Badge>{s.region_band}</Badge><Badge>{s.period_label}</Badge><Badge tone="cyan">evidence: {human(s.evidence_type)}</Badge><Badge tone="cyan">confidence: {s.confidence}</Badge>{s.offering_id && <Badge tone="blue">{s.offering_id}</Badge>}</div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>{s.attribution_label ?? "Contributor not attributed"} · published {fmtDate(s.published_at)}</span>
                <details><summary className="cursor-pointer text-rose-600">Report</summary>
                  <form action={reportItem} className="mt-2 flex flex-wrap gap-2">
                    <input type="hidden" name="sid" value={s.id} />
                    <select name="reason" className="input mt-0 w-auto text-xs" aria-label="Reason"><option value="misleading">Misleading</option><option value="confidential">Confidential</option><option value="inappropriate">Inappropriate</option><option value="duplicate">Duplicate</option></select>
                    <input name="details" maxLength={1000} placeholder="Optional details. No need to name anyone." className="input mt-0 w-64 text-xs" />
                    <button className="btn-ghost px-2 py-1 text-xs">Send</button>
                  </form>
                </details>
              </div>
            </article>)) : <Empty title="No approved observations match">Try a broader search.</Empty>}
        </div>
        <aside className="card h-fit text-sm">
          <h2 className="font-semibold">Where observations come from</h2>
          <p className="muted mt-1">Counts show distinct institutions, and only where at least the minimum cohort contributed.</p>
          {FILTERS.map((f) => (
            <div key={f} className="mt-3"><p className="text-xs font-bold uppercase text-slate-400">{human(f.replace("_id", "").replace("_band", ""))}</p>
              {d.facets[f].length ? d.facets[f].map((x) => <p key={x.value} className="flex justify-between"><span>{human(x.value)}</span><span className="muted">{x.orgs} institutions</span></p>) : <p className="muted text-xs">All groups below the minimum cohort; withheld.</p>}
            </div>))}
        </aside>
      </div>
    </div>
  );
}
