import Link from "next/link";
import { getViewer } from "@/lib/session";
import { system } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { acceptInvite } from "@/app/actions/portal";
import { Flash, Notice } from "@/components/ui";

export default async function Invite({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const [inv] = await system((q) => q<{ org_name: string; role: string; email: string; state: string }>("select * from invite_lookup($1)", [sha256(token)]));
  const v = await getViewer();
  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <h1 className="h1">Workspace invitation</h1>
      <div className="mt-4"><Flash sp={sp} /></div>
      {!inv || inv.state !== "valid" ? <Notice>This invitation is {inv?.state ?? "not valid"}. Ask your organisation&apos;s administrator for a new one.</Notice> : (
        <div className="card mt-4 space-y-3">
          <p>You are invited to join <strong>{inv.org_name}</strong> as <strong>{inv.role.replace("_", " ")}</strong>.</p>
          <p className="muted">Issued to {inv.email.replace(/^(.).*(@.*)$/, "$1•••$2")}. Only that verified address can accept.</p>
          <Notice tone="slate"><strong>Workspace terms.</strong> Joining gives you access to your organisation&apos;s workspace. It is not consent to share or train on your data. Anything you record starts private, and sharing with the learning community is a separate, explicit choice reviewed by a moderator.</Notice>
          {v ? (
            <form action={acceptInvite}><input type="hidden" name="token" value={token} /><button className="btn">I have read the terms. Accept as {v.email}</button></form>
          ) : <Link href={`/login?next=/invite/${token}`} className="btn">Sign in to accept</Link>}
        </div>
      )}
    </div>
  );
}
