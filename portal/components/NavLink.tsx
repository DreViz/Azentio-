"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Sidebar link that marks the current page (mint bar + aria-current), as navigation state must be visible.
export default function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = href === "/portal" ? path === "/portal" : path === href || path.startsWith(href + "/");
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={`block border-l-[3px] px-3 py-2 text-[15px] transition-colors ${active ? "border-mint bg-white font-medium text-ink" : "border-transparent text-ink/80 hover:border-ink/20 hover:text-ink"}`}>
      {children}
    </Link>
  );
}
