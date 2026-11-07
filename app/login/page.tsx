"use client";

import { FormEvent, Suspense, useState } from "react";
import { Eye, EyeOff, FileText, LogIn, Printer, ShieldCheck, Wallet } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

import Brand from "@/components/layout/Brand";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";

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

const FEATURES = [
  { icon: FileText, title: "PO → Invoice ในไม่กี่คลิก", text: "ดึงรายการจาก PO คำนวณ VAT และส่วนลดให้อัตโนมัติ" },
  { icon: Printer, title: "พิมพ์ลงฟอร์มต่อเนื่อง", text: "PDF ตรงช่องฟอร์ม M-T82-01 สำหรับ Epson LQ-630" },
  { icon: Wallet, title: "ติดตามยอดค้างรับ", text: "รู้ทันทีว่าใบไหนค้างชำระและเกินกำหนด" },
];

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-slate-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-brand-600/30 blur-3xl"
        />
        <Brand inverted />

        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-snug">ระบบบัญชีและลูกหนี้ ที่ใช้งานง่าย</h2>
          <ul className="mt-8 space-y-5">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="size-5 text-brand-200" />
                </span>
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="block text-sm text-slate-300">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-slate-400">TC Engineering &amp; Trading Co., Ltd.</p>
      </div>

      <div className="flex items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Brand />
          </div>

          <h1 className="text-2xl font-semibold text-slate-900">เข้าสู่ระบบ</h1>
          <p className="mt-1 text-sm text-slate-500">กรอกชื่อผู้ใช้และรหัสผ่านเพื่อเริ่มใช้งาน</p>

          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {/* useSearchParams must sit inside Suspense: /login is prerendered (cacheComponents),
                and the fallback is what the static HTML shows until the browser takes over. */}
            <Suspense fallback={<LoginForm callbackUrl={DEFAULT_AFTER_LOGIN} disabled />}>
              <LoginFormWithCallback />
            </Suspense>
          </div>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="size-3.5" /> เพื่อความปลอดภัย ระบบจะให้เข้าสู่ระบบใหม่ทุก 8 ชั่วโมง
          </p>
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
  const [showPassword, setShowPassword] = useState(false);

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
        <Field label="ชื่อผู้ใช้" htmlFor="username">
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="username"
            autoComplete="username"
            autoFocus
            required
          />
        </Field>

        <Field label="รหัสผ่าน" htmlFor="password">
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-700"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        {error && <Alert tone="danger">{error}</Alert>}

        <Button type="submit" disabled={loading} size="lg" className="w-full">
          <LogIn />
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </Button>
      </fieldset>
    </form>
  );
}
