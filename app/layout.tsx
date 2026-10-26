import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InkTelligence — Alexei Inkseer",
  description: "An AI tattoo advisor and a living compendium of tattoo history, styles, and techniques.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
