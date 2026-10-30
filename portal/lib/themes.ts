import { ai, parseJson } from "./ai";

export type Item = { id: string; title: string; body: string; offering_id: string | null };
export type Suggestion = { title: string; summary: string; item_ids: string[]; engine: "model" | "keywords" };

const KEYWORDS: [string, RegExp, string][] = [
  ["Seasonality context", /season|harvest|festive|ramadan|eid|cycle|peak|off-season/i,
    "Institutions report that seasonal cash-flow patterns are treated as volatility or arrears in credit assessment."],
  ["Late regulatory template changes", /template|regulator|return|filing|validation rule/i,
    "Institutions report late regulatory template revisions that force manual re-mapping."],
  ["Document intake exceptions", /scan|document|extraction|licen[cs]e|pages/i,
    "Institutions report document intake exceptions that slow onboarding."],
  ["Explainability of recommendations", /explain|evidence|reason|transparen/i,
    "Institutions ask for clearer explanations behind recommendations."],
];

/** Groups unthemed approved items. Every suggestion keeps the exact evidence ids it came from. */
export async function suggestThemes(items: Item[]): Promise<Suggestion[]> {
  if (!items.length) return [];
  const reply = await ai(
    `Group these approved, de-identified observations into at most 4 themes. Only group items that genuinely share a problem.
Return JSON: {"themes":[{"title":string,"summary":string (one neutral sentence, no prevalence or causation claims),"item_ids":string[]}]}. Use only the given ids.`,
    JSON.stringify(items.map((i) => ({ id: i.id, title: i.title, body: i.body.slice(0, 500) }))),
    { fast: true });
  const j = parseJson<{ themes: { title: string; summary: string; item_ids: string[] }[] }>(reply);
  const ids = new Set(items.map((i) => i.id));
  if (j?.themes?.length) {
    return j.themes
      .map((t) => ({ title: t.title, summary: t.summary, item_ids: t.item_ids.filter((x) => ids.has(x)), engine: "model" as const }))
      .filter((t) => t.item_ids.length);
  }
  const out: Suggestion[] = [];
  const used = new Set<string>();
  for (const [title, re, summary] of KEYWORDS) {
    const hit = items.filter((i) => !used.has(i.id) && re.test(`${i.title} ${i.body}`));
    if (hit.length) {
      hit.forEach((i) => used.add(i.id));
      out.push({ title, summary, item_ids: hit.map((i) => i.id), engine: "keywords" });
    }
  }
  return out;
}
