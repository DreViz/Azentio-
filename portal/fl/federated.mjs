// Federated learning programme, simulated on one machine with synthetic data.
//
// Task: predict 90-day repayment stress for SME loans from cash-flow features.
// Each client keeps its records in its own directory (fl/clients/<name>/data.json) and trains locally.
// The coordinator only ever receives clipped weight deltas plus a sample count. It never reads client files.
//
// Honest labels: plain sample-weighted FedAvg. No secure aggregation, no differential privacy accounting.
// Usage: node fl/federated.mjs   (writes fl/output/latest.json and a candidate row in fl_runs)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);

// ---------------------------------------------------------------- shared, published feature schema
// Standardisation constants are part of the programme's schema (agreed up front), not learned from any
// client's data, so every participant computes identical features. Compatibility assumption: same version.
const SCHEMA = {
  version: "sme-stress-v1",
  features: [
    ["raw_cv", 0.35, 0.25],            // month-to-month coefficient of variation
    ["deseasonal_cv", 0.18, 0.1],      // volatility after removing the annual pattern
    ["seasonal_share", 0.35, 0.3],     // share of volatility explained by season
    ["yoy_growth", 0.02, 0.12],        // year-on-year inflow change
    ["dscr", 1.6, 0.5],                // debt-service cover
    ["bureau_delinquency", 0.12, 0.32],// any 30+ days past due in 12 months (0/1)
  ],
};
const D = SCHEMA.features.length + 1; // + bias

// ---------------------------------------------------------------- deterministic synthetic data
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
const sigmoid = (z) => 1 / (1 + Math.exp(-z));

function makeBorrowers(n, seasonalShare, seed) {
  const r = rng(seed);
  return Array.from({ length: n }, () => {
    const seasonal = r() < seasonalShare;
    const de = Math.max(0.03, 0.16 + 0.09 * gauss(r));
    const raw = de + (seasonal ? 0.45 + 0.25 * r() : 0.05 * r());
    const share = seasonal ? 0.6 + 0.3 * r() : 0.1 * r();
    const yoy = 0.03 + 0.12 * gauss(r);
    const dscr = Math.max(0.6, 1.6 + 0.45 * gauss(r));
    const delinq = r() < 0.12 ? 1 : 0;
    // Ground truth: stress follows underlying volatility, decline, weak cover and delinquency. Seasonality itself is not risk.
    const p = sigmoid(-2.2 + 7 * (de - 0.16) - 5 * yoy - 1.6 * (dscr - 1.6) + 1.8 * delinq);
    return { x: [raw, de, share, yoy, dscr, delinq], y: r() < p ? 1 : 0 };
  });
}
const standardise = (x) => [...x.map((v, i) => (v - SCHEMA.features[i][1]) / SCHEMA.features[i][2]), 1];

// ---------------------------------------------------------------- client side (runs "inside" each client)
const CLIENTS = [
  { name: "Meridian Bank", n: 900, seasonalShare: 0.12, seed: 11, consent: true },
  { name: "Northwind Finance", n: 700, seasonalShare: 0.3, seed: 22, consent: true },
  { name: "Lotus Microfinance", n: 500, seasonalShare: 0.72, seed: 33, consent: true },
  { name: "Harbor Credit", n: 400, seasonalShare: 0.25, seed: 44, consent: true },
  { name: "Coral Bank", n: 600, seasonalShare: 0.2, seed: 55, consent: false }, // never opted in: excluded before training
];
const clientDir = (c) => path.join(here, "clients", c.name.toLowerCase().replace(/\s+/g, "-"));
for (const c of CLIENTS) {
  fs.mkdirSync(clientDir(c), { recursive: true });
  fs.writeFileSync(path.join(clientDir(c), "data.json"), JSON.stringify(makeBorrowers(c.n, c.seasonalShare, c.seed)));
}

