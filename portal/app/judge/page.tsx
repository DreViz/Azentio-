import { notFound } from "next/navigation";
import { demoMode } from "@/lib/auth";
import { requestCodeAction } from "@/app/actions/auth";
import { Notice, PageHeader } from "@/components/ui";

const PERSONAS = [
  ["priya@azentio.com", "Employee", "Internal dashboard, Playground, employee broadcasts. No moderation or admin rights."],
  ["maya@azentio.com", "Learning moderator", "Reviews proposed contributions, redacts, publishes, handles reports. Cannot see private drafts."],
  ["omar@azentio.com", "Product owner", "Themes and improvement ideas linked to approved evidence."],
  ["pat@azentio.com", "Content publisher", "Website content, broadcasts and media audiences. No identity administration."],
  ["ada@azentio.com", "Portal administrator", "Grants, provisioning, settings, audit log, federated model decisions."],
  ["sam@meridian.example", "Client member, Meridian Bank", "Author of the seasonal SME observation awaiting review."],
  ["alex@meridian.example", "Client admin, Meridian Bank", "Invites and manages Meridian members only."],
  ["noor@northwind.example", "Client admin Northwind + member Lotus", "Multi-membership user with a workspace switcher."],
  ["li@lotus.example", "Client member, Lotus Microfinance", "Entitled to SME Credit Decisioning only."],
];

export default function Judge() {
  if (!demoMode()) notFound();
  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <PageHeader eyebrow="Judging kit" title="Sign in as a seeded persona">
        Each button runs the real email-code flow. Because seeded inboxes do not exist, demo mode displays the code on screen instead of emailing it.
      </PageHeader>
      <Notice>This page exists only when <code>DEMO_MODE=true</code>. It is a judging convenience, not the security model: access is still decided by memberships, grants and database policies after sign-in. Any other email address can sign in normally and will see no workspace until invited or provisioned.</Notice>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {PERSONAS.map(([email, role, what]) => (
          <form key={email} action={requestCodeAction} className="card flex flex-col">
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="from" value="/judge" />
            <p className="font-semibold text-ink">{role}</p>
            <p className="font-mono text-xs text-slate-500">{email}</p>
            <p className="muted mt-2 flex-1">{what}</p>
            <button className="btn mt-4 justify-center">Get code</button>
          </form>
        ))}
      </div>
    </div>
  );
}
