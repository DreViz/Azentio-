// Smoke test: renders every page as every seeded persona and reports server errors (5xx). Usage: BASE_URL=... node scripts/smoke.mjs
import pg from "pg"; import { createHash, randomBytes } from "node:crypto";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:54329/portal" }); await db.connect();
const pages = ["/portal","/portal/contributions","/portal/contributions/new","/portal/learning","/portal/learning?q=seasonal&industry=Banking","/portal/themes","/portal/themes?suggest=1","/portal/ideas","/portal/moderation","/portal/sandbox","/portal/resources","/portal/org","/portal/admin","/portal/studio","/portal/notifications","/portal/federated","/aira?q=seasonal%20cash%20flow","/media","/trust","/","/products","/products/riva","/solutions","/insights","/about","/connect","/hackathon/register","/login","/judge"];
const people = [["priya@azentio.com","azentio"],["maya@azentio.com","azentio"],["omar@azentio.com","azentio"],["pat@azentio.com","azentio"],["ada@azentio.com","azentio"],["sam@meridian.example","meridian"],["alex@meridian.example","meridian"],["noor@northwind.example","northwind"],["li@lotus.example","lotus"],[null,null]];
const sub = (await db.query("select id from contributions where state='submitted' limit 1")).rows[0].id;
pages.push(`/portal/moderation/${sub}`, `/portal/contributions/${sub}`);
let bad = 0;
for (const [email, org] of people) {
  let cookie = "";
  if (email) {
    const raw = randomBytes(24).toString("base64url");
    const u = (await db.query("select id from users where email=$1",[email])).rows[0].id;
    const o = (await db.query("select id from organisations where slug=$1",[org])).rows[0].id;
    await db.query("insert into sessions values ($1,$2,$3, now()+interval '1 hour')",[createHash("sha256").update(raw).digest("hex"),u,o]);
    cookie = `azp_session=${raw}`;
  }
  const res = [];
  for (const p of pages) {
    const r = await fetch((process.env.BASE_URL || "http://localhost:3100")+p,{headers:{cookie},redirect:"manual"});
    const t = await r.text();
    const err = r.status >= 500 || /Application error|Unhandled Runtime Error/.test(t);
    if (err) { bad++; res.push(`${p}=${r.status}!!`); }
  }
  console.log((email ?? "anonymous").padEnd(26), res.length ? res.join(" ") : "all ok");
}
console.log("errors:", bad); await db.end();
