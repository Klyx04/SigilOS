import { NebulaClientWrapper } from "@/components/layout/nebula-client-wrapper";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { HeroSection } from "@/components/landing/hero-section";
import { SaasFeatures } from "@/components/landing/saas-features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LandingCarousel } from "@/components/landing/landing-carousel";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPublicGuilds } from "@/server/actions/presentation-actions";
import { GuildDirectorySection } from "@/components/landing/guild-directory-section";
import { PublicHeader } from "@/components/layout/public-header";
import { ChangelogWidget } from "@/components/changelog/changelog-widget";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PreFooterCta } from "@/components/landing/pre-footer-cta";

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

          <HowItWorks />

          <div className="pb-32 relative w-full max-w-[1400px] mx-auto px-6 fade-in-up duration-1000 delay-200">
            <LandingCarousel />
          </div>

          <SaasFeatures />

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

          {/* Pre-Footer CTA */}
          <PreFooterCta />

          {/* Changelog Widget Section */}
          <div className="bg-bg-secondary border-t border-white/5 py-24 pb-32">
            <div className="container mx-auto px-6 max-w-4xl">
              <div className="text-center mb-16">
                <div className="text-accent-gold font-mono text-[10px] uppercase tracking-widest mb-4">Mises à jour</div>
                <h2 className="text-3xl font-heading text-white mb-4">Journal de Bord</h2>
                <p className="text-zinc-500 font-medium font-sans">Découvrez les dernières évolutions de l'OS.</p>
              </div>
              <ChangelogWidget />
            </div>
          </div>
        </main>

        <GalacticFooter isMember={userContext.isMember} />
      </div>
    </NebulaClientWrapper >
  );
}
