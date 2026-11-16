import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";
import PwaShell from "@/components/PwaShell";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space", display: "swap" });
const plex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex", display: "swap" });

export const metadata: Metadata = {
  title: "ZClip Studio",
  description: "Upload your footage. Let ZClip do the editing.",
  applicationName: "ZClip",
  appleWebApp: { capable: true, title: "ZClip", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/zclip-gold.svg", shortcut: "/icons/zclip-gold.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0B0810",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${space.variable} ${plex.variable}`}>
      <body className="min-h-screen bg-background font-sans text-ink antialiased">
        <PwaShell />
        {children}
      </body>
    </html>
  );
}