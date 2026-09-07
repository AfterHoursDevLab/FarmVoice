import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FarmVoice — Greenhouse #1",
  description: "Voice-controlled greenhouse dashboard (Phase 1)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}