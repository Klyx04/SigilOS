import type { Metadata, Viewport } from "next";
import { Geist_Mono, Space_Grotesk, Inter, Cinzel, Source_Sans_3, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppToaster } from "@/components/shared/AppToaster";
import { getAppBaseUrl } from "@/lib/utils";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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

/* ── §REFONTE LANDING — typographie « registre » (public uniquement) ────────
   Source Sans 3 (texte, documentaire) + IBM Plex Mono (dates, heures,
   versions, chiffres, statuts, coordonnées). Ces deux familles ne sont
   appliquées qu'à l'intérieur du scope `.registre` (landing + pages
   publiques) : le dashboard et le God gardent Space Grotesk / Inter. */
const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getAppBaseUrl()),
  alternates: {
    canonical: getAppBaseUrl(),
    // ⚠️ AUCUN `languages` (hreflang) ici — décision du 25/09/2026, mesurée avant d'être prise :
    // `/?lang=en` est bien servi en anglais (le proxy lit `?lang=`, cf. `src/proxy.ts`), MAIS son
    // canonical reste `/` → Google canonicalisait `?lang=en` vers `/`, donc un hreflang pointant
    // vers une URL canonicalisée ailleurs est **ignoré** (signal contradictoire, zéro bénéfice).
    // Déclarer `fr`/`en`/`x-default` faisait donc croire à un site bilingue qui n'en est pas un :
    // seul le contenu des guides existe en anglais, le reste du site (boss, almanax, guildes) est
    // FR. Le sélecteur de langue côté visiteur **continue de fonctionner** ; on cesse simplement de
    // promettre à Google deux versions qu'on ne peut pas tenir. Un vrai i18n (`/en/…` + contenu
    // complet + sitemap par langue) serait un chantier à part, à rouvrir si une audience EN apparaît.
  },
  manifest: "/manifest.webmanifest", // Next.js generates this from manifest.ts
  title: {
    default: "SigilOS — Organisez votre guilde Dofus",
    template: "%s | SigilOS",
  },
  description: "SigilOS réunit quêtes, sorties, membres et progression Dofus dans un espace partagé, relié à Discord. Gratuit pour les guildes.",
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
import { PwaRegistration, PwaInstallBanner } from "@/components/pwa/PwaRegistration";

import { BossOverlayHost } from "@/components/boss-overlay/BossOverlayHost";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  // #16 — kill-switch God « Forcer le mode sombre » : verrouille le thème en dark
  // pour TOUT le monde (fail-closed, bascule auto si un user était resté en clair).
  const platformConfig = await db.platformConfig.findFirst({ select: { donationsEnabled: true, forceDarkMode: true } }).catch(() => null);
  const donationsEnabled = platformConfig?.donationsEnabled ?? true; // default true si pas de config
  const forcedTheme = platformConfig?.forceDarkMode ? "dark" : undefined;

  // [AUDIT 2026] Retrieve nonce from middleware for CSP-compliant script injection
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") ?? "";
  // Récupération de la locale active (cookie sigilos_locale ou header accept-language)
  const { getServerLocale } = await import("@/lib/i18n/server");
  const locale = await getServerLocale();
  const { I18nProvider } = await import("@/lib/i18n/client");

  return (
    <html lang={locale} suppressHydrationWarning>
      <body suppressHydrationWarning className={`${spaceGrotesk.variable} ${geistMono.variable} ${inter.variable} ${cinzel.variable} ${sourceSans.variable} ${plexMono.variable} antialiased`}>
        <ThemeProvider forcedTheme={forcedTheme} nonce={nonce}>
          <I18nProvider initialLocale={locale}>
            <AuthProvider session={session}>
              <TooltipProvider>
                <PwaRegistration />
                {children}
                {donationsEnabled && <SupportOrb />}
                <PwaInstallBanner />
                <AppToaster />
                <BossOverlayHost />
              </TooltipProvider>
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
