import Link from "next/link";
import { PageHeader } from "@/components/ui";

const SOLUTIONS = [
  ["SME lending", "From application to decision with evidence, policy checks and human approval.", ["sme-credit-decisioning", "financial-analysis", "similar-portfolio-intelligence"]],
  ["Credit policy and portfolio", "Test strategy changes before rollout and learn from declined applications.", ["credit-strategy-simulator", "rejection-intelligence"]],
  ["Regulatory reporting", "Configurable templates, validation and traceable submissions.", ["riva"]],
  ["Document-heavy operations", "Extraction, classification and validation of financial documents.", ["document-intelligence"]],
] as const;

export default function Solutions() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <PageHeader eyebrow="Solutions" title="Start from the business problem.">Each solution combines products that are demonstrated with synthetic data in approved sandboxes.</PageHeader>
      <div className="grid gap-4 md:grid-cols-2">
        {SOLUTIONS.map(([t, d, ps]) => (
          <div key={t} className="card">
            <p className="text-lg font-semibold text-ink">{t}</p><p className="muted mt-1">{d}</p>
            <div className="mt-3 flex flex-wrap gap-2">{ps.map((p) => <Link key={p} href={`/products/${p}`} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">{p.replace(/-/g, " ")}</Link>)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
