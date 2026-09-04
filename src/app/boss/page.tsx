import { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Sparkles, Swords, ArrowLeft, HelpCircle } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { JsonLd } from "@/components/shared/json-ld";
import { auth } from "@/auth";
import { getAppBaseUrl } from "@/lib/utils";
import { getBestiaireCatalog } from "@/server/actions/game-data-actions";
import { PublicBossCatalogClient } from "./_components/PublicBossCatalogClient";
import { getUserContext } from "@/server/actions/user-actions";

export const revalidate = 3600; // Cache ISR 1h

export const metadata: Metadata = {
  title: "Fiches Boss & Donjons Dofus Unity : Sorts, Portées & Stratégies | SigilOS",
  description:
    "Explorez tous les donjons et boss de Dofus Unity : grilles isométriques de portée des sorts, lignes de vue, résistances et mini-fenêtre overlay détachable par-dessus votre jeu. 100% gratuit et sans inscription.",
  alternates: {
    canonical: `${getAppBaseUrl()}/boss`,
  },
  openGraph: {
    title: "Fiches Boss & Donjons Dofus Unity — SigilOS (100% Gratuit)",
    description: "Simulateur de portées de sorts, résistances et fiches tactiques pour tous les donjons Dofus Unity. Gratuit et sans compte requis.",
    url: `${getAppBaseUrl()}/boss`,
  },
};

export default async function PublicBossCatalogPage() {
  const session = await auth();
  const userContext = await getUserContext();

  const catalogRes = await getBestiaireCatalog();
  const bosses = (catalogRes.success && catalogRes.data) ? catalogRes.data : [];

  const headersList = await headers();
  const nonce = headersList.get("x-nonce") ?? "";

  const jsonLdData = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: getAppBaseUrl() },
        { "@type": "ListItem", position: 2, name: "Fiches Boss & Donjons", item: `${getAppBaseUrl()}/boss` },
      ],
    },
  ];

  return (
    <div className="relative min-h-screen w-full flex flex-col bg-zinc-950 font-sans selection:bg-amber-500/30 landing-theme text-foreground">
      <PublicHeader user={session?.user} activePage="boss" isMember={userContext.isMember} />

      <JsonLd id="json-ld-boss" nonce={nonce} data={jsonLdData} />

      <main className="flex-1 pt-28 pb-20 px-4 sm:px-6 md:px-8 relative z-10 max-w-6xl mx-auto w-full">
        {/* Navigation retour */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-zinc-100 transition-colors bg-surface/60 border border-border px-3.5 py-1.5 rounded-full backdrop-blur-md"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Accueil
          </Link>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-wider">
              ✨ 100% Gratuit · Sans Inscription
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-wider">
              <Swords className="w-3.5 h-3.5" /> Bestiaire Tactique
            </span>
          </div>
        </div>

        {/* Hero Header */}
        <div className="relative rounded-3xl bg-gradient-to-br from-amber-950/40 via-surface to-background border border-amber-500/20 p-6 sm:p-10 mb-8 overflow-hidden shadow-2xl backdrop-blur-xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none -mr-20 -mt-20" />

          <div className="relative z-10 space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/10 text-[11px] font-bold text-amber-300">
              <span>Accès libre & illimité pour tous les aventuriers</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight font-heading">
              Fiches Boss & Donjons Dofus Unity
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Consultez les caractéristiques exactes, les grilles isométriques de portée de sorts, les zones d'effet et détachez une mini-fenêtre par-dessus votre jeu Dofus pour anticiper chaque tour.
            </p>
          </div>
        </div>

        {/* Client Boss Catalog Search & Filter */}
        <PublicBossCatalogClient bosses={bosses} />
      </main>

      <GalacticFooter isMember={userContext.isMember} />
    </div>
  );
}
