import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "./Icon";

// Brand-tinted status tones. Meaning is always carried by the text too, never by colour alone.
const tones: Record<string, string> = {
  slate: "bg-fog text-ink",
  blue: "bg-[#e3ecf0] text-ink",
  green: "bg-tint text-green-deep ring-1 ring-inset ring-green/40",
  amber: "bg-[#fff4d6] text-[#7a5200]",
  red: "bg-[#fde8eb] text-[#a50d26]",
  purple: "bg-ink text-mint",
  cyan: "bg-tint text-ink",
};
export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: keyof typeof tones | string }) {
  return <span className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-medium ${tones[tone] ?? tones.slate}`}>{children}</span>;
}

export function PageHeader({ eyebrow, title, children, actions }: { eyebrow?: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="h1"><span className="underline-mint">{title}</span></h1>
        {children && <div className="mt-4 text-[15px] leading-relaxed text-ink/80">{children}</div>}
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
    <div role="status" className={`mb-6 flex items-start gap-3 rounded-lg border-l-4 px-4 py-3 text-[15px] ${err ? "border-[#c8102e] bg-[#fde8eb] text-[#7d0a1d]" : "border-green bg-tint text-ink"}`}>
      {!err && <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0" />}
      <span>{err ?? msg}</span>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg bg-cloud px-8 py-10 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="muted mt-1">{children}</div>}
    </div>
  );
}

export function Notice({ children, tone = "amber" }: { children: ReactNode; tone?: "amber" | "blue" | "slate" }) {
  const c = { amber: "border-[#e0a400] bg-[#fff8e5] text-[#5c3d00]", blue: "border-green bg-tint text-ink", slate: "border-ink/30 bg-cloud text-ink/85" }[tone];
  return <div className={`rounded-md border-l-4 px-4 py-3 text-sm leading-relaxed ${c}`}>{children}</div>;
}

export function Tile({ href, title, children, tag }: { href: string; title: string; children?: ReactNode; tag?: ReactNode }) {
  return (
    <Link href={href} className="card group flex flex-col transition-shadow duration-200 hover:shadow-[0_6px_22px_rgba(22,48,61,0.12)]">
      <div className="flex items-start justify-between gap-2"><p className="font-semibold text-ink">{title}</p>{tag}</div>
      {children && <div className="mt-2 flex-1 text-sm leading-relaxed text-ink/75">{children}</div>}
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink">Find out more <Icon name="arrow-right" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
    </Link>
  );
}

export const fmtDate = (d: string | Date | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
export const fmtTime = (d: string | Date | null) => (d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
