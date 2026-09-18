import { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, ShieldCheck } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { JsonLd } from "@/components/shared/json-ld";
import { auth } from "@/auth";
import { getAppBaseUrl } from "@/lib/utils";
import { getPublicGuideDetail } from "@/server/actions/optimized-guide-actions";
import { PublicRushGuideClient } from "./_components/PublicRushGuideClient";
import { getServerI18n } from "@/lib/i18n/server";

export const revalidate = 3600; // Cache ISR 1h pour indexation Google rapide

export const metadata: Metadata = {
  title: "Guide Rush Sylvestre Dofus Unity : Quêtes, Trajets & Overlay In-Game | SigilOS",
  description:
    "Guide complet étape par étape pour obtenir le Dofus Sylvestre sur Dofus Unity. Coordonnées /travel, liste des ressources, prérequis de quêtes et Overlay In-Game détachable 100% gratuit.",
  alternates: {
    canonical: `${getAppBaseUrl()}/guides/rush-sylvestre`,
  },
  openGraph: {
    title: "Guide Rush Sylvestre Dofus Unity — Trajets & Overlay | SigilOS",
    description:
      "Obtenez le Dofus Sylvestre facilement : quêtes ordonnées, coordonnées /travel, ressources à prévoir et mini-fenêtre overlay flottante par-dessus votre jeu Dofus. 100% gratuit et sans compte requis.",
    url: `${getAppBaseUrl()}/guides/rush-sylvestre`,
    type: "article",
    images: [
      {
        url: `${getAppBaseUrl()}/api/og?title=${encodeURIComponent("Guide Rush Sylvestre Dofus")}&subtitle=${encodeURIComponent("Quêtes, Trajets & Overlay In-Game")}`,
        width: 1200,
        height: 630,
        alt: "Guide Rush Sylvestre Dofus Unity — SigilOS",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Guide Rush Sylvestre Dofus Unity — SigilOS",
    description: "Quêtes, coordonnées /travel, ressources et overlay in-game gratuit.",
    images: [`${getAppBaseUrl()}/api/og?title=${encodeURIComponent("Guide Rush Sylvestre Dofus")}&subtitle=${encodeURIComponent("Quêtes, Trajets & Overlay In-Game")}`],
  },
};

export default async function PublicRushSylvestrePage() {
  const session = await auth();
  const { getUserContext } = await import("@/server/actions/user-actions");
  const [userContext, { t, locale }] = await Promise.all([getUserContext(), getServerI18n()]);

  const guideRes = await getPublicGuideDetail("rush-sylvestre");
  if (!guideRes.success || !guideRes.guide) {
    notFound();
  }

  const guide = guideRes.guide as any;
  const milestones = guide.milestones as any[];

  // Nonce pour inline scripts de sécurité
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") ?? "";

  // Schema.org HowTo & Breadcrumbs
  const jsonLdData = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t.almanaxPage.breadcrumbHome, item: getAppBaseUrl() },
        { "@type": "ListItem", position: 2, name: t.rushGuide.breadcrumbGuides, item: `${getAppBaseUrl()}/guides` },
        {
          "@type": "ListItem",
          position: 3,
          name: t.rushGuide.breadcrumbRush,
          item: `${getAppBaseUrl()}/guides/rush-sylvestre`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: locale === "en" ? "How to obtain the Sylvan Dofus in Dofus Unity" : "Comment obtenir le Dofus Sylvestre sur Dofus Unity",
      description: locale === "en" ? "Complete step-by-step guide to complete quests and obtain the Sylvan Dofus." : "Guide complet étape par étape pour accomplir les quêtes et obtenir le Dofus Sylvestre.",
      image: `${getAppBaseUrl()}/module-dofus/Dofus_Sylvestre.png`,
      totalTime: "PT24H",
      step: milestones.slice(0, 15).map((ms, idx) => ({
        "@type": "HowToStep",
        position: idx + 1,
        name: ms.title,
        text: `Accomplir les quêtes et étapes du chapitre : ${ms.title}`,
      })),
    },
  ];

  return (
    <div className="registre min-h-screen w-full flex flex-col bg-background text-foreground">
      <PublicHeader user={session?.user} activePage="guides" isMember={userContext.isMember} />

      <JsonLd id="json-ld-rush-sylvestre" nonce={nonce} data={jsonLdData} />

      <main className="flex-1">
        <div className="reg-shell py-10 lg:py-14">
          <nav aria-label="Fil d'Ariane" className="mb-6">
            <Link href="/guides" className="reg-link-quiet text-sm">
              ← {t.rushGuide.breadcrumbGuides}
            </Link>
          </nav>

          <header className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-[62ch]">
              <p className="reg-eyebrow">
                {locale === "en" ? "Sylvan Rush · Interactive Guide" : "Rush Sylvestre · guide interactif"}
              </p>
              <h1 className="mt-3 text-[clamp(1.75rem,3.2vw,2.4rem)] font-bold leading-[1.12] tracking-tight text-foreground">
                {t.rushGuide.title}
              </h1>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                {t.rushGuide.subtitle}
              </p>
              <p className="reg-mono mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  {locale === "en" ? "~370 optimized steps" : "~370 étapes optimisées"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  {locale === "en" ? "Free · Local autosave" : "Gratuit · sauvegarde locale"}
                </span>
              </p>
            </div>

            <div className="h-24 w-24 shrink-0 sm:h-28 sm:w-28">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={guide.imageUrl || "/module-dofus/Dofus_Sylvestre.png"}
                alt="Dofus Sylvestre"
                className="h-full w-full object-contain"
                width={112}
                height={112}
              />
            </div>
          </header>

          {/* Client Interactive Guide & Overlay Launcher */}
          <div className="mt-10">
            <PublicRushGuideClient guide={guide} milestones={milestones} />
          </div>

          {/* Questions fréquentes */}
          <section aria-labelledby="faq-rush" className="mt-14 border-t border-border pt-10">
            <h2 id="faq-rush" className="reg-eyebrow">
              {locale === "en" ? "Frequently Asked Questions about Sylvan Dofus" : "Questions fréquentes sur le Dofus Sylvestre"}
            </h2>

            <div className="reg-faq mt-4">
              <details>
                <summary>
                  {locale === "en"
                    ? "How does the In-Game Overlay work?"
                    : "Comment fonctionne la mini-fenêtre Overlay en jeu ?"}
                </summary>
                <p>
                  {locale === "en"
                    ? "The In-Game Overlay opens a compact always-on-top window directly over your Dofus game. You can check off steps, view objectives, and copy /travel coordinates in 1 click without ever alt-tabbing."
                    : "L'Overlay en jeu ouvre une petite fenêtre toujours au premier plan directement par-dessus votre jeu Dofus. Vous pouvez cocher vos étapes, voir vos objectifs et copier les coordonnées /travel en 1 clic sans jamais alt-tab."}
                </p>
              </details>

              <details>
                <summary>
                  {locale === "en"
                    ? "Is my progress saved without an account?"
                    : "Ma progression est-elle sauvegardée sans compte ?"}
                </summary>
                <p>
                  {locale === "en"
                    ? "Yes. All your completed steps and markers are automatically saved in your browser's local storage. If you later connect your Discord account, you can synchronize your progress with your guild."
                    : "Oui. Toutes vos étapes cochées et vos repères sont automatiquement mémorisés dans le stockage local de votre navigateur. Si vous connectez plus tard votre compte Discord, vous pourrez synchroniser vos données avec votre guilde."}
                </p>
              </details>

              <details>
                <summary>
                  {locale === "en"
                    ? "What are the prerequisites for the Sylvan Dofus?"
                    : "Quels sont les prérequis pour le Dofus Sylvestre ?"}
                </summary>
                <p>
                  {locale === "en"
                    ? "The Sylvan Dofus requires completing a long quest series spanning Amakna, Frigost, Divine Dimensions, and the Pandala archipelago, as well as several profession crafting levels."
                    : "Le Dofus Sylvestre nécessite d'accomplir une vaste série de quêtes sur le continent d'Amakna, Frigost, les dimensions divines et l'archipel de Pandala, ainsi que certains niveaux de métiers pour confectionner des objets de quête."}
                </p>
              </details>

              <details>
                <summary>
                  {locale === "en"
                    ? "How do I use this guide with my guild?"
                    : "Comment jouer ce guide avec ma guilde ?"}
                </summary>
                <p>
                  {locale === "en"
                    ? "By creating a free guild space on SigilOS, you unlock the collective view: you can see each member's current step in real-time and coordinate dungeon groups and crafting requests."
                    : "En créant un espace de guilde gratuit sur SigilOS, vous débloquez la vue collective : vous voyez en temps réel sur quelle étape se trouve chaque membre et pouvez lancer des alertes d'entraide pour les donjons et crafts."}
                </p>
              </details>
            </div>
          </section>
        </div>
      </main>

      <GalacticFooter isMember={userContext.isMember} />
    </div>
  );
}
