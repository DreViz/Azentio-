import type { Metadata } from "next";
import Link from "next/link";
import { Poppins } from "next/font/google";
import Header from "@/components/Header";
import Logo from "@/components/Logo";
import "./globals.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-poppins", display: "swap" });

export const metadata: Metadata = {
  title: "azentio.ai | Build intelligence. Create shared value.",
  description: "Applied AI for financial services, a secure client and employee portal, and governed collective learning.",
};

const FOOTER: [string, [string, string][]][] = [
  ["Explore", [["/products", "Products"], ["/solutions", "Solutions"], ["/insights", "Insights"], ["/media", "Media & videos"]]],
  ["Collaborate", [["/portal", "Client & employee portal"], ["/aira", "Ask AIRA"], ["/connect", "Request a demo"], ["/hackathon/register", "Build Labs hackathon"]]],
  ["Trust", [["/trust", "Trust & privacy"], ["/trust?run=1", "Live access checks"], ["/about", "About azentio.ai"]]],
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
        <div className="bg-ink text-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-5 py-2.5 text-sm">
            <p>Every privacy promise on this portal has a test you can run.</p>
            <Link href="/trust" className="rounded-full bg-mint px-4 py-1 font-medium text-ink transition-colors hover:bg-green">See the proof</Link>
          </div>
        </div>
        <Header />
        <main id="main" className="flex-1">{children}</main>
        <footer className="bg-ink text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 pb-10 pt-16 md:grid-cols-4">
            <div>
              <Logo className="h-9 text-[36px] text-white" />
              <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/75">Applied intelligence for banking, insurance and capital markets, built with our clients.</p>
            </div>
            {FOOTER.map(([title, links]) => (
              <nav key={title} aria-label={title}>
                <p className="text-sm font-semibold uppercase tracking-[0.06em] text-mint">{title}</p>
                <ul className="mt-4 space-y-2.5">
                  {links.map(([href, label]) => <li key={href}><Link href={href} className="text-[15px] text-white/90 transition-colors hover:text-mint">{label}</Link></li>)}
                </ul>
              </nav>
            ))}
          </div>
          <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 border-t border-white/15 px-5 py-6 text-sm text-white/65">
            <p>© 2026 azentio.ai · Product information is indicative and subject to validation.</p>
            <p>All demonstration organisations, people and data are synthetic.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
