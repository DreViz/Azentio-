import Link from "next/link";
import { requireViewer, db, can } from "@/lib/session";
import { Badge, Empty, Flash, Notice, PageHeader, fmtDate } from "@/components/ui";
import { suggestThemes } from "@/lib/themes";
import { createTheme } from "@/app/actions/portal";

export default async function Themes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const v = await requireViewer();
  const curator = can(v, "moderator") || can(v, "product_owner");
  const d = await db(v, async (q) => ({
    themes: await q<{ id: string; title: string; summary: string; limitations: string; updated_at: string }>("select id, title, summary, limitations, updated_at from themes order by updated_at desc"),
    stats: await q<{ theme_id: string; items: number; orgs: number | null; suppressed: boolean }>("select * from theme_stats()"),
    items: await q<{ id: string; title: string; body: string; offering_id: string | null; theme_id: string | null; period_label: string; confidence: string }>(
      "select id, title, body, offering_id, theme_id, period_label, confidence from shared_items where status = 'published' order by published_at"),
    k: (await q<{ k: number }>("select min_cohort() k"))[0].k,
    ideas: await q<{ title: string; status: string; theme_id: string | null }>("select title, status, theme_id from ideas_public()"),
  }));
  const unthemed = d.items.filter((i) => !i.theme_id);
  const suggestions = curator && sp.suggest ? await suggestThemes(unthemed) : [];
  return (
    <div>
      <PageHeader eyebrow="Collective learning" title="Themes" actions={curator && unthemed.length > 0 ? <Link href="/portal/themes?suggest=1" className="btn">Suggest themes from {unthemed.length} unthemed items</Link> : undefined}>
        Recurring topics across approved observations. Organisations are counted once each, and counts are withheld below {d.k} institutions.
      </PageHeader>
      <Flash sp={sp} />
      {suggestions.length > 0 && (
        <div className="mb-8 space-y-4">
          <Notice tone="blue">Suggested groupings ({suggestions[0].engine === "model" ? "model suggestions" : "keyword rules"}). Review before creating. Suggestions keep their evidence links and make no prevalence claims.</Notice>
          {suggestions.map((s, i) => (
            <form key={i} action={createTheme} className="card space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div><label className="label">Theme title</label><input name="title" defaultValue={s.title} required className="input" /></div>
                <div><label className="label">Limitations</label><input name="limitations" required className="input" defaultValue={`Small, self-reported sample (${s.item_ids.length} observations). Not evidence of market prevalence or causation.`} /></div>
              </div>
              <div><label className="label">Summary</label><input name="summary" defaultValue={s.summary} required className="input" /></div>
              <fieldset className="text-sm"><legend className="label">Linked evidence</legend>
                {unthemed.filter((u) => s.item_ids.includes(u.id)).map((u) => <label key={u.id} className="flex gap-2"><input type="checkbox" name="item" value={u.id} defaultChecked /> {u.title}</label>)}
              </fieldset>
              <button className="btn">Create theme</button>
            </form>))}
        </div>
      )}
      {d.themes.length === 0 ? <Empty title="No themes yet" /> : (
        <div className="grid gap-5 md:grid-cols-2">
          {d.themes.map((t) => {
            const st = d.stats.find((s) => s.theme_id === t.id);
            const items = d.items.filter((i) => i.theme_id === t.id);
            const offerings = [...new Set(items.map((i) => i.offering_id).filter(Boolean))];
            const periods = [...new Set(items.map((i) => i.period_label))];
            const conf = ["high", "medium", "low"].map((c) => [c, items.filter((i) => i.confidence === c).length] as const).filter(([, k]) => k > 0).map(([c, k]) => `${k} ${c}`).join(", ") || "n/a";
            return (
              <section key={t.id} className="card">
                <div className="flex items-start justify-between gap-2"><h2 className="text-lg font-semibold text-ink">{t.title}</h2><Badge tone="slate">updated {fmtDate(t.updated_at)}</Badge></div>
                <p className="mt-1 text-sm text-slate-700">{t.summary}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 p-2"><p className="text-xl font-bold">{st?.items ?? 0}</p><p className="text-xs text-slate-500">observations</p></div>
                  <div className="rounded-lg bg-slate-50 p-2">{st && !st.suppressed ? <><p className="text-xl font-bold">{st.orgs}</p><p className="text-xs text-slate-500">distinct institutions</p></> : <><p className="text-sm font-bold">Withheld</p><p className="text-xs text-slate-500">fewer than {d.k} institutions</p></>}</div>
                  <div className="rounded-lg bg-slate-50 p-2"><p className="text-sm font-bold">{conf}</p><p className="text-xs text-slate-500">contributor confidence</p></div>
                </div>
                <p className="muted mt-3">Offerings: {offerings.join(", ") || "various"} · Period: {periods.join(", ") || "n/a"}</p>
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{t.limitations}{st?.suppressed && " Sample too small to report a count."}</p>
                <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium text-brand">Supporting observations ({items.length})</summary>
                  {items.map((i) => <Link key={i.id} href={`/portal/learning#${i.id}`} className="link block py-0.5">{i.title}</Link>)}
                </details>
                {d.ideas.filter((x) => x.theme_id === t.id).map((x) => <p key={x.title} className="mt-2 text-sm">Idea: {x.title} <Badge tone="purple">{x.status}</Badge></p>)}
              </section>);
          })}
        </div>
      )}
    </div>
  );
}
