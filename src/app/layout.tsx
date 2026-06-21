import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ACL4SSR Rule Manager",
  description: "Self-hosted rule manager and subconverter gateway",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
