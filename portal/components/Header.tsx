import Link from "next/link";
import { getViewer, db } from "@/lib/session";
import { signOutAction, switchOrgAction } from "@/app/actions/auth";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";

const PUBLIC = [["/products", "Products"], ["/solutions", "Solutions"], ["/insights", "Insights"], ["/media", "Media"], ["/aira", "AIRA"], ["/about", "About"]];

export default async function Header() {
  const v = await getViewer();
  const unread = v ? (await db(v, (q) => q<{ n: number }>("select count(*)::int n from notifications where read_at is null")))[0].n : 0;
  return (
    <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-8 sm:px-5 sm:py-4">
        <Link href="/" aria-label="azentio.ai home" className="shrink-0 text-ink"><Logo className="h-7 text-[28px] sm:h-9 sm:text-[36px]" /></Link>
        <nav aria-label="Main" className="hidden flex-1 items-center gap-7 text-[15px] text-ink lg:flex">
          {PUBLIC.map(([href, label]) => (
            <Link key={href} href={href} className="py-1 transition-colors hover:text-green-deep">{label}</Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
          {v ? (
            <>
              {v.memberships.length > 1 && (
                <form action={switchOrgAction} className="hidden items-center gap-1.5 md:flex">
                  <label htmlFor="ws" className="sr-only">Active workspace</label>
                  <select id="ws" name="org_id" defaultValue={v.activeOrg?.org_id} className="rounded-full border border-ink/20 bg-white px-3 py-1.5 text-sm text-ink">
                    {v.memberships.map((m) => <option key={m.org_id} value={m.org_id}>{m.org_name}</option>)}
                  </select>
                  <button className="cursor-pointer rounded-full px-2 py-1.5 text-sm font-medium text-ink underline decoration-mint decoration-2 underline-offset-4">Switch</button>
                </form>
              )}
              <Link href="/portal/notifications" className="relative grid h-11 w-11 place-items-center rounded-full text-ink transition-colors hover:bg-cloud" aria-label={`Notifications, ${unread} unread`}>
                <Icon name="bell" />
                {unread > 0 && <span className="absolute right-1.5 top-1.5 min-w-5 rounded-full bg-ink px-1.5 text-center text-[11px] font-semibold leading-5 text-mint">{unread}</span>}
              </Link>
              <Link href="/portal" className="btn-dark hidden sm:inline-flex">Portal</Link>
              <form action={signOutAction}><button className="cursor-pointer px-2 text-[15px] text-ink hover:text-green-deep">Sign out</button></form>
            </>
          ) : (
            <>
              <Link href="/connect" className="btn-dark hidden sm:inline-flex">Contact us</Link>
              <Link href="/login" className="btn px-4 sm:px-6">Sign in</Link>
            </>
          )}
          <details className="relative lg:hidden">
            <summary className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full text-ink hover:bg-cloud" aria-label="Open menu"><Icon name="menu" accent={false} /></summary>
            <nav aria-label="Main (mobile)" className="absolute right-0 top-12 z-40 w-56 rounded-lg border border-black/[0.06] bg-white p-2 shadow-lg">
              {PUBLIC.map(([href, label]) => <Link key={href} href={href} className="block rounded-md px-3 py-2.5 text-[15px] text-ink hover:bg-cloud">{label}</Link>)}
              <Link href="/trust" className="block rounded-md px-3 py-2.5 text-[15px] text-ink hover:bg-cloud">Trust</Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
