import Link from "next/link";
import { Suspense } from "react";

import AppNav, { NavLinks } from "@/components/layout/AppNav";
import LogoutButton from "@/components/layout/LogoutButton";

/**
 * Shared shell for every signed-in page: top bar with navigation and logout.
 * Each page still checks the session itself (requirePageSession), because a
 * layout is not re-rendered on client-side navigation and must not be the only guard.
 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 print:min-h-0 print:bg-white">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <Link href="/dashboard" className="text-lg font-bold text-slate-900">
            Accounting System
          </Link>

          {/* usePathname needs Suspense under cacheComponents on dynamic routes such as /invoices/[id] */}
          <Suspense fallback={<NavLinks pathname={null} />}>
            <AppNav />
          </Suspense>

          <LogoutButton />
        </div>
      </header>

      {children}
    </div>
  );
}
