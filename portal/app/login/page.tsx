import Link from "next/link";
import { requestCodeAction, verifyCodeAction } from "@/app/actions/auth";
import { Flash, Notice } from "@/components/ui";
import Icon from "@/components/Icon";

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const codeStep = sp.step === "code" && sp.email;
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-2 md:py-20">
      <section className="hidden rounded-lg bg-ink p-10 text-white md:block">
        <p className="text-sm text-white/80">azentio.ai portal</p>
        <h2 className="mt-3 text-[2.2rem] font-semibold leading-tight text-mint">Your workspace.<br />Your data. Your choice.</h2>
        <ul className="mt-10 space-y-6 text-[15px] text-white/90">
          {([["lock", "Single-use codes that expire in 10 minutes and lock after five wrong attempts."], ["users", "Access comes from your employee membership or your organisation's invitation, never from an email address alone."], ["shield", "Nothing you record is shared until you choose to, and a moderator reviews it first."]] as const).map(([icon, text]) => (
            <li key={icon} className="flex gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-ink"><Icon name={icon} /></span><span className="pt-1 leading-relaxed">{text}</span></li>
          ))}
        </ul>
      </section>
      <div className="md:py-6">
      <p className="eyebrow">Welcome back</p>
      <h1 className="h1 mt-1"><span className="underline-mint">Sign in</span></h1>
      <p className="mt-4 text-[15px] leading-relaxed text-ink/80">We email you a single-use six-digit code. Employees use their verified @azentio.com address. Clients join by invitation from their organisation.</p>
      <div className="mt-6"><Flash sp={sp} /></div>
      {!codeStep ? (
        <form action={requestCodeAction} className="mt-2 space-y-5">
          <input type="hidden" name="next" value={sp.next ?? ""} />
          <div>
            <label htmlFor="email" className="label">Work email</label>
            <input id="email" name="email" type="email" required maxLength={200} autoComplete="email" className="input" defaultValue={sp.email} />
          </div>
          <button className="btn w-full">Send code</button>
        </form>
      ) : (
        <form action={verifyCodeAction} className="mt-2 space-y-5">
          <input type="hidden" name="email" value={sp.email} />
          <input type="hidden" name="next" value={sp.next ?? ""} />
          <p className="text-sm">Code sent to <strong>{sp.email}</strong>. It expires in 10 minutes and works once.</p>
          {sp.demo && <Notice>Demo mode: email delivery is simulated for seeded personas. Your code is <strong className="font-mono text-base">{sp.demo}</strong>.</Notice>}
          <div>
            <label htmlFor="code" className="label">Six-digit code</label>
            <input id="code" name="code" inputMode="numeric" pattern="[0-9]{6}" required minLength={6} maxLength={6} autoComplete="one-time-code" className="input font-mono tracking-[0.4em]" defaultValue={sp.demo} />
          </div>
          <button className="btn w-full">Verify and continue</button>
          <Link href="/login" className="link block text-center text-sm">Use a different email</Link>
        </form>
      )}
      <p className="muted mt-6">Signing in does not give access to any workspace by itself. Access comes from an approved employee membership or a client invitation.</p>
      </div>
    </div>
  );
}
