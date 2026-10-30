import { CONTRIB_TYPES, EVIDENCE, CONFIDENCE, VISIBILITY, VISIBILITY_TEXT, human } from "@/lib/labels";

type C = Partial<Record<"id" | "type" | "title" | "body" | "offering_id" | "industry" | "region" | "period_start" | "period_end" | "evidence_type" | "confidence" | "visibility", string | null>>;

export default function ContributionForm({ action, offerings, c, isNew }: { action: (f: FormData) => Promise<void>; offerings: { id: string; name: string }[]; c?: C; isNew?: boolean }) {
  const d = (s: string | null | undefined) => (s ? String(s).slice(0, 10) : "");
  return (
    <form action={action} className="card space-y-5">
      {c?.id && <input type="hidden" name="id" value={c.id} />}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Please leave out customer names, account numbers, transaction-level data, credentials, confidential contract or pricing terms, and anything else restricted. Automated checks help but are not a privacy guarantee.
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div><label className="label" htmlFor="type">Type</label>
          <select id="type" name="type" className="input" defaultValue={c?.type ?? "market_observation"}>{CONTRIB_TYPES.map((t) => <option key={t} value={t}>{human(t)}</option>)}</select></div>
        <div><label className="label" htmlFor="offering_id">Related offering</label>
          <select id="offering_id" name="offering_id" className="input" defaultValue={c?.offering_id ?? ""}><option value="">Not specific</option>{offerings.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
      </div>
      <div><label className="label" htmlFor="title">Title</label><input id="title" name="title" required minLength={5} maxLength={140} className="input" defaultValue={c?.title ?? ""} /></div>
      <div><label className="label" htmlFor="body">Observation</label><textarea id="body" name="body" required minLength={20} maxLength={4000} rows={7} className="input" defaultValue={c?.body ?? ""} />
        <p className="muted mt-1">What did you observe, how often, and what evidence supports it? 20 to 4,000 characters.</p></div>
      <div className="grid gap-4 md:grid-cols-3">
        <div><label className="label" htmlFor="industry">Industry</label><input id="industry" name="industry" required minLength={2} maxLength={80} className="input" defaultValue={c?.industry ?? "Banking"} /></div>
        <div><label className="label" htmlFor="region">Region</label><input id="region" name="region" required minLength={2} maxLength={120} className="input" defaultValue={c?.region ?? ""} /></div>
        <div><label className="label" htmlFor="evidence_type">Evidence type</label>
          <select id="evidence_type" name="evidence_type" className="input" defaultValue={c?.evidence_type ?? "internal_data"}>{EVIDENCE.map((t) => <option key={t} value={t}>{human(t)}</option>)}</select></div>
        <div><label className="label" htmlFor="period_start">Observed from</label><input id="period_start" name="period_start" type="date" required className="input" defaultValue={d(c?.period_start)} /></div>
        <div><label className="label" htmlFor="period_end">Observed to</label><input id="period_end" name="period_end" type="date" required className="input" defaultValue={d(c?.period_end)} /></div>
        <div><label className="label" htmlFor="confidence">Confidence</label>
          <select id="confidence" name="confidence" className="input" defaultValue={c?.confidence ?? "medium"}>{CONFIDENCE.map((t) => <option key={t} value={t}>{human(t)}</option>)}</select></div>
      </div>
      <fieldset>
        <legend className="label mb-2">Who can see this</legend>
        <div className="grid gap-3 md:grid-cols-3">
          {VISIBILITY.map((vis) => (
            <label key={vis} className="flex cursor-pointer gap-2 rounded-xl border border-slate-200 p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-indigo-50">
              <input type="radio" name="visibility" value={vis} defaultChecked={(c?.visibility ?? "private") === vis} className="mt-1" />
              <span><span className="font-semibold">{VISIBILITY_TEXT[vis].label}</span><span className="muted block">{VISIBILITY_TEXT[vis].who}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      {isNew && (
        <fieldset className="rounded-xl border border-slate-200 p-4">
          <legend className="label px-1">Separate permissions (you can change these later)</legend>
          <label className="flex gap-2 text-sm"><input type="checkbox" name="consent_store" required /> <span><strong>Store and process</strong> this contribution in my workspace (required to save).</span></label>
          <label className="mt-2 flex gap-2 text-sm"><input type="checkbox" name="consent_publish" /> <span><strong>Publish</strong> a reviewed, de-identified copy to the learning community if I submit it.</span></label>
          <label className="mt-2 flex gap-2 text-sm"><input type="checkbox" name="consent_attribution" /> <span><strong>Attribute</strong> the shared copy to my organisation (opt-in, still reviewed).</span></label>
          <label className="mt-2 flex gap-2 text-sm"><input type="checkbox" name="consent_training" /> <span><strong>Model training</strong>: allow use in a future, separately approved training or federated-learning programme.</span></label>
          <p className="muted mt-2">Joining a workspace is not consent to share. Saving never shares anything.</p>
        </fieldset>
      )}
      <button className="btn">{isNew ? "Save draft" : "Save changes"}</button>
    </form>
  );
}
