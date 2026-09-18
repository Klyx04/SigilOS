import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAppBaseUrl } from "@/lib/utils";
import { getPublicGuildShowcase } from "@/server/actions/presentation-actions";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { JsonLd } from "@/components/shared/json-ld";
import { LandingHero } from "@/components/landing/registre/hero";
import { LandingTools } from "@/components/landing/registre/tools";
import { LandingWorkflow } from "@/components/landing/registre/workflow";
import { LandingGuide } from "@/components/landing/registre/guide";
import { LandingProof } from "@/components/landing/registre/proof";
import { LandingSetup } from "@/components/landing/registre/setup";
import { getServerI18n } from "@/lib/i18n/server";

export const revalidate = 3600; // ISR 1h — page d'accueil publique (contenu stable), accéléra le chargement & le SEO

const baseUrl = getAppBaseUrl();

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  const { t, locale } = await getServerI18n();

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

  const showcaseGuilds = await getPublicGuildShowcase(6);

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
          locale === "en"
            ? "SigilOS is a Dofus guild dashboard connected to Discord: outings, quests, roster, and progress in one place."
            : "SigilOS est le tableau de bord d'une guilde Dofus relié à Discord : sorties, quêtes, membres et progression au même endroit.",
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
        "mainEntity": t.landing.faqItems.map((item) => ({
          "@type": "Question",
          "name": item.q,
          "acceptedAnswer": { "@type": "Answer", "text": item.a },
        })),
      },
    ],
  };

  return (
    <>
      <JsonLd id="json-ld" nonce={nonce} data={jsonLd} />

      <div className="registre min-h-screen bg-background text-foreground flex flex-col overflow-x-hidden">
        <a className="reg-skip" href="#contenu">
          {t.nav.skipToContent}
        </a>

        <PublicHeader user={session?.user} variant="hero" isMember={userContext.isMember} />

        <main id="contenu" className="flex-1 w-full">
          <LandingHero guild={topGuild} clientId={clientId} autoOnboardingOn={autoOnboardingOn} />

          <LandingTools />

          <LandingWorkflow />

          <LandingGuide />

          <LandingProof guilds={showcaseGuilds} />

          <LandingSetup clientId={clientId} autoOnboardingOn={autoOnboardingOn} />
        </main>

        <GalacticFooter isMember={userContext.isMember} />
      </div>
    </>
  );
}
