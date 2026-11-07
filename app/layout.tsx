import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";

import "./globals.css";

const plexThai = IBM_Plex_Sans_Thai({
  weight: ["400", "500", "600", "700"],
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-plex-thai",
});

export const metadata: Metadata = {
  title: {
    default: "Accounting System",
    template: "%s · Accounting System",
  },
  description: "ระบบจัดการบัญชีและลูกหนี้",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={plexThai.variable}>
      {/* Browser extensions (e.g. ColorZilla) inject attributes into <body> before hydration */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
