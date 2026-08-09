import { NebulaClientWrapper } from "@/components/layout/nebula-client-wrapper";
import Script from "next/script";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { HeroSection } from "@/components/landing/hero-section";
import { LandingCarousel } from "@/components/landing/landing-carousel";
import { auth } from "@/auth";
import { getPublicGuilds } from "@/server/actions/presentation-actions";
import { GuildDirectorySection } from "@/components/landing/guild-directory-section";
import { PublicHeader } from "@/components/layout/public-header";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const revalidate = 3600; // ISR 1h — page d'accueil publique (contenu stable), accélère le chargement & la performance SEO

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

  const [guilds, userContext, userGuilds] = await Promise.all([
    getPublicGuilds(),
    getUserContext(),
    session?.user ? getUserGuilds() : Promise.resolve([]),
  ]);

  if (info.error) {
    redirect(`/auth/error?error=${info.error}`);
  }

  // Un membre connecté disposant d'au moins une guilde accessible est aiguillé
  // directement vers son QG (le portail /dashboard redirige déjà seul vers la
  // 1ʳᵉ guilde s'il n'y en a qu'une). Évite de rester bloqué sur la landing
  // après le login ("je ne peux pas entrer direct"). Les non-connectés et les
  // membres sans guilde accessible voient toujours la page d'accueil publique.
  if (session?.user) {
    const { getGuildsSeparated } = await import("@/server/actions/user-actions");
    const separated = await getGuildsSeparated();
    if (separated.active.length > 0) {
      redirect("/dashboard");
    }
  }

  // [AUDIT 2026] Retrieve nonce for inline scripts
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') ?? '';

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

          {/* H1 SSR statique pour le SEO (le H1 client animé est masqué via aria-hidden dans HeroSection) */}
          <h1 className="sr-only">
            {session?.user
              ? "Prenez les commandes de votre empire Dofus"
              : "L'outil de gestion n°1 pour votre guilde Dofus"}
          </h1>

          {/* Hero */}
          <HeroSection user={session?.user} userGuilds={userGuilds} />

          {/* Screenshots */}
          <section className="py-16 relative w-full max-w-[1400px] mx-auto px-6">
            <LandingCarousel />
          </section>

          {/* Guild Directory Teaser */}
          <section className="py-20 border-t border-white/5 relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-amber-500/[0.03] blur-[120px] rounded-full pointer-events-none" />
            <div className="container mx-auto px-6 relative z-10">
              <div className="max-w-4xl mx-auto text-center mb-14">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 mb-5 font-mono text-[10px] text-amber-400 uppercase tracking-widest">
                  Annuaire SigilOS
                </div>
                <h2 className="text-3xl md:text-5xl font-heading text-foreground mb-4">
                  Les guildes qui font{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200 italic font-black">
                    référence.
                  </span>
                </h2>
                <p className="text-zinc-500 font-medium text-base max-w-lg mx-auto">
                  Découvrez les organisations qui utilisent SigilOS pour dominer Dofus Unity.
                </p>
              </div>
              <GuildDirectorySection guilds={guilds} />
            </div>
          </section>

        </main>

        {/* Floating pill footer — compact, moderne */}
        <GalacticFooter variant="compact" isMember={userContext.isMember} />
      </div>
    </NebulaClientWrapper>
  );
}
