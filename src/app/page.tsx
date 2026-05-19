import { NebulaClientWrapper } from "@/components/layout/nebula-client-wrapper";
import Script from "next/script";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { HeroSection } from "@/components/landing/hero-section";
import { SaasFeatures } from "@/components/landing/saas-features";

import { LandingCarousel } from "@/components/landing/landing-carousel";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPublicGuilds } from "@/server/actions/presentation-actions";
import { GuildDirectorySection } from "@/components/landing/guild-directory-section";
import { PublicHeader } from "@/components/layout/public-header";
import { Check, Minus } from "lucide-react";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "SigilOS",
  "applicationCategory": "GameApplication",
  "operatingSystem": "Web",
  "url": "https://sigilos.fr",
  "description": "Le meilleur outil de gestion de guilde Dofus : quêtes, Songes Infinis, Dungeon Finder, Ladder XP et bot Discord.",
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
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [session, info] = await Promise.all([auth(), searchParams]);

  const { getUserContext, getUserGuilds } = await import("@/server/actions/user-actions");

  // All three are independent \u2014 run concurrently
  const [guilds, userContext, userGuilds] = await Promise.all([
    getPublicGuilds(),
    getUserContext(),
    session?.user ? getUserGuilds() : Promise.resolve([]),
  ]);

  if (info.error) {
    redirect(`/auth/error?error=${info.error}`);
  }

  // [AUDIT 2026] Retrieve nonce for inline scripts
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') ?? '';

  const COMPARISON_DATA = [
    { feature: "Cockpit de Guilde Unifié", sigilos: true, others: "Fragmenté" },
    { feature: "Intégration Discord Native", sigilos: true, others: "Basique" },
    { feature: "Missions & Suivi Hebdo", sigilos: true, others: "Manuel" },
    { feature: "Sync. Metamob (Ocre)", sigilos: true, others: "Externe" },
    { feature: "Tracking Avis & Archis", sigilos: true, others: "Discord" },
    { feature: "Dungeon Finder (LFG)", sigilos: true, others: "In-game" },
    { feature: "Annuaire Public Premium", sigilos: true, others: "Basique" },
    { feature: "Stats & Ladder Temps Réel", sigilos: true, others: "Officiel (Lent)" },
  ];

  return (
    <NebulaClientWrapper>
      <Script
        id="json-ld"
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen landing-theme bg-background text-foreground selection:bg-emerald-500/30 font-sans flex flex-col overflow-x-hidden">

        <PublicHeader user={session?.user} variant="hero" isMember={userContext.isMember} />

        <main className="flex-1 w-full relative z-10 flex flex-col">

          <HeroSection user={session?.user} userGuilds={userGuilds} />

          {/* Screenshot Carousel Section */}
          <section className="pb-32 relative w-full max-w-[1400px] mx-auto px-6">
            <div className="text-center mb-16 opacity-0 animate-[fade-in_1s_ease-out_forwards]">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-5 font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
                Aperçu de l&apos;interface
              </div>
              <h2 className="text-3xl md:text-5xl font-heading text-foreground mb-4">
                L&apos;ergonomie d&apos;un <span className="text-emerald-600 dark:text-emerald-400 italic font-black">triple A.</span>
              </h2>
              <p className="text-zinc-500 text-base font-medium max-w-lg mx-auto">
                SigilOS redéfinit les standards de l&apos;interface utilisateur pour le gaming web.
              </p>
            </div>
            <LandingCarousel />
          </section>

          <SaasFeatures />

          {/* Premium Comparison Section */}
          <section className="py-32 bg-background relative overflow-hidden border-t border-white/5">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/[0.02] to-transparent" />

            <div className="container px-6 mx-auto relative z-10 font-sans">
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-16">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6 font-mono text-[10px] text-amber-500 uppercase tracking-widest">
                    Performance Comparée
                  </div>
                  <h2 className="text-4xl md:text-5xl font-heading text-foreground mb-6 leading-tight">
                    Plus qu&apos;un outil, <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-amber-600 dark:from-emerald-400 dark:to-amber-200 font-black italic">votre avantage compétitif.</span>
                  </h2>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {/* Table Header - Desktop Only */}
                  <div className="hidden md:flex items-center px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                    <div className="flex-1">Fonctionnalité</div>
                    <div className="w-32 text-center">Autres Outils</div>
                    <div className="w-32 text-center text-emerald-500">SigilOS</div>
                  </div>

                  {COMPARISON_DATA.map((row, i) => (
                    <div
                      key={i}
                      className="group flex flex-col md:flex-row items-center gap-4 p-6 rounded-2xl bg-foreground/[0.03] border border-border hover:border-emerald-500/20 transition-all duration-300 hover:bg-foreground/[0.05]"
                    >
                      <div className="flex-1 text-foreground font-black text-base md:text-lg italic uppercase tracking-tighter">{row.feature}</div>

                      <div className="flex items-center gap-8 w-full md:w-auto">
                        {/* Others Column */}
                        <div className="flex-1 md:w-32 flex flex-col items-center gap-1">
                          <span className="text-[9px] font-black text-zinc-600 uppercase tracking-wider md:hidden mb-2">Autres</span>
                          <div className="flex items-center gap-2 text-zinc-600">
                            {row.others === ("false" as any) ? (
                              <Minus className="w-5 h-5 opacity-40" />
                            ) : (
                              <span className="text-xs font-black opacity-60 uppercase tracking-tighter">{row.others}</span>
                            )}
                          </div>
                        </div>

                        {/* SigilOS Column */}
                        <div className="flex-1 md:w-32 flex flex-col items-center gap-1">
                          <span className="text-[9px] font-black text-emerald-500/50 uppercase tracking-wider md:hidden mb-2">SigilOS</span>
                          <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)] group-hover:scale-110 transition-transform">
                            <Check className="w-6 h-6" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Guild Directory Section with Premium Look */}
          <section className="bg-zinc-950 py-32 border-t border-white/5 relative overflow-hidden">
            {/* Ambient gold glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-amber-500/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="container mx-auto px-6 relative z-10">
              <div className="max-w-4xl mx-auto text-center mb-20">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6 font-mono text-[10px] text-emerald-400 uppercase tracking-widest">
                  Annuaire SigilOS
                </div>
                <h2 className="text-4xl md:text-6xl font-heading text-foreground mb-6">L&apos;élite des guildes <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-amber-400 dark:from-amber-200 dark:to-amber-500 italic font-black">réunie.</span></h2>
                <p className="text-zinc-500 font-medium text-lg max-w-2xl mx-auto leading-relaxed">
                  L&apos;annuaire SigilOS n&apos;est pas qu&apos;une liste. C&apos;est la vitrine premium des organisations les plus sérieuses de Dofus Unity.
                </p>
              </div>

              <GuildDirectorySection guilds={guilds} />
            </div>
          </section>

        </main>

        <GalacticFooter isMember={userContext.isMember} />
      </div>
    </NebulaClientWrapper >
  );
}