/** Local training job. Reads only its own directory and returns a delta, never rows. */
function localTrain(c, globalW, epochs = 30, lr = 0.1) {
  const data = JSON.parse(fs.readFileSync(path.join(clientDir(c), "data.json"), "utf8"));
  const w = [...globalW];
  for (let e = 0; e < epochs; e++) {
    const g = new Array(D).fill(0);
    for (const { x, y } of data) { const s = standardise(x); const err = sigmoid(dot(w, s)) - y; for (let i = 0; i < D; i++) g[i] += err * s[i]; }
    for (let i = 0; i < D; i++) w[i] -= (lr * g[i]) / data.length + lr * 1e-3 * w[i];
  }
  return { client: c.name, schema: SCHEMA.version, n: data.length, delta: w.map((v, i) => v - globalW[i]) };
}

// ---------------------------------------------------------------- coordinator
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const norm = (a) => Math.sqrt(dot(a, a));
const CLIP = 1.5, MIN_COHORT = 3, OUTLIER_FACTOR = 4;

function validate(u, median) {
  if (u.schema !== SCHEMA.version) return "schema version mismatch";
  if (!Array.isArray(u.delta) || u.delta.length !== D || !u.delta.every(Number.isFinite)) return "malformed update";
  if (median > 0 && norm(u.delta) > OUTLIER_FACTOR * median) return `update norm ${norm(u.delta).toFixed(2)} is over ${OUTLIER_FACTOR}x the cohort median (possible poisoning)`;
  return null;
}
const clip = (d) => { const n = norm(d); return n > CLIP ? d.map((v) => (v * CLIP) / n) : d; };

function auc(w, data) {
  const s = data.map(({ x, y }) => ({ p: dot(w, standardise(x)), y })).sort((a, b) => a.p - b.p);
  let rank = 0, pos = 0, sumPos = 0;
  for (const it of s) { rank++; if (it.y) { pos++; sumPos += rank; } }
  const neg = s.length - pos;
  return (sumPos - (pos * (pos + 1)) / 2) / (pos * neg);
}

const holdout = makeBorrowers(3000, 0.4, 999); // separate synthetic holdout, mixed seasonality
const participants = CLIENTS.filter((c) => c.consent);
let w = new Array(D).fill(0);
const log = [];
const ROUNDS = 5;
for (let round = 1; round <= ROUNDS; round++) {
  const dropped = round === 2 || round === 3 ? ["Harbor Credit"] : []; // simulated connectivity loss
  const active = participants.filter((c) => !dropped.includes(c.name));
  const updates = active.map((c) => localTrain(c, w));
  if (round === 3) { // simulated compromised participant sends a scaled, sign-flipped update
    const u = updates.find((x) => x.client === "Northwind Finance");
    u.delta = u.delta.map((v) => -25 * v - 0.5);
  }
  const norms = updates.map((u) => norm(u.delta)).sort((a, b) => a - b);
  const median = norms[Math.floor(norms.length / 2)];
  const rejected = [], accepted = [];
  for (const u of updates) { const why = validate(u, median); if (why) rejected.push({ client: u.client, reason: why }); else accepted.push(u); }
  if (accepted.length < MIN_COHORT) {
    log.push({ round, participants: accepted.map((u) => u.client), rejected, dropped, skipped: true, globalAuc: auc(w, holdout) });
    continue; // below minimum cohort: no aggregation this round
  }
  const total = accepted.reduce((s, u) => s + u.n, 0);
  const agg = new Array(D).fill(0);
  for (const u of accepted) { const d = clip(u.delta); for (let i = 0; i < D; i++) agg[i] += (d[i] * u.n) / total; }
  w = w.map((v, i) => v + agg[i]);
  // Coordinator log: who, how many, norms and metrics. Never training rows.
  log.push({ round, participants: accepted.map((u) => u.client), rejected, dropped, norms: Object.fromEntries(updates.map((u) => [u.client, +norm(u.delta).toFixed(3)])), globalAuc: auc(w, holdout) });
}

// Baselines: a raw-volatility rule and each client's local-only model, all on the same holdout.
const ruleAuc = auc([10, 0, 0, 0, 0, 0, 0], holdout);
const perClient = participants.map((c) => {
  let lw = new Array(D).fill(0);
  for (let k = 0; k < ROUNDS; k++) lw = lw.map((v, i) => v + localTrain(c, lw).delta[i]);
  return { client: c.name, n: c.n, seasonalShare: c.seasonalShare, localOnlyAuc: auc(lw, holdout), globalAuc: auc(w, holdout) };
});

