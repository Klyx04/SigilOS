import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen, Sparkles, CheckCircle2, HelpCircle } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { JsonLd } from "@/components/shared/json-ld";
import { auth } from "@/auth";
import { getAppBaseUrl } from "@/lib/utils";
import { getUserContext } from "@/server/actions/user-actions";
import { getServerI18n } from "@/lib/i18n/server";
import { ElevageStudioClient } from "./_components/ElevageStudioClient";

export const revalidate = 3600; // Cache ISR 1h

export async function generateMetadata(): Promise<Metadata> {
    const { getServerI18n } = await import("@/lib/i18n/server");
    const { t, locale } = await getServerI18n();

    const title = t.elevageStudio.metaTitle;
    const description = t.elevageStudio.metaDesc;

    return {
        title,
        description,
        alternates: {
            canonical: `${getAppBaseUrl()}/elevage`,
        },
        openGraph: {
            title: locale === "en"
                ? "Dofus Unity 3.7 Breeding Studio — Cross Calculator, Serenity & XP (100% Free)"
                : "Studio Élevage 3.7 Dofus Unity — Simulateur de Croisements, Sérénité & XP (100% Gratuit)",
            description,
            url: `${getAppBaseUrl()}/elevage`,
            images: [
                {
                    url: `${getAppBaseUrl()}/api/og?title=${encodeURIComponent("Studio Élevage Dofus Unity 3.7")}&subtitle=Simulateur%20Croisements%2C%20S%C3%A9r%C3%A9nit%C3%A9%20%26%20XP`,
                    width: 1200,
                    height: 630,
                    alt: "Studio Élevage Dofus Unity 3.7",
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
        },
    };
}

export default async function PublicElevagePage() {
    const session = await auth();
    const [userContext, { t, locale }] = await Promise.all([getUserContext(), getServerI18n()]);

    const isEn = locale === "en";

    const jsonLdData: any[] = [
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
                { "@type": "ListItem", position: 1, name: t.bossPage.backHome, item: getAppBaseUrl() },
                { "@type": "ListItem", position: 2, name: "Élevage Studio 3.7", item: `${getAppBaseUrl()}/elevage` },
            ],
        },
        {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "SigilOS Studio Élevage 3.7",
            applicationCategory: "GameApplication",
            operatingSystem: "Web",
            description: t.elevageStudio.metaDesc,
            url: `${getAppBaseUrl()}/elevage`,
            offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "EUR",
            },
        },
        {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
                {
                    "@type": "Question",
                    name: isEn
                        ? "How to calculate target generation probability in Dofus Unity 3.7?"
                        : "Comment fonctionne le calcul des probabilités de croisement sur Dofus Unity 3.7 ?",
                    acceptedAnswer: {
                        "@type": "Answer",
                        text: isEn
                            ? "The formula is: 30% Base + (Parent 1 Level × 0.15%) + (Parent 2 Level × 0.15%) + Optimakina (+20%) + Almanax Takeza (+20%). You reach 100% guaranteed target generation with an Optimakina when the sum of parents' levels reaches 334 (e.g. level 167 + level 167)."
                            : "La probabilité d'obtenir la génération cible répond à la formule : 30% (Base) + (Niveau Parent 1 × 0,15%) + (Niveau Parent 2 × 0,15%) + Optimakina (+20%) + Almanax Takeza (+20%). Le seuil 100% garanti avec Optimakina est atteint dès que le cumul des niveaux des deux parents atteint 334 (par exemple deux parents niveau 167, ou un niveau 200 et un niveau 134).",
                    },
                },
                {
                    "@type": "Question",
                    name: isEn
                        ? "How many generations exist for Dragoturkeys, Seemyools and Rhineetles?"
                        : "Combien de générations existent pour les Dragodindes, Muldos et Volkornes ?",
                    acceptedAnswer: {
                        "@type": "Answer",
                        text: isEn
                            ? "In Dofus Unity, all 3 mount families now span 10 full generations: 66 Dragoturkey coats, 82 Seemyool coats (with Gen 9 aquamarine, amber, azure, coral and Gen 10 crosses), and 80 Rhineetle coats (with Gen 9 amethyst, jade, ruby, sapphire and Gen 10 crosses)."
                            : "Dans Dofus Unity, les 3 familles de montures comportent désormais 10 générations complètes : 66 robes de Dragodindes, 82 robes de Muldos (avec les Gen 9 Aigue-marine, Ambre, Azur, Corail et leurs bicolores Gen 10) et 80 robes de Volkornes (avec les Gen 9 Améthyste, Jade, Rubis, Saphir et leurs bicolores Gen 10), récompensées par les succès en jeu (Générations aquatiques et Génération V).",
                    },
                },
                {
                    "@type": "Question",
                    name: isEn
                        ? "How to avoid serenity drift in Dofus 3.7 paddocks?"
                        : "Comment éviter la dérive de sérénité dans les enclos Dofus 3.7 ?",
                    acceptedAnswer: {
                        "@type": "Answer",
                        text: isEn
                            ? "With paddock catalysts doubled in 3.7, serenity shifts twice as fast. Use the two-step protocol: set serenity between -2,000 and -1 for endurance and maturity simultaneously, then between 0 and +2,000 for love and end of maturity. Never leave a slapper or stroker running without monitoring."
                            : "L'efficacité des carburants ayant été doublée en 3.7, la sérénité dérive 2 fois plus vite. Utilisez le protocole en 2 étapes : ajustez la sérénité entre -2 000 et -1 pour monter endurance et maturité simultanément, puis entre 0 et +2 000 pour monter amour et fin de maturité sans jamais toucher aux extrêmes.",
                    },
                },
                {
                    "@type": "Question",
                    name: isEn
                        ? "How does mount cloning work after breeding?"
                        : "Comment fonctionne le clonage des montures stériles ?",
                    acceptedAnswer: {
                        "@type": "Answer",
                        text: isEn
                            ? "Breeding makes both parents permanently sterile with immediate birth. The cloning interface lets you fuse two sterile mounts of the same breed and generation to recreate a fertile mount that keeps the exact serenity of the model mount."
                            : "L'accouplement rend les deux parents définitivement stériles lors d'une naissance immédiate. L'interface de Clonage permet de fusionner deux montures stériles de même type et même génération pour récupérer une monture fertile qui conserve la sérénité exacte de la monture modèle.",
                    },
                },
            ],
        },
    ];

    return (
        <div className="registre relative min-h-screen w-full flex flex-col bg-background font-sans selection:bg-warning/30 landing-theme text-foreground">
            <PublicHeader user={session?.user} activePage="elevage" isMember={userContext.isMember} />

            <JsonLd id="elevage-studio-jsonld" data={jsonLdData} />

            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-12">
                {/* Fil d'Ariane & Bouton retour */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>{t.bossPage.backHome}</span>
                    </Link>
                    <span>/</span>
                    <span className="text-foreground font-semibold">Élevage Studio 3.7</span>
                </div>

                {/* Composant interactif */}
                <ElevageStudioClient />

                {/* ── SECTION ÉDITORIALE SEO & FAQ (Indexable par Google Search Console) ── */}
                <section className="mt-16 pt-12 border-t border-border space-y-10">
                    <div className="max-w-3xl space-y-3">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-400">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Guide & Mécaniques Dofus Unity 3.7</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                            {isEn
                                ? "Everything you need to master Breeding in Dofus Unity 3.7"
                                : "Tout comprendre sur l'Élevage dans Dofus Unity 3.7"}
                        </h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {isEn
                                ? "SigilOS Breeding Studio is an open-access, zero-registration interactive simulator calibrated for the Dofus 3.7 update. Find below detailed formulas and mechanics."
                                : "Le Studio Élevage SigilOS est un simulateur interactif gratuit et accessible sans compte, mis à jour pour la refonte 3.7 de Dofus Unity. Retrouvez ci-dessous le fonctionnement des formules de croisement, des enclos et des gains économiques."}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-5 rounded-2xl bg-surface/60 border border-border space-y-2.5">
                            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                <span className="text-amber-400 font-mono text-xs">01.</span>
                                <span>{isEn ? "Target Generation 100%" : "Seuil 100% Génération Cible"}</span>
                            </h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {isEn
                                    ? "Thanks to the 3.7 buff, Optimakina now provides +20% probability (up from +10%). By combining two parents whose level sum equals 334, you secure 100% target generation without needing two level 200 mounts."
                                    : "Grâce au renforcement de la MàJ 3.7, l'Optimakina injecte +20% de probabilité (au lieu de 10%). En associant deux parents dont la somme des niveaux atteint 334 (ex: 167 + 167 ou 200 + 134), vous garantissez la génération cible à 100% sans gaspiller de carburant."}
                            </p>
                        </div>

                        <div className="p-5 rounded-2xl bg-surface/60 border border-border space-y-2.5">
                            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                <span className="text-cyan-400 font-mono text-xs">02.</span>
                                <span>{isEn ? "Serenity Anti-Drift" : "Anti-Dérive de Sérénité"}</span>
                            </h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {isEn
                                    ? "Paddock catalyst throughput is doubled in 3.7 (6,000 pts / 200,000 max). Our studio calculates exact timing so your mounts never drift beyond required mood windows."
                                    : "Le débit des carburants en enclos étant doublé (6 000 pts / 200 000 max), la sérénité franchit la fenêtre neutre en quelques dizaines de minutes. Suivez notre protocole en 2 étapes pour monter endurance et amour sans dérive."}
                            </p>
                        </div>

                        <div className="p-5 rounded-2xl bg-surface/60 border border-border space-y-2.5">
                            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                <span className="text-emerald-400 font-mono text-xs">03.</span>
                                <span>{isEn ? "10 Full Generations" : "3 Familles, 10 Générations"}</span>
                            </h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {isEn
                                    ? "Dragoturkeys (66 coats), Seemyools (82 coats) and Rhineetles (80 coats) all possess 10 full generations with dedicated in-game achievements (Aquatic Generations & Generation V)."
                                    : "Dragodindes (66 robes), Muldos (82 robes) et Volkornes (80 robes) possèdent chacun 10 générations complètes avec leurs succès in-game associés (Générations aquatiques et Génération V)."}
                            </p>
                        </div>
                    </div>

                    {/* FAQ Accordion / Cards */}
                    <div className="space-y-4 pt-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                <HelpCircle className="w-5 h-5 text-amber-400" />
                                <span>{isEn ? "Frequently Asked Questions" : "Foire Aux Questions Élevage"}</span>
                            </h3>
                            <Link
                                href="/guides/guide-elevage-enclos-guilde-dofus"
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                            >
                                <BookOpen className="w-3.5 h-3.5" />
                                <span>{isEn ? "Read the Complete Guide" : "Consulter le guide complet"}</span>
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl bg-surface/40 border border-border space-y-2">
                                <strong className="text-xs text-foreground block">
                                    {isEn
                                        ? "How does immediate breeding and sterility work?"
                                        : "Comment fonctionnent la naissance immédiate et la stérilité ?"}
                                </strong>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {isEn
                                        ? "Since Dofus 3.5, gestation delays have been removed. Breeding produces an immediate newborn, and both parents instantly become sterile. You can recycle two sterile mounts of the same type via the Cloning interface."
                                        : "Depuis la refonte 3.5, les temps de gestation de plusieurs jours sont supprimés. L'accouplement fait naître le bébé immédiatement, et les deux parents deviennent stériles. Vous pouvez ensuite recycler deux stériles de même type et même génération via le clonage pour récupérer une monture fertile."}
                                </p>
                            </div>

                            <div className="p-4 rounded-xl bg-surface/40 border border-border space-y-2">
                                <strong className="text-xs text-foreground block">
                                    {isEn
                                        ? "What is the cloning serenity trick?"
                                        : "Quelle est l'astuce de sérénité lors du clonage ?"}
                                </strong>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {isEn
                                        ? "In update 3.7, the cloned fertile mount preserves the exact serenity value of the model mount. Calibrating your model in the neutral zone saves precious hours of strokers/slappers."
                                        : "En 3.7, la monture fertile issue du clonage conserve la sérénité exacte de la monture modèle. Si votre modèle était déjà calé en zone neutre, la nouvelle fertile peut être directement placée en abreuvoir/foudroyeur sans aucun détour par un caresseur."}
                                </p>
                            </div>

                            <div className="p-4 rounded-xl bg-surface/40 border border-border space-y-2">
                                <strong className="text-xs text-foreground block">
                                    {isEn
                                        ? "How to earn Genetons in 3.7?"
                                        : "Comment obtenir un maximum de Génétons ?"}
                                </strong>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {isEn
                                        ? "Genetons are awarded when a newborn surpasses all ancestors in both parents' family trees. Gains scale up to 500 genetons for Gen 9 and 10, exchangeable for stat scrolls and tourmalines."
                                        : "Un accouplement rapporte des Génétons uniquement si le bébé dépasse toutes les montures des arbres généalogiques des deux parents. Les gains atteignent 500 génétons en Gen 9 et 10, échangeables en [-18, 1] auprès d'Eugène Éton contre des parchemins et tourmalines."}
                                </p>
                            </div>

                            <div className="p-4 rounded-xl bg-surface/40 border border-border space-y-2">
                                <strong className="text-xs text-foreground block">
                                    {isEn
                                        ? "How long to level a mount to 200 in paddocks?"
                                        : "Combien de temps faut-il pour monter une monture niveau 200 ?"}
                                </strong>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {isEn
                                        ? "Reaching level 200 requires 867,582 XP via the Manger paddock. In Tier 4 (Elixir, 40 XP/10s), it takes ~60 hours (~2.5 days), or only ~30 hours with the Wise (Sage) genetic trait."
                                        : "Une monture requiert 867 582 XP en mangeoire pour atteindre le niveau 200. Avec un carburant Tier 4 (Élixir, 40 XP / 10s), il faut environ 60 heures (~2,5 jours), et seulement ~30 heures chrono si la monture possède la capacité génétique Sage (XP doublée) !"}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <GalacticFooter />
        </div>
    );
}
