import Link from "next/link";
import { getViewer, db } from "@/lib/session";
import { signOutAction, switchOrgAction } from "@/app/actions/auth";

const PUBLIC = [["/products", "Products"], ["/solutions", "Solutions"], ["/insights", "Insights"], ["/media", "Media"], ["/aira", "AIRA"], ["/about", "About"], ["/trust", "Trust"]];

export default async function Header() {
  const v = await getViewer();
  const unread = v ? (await db(v, (q) => q<{ n: number }>("select count(*)::int n from notifications where read_at is null")))[0].n : 0;
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/95 text-white backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-5 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-2 text-sm">az</span>
          azentio<span className="text-brand-2">.ai</span>
        </Link>
        <nav aria-label="Main" className="hidden flex-1 gap-4 text-sm text-slate-300 lg:flex">
          {PUBLIC.map(([href, label]) => <Link key={href} href={href} className="hover:text-white">{label}</Link>)}
        </nav>
        <details className="relative lg:hidden">
          <summary className="cursor-pointer list-none rounded-md px-2 py-1 text-sm text-slate-200 hover:bg-white/10" aria-label="Open menu">☰ Menu</summary>
          <nav aria-label="Main (mobile)" className="absolute left-0 top-9 z-40 w-48 rounded-xl border border-white/10 bg-ink p-2 shadow-xl">
            {PUBLIC.map(([href, label]) => <Link key={href} href={href} className="block rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-white/10">{label}</Link>)}
          </nav>
        </details>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {v ? (
            <>
              {v.memberships.length > 1 && (
                <form action={switchOrgAction} className="flex items-center gap-1">
                  <label htmlFor="ws" className="sr-only">Active workspace</label>
                  <select id="ws" name="org_id" defaultValue={v.activeOrg?.org_id} className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-xs">
                    {v.memberships.map((m) => <option key={m.org_id} value={m.org_id} className="text-black">{m.org_name}</option>)}
                  </select>
                  <button className="rounded-md bg-white/15 px-2 py-1 text-xs hover:bg-white/25">Switch</button>
                </form>
              )}
              {v.memberships.length === 1 && <span className="hidden text-xs text-slate-300 md:inline">{v.activeOrg?.org_name}</span>}
              <Link href="/portal/notifications" className="relative rounded-md px-2 py-1 hover:bg-white/10" aria-label={`Notifications, ${unread} unread`}>
                🔔{unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold">{unread}</span>}
              </Link>
              <Link href="/portal" className="rounded-lg bg-white/10 px-3 py-1.5 font-semibold hover:bg-white/20">Portal</Link>
              <form action={signOutAction}><button className="text-slate-300 hover:text-white">Sign out</button></form>
            </>
          ) : (
            <>
              <Link href="/connect" className="hidden text-slate-300 hover:text-white sm:inline">Request demo</Link>
              <Link href="/login" className="rounded-lg bg-brand px-3 py-1.5 font-semibold hover:bg-indigo-500">Sign in</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
