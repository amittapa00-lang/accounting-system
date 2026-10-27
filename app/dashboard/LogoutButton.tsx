"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  async function handleLogout() {
    await signOut({
      callbackUrl: "/login",
    });
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
    >
      ออกจากระบบ
    </button>
  );
}