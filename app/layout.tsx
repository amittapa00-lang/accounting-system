import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Accounting System",
  description: "ระบบจัดการบัญชีและลูกหนี้",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      {/* Browser extensions (e.g. ColorZilla) inject attributes into <body> before hydration */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
