import type { Metadata } from "next";
import { Barlow_Condensed, IBM_Plex_Mono, Inter, Source_Sans_3, Source_Serif_4 } from "next/font/google";
import "@/app/globals.css";
import "@/app/da-wakfu.css";
import { DaWakfuFilters } from "@/components/da/DaWakfuFilters";
import { Toaster } from "sonner";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

/* Plus de Cinzel ici (05/11/2026) : la DA a tranché pour Barlow Condensed sur les
   titres, et le module Rush n'en monte plus une seule occurrence — seule l'interface
   God l'utilise, et elle ne vit pas dans cette route. Trois graisses de moins à
   télécharger dans la PiP, qui flotte au-dessus du jeu. */

/* Familles de la DA « Gouache Wakfu » : déclarées ici parce que ce layout
   redéclare `<html>` et n'hérite donc pas des variables du layout racine.
   `next/font` ne télécharge que les graisses réellement rendues. */
const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});
const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"],
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SigilOS — Guide Overlay",
  robots: { index: false, follow: false },
};

export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${barlow.variable} ${sourceSans.variable} ${sourceSerif.variable} ${plexMono.variable} bg-background text-foreground antialiased overflow-hidden`}>
        <DaWakfuFilters />
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
