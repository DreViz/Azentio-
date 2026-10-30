import { claude, parseJson } from "./ai";

export type Flag = { kind: string; match: string; replacement: string };
export type Proposal = {
  title: string; body: string; industry: string; region_band: string; period_label: string;
  flags: Flag[]; risk: "low" | "medium" | "high"; reasons: string[]; engine: "claude" | "rules";
};
type Source = { title: string; body: string; industry: string; region: string; period_start: string; period_end: string };

const CITY_BANDS: Record<string, string> = {
  mumbai: "Western India", pune: "Western India", nashik: "Western India", nagpur: "Western India", ahmedabad: "Western India", surat: "Western India",
  delhi: "Northern India", jaipur: "Northern India", lucknow: "Northern India", ludhiana: "Northern India",
  chennai: "Southern India", bengaluru: "Southern India", bangalore: "Southern India", hyderabad: "Southern India", kochi: "Southern India", coimbatore: "Southern India",
  kolkata: "Eastern India", dubai: "GCC", "abu dhabi": "GCC", sharjah: "GCC", riyadh: "GCC", jeddah: "GCC", doha: "GCC", muscat: "GCC",
  "kuala lumpur": "Southeast Asia", jakarta: "Southeast Asia", manila: "Southeast Asia", bangkok: "Southeast Asia", "ho chi minh": "Southeast Asia",
  penang: "Southeast Asia", cebu: "Southeast Asia", lagos: "Africa", nairobi: "Africa",
};
const MONTHS = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

