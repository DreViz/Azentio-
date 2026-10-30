import Link from "next/link";
import type { ReactNode } from "react";

const tones: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700", blue: "bg-indigo-50 text-indigo-700", green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-800", red: "bg-rose-50 text-rose-700", purple: "bg-violet-50 text-violet-700", cyan: "bg-cyan-50 text-cyan-800",
};
export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: keyof typeof tones | string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone] ?? tones.slate}`}>{children}</span>;
}

export function PageHeader({ eyebrow, title, children, actions }: { eyebrow?: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand">{eyebrow}</p>}
        <h1 className="h1">{title}</h1>
        {children && <div className="mt-2 text-slate-600">{children}</div>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

/** Shows ?msg= / ?error= feedback after a server action redirect. */
export function Flash({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const msg = typeof sp.msg === "string" ? sp.msg : null, err = typeof sp.error === "string" ? sp.error : null;
  if (!msg && !err) return null;
  return (
    <div role="status" className={`mb-5 rounded-xl border px-4 py-3 text-sm ${err ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
      {err ?? msg}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
      <p className="font-semibold text-slate-700">{title}</p>
      {children && <div className="muted mt-1">{children}</div>}
    </div>
  );
}

export function Notice({ children, tone = "amber" }: { children: ReactNode; tone?: "amber" | "blue" | "slate" }) {
  const c = { amber: "border-amber-200 bg-amber-50 text-amber-900", blue: "border-indigo-200 bg-indigo-50 text-indigo-900", slate: "border-slate-200 bg-slate-50 text-slate-700" }[tone];
  return <div className={`rounded-xl border px-4 py-3 text-sm ${c}`}>{children}</div>;
}

export function Tile({ href, title, children, tag }: { href: string; title: string; children?: ReactNode; tag?: ReactNode }) {
  return (
    <Link href={href} className="card block transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-2"><p className="font-semibold text-ink">{title}</p>{tag}</div>
      {children && <div className="muted mt-1">{children}</div>}
    </Link>
  );
}

export const fmtDate = (d: string | Date | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
export const fmtTime = (d: string | Date | null) => (d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
