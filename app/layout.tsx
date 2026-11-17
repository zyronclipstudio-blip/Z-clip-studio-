import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import PwaShell from "@/components/PwaShell";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: "ZClip Studio",
  description: "Upload your footage. Let ZClip do the editing.",
  applicationName: "ZClip",
  appleWebApp: { capable: true, title: "ZClip", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/zclip-gold.svg", shortcut: "/icons/zclip-gold.svg" },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-background font-sans text-ink antialiased">
        <PwaShell />
        {children}
      </body>
    </html>
  );
}