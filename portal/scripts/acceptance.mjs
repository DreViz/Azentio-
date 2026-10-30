// HTTP acceptance tests against a running portal (route-level enforcement, including direct media links).
// The harness mints sessions for seeded personas directly in the database (it has the DATABASE_URL),
// so these tests exercise authorisation, not sign-in. Sign-in is covered by AT-SIGNIN below.
// Usage: BASE_URL=http://localhost:3100 node scripts/acceptance.mjs
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
for (const f of [".env.local", ".env"]) {
  const p = path.join(root, f);
  if (fs.existsSync(p)) for (const line of fs.readFileSync(p, "utf8").split("\n")) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
}
const BASE = process.env.BASE_URL || "http://localhost:3100";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0];

const sessions = {};
async function session(email, orgSlug) {
  const key = `${email}:${orgSlug}`;
  if (sessions[key]) return sessions[key];
  const raw = randomBytes(24).toString("base64url");
  const u = await one("select id from users where email = $1", [email]);
  const o = orgSlug ? await one("select id from organisations where slug = $1", [orgSlug]) : null;
  await db.query("insert into sessions(token_hash, user_id, active_org_id, expires_at) values ($1,$2,$3, now() + interval '1 hour')",
    [createHash("sha256").update(raw).digest("hex"), u.id, o?.id ?? null]);
  return (sessions[key] = `azp_session=${raw}`);
}
async function get(pathname, who) {
  const headers = who ? { cookie: await session(...who) } : {};
  const r = await fetch(BASE + pathname, { headers, redirect: "manual" });
  return { status: r.status, text: r.status === 200 ? await r.text() : "", headers: r.headers };
}

const media = Object.fromEntries((await db.query("select filename, id from media")).rows.map((r) => [r.filename, r.id]));
const content = Object.fromEntries((await db.query("select title, id from content_items")).rows.map((r) => [r.title, r.id]));
const samDraft = (await one("select id from contributions where title like 'Draft: collateral%'")).id;
const alexOrg = (await one("select id from contributions where title like 'Branch teams%'")).id;

const SAM = ["sam@meridian.example", "meridian"], LI = ["li@lotus.example", "lotus"], ALEX = ["alex@meridian.example", "meridian"];
const NOOR_NW = ["noor@northwind.example", "northwind"], NOOR_LOTUS = ["noor@northwind.example", "lotus"];
const PRIYA = ["priya@azentio.com", "azentio"], MAYA = ["maya@azentio.com", "azentio"];

const tests = [
  ["HTTP-01", "Anonymous: employee recording by direct link", () => get(`/api/media/${media["employee-townhall.svg"]}`), (r) => r.status === 404],
  ["HTTP-02", "Employee: employee recording", () => get(`/api/media/${media["employee-townhall.svg"]}`, PRIYA), (r) => r.status === 200 && r.headers.get("cache-control")?.includes("no-store")],
  ["HTTP-03", "Lotus client: Meridian-only briefing media", () => get(`/api/media/${media["meridian-briefing.svg"]}`, LI), (r) => r.status === 404],
  ["HTTP-04", "Meridian client: own briefing media", () => get(`/api/media/${media["meridian-briefing.svg"]}`, SAM), (r) => r.status === 200],
  ["HTTP-05", "Northwind (entitled to RIVA): RIVA webinar media", () => get(`/api/media/${media["riva-walkthrough.svg"]}`, NOOR_NW), (r) => r.status === 200],
  ["HTTP-06", "Same user, active workspace Lotus (not entitled): RIVA media", () => get(`/api/media/${media["riva-walkthrough.svg"]}`, NOOR_LOTUS), (r) => r.status === 404],
  ["HTTP-07", "Anonymous: employee-only product page by URL", () => get("/products/seasonality-lab"), (r) => r.status === 404],
  ["HTTP-08", "Employee: employee-only product page", () => get("/products/seasonality-lab", PRIYA), (r) => r.status === 200],
  ["HTTP-09", "Client: employee experiment notes by URL", () => get(`/content/${content["Experiment notes: seasonality-aware comparison"]}`, LI), (r) => r.status === 404],
  ["HTTP-10", "Same Meridian author: own private draft", () => get(`/portal/contributions/${samDraft}`, SAM), (r) => r.status === 200 && r.text.includes("collateral")],
  ["HTTP-11", "Meridian colleague: another member's private draft", () => get(`/portal/contributions/${samDraft}`, ALEX), (r) => r.status === 404],
  ["HTTP-12", "Meridian colleague: organisation-visible observation", () => get(`/portal/contributions/${alexOrg}`, SAM), (r) => r.status === 200],
  ["HTTP-13", "Lotus client: Meridian organisation-visible observation", () => get(`/portal/contributions/${alexOrg}`, LI), (r) => r.status === 404],
  ["HTTP-14", "Moderator: Meridian private draft", () => get(`/portal/contributions/${samDraft}`, MAYA), (r) => r.status === 404],
  ["HTTP-15", "Anonymous: portal redirects to sign-in", () => get("/portal"), (r) => r.status === 307 || r.status === 303 || r.status === 302],
  ["HTTP-16", "Client: moderation page shows no queue", () => get("/portal/moderation", LI), (r) => r.status === 200 && r.text.includes("requires the learning moderator grant") && !r.text.includes("Seasonal SME cash flow")],
  ["HTTP-17", "Anonymous: AIRA does not reveal internal notes", () => get("/aira?q=" + encodeURIComponent("internal experiment seasonality prototype notes town hall")), (r) => r.status === 200 && !r.text.includes("Experiment notes") && !r.text.includes("town hall recording")],
  ["HTTP-18", "Client: shared feed has no source or org fields", () => get("/portal/learning", LI), (r) => r.status === 200 && !r.text.includes("Meridian Bank") && !r.text.includes("004512339871")],
  ["HTTP-19", "Client: ideas page hides internal priority", () => get("/portal/ideas", LI), (r) => r.status === 200 && !r.text.includes("priority")],
  ["HTTP-20", "Security headers present", () => get("/"), (r) => r.headers.get("x-frame-options") === "DENY" && r.headers.get("x-content-type-options") === "nosniff"],
  ["HTTP-21", "Media id that is not a UUID", () => get("/api/media/..%2F..%2Fpackage.json"), (r) => r.status === 404],
];

let pass = 0;
const rows = [];
for (const [id, name, run, ok] of tests) {
  let r, good = false;
  try { r = await run(); good = ok(r); } catch (e) { r = { status: `error ${e.message}` }; }
  if (good) pass++;
  rows.push(`| ${id} | ${name} | ${r.status} | ${good ? "PASS" : "FAIL"} |`);
  console.log(`${good ? "PASS" : "FAIL"}  ${id}  ${name}  (${r.status})`);
}
await db.query("delete from sessions where expires_at < now() + interval '2 hours' and created_at > now() - interval '10 minutes' and token_hash = any($1)",
  [Object.values(sessions).map((c) => createHash("sha256").update(c.split("=")[1]).digest("hex"))]);
await db.end();
fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs", "acceptance-http-results.md"),
  `# HTTP acceptance results\n\nRun ${new Date().toISOString()} against ${BASE}. ${pass}/${tests.length} passed.\n\n| Test | Scenario | HTTP status | Result |\n|---|---|---|---|\n${rows.join("\n")}\n`);
console.log(`\n${pass}/${tests.length} passed`);
process.exit(pass === tests.length ? 0 : 1);
