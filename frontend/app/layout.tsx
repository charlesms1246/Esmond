import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { NavBar }    from "@/components/NavBar";

export const metadata: Metadata = {
  title:       "Esmond — Programmable Payment Engine",
  description: "On-chain payroll, milestone escrow, and subscription billing on Polkadot Hub",
  icons: {
    icon: [
      { url: "/esmond_favicon/favicon.ico" },
      { url: "/esmond_favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/esmond_favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple:   { url: "/esmond_favicon/apple-touch-icon.png" },
    other: [
      { rel: "manifest", url: "/esmond_favicon/site.webmanifest" },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col">
        <Providers>
          <NavBar />
          <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <footer className="border-t border-[var(--border)] py-6 text-center text-sm text-[var(--text-muted)]">
            Esmond · Polkadot Hub Testnet (Paseo) · Chain ID: 420420417
          </footer>
        </Providers>
      </body>
    </html>
  );
}
