// frontend/app/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title:       "Esmond — Polkadot Payment Infrastructure",
  description: "Payroll, escrow, and subscription management on Polkadot Asset Hub",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
