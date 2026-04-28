import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "AURA MARKET | Luxury NFT Marketplace",
  description: "Mint and trade premium digital assets on Stellar Soroban.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="bg-bg-void text-primary selection:bg-aura/30">
        <ToastProvider>
          <Navbar />
          <main>{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
