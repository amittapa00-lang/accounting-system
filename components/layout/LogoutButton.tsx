"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

import { cn } from "@/components/ui/cn";

export default function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);

    // redirect: false keeps us on the current host. With a callbackUrl, next-auth
    // builds an absolute URL from NEXTAUTH_URL, which sends LAN users to "localhost".
    await signOut({ redirect: false });
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      title="ออกจากระบบ"
      aria-label="ออกจากระบบ"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-60",
        compact ? "size-9" : "h-9 px-3"
      )}
    >
      <LogOut className="size-4" />
      {!compact && (loading ? "กำลังออก..." : "ออกจากระบบ")}
    </button>
  );
}
