import { getActiveSession } from "@/lib/auth";
import { roleLabel } from "@/lib/labels";

import LogoutButton from "./LogoutButton";

/** Signed-in user with a logout button. Reads the session, so render it inside <Suspense>. */
export default async function UserCard() {
  const session = await getActiveSession();
  if (!session) return null;

  const name = session.user.name ?? session.user.username ?? "ผู้ใช้งาน";

  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
        {name.trim().charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium text-slate-900">{name}</p>
        <p className="truncate text-xs text-slate-500">{roleLabel(session.user.role)}</p>
      </div>
      <LogoutButton compact />
    </div>
  );
}

export function UserCardSkeleton() {
  return (
    <div className="flex items-center gap-3 px-2 py-1.5">
      <span className="size-9 animate-pulse rounded-full bg-slate-200" />
      <div className="flex-1 space-y-1.5">
        <span className="block h-3 w-24 animate-pulse rounded bg-slate-200" />
        <span className="block h-2.5 w-16 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}
