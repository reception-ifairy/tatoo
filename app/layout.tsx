import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InkTelligence — Alexei Inkseer",
  description: "Doradca AI i kompendium stylów oraz technik tatuażu.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
