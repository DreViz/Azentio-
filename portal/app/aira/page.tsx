import Link from "next/link";
import { getViewer, db } from "@/lib/session";
import { answer } from "@/lib/aira";
import { Badge, PageHeader, Notice } from "@/components/ui";

export default async function Aira({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const v = await getViewer();
  const question = (sp.q ?? "").slice(0, 500).trim();
  const res = question ? await db(v, (q) => answer(q, question, !!v)) : null;
  const who = !v ? "public visitor" : v.isEmployee ? "employee" : v.activeOrg ? `member of ${v.activeOrg.org_name}` : "signed-in user without a workspace";
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <PageHeader eyebrow="AIRA" title="Ask azentio.ai">
        AIRA answers only from content you are allowed to see and cites every source. You are asking as a <strong>{who}</strong>.
      </PageHeader>
      <form className="card flex gap-2" action="/aira">
        <label htmlFor="q" className="sr-only">Question</label>
        <input id="q" name="q" defaultValue={question} maxLength={500} placeholder="e.g. What have clients observed about seasonal SME cash flow?" className="input mt-0 flex-1" />
        <button className="btn">Ask</button>
      </form>
      {res && (
        <div className="card mt-5">
          <div className="mb-3 flex items-center gap-2">
            <Badge tone={res.engine === "model" ? "purple" : "slate"}>{res.engine === "model" ? "Grounded" : res.citations.length ? "Extractive answer (sources used)" : "No matching approved evidence"}</Badge>
            <span className="muted">{res.citations.length} permitted sources · {res.ms} ms</span>
          </div>
          <p className="whitespace-pre-line text-slate-800">{res.answer}</p>
          {res.citations.length > 0 && (
            <ol className="mt-4 space-y-2 border-t pt-3 text-sm">
              {res.citations.map((c) => (
                <li key={c.id} className="flex gap-2"><span className="font-mono text-slate-500">{c.ref}</span><Link href={c.href} className="link">{c.title}</Link><Badge>{c.kind === "shared" ? "approved shared observation" : c.kind}</Badge></li>
              ))}
            </ol>
          )}
        </div>
      )}
      <div className="mt-5"><Notice tone="slate">Shared observations are self-reported by a small number of institutions. They are not evidence of market prevalence. AIRA never sees private drafts, organisation-only content you cannot access, or reviewer notes.</Notice></div>
    </div>
  );
}
