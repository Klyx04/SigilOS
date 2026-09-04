import { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles, BookOpen, Clock, ShieldCheck, HelpCircle } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { JsonLd } from "@/components/shared/json-ld";
import { auth } from "@/auth";
import { getAppBaseUrl } from "@/lib/utils";
import { getPublicGuideDetail } from "@/server/actions/optimized-guide-actions";
import { PublicRushGuideClient } from "./_components/PublicRushGuideClient";

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
  const userContext = await getUserContext();

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
        { "@type": "ListItem", position: 1, name: "Accueil", item: getAppBaseUrl() },
        { "@type": "ListItem", position: 2, name: "Guides Dofus", item: `${getAppBaseUrl()}/guides` },
        {
          "@type": "ListItem",
          position: 3,
          name: "Guide Rush Sylvestre",
          item: `${getAppBaseUrl()}/guides/rush-sylvestre`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "Comment obtenir le Dofus Sylvestre sur Dofus Unity",
      description: "Guide complet étape par étape pour accomplir les quêtes et obtenir le Dofus Sylvestre.",
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
    <div className="relative min-h-screen w-full flex flex-col bg-zinc-950 font-sans selection:bg-emerald-500/30 landing-theme text-foreground">
      <PublicHeader user={session?.user} activePage="guides" isMember={userContext.isMember} />

      <JsonLd id="json-ld-rush-sylvestre" nonce={nonce} data={jsonLdData} />

      <main className="flex-1 pt-28 pb-20 px-4 sm:px-6 md:px-8 relative z-10 max-w-6xl mx-auto w-full">
        {/* Navigation retour */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/guides"
            className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-zinc-100 transition-colors bg-surface/60 border border-border px-3.5 py-1.5 rounded-full backdrop-blur-md"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Tous les guides
          </Link>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-wider">
              ✨ 100% Gratuit · Sans Inscription
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-zinc-300 text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Guide Interactif & Overlay
            </span>
          </div>
        </div>

        {/* Hero Header */}
        <div className="relative rounded-3xl bg-gradient-to-br from-emerald-950/40 via-surface to-background border border-emerald-500/20 p-6 sm:p-10 mb-8 overflow-hidden shadow-2xl backdrop-blur-xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none -mr-20 -mt-20" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-bold text-emerald-300">
                <span>Accès libre et sans compte · Progression sauvegardée localement</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight font-heading">
                Guide Rush Sylvestre — Dofus Unity
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Le parcours le plus optimisé pour obtenir le Dofus Sylvestre : quêtes ordonnées, coordonnées /travel copiables en 1 clic et mini-fenêtre détachable toujours par-dessus votre jeu Dofus.
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Clock className="w-4 h-4 text-emerald-400" /> ~370 étapes optimisées
                </span>
                <span className="flex items-center gap-1.5 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> 100% Gratuit & Sauvegarde locale
                </span>
              </div>
            </div>

            <div className="shrink-0 w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-background/50 border border-emerald-500/30 flex items-center justify-center p-4 shadow-2xl shadow-emerald-500/10 backdrop-blur-md">
              <img
                src={guide.imageUrl || "/module-dofus/Dofus_Sylvestre.png"}
                alt="Dofus Sylvestre"
                className="w-full h-full object-contain drop-shadow-xl"
              />
            </div>
          </div>
        </div>

        {/* Client Interactive Guide & Overlay Launcher */}
        <PublicRushGuideClient guide={guide} milestones={milestones} />

        {/* Educational SEO Section */}
        <section className="mt-16 rounded-3xl border border-border bg-surface/40 p-6 sm:p-10 space-y-6">
          <h2 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2.5">
            <HelpCircle className="w-5 h-5 text-emerald-400" /> Questions Fréquentes sur le Dofus Sylvestre
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            <div className="space-y-2 rounded-2xl bg-background/50 border border-border p-5">
              <h3 className="font-bold text-foreground text-sm">Comment fonctionne la mini-fenêtre Overlay en jeu ?</h3>
              <p>
                L'Overlay en jeu ouvre une petite fenêtre toujours au premier plan directement par-dessus votre jeu Dofus. Vous pouvez cocher vos étapes, voir vos objectifs et copier les coordonnées /travel en 1 clic sans jamais alt-tab.
              </p>
            </div>

            <div className="space-y-2 rounded-2xl bg-background/50 border border-border p-5">
              <h3 className="font-bold text-foreground text-sm">Ma progression est-elle sauvegardée sans compte ?</h3>
              <p>
                Oui ! Toutes vos étapes cochées et vos repères sont automatiquement mémorisés dans le stockage local de votre navigateur. Si vous connectez plus tard votre compte Discord, vous pourrez synchroniser vos données avec votre guilde.
              </p>
            </div>

            <div className="space-y-2 rounded-2xl bg-background/50 border border-border p-5">
              <h3 className="font-bold text-foreground text-sm">Quels sont les prérequis pour le Dofus Sylvestre ?</h3>
              <p>
                Le Dofus Sylvestre nécessite d'accomplir une vaste série de quêtes sur le continent d'Amakna, Frigost, les dimensions divines et l'archipel de Pandala, ainsi que certains niveaux de métiers pour confectionner des objets de quête.
              </p>
            </div>

            <div className="space-y-2 rounded-2xl bg-background/50 border border-border p-5">
              <h3 className="font-bold text-foreground text-sm">Comment jouer ce guide avec ma guilde ?</h3>
              <p>
                En créant un espace de guilde gratuit sur SigilOS, vous débloquez la vue collective : vous voyez en temps réel sur quelle étape se trouve chaque membre et pouvez lancer des alertes d'entraide pour les donjons et crafts.
              </p>
            </div>
          </div>
        </section>
      </main>

      <GalacticFooter isMember={userContext.isMember} />
    </div>
  );
}
