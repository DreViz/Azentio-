import Link from "next/link";
import { requireViewer, can } from "@/lib/session";

// Navigation reflects the viewer's grants for convenience only. Every page and action is
// independently enforced by database policies, so hiding a link is never the control.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const v = await requireViewer();
  const client = v.activeOrg?.kind === "client";
  const sections: [string, [string, string][]][] = [
    ["Workspace", [["/portal", "Dashboard"], ...(client ? [["/portal/contributions", "Observations"], ["/portal/sandbox", "Sandboxes"], ["/portal/resources", "Resources & sessions"]] as [string, string][] : [])]],
    ["Learning", [["/portal/learning", "Shared learning"], ["/portal/themes", "Themes"], ["/portal/ideas", "Improvement ideas"], ["/aira", "Ask AIRA"]]],
  ];
  if (v.isEmployee) sections.push(["Employee", [["/portal/sandbox", "Playground"], ["/portal/resources", "Live, experiments & library"], ["/portal/federated", "Federated lab"]]]);
  const admin: [string, string][] = [];
  if (can(v, "moderator")) admin.push(["/portal/moderation", "Moderation"]);
  if (can(v, "publisher")) admin.push(["/portal/studio", "Content studio"]);
  if (can(v, "portal_admin")) admin.push(["/portal/admin", "Administration"]);
  if (client && v.activeOrg?.role === "client_admin") admin.push(["/portal/org", "Organisation"]);
  if (admin.length) sections.push(["Manage", admin]);
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 md:flex-row md:gap-8">
      <details className="card p-3 md:hidden">
        <summary className="cursor-pointer text-sm font-semibold text-ink">Portal menu · {v.activeOrg?.org_name ?? "No workspace"}</summary>
        {sections.map(([title, links]) => (
          <nav key={title} aria-label={`${title} (mobile)`} className="mt-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</p>
            {links.map(([href, label]) => <Link key={href + label} href={href} className="block rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100">{label}</Link>)}
          </nav>
        ))}
      </details>
      <aside className="hidden w-56 shrink-0 md:block">
        <div className="card sticky top-20 p-4">
          <p className="text-xs font-semibold text-slate-500">Signed in as</p>
          <p className="truncate font-semibold text-ink">{v.name}</p>
          <p className="truncate text-xs text-slate-500">{v.email}</p>
          {v.activeOrg && <p className="mt-2 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">Workspace: {v.activeOrg.org_name}</p>}
          {sections.map(([title, links]) => (
            <nav key={title} aria-label={title} className="mt-4">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</p>
              {links.map(([href, label]) => <Link key={href + label} href={href} className="block rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-slate-100">{label}</Link>)}
            </nav>
          ))}
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
