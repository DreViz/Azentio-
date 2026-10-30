import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "azentio.ai | Build intelligence. Create shared value.",
  description: "Applied AI for financial services, a secure client and employee portal, and governed collective learning.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
        <Header />
        <main id="main" className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-slate-500">
            <p>© 2026 azentio.ai · Product information is indicative and subject to validation. All demonstration data is synthetic.</p>
            <nav className="flex gap-4"><Link href="/trust">Trust &amp; privacy</Link><Link href="/connect">Contact</Link><Link href="/hackathon/register">Hackathon</Link></nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
