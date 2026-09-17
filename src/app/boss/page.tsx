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
    <div className="registre relative min-h-screen w-full flex flex-col bg-background font-sans selection:bg-warning/30 landing-theme text-foreground">
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
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border text-muted-foreground text-xs font-medium">
              Accès libre · sans inscription
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border text-muted-foreground text-xs font-medium">
              <Swords className="w-3.5 h-3.5" /> Bestiaire tactique
            </span>
          </div>
        </div>

        {/* En-tête de section (sobre : pas de halos, pas de dégradés) */}
        <div className="rounded-xl border border-border bg-surface/40 p-5 sm:p-7 mb-6">
          <div className="space-y-2.5 max-w-2xl">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Encyclopédie des combats
            </p>
            <h1 className="text-2xl sm:text-4xl font-bold text-foreground">
              Fiches Boss & Donjons Dofus Unity
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Caractéristiques exactes, grilles de portée des sorts, lignes de vue, placements de départ et
              détachement d'une mini-fenêtre par-dessus votre jeu — de quoi préparer chaque tour.
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
