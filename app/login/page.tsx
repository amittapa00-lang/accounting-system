"use client";

import { FormEvent, Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

const DEFAULT_AFTER_LOGIN = "/dashboard";

/**
 * Only same-origin relative paths are allowed after login ("/invoices/abc?x=1").
 * Rejects absolute URLs, protocol-relative "//host", "/\host" (browsers treat "\" as "/")
 * and whitespace (browsers drop tabs/newlines, so "/\t/host" would become "//host").
 */
function safeCallbackUrl(value: string | null): string {
  if (!value || !/^\/(?![/\\])[^\\\s]*$/.test(value)) {
    return DEFAULT_AFTER_LOGIN;
  }

  // Going back to the login page itself would just show the form again.
  if (value === "/login" || value.startsWith("/login?") || value.startsWith("/login/")) {
    return DEFAULT_AFTER_LOGIN;
  }

  return value;
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Accounting System
            </h1>

            <p className="text-gray-500 mt-2">
              เข้าสู่ระบบจัดการบัญชี
            </p>
          </div>

          {/* useSearchParams must sit inside Suspense: /login is prerendered (cacheComponents),
              and the fallback is what the static HTML shows until the browser takes over. */}
          <Suspense fallback={<LoginForm callbackUrl={DEFAULT_AFTER_LOGIN} disabled />}>
            <LoginFormWithCallback />
          </Suspense>

          <div className="mt-6 text-center text-sm text-gray-400">
            Accounting Management System
          </div>
        </div>
      </div>
    </main>
  );
}

function LoginFormWithCallback() {
  const searchParams = useSearchParams();

  return <LoginForm callbackUrl={safeCallbackUrl(searchParams.get("callbackUrl"))} />;
}

function LoginForm({
  callbackUrl,
  disabled = false,
}: {
  callbackUrl: string;
  disabled?: boolean;
}) {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading || disabled) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (!result || result.error || !result.ok) {
        setError(
          result?.error
            ? "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
            : "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง"
        );
        setLoading(false);
        return;
      }

      // Keep the button disabled while the next page loads.
      router.push(callbackUrl);
      router.refresh();
    } catch (error) {
      console.error(error);
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อระบบ กรุณาลองใหม่อีกครั้ง");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset disabled={disabled} className="min-w-0 space-y-5">
        <div>
          <label
            htmlFor="username"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Username
          </label>

          <input
            id="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="กรอก Username"
            autoComplete="username"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Password
          </label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="กรอก Password"
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </fieldset>
    </form>
  );
}
