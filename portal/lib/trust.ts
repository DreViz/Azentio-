import { randomUUID } from "node:crypto";
import { pool, system } from "./db";
import { retrieve } from "./aira";

export type Check = { id: string; persona: string; attempt: string; expected: string; actual: string; pass: boolean; ms: number };

type Ids = { users: Record<string, string>; orgs: Record<string, string> };
async function ids(): Promise<Ids> {
  return system(async (q) => ({
    users: Object.fromEntries((await q<{ k: string; id: string }>("select split_part(email, '@', 1) k, id from users")).map((r) => [r.k, r.id])),
    orgs: Object.fromEntries((await q<{ slug: string; id: string }>("select slug, id from organisations")).map((r) => [r.slug, r.id])),
  }));
}

/**
 * Runs one probe as a persona inside a transaction that is always rolled back,
 * so probes that try to write (or that succeed when they should not) never change data.
 */
async function probe<T>(userId: string | null, orgId: string | null, fn: (q: (sql: string, p?: unknown[]) => Promise<T[]>, as: (u: string | null, o?: string | null) => Promise<void>) => Promise<string>): Promise<{ actual: string; ms: number }> {
  const c = await pool.connect();
  const t0 = performance.now();
  try {
    await c.query("begin");
    await c.query("set local role portal_app");
    const as = async (u: string | null, o: string | null = null) => { await c.query("select set_config('app.user_id', $1, true), set_config('app.org_id', $2, true)", [u ?? "", o ?? ""]); };
    await as(userId, orgId);
    const q = async (sql: string, p: unknown[] = []) => (await c.query(sql, p)).rows as T[];
    let actual: string;
    try { actual = await fn(q, as); } catch (e) {
      // Only a refusal raised by Postgres counts as "denied"; anything else is a harness error and fails.
      const pgErr = (e as { code?: string }).code;
      actual = pgErr ? `denied: ${(e as Error).message.slice(0, 90)}` : `harness error: ${(e as Error).message.slice(0, 90)}`;
    }
    return { actual, ms: Math.round(performance.now() - t0) };
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

type Def = { id: string; persona: string; attempt: string; expected: string; run: (x: Ids) => Promise<{ actual: string; ms: number }>; ok: (actual: string) => boolean };
const n = (rows: { n: number }[]) => String(rows[0]?.n ?? 0);
const denied = (a: string) => a.startsWith("denied");

const DEFS: Def[] = [
  { id: "AT-01", persona: "Anonymous visitor", attempt: "Read client contributions", expected: "0 rows",
    run: () => probe(null, null, async (q) => n(await q("select count(*)::int n from contributions") as never)), ok: (a) => a === "0" },
  { id: "AT-02", persona: "Anonymous visitor", attempt: "List employee-only media files", expected: "0 rows",
    run: () => probe(null, null, async (q) => n(await q("select count(*)::int n from media where audience <> 'public'") as never)), ok: (a) => a === "0" },
  { id: "AT-03", persona: "Meridian client admin", attempt: "Forge active workspace = Northwind", expected: "workspace rejected, no Northwind content",
    run: (x) => probe(x.users.alex, x.orgs.northwind, async (q) => {
      const [{ o }] = await q("select app_org() o") as { o: string | null }[];
      const [{ n: c }] = await q("select count(*)::int n from content_items where audience = 'entitled' and offering_id = 'riva'") as { n: number }[];
      return `active org ${o ?? "null"}, entitled RIVA items ${c}`;
    }), ok: (a) => a === "active org null, entitled RIVA items 0" },
  { id: "AT-04", persona: "Lotus client member", attempt: "Read Meridian's contributions", expected: "0 rows",
    run: (x) => probe(x.users.li, x.orgs.lotus, async (q) => n(await q("select count(*)::int n from contributions where org_id = $1", [x.orgs.meridian]) as never)), ok: (a) => a === "0" },
  { id: "AT-05", persona: "Lotus client member", attempt: "Open employee-only experiment offering by id", expected: "0 rows",
    run: (x) => probe(x.users.li, x.orgs.lotus, async (q) => n(await q("select count(*)::int n from offerings where id = 'seasonality-lab'") as never)), ok: (a) => a === "0" },
  { id: "AT-06", persona: "Employee, no moderator grant", attempt: "Read the moderation queue", expected: "0 rows",
    run: (x) => probe(x.users.priya, x.orgs.azentio, async (q) => n(await q("select count(*)::int n from contributions where state = 'submitted'") as never)), ok: (a) => a === "0" },
  { id: "AT-07", persona: "Learning moderator", attempt: "Read unsubmitted private drafts", expected: "0 drafts, reviewed items still visible",
    run: (x) => probe(x.users.maya, x.orgs.azentio, async (q) => {
      const [{ d, s }] = await q("select count(*) filter (where state = 'draft')::int d, count(*) filter (where state <> 'draft')::int s from contributions") as { d: number; s: number }[];
      return `drafts ${d}, reviewable ${s}`;
    }), ok: (a) => /^drafts 0, reviewable [1-9]/.test(a) },
  { id: "AT-08", persona: "Meridian client admin", attempt: "Grant themselves the moderator role", expected: "denied",
    run: (x) => probe(x.users.alex, x.orgs.meridian, async (q) => { await q("select grant_set($1, 'moderator', true)", [x.users.alex]); return "granted"; }), ok: denied },
  { id: "AT-09", persona: "Meridian client admin", attempt: "Invite an @azentio.com user into the client workspace", expected: "denied",
    run: (x) => probe(x.users.alex, x.orgs.meridian, async (q) => { await q("select invite_create('eve@azentio.com', 'client_admin', 'h', now() + interval '1 day')"); return "invited"; }), ok: denied },
  { id: "AT-10", persona: "Verified email, no membership", attempt: "Read shared learning and restricted content", expected: "0 rows",
    run: () => probe(randomUUID(), null, async (q) => n(await q("select ((select count(*) from shared_items) + (select count(*) from content_items where audience <> 'public'))::int n") as never)), ok: (a) => a === "0" },
  { id: "AT-12", persona: "Lotus client member", attempt: "Select the hidden source link of a shared item", expected: "denied (column not granted)",
    run: (x) => probe(x.users.li, x.orgs.lotus, async (q) => { await q("select contribution_id from shared_items limit 1"); return "returned source ids"; }), ok: denied },
  { id: "AT-14", persona: "Meridian author → Lotus reader", attempt: "Withdraw a published item, then search and ask AIRA as another client", expected: "visible before, gone after",
    run: (x) => probe(x.users.sam, x.orgs.meridian, async (q, as) => {
      const [c] = await q("select id from contributions where author_id = app_uid() and state = 'published' limit 1") as { id: string }[];
      const sids = (await q("select shared_for_contribution($1) s", [c.id]) as { s: string }[]).map((r) => r.s);
      await as(x.users.li, x.orgs.lotus);
      const before = (await q("select count(*)::int n from shared_items where id = any($1::uuid[])", [sids]) as { n: number }[])[0].n;
      await as(x.users.sam, x.orgs.meridian);
      const t = performance.now();
      await q("select contribution_withdraw($1)", [c.id]);
      await as(x.users.li, x.orgs.lotus);
      const after = (await q("select count(*)::int n from shared_items where id = any($1::uuid[])", [sids]) as { n: number }[])[0].n;
      return `before ${before}, after ${after}, propagation ${Math.round(performance.now() - t)} ms`;
    }), ok: (a) => /^before [1-9]\d*, after 0/.test(a) },
  { id: "AT-15", persona: "Lotus client member", attempt: "Read the organisation count of a two-institution theme", expected: "withheld",
    run: (x) => probe(x.users.li, x.orgs.lotus, async (q) => {
      const rows = await q("select t.title, s.items, s.orgs, s.suppressed from theme_stats() s join themes t on t.id = s.theme_id where t.title = 'Document intake exceptions'") as { items: number; orgs: number | null; suppressed: boolean }[];
      return rows[0] ? `items ${rows[0].items}, orgs ${rows[0].orgs ?? "withheld"}` : "no theme";
    }), ok: (a) => a === "items 3, orgs withheld" },
  { id: "AT-16", persona: "Lotus client member", attempt: "Three posts from one institution count once", expected: "3 institutions for 3+ posts",
    run: (x) => probe(x.users.li, x.orgs.lotus, async (q) => {
      const rows = await q("select s.items, s.orgs from theme_stats() s join themes t on t.id = s.theme_id where t.title = 'Late regulatory template changes'") as { items: number; orgs: number | null }[];
      return rows[0] ? `items ${rows[0].items}, orgs ${rows[0].orgs}` : "no theme";
    }), ok: (a) => /^items \d+, orgs 3$/.test(a) },
  { id: "AT-17", persona: "Anonymous visitor", attempt: "Ask AIRA about internal experiments", expected: "no employee or shared sources",
    run: () => probe(null, null, async (q) => {
      const cites = await retrieve(q as never, "internal experiment seasonality town hall prototype notes");
      const bad = cites.filter((c) => c.kind === "shared" || /experiment notes|town hall|seasonality-aware/i.test(c.title));
      return `${cites.length} sources, ${bad.length} restricted`;
    }), ok: (a) => / 0 restricted$/.test(a) },
  { id: "AT-19", persona: "Meridian client member", attempt: "Publish their own submission (skip moderation)", expected: "denied",
    run: (x) => probe(x.users.sam, x.orgs.meridian, async (q) => {
      const [c] = await q("select id from contributions where author_id = app_uid() order by (state = 'submitted') desc limit 1") as { id: string }[];
      await q("select contribution_publish($1, '{}'::jsonb, '')", [c.id]); return "published";
    }), ok: denied },
  { id: "AT-19b", persona: "Meridian client member", attempt: "Set state = published directly with UPDATE", expected: "denied (column not granted)",
    run: (x) => probe(x.users.sam, x.orgs.meridian, async (q) => { await q("update contributions set state = 'published' where author_id = app_uid()"); return "updated"; }), ok: denied },
  { id: "AT-20", persona: "System", attempt: "Every published contribution has an audit event", expected: "0 missing",
    run: () => probe(null, null, async () => {
      const [{ n: m }] = await system((q) => q<{ n: number }>("select count(*)::int n from contributions c where state = 'published' and not exists (select 1 from audit_events a where a.entity_id = c.id::text and a.action = 'contribution.published')"));
      return String(m);
    }), ok: (a) => a === "0" },
  { id: "AT-20b", persona: "Portal administrator", attempt: "Delete or edit audit events", expected: "denied",
    run: (x) => probe(x.users.ada, x.orgs.azentio, async (q) => { await q("delete from audit_events"); return "deleted"; }), ok: denied },
  { id: "AT-21", persona: "Content publisher", attempt: "Publish content without an audience", expected: "denied",
    run: (x) => probe(x.users.pat, x.orgs.azentio, async (q) => { await q("insert into content_items(kind, title, body, created_by) values ('insight', 'No audience', 'This item has no audience set.', app_uid())"); return "inserted"; }), ok: denied },
  { id: "AT-22", persona: "Lotus client member", attempt: "Read internal idea priority", expected: "0 rows",
    run: (x) => probe(x.users.li, x.orgs.lotus, async (q) => n(await q("select count(*)::int n from ideas") as never)), ok: (a) => a === "0" },
  { id: "AT-23", persona: "Learning moderator", attempt: "Identify client authors", expected: "0 client users visible",
    run: (x) => probe(x.users.maya, x.orgs.azentio, async (q) => n(await q("select count(*)::int n from users where email not like '%@azentio.com'") as never)), ok: (a) => a === "0" },
  { id: "AT-24", persona: "Portal administrator", attempt: "Read a client's private draft", expected: "0 rows",
    run: (x) => probe(x.users.ada, x.orgs.azentio, async (q) => n(await q("select count(*)::int n from contributions where state = 'draft'") as never)), ok: (a) => a === "0" },
  { id: "AT-25", persona: "Northwind admin, active workspace Lotus", attempt: "See RIVA content entitled to Northwind only", expected: "0 rows",
    run: (x) => probe(x.users.noor, x.orgs.lotus, async (q) => n(await q("select count(*)::int n from content_items where audience = 'entitled' and offering_id = 'riva'") as never)), ok: (a) => a === "0" },
];

export async function runTrustChecks(): Promise<Check[]> {
  const x = await ids();
  const out: Check[] = [];
  for (const d of DEFS) {
    let r: { actual: string; ms: number };
    try { r = await d.run(x); } catch (e) { r = { actual: `harness error: ${(e as Error).message}`, ms: 0 }; }
    out.push({ id: d.id, persona: d.persona, attempt: d.attempt, expected: d.expected, actual: r.actual, pass: d.ok(r.actual), ms: r.ms });
  }
  return out;
}
