import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAppBaseUrl } from "@/lib/utils";
import { LANDING_FAQ } from "@/lib/landing-faq";
import { findPublicScreen, firstPublicScreen } from "@/lib/landing-utils";
import { getPublicGuildShowcase } from "@/server/actions/presentation-actions";
import { getPublicLandingScreens } from "@/server/actions/landing-screen-actions";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { JsonLd } from "@/components/shared/json-ld";
import { LandingHero } from "@/components/landing/registre/hero";
import { LandingTools } from "@/components/landing/registre/tools";
import { LandingWorkflow } from "@/components/landing/registre/workflow";
import { LandingGuide } from "@/components/landing/registre/guide";
import { LandingProof } from "@/components/landing/registre/proof";
import { LandingSetup } from "@/components/landing/registre/setup";

/**
 * Landing publique — refonte « registre » (anti-AI-slop).
 *
 * Six blocs, dans l'ordre du parcours visiteur :
 *   1. Hero 5/7 — ce que c'est, pour qui, une seule action principale.
 *   2. Outils ouverts — quatre raccourcis, accessibles sans compte.
 *   3. Une sortie de bout en bout — le vrai enchaînement Discord → SigilOS.
 *   4. Le guide en jeu — les captures produit du God, légendées.
 *   5. Preuve communautaire — la guilde réelle, ses chiffres, son journal.
 *   6. Mise en route + questions utiles.
 *
 * Ont disparu : le bento marketing, le tableau « sans / avec », les trois
 * piliers, la séquence 01/02/03 en cartes, la preuve sociale au pluriel et la
 * capsule de pied de page flottante.
 */

export const revalidate = 3600; // ISR 1h — page d'accueil publique (contenu stable), accéléra le chargement & le SEO

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
      "description":
        "SigilOS est le tableau de bord d'une guilde Dofus relié à Discord : sorties, quêtes, membres et progression au même endroit.",
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
      // Balisage aligné sur la FAQ réellement affichée (source : src/lib/landing-faq.ts).
      "@type": "FAQPage",
      "mainEntity": LANDING_FAQ.map((item) => ({
        "@type": "Question",
        "name": item.q,
        "acceptedAnswer": { "@type": "Answer", "text": item.a },
      })),
    },
  ],
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);

  const { getUserContext } = await import("@/server/actions/user-actions");
  const userContext = await getUserContext();

  const authError = typeof params?.error === "string" ? params.error : undefined;
  if (authError) {
    redirect(`/auth/error?error=${authError}`);
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

  // Données réelles de la page : guilde(s) publique(s) + captures pilotées par le God (#140).
  const [showcaseGuilds, productScreensRes, heroScreensRes] = await Promise.all([
    getPublicGuildShowcase(6),
    getPublicLandingScreens("product-story"),
    getPublicLandingScreens("hero"),
  ]);

  const productScreens = productScreensRes.success && productScreensRes.data ? productScreensRes.data : [];
  const heroScreens = heroScreensRes.success && heroScreensRes.data ? heroScreensRes.data : [];

  const heroScreen = firstPublicScreen(heroScreens[0]);
  const workflowScreen = findPublicScreen(productScreens, /sortie|groupe|event|événement|calendrier/i);
  const topGuild =
    [...showcaseGuilds].sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0))[0] ?? null;

  const clientId = process.env.DISCORD_CLIENT_ID || process.env.AUTH_DISCORD_ID || "";
  const { getPlatformConfig } = await import("@/server/actions/god-roadmap-actions");
  const platformRes = await getPlatformConfig().catch(() => null);
  const autoOnboardingOn =
    (platformRes?.success ? (platformRes.data as { autoOnboardingEnabled?: boolean } | undefined)?.autoOnboardingEnabled : undefined) !==
    false;

  // [AUDIT 2026] Retrieve nonce for inline scripts
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") ?? "";

  return (
    <>
      <JsonLd id="json-ld" nonce={nonce} data={jsonLd} />

      <div className="registre min-h-screen bg-background text-foreground flex flex-col overflow-x-hidden">
        <a className="reg-skip" href="#contenu">
          Aller au contenu
        </a>

        <PublicHeader user={session?.user} variant="hero" isMember={userContext.isMember} />

        <main id="contenu" className="flex-1 w-full">
          <LandingHero
            screen={heroScreen}
            guild={topGuild}
            clientId={clientId}
            autoOnboardingOn={autoOnboardingOn}
          />

          <LandingTools />

          <LandingWorkflow screen={workflowScreen} />

          <LandingGuide screens={productScreens} />

          <LandingProof guilds={showcaseGuilds} />

          <LandingSetup clientId={clientId} autoOnboardingOn={autoOnboardingOn} />
        </main>

        <GalacticFooter isMember={userContext.isMember} />
      </div>
    </>
  );
}
