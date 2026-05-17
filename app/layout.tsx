import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ドリー夢 LIFF",
  description: "顧客向けLIFFアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
