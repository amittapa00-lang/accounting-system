"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, FileText, LayoutDashboard, Users, Wallet } from "lucide-react";

import { cn } from "@/components/ui/cn";

export const NAV_SECTIONS = [
  {
    title: "ภาพรวม",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "งานขาย",
    items: [
      { href: "/customers", label: "ลูกค้า", icon: Users },
      { href: "/purchase-orders", label: "Purchase Order", icon: ClipboardList },
      { href: "/invoices", label: "Invoice", icon: FileText },
    ],
  },
  {
    title: "การเงิน",
    items: [{ href: "/payments", label: "รับชำระเงิน", icon: Wallet }],
  },
];

function isActive(pathname: string | null, href: string) {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

/** Navigation links. Also the Suspense fallback (pathname null) while the URL is not known yet. */
export function NavLinks({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <nav className="space-y-6">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="px-3 pb-1.5 text-xs font-medium text-slate-400">{section.title}</p>
          <ul className="space-y-0.5">
            {section.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-brand-50 text-brand-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-[18px] shrink-0",
                        active ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600"
                      )}
                    />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Highlights the current section. Render inside <Suspense> (usePathname suspends on dynamic routes). */
export default function AppNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return <NavLinks pathname={pathname} onNavigate={onNavigate} />;
}
