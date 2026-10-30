import Link from "next/link";
import { requestCodeAction, verifyCodeAction } from "@/app/actions/auth";
import { Flash, Notice } from "@/components/ui";

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const codeStep = sp.step === "code" && sp.email;
  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="h1">Sign in</h1>
      <p className="muted mt-2">We email you a single-use six-digit code. Employees use their verified @azentio.com address. Clients join by invitation from their organisation.</p>
      <div className="mt-6"><Flash sp={sp} /></div>
      {!codeStep ? (
        <form action={requestCodeAction} className="card space-y-4">
          <input type="hidden" name="next" value={sp.next ?? ""} />
          <div>
            <label htmlFor="email" className="label">Work email</label>
            <input id="email" name="email" type="email" required maxLength={200} autoComplete="email" className="input" defaultValue={sp.email} />
          </div>
          <button className="btn w-full justify-center">Send code</button>
        </form>
      ) : (
        <form action={verifyCodeAction} className="card space-y-4">
          <input type="hidden" name="email" value={sp.email} />
          <input type="hidden" name="next" value={sp.next ?? ""} />
          <p className="text-sm">Code sent to <strong>{sp.email}</strong>. It expires in 10 minutes and works once.</p>
          {sp.demo && <Notice>Demo mode: email delivery is simulated for seeded personas. Your code is <strong className="font-mono text-base">{sp.demo}</strong>.</Notice>}
          <div>
            <label htmlFor="code" className="label">Six-digit code</label>
            <input id="code" name="code" inputMode="numeric" pattern="[0-9]{6}" required minLength={6} maxLength={6} autoComplete="one-time-code" className="input font-mono tracking-[0.4em]" defaultValue={sp.demo} />
          </div>
          <button className="btn w-full justify-center">Verify and continue</button>
          <Link href="/login" className="link block text-center text-sm">Use a different email</Link>
        </form>
      )}
      <p className="muted mt-6">Signing in does not give access to any workspace by itself. Access comes from an approved employee membership or a client invitation.</p>
    </div>
  );
}