const summary = {
  task: "Predict 90-day repayment stress for SME loans from 24 months of synthetic cash-flow features (schema " + SCHEMA.version + ")",
  model: "Logistic regression, 6 features + bias",
  features: SCHEMA.features.map((f) => f[0]),
  weighting: "Sample-size weighted FedAvg over clipped deltas",
  clipNorm: CLIP,
  rounds: log.map((l) => ({ round: l.round, participants: l.participants, rejected: l.rejected, dropped: l.dropped, skipped: !!l.skipped, globalAuc: l.globalAuc })),
  baseline: [{ name: "Raw volatility rule (higher month-to-month CV = riskier)", auc: ruleAuc }, ...perClient.map((p) => ({ name: `Local-only model: ${p.client}`, auc: p.localOnlyAuc }))],
  final: { auc: auc(w, holdout), perClient },
  controls: [
    { name: "Programme consent gate (Coral Bank excluded, never opted in)", status: "implemented" },
    { name: "Schema/version and shape validation of every update", status: "implemented" },
    { name: `Outlier rejection (norm > ${OUTLIER_FACTOR}x cohort median)`, status: "implemented" },
    { name: `Update clipping (L2 <= ${CLIP})`, status: "implemented" },
    { name: `Minimum cohort of ${MIN_COHORT} accepted updates per round`, status: "implemented" },
    { name: "Training rows never leave client directories or appear in coordinator logs", status: "implemented (simulated isolation)" },
    { name: "Authenticated participants (mTLS / signed updates)", status: "designed, not implemented" },
    { name: "Secure aggregation", status: "designed, not implemented" },
    { name: "Differential privacy with privacy accounting", status: "designed, not implemented" },
  ],
  consent: CLIENTS.map((c) => ({ client: c.name, programmeConsent: c.consent })),
  notes: [
    "Lotus Microfinance holds most seasonal borrowers. Clients with few seasonal borrowers cannot learn alone that seasonality is not risk; the shared model can.",
    "Skewed client distributions pull the global model toward the largest clients; sample weighting makes this explicit and per-client metrics expose it.",
    "Model updates can leak information about training data, and malicious clients can poison training. Norm checks and clipping reduce but do not remove these risks.",
    "Withdrawal stops a client's future participation. It does not remove its past contribution from models already aggregated; that requires retraining from a lineage point by explicit policy.",
    "The aggregate is registered as a candidate. A portal administrator must approve deployment; the previous version stays available for rollback.",
  ],
};
fs.mkdirSync(path.join(here, "output"), { recursive: true });
fs.writeFileSync(path.join(here, "output", "latest.json"), JSON.stringify({ summary, coordinatorLog: log }, null, 2));
console.log(`global AUC ${summary.final.auc.toFixed(3)} vs raw rule ${ruleAuc.toFixed(3)}`);
for (const l of log) console.log(`round ${l.round}: ${l.participants.length} accepted, rejected ${l.rejected.map((r) => r.client).join(",") || "none"}, dropped ${l.dropped.join(",") || "none"}, AUC ${l.globalAuc.toFixed(3)}`);
for (const p of perClient) console.log(`${p.client}: local-only ${p.localOnlyAuc.toFixed(3)} global ${p.globalAuc.toFixed(3)}`);

// Self-checks: the poisoned update must be rejected and the non-consenting client must never participate.
console.assert(log[2].rejected.some((r) => r.client === "Northwind Finance"), "poisoned update was not rejected");
console.assert(!log.some((l) => l.participants.includes("Coral Bank")), "non-consenting client participated");

for (const f of [".env.local", ".env"]) {
  const p = path.join(root, f);
  if (fs.existsSync(p)) for (const line of fs.readFileSync(p, "utf8").split("\n")) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
}
if (process.env.DATABASE_URL) {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query("insert into fl_runs(summary) values ($1)", [summary]);
  await c.query("insert into audit_events(action, entity, detail) values ('fl.candidate_registered', 'fl_run', $1)", [{ auc: summary.final.auc }]);
  await c.end();
  console.log("candidate registered in fl_runs");
}
