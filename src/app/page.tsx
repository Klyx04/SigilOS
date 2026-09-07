import { NebulaClientWrapper } from "@/components/layout/nebula-client-wrapper";
import Script from "next/script";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { DofusHeroSection } from "@/components/landing/dofus-hero-section";
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
import { ToolsBentoShowcase } from "@/components/landing/tools-bento-showcase";
import { FaqSection } from "@/components/landing/faq-section";
import { PreFooterCta } from "@/components/landing/pre-footer-cta";
import { getPublicLandingScreens } from "@/server/actions/landing-screen-actions";
import { getAppBaseUrl } from "@/lib/utils";

export const revalidate = 3600; // ISR 1h — page d'accueil publique (contenu stable), accélère le chargement & la performance SEO

const baseUrl = getAppBaseUrl();

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "SigilOS",
      "applicationCategory": "GameApplication",
      "operatingSystem": "Web",
      "url": baseUrl,
      "description": "SigilOS réunit quêtes, sorties, membres et progression Dofus dans un espace partagé, relié à Discord. Gratuit pour les guildes.",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "EUR",
      },
      "creator": {
        "@type": "Organization",
        "name": "SigilOS",
        "url": baseUrl,
      },
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Comment se connecter à SigilOS ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Uniquement via votre compte Discord (OAuth2). Il n'existe ni compte ni mot de passe SigilOS : vous vous connectez à Discord, puis vous accédez aux guildes où vous êtes membre ou administrateur."
          }
        },
        {
          "@type": "Question",
          "name": "Combien ça coûte ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "C'est 100% gratuit et sans publicité pour toutes les guildes Dofus."
          }
        },
        {
          "@type": "Question",
          "name": "Comment créer l'espace de ma guilde ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Si vous êtes administrateur Discord de votre serveur de guilde, vous pouvez installer SigilOS immédiatement en autonomie en 1 clic. Un accompagnement manuel par ticket Discord reste également disponible."
          }
        },
        {
          "@type": "Question",
          "name": "Demandez-vous mon mot de passe Ankama ou mon e-mail ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Non, jamais. Vous connectez uniquement votre compte Discord. SigilOS ne demande aucun mot de passe de jeu et ne collecte aucune adresse e-mail."
          }
        },
        {
          "@type": "Question",
          "name": "Comment intégrer les archimonstres (Ocre) ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Ajoutez votre pseudo Dofus et votre clé API Metamob en lecture seule. SigilOS synchronise vos captures pour que toute la guilde s'entraide sur la quête du Dofus Ocre."
          }
        }
      ]
    }
  ]
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

  // 🖼️ #140 — screens de la landing pilotés par le God (fallback captures par défaut)
  const [productScreensRes, heroScreensRes] = await Promise.all([
      getPublicLandingScreens("product-story"),
      getPublicLandingScreens("hero"),
  ]);
  const productScreens = (productScreensRes.success && productScreensRes.data) ? productScreensRes.data : [];
  const heroScreens = (heroScreensRes.success && heroScreensRes.data) ? heroScreensRes.data : [];
  const heroImageUrl = heroScreens[0]?.imageUrl;

  if (info.error) {
    redirect(`/auth/error?error=${info.error}`);
  }

  // Un membre connecté disposant d'au moins une guilde accessible ou éligible au déploiement
  // est aiguillé directement vers son QG / dashboard.
  if (session?.user) {
    const { getGuildsSeparated } = await import("@/server/actions/user-actions");
    const separated = await getGuildsSeparated();
    if (separated.active.length > 0 || separated.pending.length > 0) {
      redirect("/dashboard");
    }
  }

  const clientId = process.env.DISCORD_CLIENT_ID || process.env.AUTH_DISCORD_ID || "";
  const { getPlatformConfig } = await import("@/server/actions/god-roadmap-actions");
  const platformRes = await getPlatformConfig().catch(() => null);
  const autoOnboardingOn =
    (platformRes?.success ? (platformRes.data as any)?.autoOnboardingEnabled : undefined) !== false;

  // [AUDIT 2026] Retrieve nonce for inline scripts
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') ?? '';

  return (
    <NebulaClientWrapper>
      <Script
        id="json-ld"
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="min-h-screen landing-theme bg-background text-foreground selection:bg-success/30 font-sans flex flex-col overflow-x-hidden">

        <PublicHeader user={session?.user} variant="hero" isMember={userContext.isMember} />

        <main className="flex-1 w-full relative z-10 flex flex-col">

          {/* Hero — Dofus Unity Immersive */}
          <DofusHeroSection user={session?.user} userGuilds={userGuilds} clientId={clientId} autoOnboardingOn={autoOnboardingOn} />

          {/* Outils & Overlay Compagnon Bento Showcase (Gratuit / Sans Inscription) */}
          <ToolsBentoShowcase />

          {/* Problème / solution */}
          <ProblemSolution />

          {/* Démo produit narrative */}
          <ProductStory screens={productScreens} />

          {/* Showcase mini-dashboards par guilde (landing v3) */}
          {showcaseGuilds.length > 0 && <GuildShowcaseSection guilds={showcaseGuilds} />}

          {/* Trois piliers */}
          <ThreePillars />

          {/* Comment ça marche */}
          <HowItWorks />

          {/* FAQ courte — rassure avant le CTA final, renvoie vers /legal/faq */}
          <FaqSection />

          {/* CTA final */}
          <PreFooterCta />

        </main>

        {/* Floating pill footer — compact, moderne */}
        <GalacticFooter variant="compact" isMember={userContext.isMember} />
      </div>
    </NebulaClientWrapper>
  );
}
