import { Suspense } from "react";
import { Plus } from "lucide-react";

import AppNav, { NavLinks } from "@/components/layout/AppNav";
import Brand from "@/components/layout/Brand";
import MobileNav from "@/components/layout/MobileNav";
import UserCard, { UserCardSkeleton } from "@/components/layout/UserCard";
import { ButtonLink } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toast";

/**
 * Shell for every signed-in page: sidebar on desktop, top bar + slide-out menu on mobile.
 * Pages render their content directly (no page-level container or background needed).
 *
 * Each page still checks the session itself (requirePageSession), because a layout is not
 * re-rendered on client-side navigation and must not be the only guard.
 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  const user = (
    <Suspense fallback={<UserCardSkeleton />}>
      <UserCard />
    </Suspense>
  );

  return (
    <div className="min-h-screen bg-slate-50 lg:pl-64 print:bg-white print:pl-0">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex print:hidden">
        <div className="px-5 py-5">
          <Brand />
        </div>

        <div className="px-3">
          <ButtonLink href="/purchase-orders/new" variant="brand" className="w-full">
            <Plus /> สร้าง PO ใหม่
          </ButtonLink>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-5">
          {/* usePathname needs Suspense under cacheComponents on dynamic routes such as /invoices/[id] */}
          <Suspense fallback={<NavLinks pathname={null} />}>
            <AppNav />
          </Suspense>
        </div>

        <div className="border-t border-slate-200 p-3">{user}</div>
      </aside>

      <MobileNav brand={<Brand />} user={user} />

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:p-0">{children}</main>

      <Toaster />
    </div>
  );
}
