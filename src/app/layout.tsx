import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Playfair_Display, Inter, Cinzel, Rajdhani } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { getAppBaseUrl } from "@/lib/utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getAppBaseUrl()),
  alternates: {
    canonical: getAppBaseUrl(),
  },
  manifest: "/manifest.webmanifest", // Next.js generates this from manifest.ts
  title: {
    default: "SigilOS — Organisez votre guilde Dofus",
    template: "%s | SigilOS",
  },
  description: "SigilOS réunit quêtes, sorties, membres et progression Dofus dans un espace partagé, relié à Discord. Gratuit pour les guildes.",
  keywords: ["dofus", "guilde", "gestion guilde dofus", "bot discord dofus", "sigilos", "quête ocre", "songes infinis", "almanax", "dungeon finder", "dofus 2026", "guilde dofus 3"],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: getAppBaseUrl(),
    siteName: "SigilOS",
    title: "SigilOS — Gestion de guilde Dofus",
    description: "Quêtes, sorties, membres et progression Dofus dans un espace partagé, relié à Discord.",
    images: [
      {
        url: new URL('/api/og?title=SigilOS&subtitle=Le%20syst%C3%A8me%20d%27exploitation%20pour%20guildes%20Dofus', getAppBaseUrl()).toString(),
        width: 1200,
        height: 630,
        alt: "SigilOS — Le système d'exploitation pour guildes Dofus",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SigilOS — Gestion de guilde Dofus",
    description: "Quêtes, sorties, membres et progression Dofus dans un espace partagé, relié à Discord.",
    images: [new URL('/api/og?title=SigilOS&subtitle=Le%20syst%C3%A8me%20d%27exploitation%20pour%20guildes%20Dofus', getAppBaseUrl()).toString()],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/assets/ui/logo-v2.png",
    shortcut: "/assets/ui/logo-v2.png",
    apple: "/assets/ui/logo-v2.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#14b8a6", // Teal — matches actual design
};

import { auth } from "@/auth";
import { SupportOrb } from "@/components/shared/support-orb";
import { db } from "@/lib/prisma";
import { headers } from "next/headers";
import { GodBypassCookie } from "@/components/god-bypass-cookie";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const platformConfig = await db.platformConfig.findFirst({ select: { donationsEnabled: true } }).catch(() => null);
  const donationsEnabled = platformConfig?.donationsEnabled ?? true; // default true si pas de config

  // [AUDIT 2026] Retrieve nonce from middleware for CSP-compliant script injection
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') ?? '';

  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${inter.variable} ${cinzel.variable} ${rajdhani.variable} antialiased`}>
        <ThemeProvider>
          <AuthProvider session={session}>
            <TooltipProvider>
              <GodBypassCookie />
              {children}
              {donationsEnabled && <SupportOrb />}
              <Toaster
                position="bottom-right"
                richColors
                expand={false}
                closeButton
                theme="dark"
                toastOptions={{
                  className: "group font-sans border-white/5 bg-[#0d0f11]/90 backdrop-blur-2xl text-white shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl p-4 border border-zinc-500/10",
                  descriptionClassName: "text-zinc-400 font-medium text-[13px]",
                  style: {
                    borderLeft: '3px solid rgba(255,255,255,0.1)',
                  },
                  actionButtonStyle: {
                    background: "white",
                    color: "black",
                    fontWeight: "bold",
                    borderRadius: "0.5rem",
                  },
                }}
              />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
