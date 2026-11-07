"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/customers", label: "ลูกค้า" },
  { href: "/purchase-orders", label: "Purchase Order" },
  { href: "/invoices", label: "Invoice" },
  { href: "/payments", label: "รับชำระเงิน" },
];

function isActive(pathname: string | null, href: string) {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

/** Plain links. Also used as the Suspense fallback while the pathname is not known yet. */
export function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={
            isActive(pathname, item.href)
              ? "rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
              : "rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** Highlights the current section. Must be rendered inside <Suspense> (see app/(main)/layout.tsx). */
export default function AppNav() {
  const pathname = usePathname();
  return <NavLinks pathname={pathname} />;
}
