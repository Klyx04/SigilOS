import { NebulaClientWrapper } from "@/components/layout/nebula-client-wrapper";
import Script from "next/script";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { HeroSection } from "@/components/landing/hero-section";
import { ProblemSolution } from "@/components/landing/problem-solution";
import { ProductStory } from "@/components/landing/product-story";
import { ThreePillars } from "@/components/landing/three-pillars";
import { auth } from "@/auth";
import { getPublicGuildShowcase } from "@/server/actions/presentation-actions";
import { GuildShowcaseSection } from "@/components/landing/guild-showcase-section";
import { PublicHeader } from "@/components/layout/public-header";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { HowItWorks } from "@/components/landing/how-it-works";
import { PreFooterCta } from "@/components/landing/pre-footer-cta";

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

  const [userContext, userGuilds] = await Promise.all([
    getUserContext(),
    session?.user ? getUserGuilds() : Promise.resolve([]),
  ]);

  // Landing v3 — showcase mini-dashboards par guilde (stats réelles, cache Redis 5 min)
  const showcaseGuilds = await getPublicGuildShowcase(6);

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

          {/* Hero */}
          <HeroSection user={session?.user} userGuilds={userGuilds} />

          {/* Problème / solution */}
          <ProblemSolution />

          {/* Démo produit narrative */}
          <ProductStory />

          {/* Showcase mini-dashboards par guilde (landing v3) */}
          {showcaseGuilds.length > 0 && <GuildShowcaseSection guilds={showcaseGuilds} />}

          {/* Trois piliers */}
          <ThreePillars />

          {/* Comment ça marche */}
          <HowItWorks />

          {/* CTA final */}
          <PreFooterCta />

        </main>

        {/* Floating pill footer — compact, moderne */}
        <GalacticFooter variant="compact" isMember={userContext.isMember} />
      </div>
    </NebulaClientWrapper>
  );
}
