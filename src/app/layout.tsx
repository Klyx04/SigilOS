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
    default: "SigilOS — Le système d'exploitation pour guildes Dofus",
    template: "%s | SigilOS",
  },
  description: "SigilOS est la plateforme de gestion de guilde Dofus la plus complète en 2026. Bot Discord, suivi de quêtes (Ocre, Almanax, Songes Infinis), annuaire de guildes, ladder XP, Dungeon Finder et outils communautaires. Gratuit et open-source.",
  keywords: ["dofus", "guilde", "gestion guilde dofus", "bot discord dofus", "sigilos", "quête ocre", "songes infinis", "almanax", "dungeon finder", "dofus 2026", "guilde dofus 3"],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: getAppBaseUrl(),
    siteName: "SigilOS",
    title: "SigilOS — Gestion de Guilde Dofus",
    description: "La plateforme tout-en-un pour les guildes Dofus : quêtes, Songes Infinis, Dungeon Finder, ladder XP et outils communautaires.",
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
    title: "SigilOS — Gestion de Guilde Dofus",
    description: "La plateforme tout-en-un pour les guildes Dofus. Quêtes, Songes, Dungeon Finder, Ladder XP.",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${inter.variable} ${cinzel.variable} ${rajdhani.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider session={session}>
            <TooltipProvider>
              {children}
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
