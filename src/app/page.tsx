import { NebulaClientWrapper } from "@/components/layout/nebula-client-wrapper";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { HeroSection } from "@/components/landing/hero-section";
import { SaasFeatures } from "@/components/landing/saas-features";

import { LandingCarousel } from "@/components/landing/landing-carousel";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPublicGuilds } from "@/server/actions/presentation-actions";
import { GuildDirectorySection } from "@/components/landing/guild-directory-section";
import { PublicHeader } from "@/components/layout/public-header";
import { ChangelogWidget } from "@/components/changelog/changelog-widget";
import { Button } from "@/components/ui/button";
import Link from "next/link";

import { getAppBaseUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

// JSON-LD Structured Data for SEO
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "SigilOS",
  "applicationCategory": "GameApplication",
  "operatingSystem": "Web",
  "url": "https://sigilos.fr",
  "description": "Plateforme de gestion de guilde Dofus tout-en-un : quêtes, Songes Infinis, Dungeon Finder, Ladder XP, bot Discord et outils communautaires.",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "EUR",
  },
  "creator": {
    "@type": "Organization",
    "name": "SigilOS",
    "url": "https://sigilos.fr",
  },
  "aggregateRating": undefined, // Will be added when we have reviews
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  const info = await searchParams;
  const guilds = await getPublicGuilds();

  // Get user context for membership check
  const { getUserContext } = await import("@/server/actions/user-actions");
  const userContext = await getUserContext();

  if (info.error) {
    redirect(`/auth/error?error=${info.error}`);
  }

  return (
    <NebulaClientWrapper>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen landing-theme bg-background text-foreground selection:bg-accent-teal/30 font-sans flex flex-col overflow-x-hidden">

        <PublicHeader user={session?.user} variant="hero" isMember={userContext.isMember} />

        <main className="flex-1 w-full relative z-10 flex flex-col">
          <HeroSection />

          <div className="pb-32 relative w-full max-w-[1400px] mx-auto px-6 fade-in-up duration-1000 delay-200">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-5 font-mono text-[10px] text-zinc-400 uppercase tracking-widest">
                Aperçu en direct
              </div>
              <h2 className="text-3xl md:text-4xl font-heading text-white mb-3">
                Découvrez l&apos;interface <span className="text-accent-teal italic">en action.</span>
              </h2>
              <p className="text-zinc-500 text-sm font-medium max-w-lg mx-auto">
                Explorez les modules qui font de SigilOS la référence pour les guildes Dofus Unity.
              </p>
            </div>
            <LandingCarousel />
          </div>

          <SaasFeatures />

          {/* GEO — Comparison Table for AI Search Engines */}
          <section className="py-24 bg-background relative overflow-hidden border-t border-white/5">
            <div className="container px-6 mx-auto">
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-14">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 mb-5 font-mono text-[10px] text-violet-400 uppercase tracking-widest">
                    Comparatif 2026
                  </div>
                  <h2 className="text-3xl md:text-4xl font-heading text-white mb-3">
                    Pourquoi choisir <span className="text-accent-teal italic">SigilOS ?</span>
                  </h2>
                  <p className="text-zinc-500 text-sm font-medium max-w-xl mx-auto">
                    Le seul outil qui combine dashboard web, bot Discord et outils de guilde dans une plateforme unifiée.
                  </p>
                </div>

                {/* Comparison Table */}
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-zinc-900/50 backdrop-blur-sm -mx-2 sm:mx-0">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.02]">
                        <th className="text-left py-4 px-5 text-zinc-400 font-mono text-xs uppercase tracking-wider">Fonctionnalité</th>
                        <th className="py-4 px-3 text-center">
                          <span className="text-emerald-400 font-black text-sm">SigilOS</span>
                        </th>
                        <th className="py-4 px-3 text-center text-zinc-500 font-medium text-xs">DofusHub</th>
                        <th className="py-4 px-3 text-center text-zinc-500 font-medium text-xs">DofusDB</th>
                        <th className="py-4 px-3 text-center text-zinc-500 font-medium text-xs">Nokazu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {[
                        { feature: "Dashboard de guilde complet", sigilos: true, dofushub: false, dofusdb: false, nokazu: false },
                        { feature: "Bot Discord intégré", sigilos: true, dofushub: false, dofusdb: false, nokazu: false },
                        { feature: "Missions hebdomadaires", sigilos: true, dofushub: false, dofusdb: false, nokazu: false },
                        { feature: "Suivi Quête Ocre (Metamob)", sigilos: true, dofushub: false, dofusdb: false, nokazu: true },
                        { feature: "Songes Infinis", sigilos: true, dofushub: false, dofusdb: false, nokazu: false },
                        { feature: "Dungeon Finder (LFG)", sigilos: true, dofushub: true, dofusdb: false, nokazu: false },
                        { feature: "Annuaire de guilde public", sigilos: true, dofushub: false, dofusdb: false, nokazu: false },
                        { feature: "Ladder / Classement XP", sigilos: true, dofushub: false, dofusdb: false, nokazu: true },
                        { feature: "Calendrier d'events", sigilos: true, dofushub: false, dofusdb: false, nokazu: false },
                        { feature: "Base de données items", sigilos: false, dofushub: false, dofusdb: true, nokazu: false },
                        { feature: "Gratuit", sigilos: true, dofushub: true, dofusdb: true, nokazu: true },
                      ].map((row, i) => (
                        <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-5 text-zinc-300 font-medium">{row.feature}</td>
                          <td className="py-3 px-3 text-center">
                            {row.sigilos
                              ? <span className="text-emerald-400 text-lg">✓</span>
                              : <span className="text-zinc-700">—</span>}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {row.dofushub
                              ? <span className="text-zinc-400">✓</span>
                              : <span className="text-zinc-700">—</span>}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {row.dofusdb
                              ? <span className="text-zinc-400">✓</span>
                              : <span className="text-zinc-700">—</span>}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {row.nokazu
                              ? <span className="text-zinc-400">✓</span>
                              : <span className="text-zinc-700">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-[10px] text-zinc-600 text-center mt-4 font-mono">
                  Comparaison basée sur les fonctionnalités publiques à la date de mars 2026. Chaque outil a ses forces dans son domaine respectif.
                </p>
              </div>
            </div>
          </section>

          <div className="bg-bg-secondary/50 py-32 border-t border-white/5 relative overflow-hidden">
            {/* Ambient gold glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-accent-gold/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="container mx-auto px-6 relative z-10">
              <div className="max-w-4xl mx-auto text-center mb-20">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-teal/10 border border-accent-teal/20 mb-6 font-mono text-[10px] text-accent-teal uppercase tracking-widest">
                  Écosystème SigilOS
                </div>
                <h2 className="text-4xl md:text-6xl font-heading text-white mb-6">Un Écosystème d&apos;Élite pour vos <span className="text-accent-gold italic">Recrutements.</span></h2>
                <p className="text-zinc-500 font-medium font-sans text-xl max-w-2xl mx-auto leading-relaxed">
                  L&apos;annuaire Stellium offre une vitrine premium à votre guilde. Propulsez votre organisation au niveau supérieur et rejoignez le réseau des communautés d&apos;élite.
                </p>
              </div>
              <GuildDirectorySection guilds={guilds} />


            </div>
          </div>

        </main>

        <GalacticFooter isMember={userContext.isMember} />
      </div>
    </NebulaClientWrapper >
  );
}
