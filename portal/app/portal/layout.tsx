import Link from "next/link";
import { requireViewer, can } from "@/lib/session";
import NavLink from "@/components/NavLink";

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
      <details className="rounded-lg bg-cloud p-4 md:hidden">
        <summary className="cursor-pointer text-sm font-semibold text-ink">Portal menu · {v.activeOrg?.org_name ?? "No workspace"}</summary>
        {sections.map(([title, links]) => (
          <nav key={title} aria-label={`${title} (mobile)`} className="mt-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</p>
            {links.map(([href, label]) => <Link key={href + label} href={href} className="block rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100">{label}</Link>)}
          </nav>
        ))}
      </details>
      <aside className="hidden w-60 shrink-0 md:block">
        <div className="sticky top-24 rounded-lg bg-cloud py-5">
          <div className="px-5">
            <p className="text-xs text-muted">Signed in as</p>
            <p className="mt-0.5 font-semibold leading-snug text-ink">{v.name}</p>
            <p className="truncate text-xs text-muted">{v.email}</p>
            {v.activeOrg && <p className="mt-3 rounded-md bg-ink px-3 py-2 text-xs font-medium leading-snug text-mint">{v.activeOrg.org_name}</p>}
          </div>
          {sections.map(([title, links]) => (
            <nav key={title} aria-label={title} className="mt-5">
              <p className="mb-1 px-5 text-xs font-semibold uppercase tracking-[0.06em] text-green-deep">{title}</p>
              {links.map(([href, label]) => <NavLink key={href + label} href={href}>{label}</NavLink>)}
            </nav>
          ))}
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
