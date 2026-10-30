// Deterministic sandbox for the guided Playground. Synthetic applicants only.
// Outputs are explanations for discussion, never a credit decision.

export type Applicant = { id: string; name: string; sector: string; emi: number; inflows: number[] }; // 24 months, oldest first

const seasonal = (base: number, peakMonths: number[], peak: number, noise: number[]) =>
  Array.from({ length: 24 }, (_, i) => Math.round(base * (peakMonths.includes(i % 12) ? peak : 0.55) * noise[i % noise.length]));

export const APPLICANTS: Applicant[] = [
  { id: "agro", name: "Synthetic agri-processor (seasonal)", sector: "Agri processing", emi: 9_000,
    inflows: seasonal(60_000, [9, 10, 11, 0], 2.6, [1, 0.96, 1.04, 0.98, 1.02, 1.01, 0.97]) },
  { id: "retail", name: "Synthetic festive retailer (seasonal)", sector: "Retail", emi: 6_500,
    inflows: seasonal(40_000, [2, 3], 2.9, [1.02, 0.98, 1, 1.03, 0.97]) },
  { id: "services", name: "Synthetic IT services firm (stable)", sector: "Services", emi: 7_000,
    inflows: Array.from({ length: 24 }, (_, i) => Math.round(52_000 * [1, 1.04, 0.97, 1.02, 0.99, 1.03][i % 6])) },
  { id: "stress", name: "Synthetic distributor (declining)", sector: "Distribution", emi: 8_000,
    inflows: Array.from({ length: 24 }, (_, i) => Math.round(70_000 * (1 - i * 0.025) * [1, 0.9, 1.1, 0.95][i % 4])) },
];

const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };

export type RunOutput = {
  applicant: string; mode: "standard" | "seasonality"; label: string; indicative: string;
  metrics: { name: string; value: string }[]; evidence: string[]; caution: string;
};

/** Standard view: month-to-month volatility on the last 12 months. */
export function runStandard(a: Applicant): RunOutput {
  const last = a.inflows.slice(12);
  const cv = sd(last) / mean(last);
  const dscr = (mean(last) * 0.35) / a.emi;
  const minCover = (Math.min(...last) * 0.35) / a.emi;
  const flag = cv > 0.45 || minCover < 1;
  return {
    applicant: a.name, mode: "standard", label: "Simulated output on synthetic data",
    indicative: flag ? "Refer for human review: high month-to-month volatility" : "Within indicative policy thresholds",
    metrics: [
      { name: "Average monthly inflow", value: Math.round(mean(last)).toLocaleString("en-IN") },
      { name: "Coefficient of variation", value: cv.toFixed(2) },
      { name: "Average debt-service cover", value: dscr.toFixed(2) },
      { name: "Weakest-month cover", value: minCover.toFixed(2) },
    ],
    evidence: [`Volatility threshold 0.45; observed ${cv.toFixed(2)}.`, `Weakest month covers the instalment ${minCover.toFixed(2)} times.`],
    caution: "Sandbox recommendation only. Not an approved credit or business decision.",
  };
}

/** Experimental view (employees only): removes the repeating annual pattern before judging volatility. */
export function runSeasonal(a: Applicant): RunOutput {
  const y1 = a.inflows.slice(0, 12), y2 = a.inflows.slice(12);
  const index = y1.map((x, i) => (x + y2[i]) / 2 / mean([...y1, ...y2]));
  const deseason = y2.map((x, i) => x / index[i]);
  const cvRaw = sd(y2) / mean(y2), cvAdj = sd(deseason) / mean(deseason);
  const yoy = mean(y2) / mean(y1) - 1;
  const annualCover = (mean(y2) * 0.35) / a.emi;
  const seasonalShare = 1 - cvAdj / Math.max(cvRaw, 1e-9);
  const flag = cvAdj > 0.2 || yoy < -0.1 || annualCover < 1.2;
  return {
    applicant: a.name, mode: "seasonality", label: "Experimental, simulated output on synthetic data",
    indicative: flag ? "Refer for human review: residual volatility or declining trend after seasonal adjustment" : "Volatility is mostly seasonal; annual cover within indicative thresholds",
    metrics: [
      { name: "Raw coefficient of variation", value: cvRaw.toFixed(2) },
      { name: "After seasonal adjustment", value: cvAdj.toFixed(2) },
      { name: "Share of volatility explained by season", value: `${Math.round(Math.max(0, seasonalShare) * 100)}%` },
      { name: "Year-on-year change", value: `${(yoy * 100).toFixed(1)}%` },
      { name: "Annualised debt-service cover", value: annualCover.toFixed(2) },
    ],
    evidence: [
      `The same months peak in both years (seasonal index range ${Math.min(...index).toFixed(2)} to ${Math.max(...index).toFixed(2)}).`,
      `After removing the seasonal pattern, volatility falls from ${cvRaw.toFixed(2)} to ${cvAdj.toFixed(2)}.`,
    ],
    caution: "Experimental method under evaluation. Not an approved credit or business decision.",
  };
}
