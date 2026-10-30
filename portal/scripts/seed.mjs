// Seeds synthetic data only: fictional organisations, personas and observations.
// Usage: node scripts/seed.mjs   (applies db/schema.sql first, which resets the schema)
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
for (const f of [".env.local", ".env"]) {
  const p = path.join(root, f);
  if (fs.existsSync(p)) for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const q = async (sql, p = []) => (await c.query(sql, p)).rows;
const one = async (sql, p = []) => (await q(sql, p))[0];

await c.query(fs.readFileSync(path.join(root, "db/schema.sql"), "utf8"));

// ---------------------------------------------------------------- organisations
const org = {};
for (const [slug, name, kind, industry, region] of [
  ["azentio", "Azentio", "azentio", "Software", "Global"],
  ["meridian", "Meridian Bank (fictional)", "client", "Banking", "India"],
  ["northwind", "Northwind Finance (fictional)", "client", "Banking", "GCC"],
  ["lotus", "Lotus Microfinance (fictional)", "client", "Microfinance", "Southeast Asia"],
]) org[slug] = (await one("insert into organisations(slug,name,kind,industry,region) values ($1,$2,$3,$4,$5) returning id", [slug, name, kind, industry, region])).id;

// ---------------------------------------------------------------- personas
const user = {};
const personas = [
  ["priya@azentio.com", "Priya (Employee)", [["azentio", "employee"]], []],
  ["maya@azentio.com", "Maya (Learning moderator)", [["azentio", "employee"]], ["moderator"]],
  ["pat@azentio.com", "Pat (Content publisher)", [["azentio", "employee"]], ["publisher"]],
  ["omar@azentio.com", "Omar (Product owner)", [["azentio", "employee"]], ["product_owner"]],
  ["ada@azentio.com", "Ada (Portal administrator)", [["azentio", "employee"]], ["portal_admin"]],
  ["alex@meridian.example", "Alex (Meridian client admin)", [["meridian", "client_admin"]], []],
  ["sam@meridian.example", "Sam (Meridian analyst)", [["meridian", "client_member"]], []],
  ["noor@northwind.example", "Noor (Northwind admin, Lotus advisor)", [["northwind", "client_admin"], ["lotus", "client_member"]], []],
  ["li@lotus.example", "Li (Lotus credit lead)", [["lotus", "client_member"]], []],
];
for (const [email, name, ms, gs] of personas) {
  const id = (await one("insert into users(email, display_name) values ($1,$2) returning id", [email, name])).id;
  user[email.split("@")[0]] = id;
  for (const [o, role] of ms) await q("insert into memberships(user_id, org_id, role) values ($1,$2,$3)", [id, org[o], role]);
  for (const g of gs) await q("insert into grants(user_id, grant_name) values ($1,$2)", [id, g]);
}

// ---------------------------------------------------------------- catalogue (from the reference prototype)
const offerings = [
  ["credit-strategy-simulator", "Credit Strategy Simulator", "Credit Intelligence", "Credit policy intelligence",
    "Simulate credit policy changes before deployment. Explore potential effects on approvals, risk exposure, and portfolio outcomes.",
    ["Policy scenario configuration", "Approval and risk impact comparison", "Evidence-led simulation"], ["Select a portfolio", "Define a strategy", "Run scenarios", "Review impact", "Refine and approve"]],
  ["sme-credit-decisioning", "SME Credit Decisioning Workbench", "Credit Intelligence", "Explainable credit intelligence",
    "Bring financial analysis, policy evaluation, risk review, and credit recommendations into one workbench with evidence and human oversight.",
    ["Policy and exception evaluation", "Explainable recommendations", "Human decision controls"], ["Capture application", "Collect evidence", "Evaluate policies", "Review recommendation", "Approve or refer"]],
  ["similar-portfolio-intelligence", "Similar Portfolio Intelligence", "Credit Intelligence", "Contextual portfolio insights",
    "Compare financing applications with relevant historical portfolio segments to understand patterns, risk indicators, and comparable outcomes.",
    ["Peer cohort discovery", "Portfolio comparisons", "Historical outcome context"], ["Select application", "Identify comparable cohort", "Compare indicators", "Review insights"]],
  ["rejection-intelligence", "Rejection Intelligence", "Credit Intelligence", "Rejection analysis and simulation",
    "Analyse declined applications, uncover rejection patterns, and simulate changes that could increase eligible approvals.",
    ["Rejection pattern analysis", "What-if eligibility simulation", "Reason-code transparency"], ["Load declined applications", "Cluster reasons", "Simulate changes", "Review impact"]],
  ["riva", "RIVA", "Reporting & Analytics", "Reporting intelligence, validation and analytics",
    "A configurable reporting environment connecting data sources, mapping report fields, supporting validation, and simplifying reporting workflows.",
    ["Multi-source data mapping", "Configurable report templates", "Validation and audit history"], ["Connect sources", "Configure template", "Map fields", "Validate", "Generate report"]],
  ["financial-analysis", "Financial Analysis Intelligence", "Reporting & Analytics", "Financial assessment",
    "Turn financial statements into structured analysis, ratios, trends, and decision-ready credit insights.",
    ["Statement spreading", "Ratio and trend analysis", "Decision-ready summaries"], ["Upload statements", "Extract and spread", "Analyse ratios", "Review insights"]],
  ["document-intelligence", "Document Intelligence", "AI Applications", "Intelligent extraction and verification",
    "Extract, classify, structure, and validate information from financial documents, identity records, and complex inputs.",
    ["Classification", "Field extraction", "Validation rules"], ["Ingest documents", "Classify", "Extract", "Validate", "Hand off"]],
  ["persona-newsroom", "Persona Newsroom", "AI Applications", "Executive content intelligence",
    "Discover relevant market news, match stories to executive personas, and generate editable thought-leadership drafts.",
    ["News discovery", "Persona matching", "Editable drafts"], ["Discover", "Match", "Draft", "Edit", "Publish"]],
];
for (const [id, name, cat, eyebrow, summary, caps, steps] of offerings)
  await q("insert into offerings values ($1,$2,$3,$4,$5,$6,$7,'public')", [id, name, cat, eyebrow, summary, caps, steps]);
await q(`insert into offerings values ('seasonality-lab','Seasonality-aware Comparison (experiment)','AI Lab','Internal experiment',
  'Employee-only prototype that explains SME cash-flow seasonality when comparing an applicant with peers. Not a product, not client-visible.',
  '{"Seasonal decomposition of monthly cash flow","Peer comparison by season","Plain-language explanation"}','{"Load sample","Decompose","Compare","Explain"}','employee')`);

for (const [o, offs] of [["meridian", ["sme-credit-decisioning", "financial-analysis"]], ["northwind", ["riva", "financial-analysis"]], ["lotus", ["sme-credit-decisioning"]]])
  for (const off of offs) await q("insert into entitlements values ($1,$2)", [org[o], off]);

// ---------------------------------------------------------------- media (private storage, served only after an access check)
const storage = path.join(root, "storage");
fs.mkdirSync(storage, { recursive: true });
const svg = (title, sub, color) => `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1b3f"/><stop offset="1" stop-color="${color}"/></linearGradient></defs>
<rect width="960" height="540" fill="url(#g)"/><circle cx="820" cy="120" r="180" fill="#ffffff10"/><circle cx="120" cy="460" r="140" fill="#ffffff08"/>
<text x="60" y="250" fill="#fff" font-family="Arial" font-size="44" font-weight="700">${title}</text>
<text x="60" y="305" fill="#c7d2fe" font-family="Arial" font-size="24">${sub}</text>
<text x="60" y="490" fill="#94a3b8" font-family="Arial" font-size="18">azentio.ai · synthetic demonstration media</text></svg>`;
const media = {};
for (const [key, title, file, audience, o, off, sub, color] of [
  ["public", "azentio.ai product tour", "public-tour.svg", "public", null, null, "Public product overview", "#2563eb"],
  ["townhall", "AI Lab town hall recording (internal)", "employee-townhall.svg", "employee", null, null, "Employees only: Q4 AI Lab town hall", "#7c3aed"],
  ["riva", "RIVA walkthrough for entitled clients", "riva-walkthrough.svg", "entitled", null, "riva", "Entitled clients: RIVA validation walkthrough", "#0891b2"],
  ["meridian", "Meridian onboarding briefing", "meridian-briefing.svg", "org", "meridian", null, "Meridian Bank workspace only", "#059669"],
]) {
  fs.writeFileSync(path.join(storage, file), svg(title, sub, color));
  media[key] = (await one("insert into media(title, filename, mime, audience, org_id, offering_id) values ($1,$2,'image/svg+xml',$3,$4,$5) returning id",
    [title, file, audience, o ? org[o] : null, off])).id;
}

// ---------------------------------------------------------------- content with explicit audiences
const content = [
  ["banner", "Build intelligence. Create shared value.", "Explore applied AI for credit, reporting and documents, and join the azentio.ai Build Labs hackathon.", "public"],
  ["insight", "Why explainability matters in SME credit", "Credit teams adopt AI faster when every recommendation shows its evidence, its policy checks and a clear human decision point. This note outlines patterns we use across our credit prototypes.", "public", { media: "public" }],
  ["insight", "From reporting templates to validated submissions", "Regulatory reporting changes arrive late and often. Configurable templates with validation history reduce manual mapping and improve traceability.", "public"],
  ["insight", "Document intelligence beyond OCR", "Extraction is only the first step. Classification, validation rules and confident hand-off decide whether automation reduces work.", "public"],
  ["broadcast", "Live: AI Lab town hall (employees only)", "Quarterly AI Lab town hall with the experiment roadmap, Build Labs results and release readiness reviews. Internal session, recording below.", "employee", { media: "townhall", starts: "2026-11-05T10:30:00+05:30" }],
  ["experiment", "Experiment notes: seasonality-aware comparison", "Internal prototype notes. Seasonal decomposition of 24 months of synthetic SME cash flow, compared with peers in the same season. Open question: how to explain seasonality to credit officers without implying a credit decision.", "employee", { owner: "AI Lab", review: "2026-12-15" }],
  ["knowledge", "Internal library: sandbox data policy", "All sandboxes use synthetic data unless a client has explicitly approved specific data for a specific demonstration. Owner reviews this policy quarterly.", "employee", { owner: "Platform team", review: "2026-12-01" }],
  ["release_note", "Internal release note: Playground 0.4", "Adds structured feedback (useful / needs evidence / wrong) to every sandbox run.", "employee", { owner: "Platform team", review: "2027-01-15" }],
  ["briefing", "Client briefing: what we heard this quarter", "A summary of approved shared themes and the status of related improvement ideas. Private client material is never included.", "clients"],
  ["briefing", "Invitation-only webinar: RIVA validation rules", "For entitled RIVA clients: designing validation rules that survive late template changes.", "entitled", { offering: "riva", media: "riva", starts: "2026-11-12T15:00:00+05:30" }],
  ["release_note", "Financial Analysis Intelligence: release notes 2.3", "Ratio explanations now cite the statement lines they are computed from.", "entitled", { offering: "financial-analysis" }],
  ["briefing", "Meridian workspace: onboarding pack", "Resources prepared for Meridian Bank's sandbox programme, including the approved synthetic data sets.", "org", { org: "meridian", media: "meridian" }],
];
for (const [kind, title, body, audience, x = {}] of content)
  await q(`insert into content_items(kind,title,body,audience,org_id,offering_id,media_id,owner_name,review_date,starts_at,created_by)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [kind, title, body, audience, x.org ? org[x.org] : null, x.offering ?? null, x.media ? media[x.media] : null, x.owner ?? null, x.review ?? null, x.starts ?? null, user.pat]);

// ---------------------------------------------------------------- collective learning
async function contribution(o, author, f, consents = { store: true, publish: true, attribution: false, training: false }) {
  const r = await one(`insert into contributions(org_id, author_id, visibility, state, type, title, body, offering_id, industry, region, period_start, period_end, evidence_type, confidence, created_at, updated_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now() - make_interval(days => $15), now() - make_interval(days => $15)) returning id`,
    [org[o], user[author], f.visibility ?? "proposed_shared", f.state ?? "submitted", f.type ?? "market_observation", f.title, f.body, f.offering ?? null,
     f.industry, f.region, f.start, f.end, f.evidence ?? "internal_data", f.confidence ?? "medium", f.daysAgo ?? 2]);
  for (const [k, v] of Object.entries(consents)) await q("insert into consents(contribution_id, kind, granted, user_id) values ($1,$2,$3,$4)", [r.id, k, v, user[author]]);
  await q("insert into audit_events(actor_id, action, entity, entity_id, detail) values ($1,'contribution.created','contribution',$2,'{\"seed\":true}')", [user[author], r.id]);
  return r.id;
}
async function publish(cid, theme, shared) {
  const src = await one("select * from contributions where id = $1", [cid]);
  const s = await one(`insert into shared_items(contribution_id, title, body, type, offering_id, industry, region_band, period_label, evidence_type, confidence, theme_id, published_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now() - interval '20 days') returning id`,
    [cid, shared.title, shared.body, src.type, src.offering_id, src.industry, shared.region, shared.period, src.evidence_type, src.confidence, theme]);
  await q("update contributions set state = 'published' where id = $1", [cid]);
  await q("insert into reviews(contribution_id, reviewer_id, decision, reason) values ($1,$2,'published','Published after review and de-identification')", [cid, user.maya]);
  await q("insert into audit_events(actor_id, action, entity, entity_id, detail) values ($1,'contribution.published','contribution',$2,$3)", [user.maya, cid, { shared_item: s.id, seed: true }]);
  return s.id;
}

const theme = {};
theme.reg = (await one(`insert into themes(title, summary, limitations, created_by) values ('Late regulatory template changes',
  'Several institutions report that regulators change reporting templates close to submission deadlines, forcing manual re-mapping.',
  'Self-reported by participating institutions. Not a measure of market prevalence.', $1) returning id`, [user.omar])).id;
theme.doc = (await one(`insert into themes(title, summary, limitations, created_by) values ('Document intake exceptions',
  'Exceptions in document intake (unreadable scans, missing pages) slow onboarding.',
  'Very small sample. Counts are withheld until enough distinct institutions contribute.', $1) returning id`, [user.maya])).id;

const regItems = [];
regItems.push(await publish(await contribution("meridian", "sam", { title: "Template change two weeks before quarterly filing", body: "Our regulatory reporting team had to re-map 40 fields after the central bank revised the liquidity return template in Mumbai circular dated 3 March 2026.", offering: "riva", industry: "Banking", region: "Mumbai, India", start: "2026-01-01", end: "2026-03-31", daysAgo: 30 }), theme.reg,
  { title: "Template change shortly before a quarterly filing", body: "A reporting team had to re-map a large number of fields after a regulator revised a liquidity return template close to the filing deadline.", region: "India", period: "Q1 2026" }));
regItems.push(await publish(await contribution("northwind", "noor", { title: "Validation rules break on revised returns", body: "Validation rules written for the previous template version failed silently after a mid-quarter revision.", offering: "riva", industry: "Banking", region: "UAE", start: "2026-01-01", end: "2026-06-30", daysAgo: 28 }), theme.reg,
  { title: "Validation rules break on revised returns", body: "Validation rules written for a previous template version failed silently after a mid-quarter revision.", region: "GCC", period: "H1 2026" }));
regItems.push(await publish(await contribution("lotus", "li", { title: "Manual re-mapping for revised microfinance returns", body: "Revised portfolio-at-risk return required manual re-mapping across three source systems.", offering: "riva", industry: "Microfinance", region: "Malaysia", start: "2026-04-01", end: "2026-06-30", daysAgo: 25 }), theme.reg,
  { title: "Manual re-mapping for revised returns", body: "A revised portfolio-quality return required manual re-mapping across several source systems.", region: "Southeast Asia", period: "Q2 2026" }));
// Two orgs, three posts: the dashboard must count two organisations and withhold the count.
for (const [o, a, t] of [["meridian", "sam", "Unreadable scans stall SME onboarding"], ["meridian", "alex", "Missing statement pages delay credit review"], ["northwind", "noor", "Scanned trade licences fail extraction"]])
  await publish(await contribution(o, a, { title: t, body: `${t}. Exceptions are handled by email and spreadsheets, which adds days to onboarding.`, offering: "document-intelligence", industry: "Banking", region: o === "meridian" ? "India" : "UAE", start: "2026-04-01", end: "2026-06-30", type: "operational_challenge", daysAgo: 22 }), theme.doc,
    { title: t, body: `${t}. Exceptions are handled manually, which adds days to onboarding.`, region: o === "meridian" ? "India" : "GCC", period: "Q2 2026" });

// An improvement idea already in flight, linked to permitted evidence.
const idea = (await one(`insert into ideas(title, problem, offering_id, proposed_outcome, owner_team, priority, status, public_note, theme_id, created_by)
  values ('Template version diff and re-mapping assistant for RIVA', 'Late template revisions force manual re-mapping and silently break validation rules.', 'riva',
  'Detect template version changes, show a field-level diff and propose re-mappings for human approval.', 'RIVA product team', 'high', 'Planned',
  'Planned for a future release. Scope and timing are not yet committed.', $1, $2) returning id`, [theme.reg, user.omar])).id;
for (const s of regItems) await q("insert into idea_evidence values ($1,$2)", [idea, s]);
await q("insert into idea_status_history(idea_id, from_status, to_status, note, actor_id) values ($1,null,'Proposed','Created',$2),($1,'Proposed','Under review','Linked to 3 approved observations',$2),($1,'Under review','Planned','Approved for planning',$2)", [idea, user.omar]);

// The judging scenario: seasonal SME cash flow, three institutions, waiting for moderation.
await contribution("meridian", "sam", {
  title: "Seasonal SME cash flow read as volatility",
  body: "Our client Kesar Agro Foods Pvt Ltd in Nashik (account 004512339871) earns most of its revenue between October and January. On 14 March 2026 our scorecard flagged it as high volatility and the limit was cut by ₹3.2 crore, although the business has repaid on time for six years. Credit officers have no way to compare it with seasonal peers.",
  offering: "financial-analysis", industry: "Banking", region: "Nashik, Maharashtra, India", start: "2026-01-01", end: "2026-03-31", confidence: "high", daysAgo: 1 });
await contribution("northwind", "noor", {
  title: "Festive-season traders penalised by monthly averages",
  body: "SME retailers in Dubai who earn heavily around Ramadan and Eid show large swings in monthly inflows. Our averaging-based analysis treats the off-season months as stress, which leads to conservative limits for otherwise healthy traders. Contact our team at credit.ops@northwind.example for details.",
  offering: "financial-analysis", industry: "Banking", region: "Dubai, UAE", start: "2026-02-01", end: "2026-05-31", confidence: "medium", daysAgo: 1 });
await contribution("lotus", "li", {
  title: "Harvest-cycle repayments look like arrears",
  body: "Microfinance borrowers who are smallholder farmers repay in lumps after harvest. Standard monthly arrears logic marks them as delinquent between harvests, although their annual repayment is complete. A seasonal comparison would explain this to credit officers.",
  offering: "sme-credit-decisioning", industry: "Microfinance", region: "Penang, Malaysia", start: "2026-01-01", end: "2026-06-30", confidence: "medium", evidence: "customer_feedback", daysAgo: 1 });

// Private and organisation-only material that must never leave its boundary.
await contribution("meridian", "sam", { visibility: "private", state: "draft", title: "Draft: collateral haircut thoughts", body: "Unfinished private note about collateral haircuts for working-capital lines. Not ready to share with anyone.", industry: "Banking", region: "India", start: "2026-07-01", end: "2026-09-30", confidence: "low", evidence: "anecdotal" },
  { store: true, publish: false, attribution: false, training: false });
await contribution("meridian", "alex", { visibility: "org", state: "draft", type: "operational_challenge", title: "Branch teams keep a shadow spreadsheet for exceptions", body: "Meridian internal: branch credit teams track onboarding exceptions in a shared spreadsheet because the workflow tool lacks an exception queue.", industry: "Banking", region: "India", start: "2026-04-01", end: "2026-06-30", evidence: "internal_data" },
  { store: true, publish: false, attribution: false, training: false });
await contribution("northwind", "noor", { visibility: "private", state: "draft", title: "Draft: pricing pressure on trade finance", body: "Private draft with confidential pricing notes for trade finance renewals. Must never be shared.", industry: "Banking", region: "UAE", start: "2026-07-01", end: "2026-09-30", confidence: "low", evidence: "anecdotal" },
  { store: true, publish: false, attribution: false, training: false });

await q("insert into notifications(user_id, message, link) select user_id, 'Three new contributions are waiting for review.', '/portal/moderation' from grants where grant_name = 'moderator'");
console.log("seeded:", Object.keys(org).length, "orgs,", personas.length, "personas");
await c.end();