// Ordered: more specific patterns first so that, for example, an account number is not read as a phone.
const RULES: { kind: string; re: RegExp; to: (m: string) => string }[] = [
  { kind: "email", re: /[\w.+-]+@[\w-]+\.[\w.]+/g, to: () => "[email removed]" },
  { kind: "account_number", re: /\b(?:a\/c|acct|account)?\s*(?:no\.?|number)?\s*#?\d{9,18}\b/gi, to: () => "[account number removed]" },
  { kind: "phone", re: /\+\d{1,3}(?:[\s-]?\d{1,6}){2,4}\b/g, to: () => "[phone removed]" },
  { kind: "amount", re: /(?:₹|us\$|\$)\s?\d[\d,.]*(?:\s?(?:crore|cr|lakh|million|mn|bn|billion|k)\b)?|\b(?:inr|rs\.?|usd|aed|sar|myr|php)\s?\d[\d,.]*(?:\s?(?:crore|cr|lakh|million|mn|bn|billion|k)\b)?|\b\d[\d,.]*\s?(?:crore|lakh)\b/gi, to: () => "[amount generalised]" },
  { kind: "exact_date", re: new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS})\\b(?:,?\\s+\\d{4})?|\\b(?:${MONTHS})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?\\b|\\b\\d{4}-\\d{2}-\\d{2}\\b`, "gi"), to: () => "[date generalised to the observation period]" },
  { kind: "named_business", re: /\b(?:[A-Z][a-zA-Z&]+\s){1,3}(?:Foods|Agro|Traders|Industries|Exports|Textiles|Enterprises|Trading|Pvt\.?\s?Ltd\.?|Ltd\.?|LLC|Sdn\s?Bhd|Co\.)\b/g, to: () => "[a customer business]" },
  { kind: "person", re: /\b(?:Mr|Mrs|Ms|Dr)\.?\s+[A-Z][a-z]+(?:\s[A-Z][a-z]+)?/g, to: () => "[a person]" },
];

function applyRules(text: string, orgNames: string[], flags: Flag[]): string {
  let out = text;
  for (const name of orgNames) {
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    out = out.replace(re, (m) => { flags.push({ kind: "organisation_name", match: m, replacement: "[a participating institution]" }); return "[a participating institution]"; });
  }
  for (const r of RULES) out = out.replace(r.re, (m) => { flags.push({ kind: r.kind, match: m.trim(), replacement: r.to(m) }); return r.to(m); });
  for (const [city, band] of Object.entries(CITY_BANDS)) {
    out = out.replace(new RegExp(`\\b${city}\\b`, "gi"), (m) => { flags.push({ kind: "precise_location", match: m, replacement: band }); return band; });
  }
  return out;
}

export function regionBand(region: string): string {
  const r = region.toLowerCase();
  for (const [city, band] of Object.entries(CITY_BANDS)) if (r.includes(city)) return band;
  if (/india|maharashtra|karnataka|tamil|gujarat/.test(r)) return "India";
  if (/uae|saudi|qatar|oman|kuwait|bahrain|gcc|middle east/.test(r)) return "GCC";
  if (/malaysia|indonesia|philippines|thailand|vietnam|asia/.test(r)) return "Southeast Asia";
  if (/africa|nigeria|kenya/.test(r)) return "Africa";
  return "Multi-region";
}

/** Coarsens an observation period to a quarter, half-year or year label. */
export function periodLabel(start: string, end: string): string {
  const s = new Date(start), e = new Date(end);
  const q = (d: Date) => Math.floor(d.getUTCMonth() / 3) + 1;
  if (s.getUTCFullYear() !== e.getUTCFullYear()) return `${s.getUTCFullYear()} to ${e.getUTCFullYear()}`;
  if (q(s) === q(e)) return `Q${q(s)} ${s.getUTCFullYear()}`;
  if (q(e) <= 2) return `H1 ${s.getUTCFullYear()}`;
  if (q(s) >= 3) return `H2 ${s.getUTCFullYear()}`;
  return String(s.getUTCFullYear());
}

function risk(flags: Flag[]): { risk: Proposal["risk"]; reasons: string[] } {
  const kinds = new Set(flags.map((f) => f.kind));
  const reasons: string[] = [];
  if (kinds.has("account_number") || kinds.has("email") || kinds.has("phone")) reasons.push("Direct identifiers were present (account, email or phone).");
  if (kinds.has("named_business") || kinds.has("organisation_name") || kinds.has("person")) reasons.push("Named customers, people or institutions were present.");
  if (kinds.has("precise_location") || kinds.has("exact_date") || kinds.has("amount")) reasons.push("Precise location, date or amount could make a rare case identifiable.");
  const high = reasons.length && (kinds.has("account_number") || kinds.has("email") || kinds.has("phone") || kinds.has("named_business") || kinds.has("person"));
  return { risk: high ? "high" : reasons.length ? "medium" : "low", reasons: reasons.length ? reasons : ["No identifiers detected by automated checks."] };
}

/** Deterministic first pass, run locally before anything is sent to a model. */
export function ruleProposal(src: Source, orgNames: string[]): Proposal {
  const flags: Flag[] = [];
  const title = applyRules(src.title, orgNames, flags);
  const body = applyRules(src.body, orgNames, flags);
  return { title, body, industry: src.industry, region_band: regionBand(src.region), period_label: periodLabel(src.period_start, src.period_end), flags, ...risk(flags), engine: "rules" };
}

const SYSTEM = `You help a human moderator de-identify a client market observation before it is shared with other financial institutions.
Rewrite the title and body so they keep the business insight but remove or generalise anything that could identify the contributing institution, its customers or people:
names, account numbers, contact details, exact dates, exact amounts, precise places, unusual transaction details, confidential pricing or contract terms.
Prefer generalisation over deletion ("a mid-size agri-processing SME in Western India" rather than a name). Do not add facts.
Return only JSON: {"title": string, "body": string, "risk": "low"|"medium"|"high", "reasons": string[] (max 4, plain English)}.`;

/**
 * Moderation copilot. Rules always run first and the model only sees the rule-scrubbed text,
 * so direct identifiers never leave the server. The model then rewrites for re-identification risk.
 */
export async function proposeRedaction(src: Source, orgNames: string[]): Promise<Proposal> {
  const base = ruleProposal(src, orgNames);
  const reply = await claude(SYSTEM, JSON.stringify({ title: base.title, body: base.body, industry: src.industry, region: base.region_band, period: base.period_label }));
  const j = parseJson<{ title: string; body: string; risk: Proposal["risk"]; reasons: string[] }>(reply);
  if (!j?.title || !j?.body) return base;
  // Re-scan the model output: the model is assistance, not the control.
  const extra: Flag[] = [];
  const title = applyRules(j.title, orgNames, extra), body = applyRules(j.body, orgNames, extra);
  const order = { low: 0, medium: 1, high: 2 } as const;
  const r = order[j.risk] >= order[base.risk] ? j.risk : base.risk;
  return { ...base, title, body, flags: [...base.flags, ...extra], risk: r ?? base.risk, reasons: [...base.reasons, ...(j.reasons ?? [])].slice(0, 6), engine: "claude" };
}

/** Author-side scan shown on the form: flags likely sensitive content before submission. */
export function scanForAuthor(text: string): Flag[] {
  const flags: Flag[] = [];
  applyRules(text, [], flags);
  return flags;
}
