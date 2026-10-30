import { enquiryAction } from "@/app/actions/public";

export default function EnquiryForm({ kind, product }: { kind: "demo" | "hackathon"; product?: string }) {
  return (
    <form action={enquiryAction} className="card grid gap-4 md:grid-cols-2">
      <input type="hidden" name="kind" value={kind} />
      <div className="hidden" aria-hidden><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <div><label htmlFor="name" className="label">Full name</label><input id="name" name="name" required minLength={2} maxLength={120} className="input" /></div>
      <div><label htmlFor="email" className="label">Work email</label><input id="email" name="email" type="email" required maxLength={200} className="input" /></div>
      <div className="md:col-span-2"><label htmlFor="company" className="label">{kind === "demo" ? "Organisation" : "Team name"}</label><input id="company" name="company" maxLength={160} className="input" /></div>
      <div className="md:col-span-2"><label htmlFor="message" className="label">{kind === "demo" ? "What would you like to see?" : "Your idea in a sentence"}</label>
        <textarea id="message" name="message" maxLength={2000} rows={4} className="input" defaultValue={product ? `Interested in: ${product}` : ""} /></div>
      <p className="muted md:col-span-2">Please do not include customer data or confidential information.</p>
      <button className="btn md:col-span-2 md:w-fit">{kind === "demo" ? "Request demo" : "Register interest"}</button>
    </form>
  );
}
