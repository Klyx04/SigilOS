import { getAppBaseUrl } from "@/lib/utils";
import { Metadata } from "next";
import { headers } from "next/headers";
import { HelpCircle, ShieldCheck, Server, Lock, Fingerprint } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const metadata: Metadata = {
    title: "FAQ Dofus & Aide | SigilOS",
    description: "Questions fréquentes sur SigilOS : sécurité des données Dofus, connexion Discord, fonctionnement de l'outil de gestion de guilde, intégration Metamob et RGPD.",
    alternates: {
        canonical: `${getAppBaseUrl()}/legal/faq`,
    },
};

export default async function FAQPage() {
    // [AUDIT 2026] Retrieve nonce for inline scripts
    const headersList = await headers();
    const nonce = headersList.get('x-nonce') ?? '';

    // FAQPage structured data for Google rich snippets
    const faqJsonLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": "Qu'est-ce que SigilOS ?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "SigilOS est un système d'exploitation de guilde exclusif pour Dofus. Il relie votre serveur Discord à un tableau de bord web pour automatiser la gestion des membres, des events (Songes, Donjons), et le suivi des archimonstres via Metamob."
                }
            },
            {
                "@type": "Question",
                "name": "Est-ce que SigilOS est gratuit ?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Oui, SigilOS est intégralement gratuit et sans publicité pour les guildes bénéficiant d'un accès."
                }
            },
            {
                "@type": "Question",
                "name": "Comment fonctionne la connexion Discord ?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "La connexion s'effectue uniquement via Discord (OAuth2). SigilOS ne demande jamais vos identifiants Ankama. Nous n'avons accès qu'à votre ID Discord, votre pseudo public et votre avatar. Aucune adresse e-mail n'est collectée."
                }
            },
            {
                "@type": "Question",
                "name": "Qui a accès à mes données ?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Vos données sont strictement isolées au sein de votre guilde. Les données sensibles sont chiffrées de bout en bout. Aucune donnée n'est vendue à des tiers."
                }
            },
            {
                "@type": "Question",
                "name": "Comment ajouter SigilOS à ma guilde ?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "SigilOS est en bêta fermée. Si vous êtes Meneur ou Officier d'une guilde ambitieuse, vous pouvez formuler une demande d'accès via le serveur Discord officiel du projet."
                }
            },
        ],
    };

    return (
        <>
            <script
                type="application/ld+json"
                nonce={nonce}
                // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
            />
            <div className="space-y-12">
                {/* Hero Section */}
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center p-3 bg-violet-500/10 rounded-2xl border border-violet-500/20 mb-4 relative group">
                        <div className="absolute inset-0 bg-violet-500/20 blur-xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
                        <HelpCircle className="w-8 h-8 text-violet-400 relative z-10" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 tracking-tight">
                        Foire Aux Questions
                    </h1>
                    <p className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-base">
                        Retrouvez toutes les réponses concernant l'utilisation de SigilOS, notre politique de confidentialité et la sécurisation de vos données.
                    </p>
                </div>

                {/* Security Notice */}
                <div className="bg-warning/5 border border-warning/20 rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-warning/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10 flex flex-col sm:flex-row gap-4 items-start sm:items-center text-warning/90">
                        <div className="p-3 bg-warning/10 rounded-xl shrink-0">
                            <ShieldCheck className="w-6 h-6 text-warning" />
                        </div>
                        <div>
                            <h3 className="font-black tracking-tight text-foreground mb-1">Votre sécurité d'abord</h3>
                            <p className="text-sm leading-relaxed text-warning/80">
                                <strong>SigilOS ne vous demandera JAMAIS les identifiants de votre compte Ankama (nom de compte, mot de passe, ou Shield).</strong> L'application n'a aucun lien direct avec les serveurs d'Ankama Games. Votre sécurité est garantie.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Spacing */}
                <hr className="border-border" />

                {/* Accordion List */}
                <div className="space-y-12">
                    {/* CATEGORY 1: Général */}
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-info/10 rounded-lg">
                                <Server className="w-4 h-4 text-info" />
                            </div>
                            <h2 className="text-xl font-bold text-foreground tracking-tight">Général & Découverte</h2>
                        </div>
                        <Accordion type="single" collapsible className="w-full space-y-4">
                            <AccordionItem value="item-1" className="border border-border bg-surface/30 rounded-xl px-4 overflow-hidden shadow-lg data-[state=open]:border-info/30 transition-colors">
                                <AccordionTrigger className="hover:no-underline py-4 text-sm font-semibold text-foreground/90 hover:text-foreground group">
                                    Qu'est-ce que SigilOS ?
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground leading-relaxed text-sm pb-4">
                                    SigilOS est un système d'exploitation de guilde exclusif pour Dofus. Il relie votre serveur Discord à un tableau de bord web pour automatiser la gestion des membres, des events (Songes, Donjons), et le suivi des archimonstres via Metamob. Plus qu'un simple bot, c'est une plateforme complète pour les guildes ambitieuses.
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-2" className="border border-border bg-surface/30 rounded-xl px-4 overflow-hidden shadow-lg data-[state=open]:border-info/30 transition-colors">
                                <AccordionTrigger className="hover:no-underline py-4 text-sm font-semibold text-foreground/90 hover:text-foreground">
                                    Est-ce que SigilOS est gratuit ?
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground leading-relaxed text-sm pb-4">
                                    Oui, SigilOS est intégralement gratuit et sans publicité pour les guildes bénéficiant d'un accès.
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-3" className="border border-border bg-surface/30 rounded-xl px-4 overflow-hidden shadow-lg data-[state=open]:border-info/30 transition-colors">
                                <AccordionTrigger className="hover:no-underline py-4 text-sm font-semibold text-foreground/90 hover:text-foreground">
                                    Faut-il installer quelque chose sur son ordinateur ?
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground leading-relaxed text-sm pb-4">
                                    Absolument pas. SigilOS fonctionne entièrement dans votre navigateur web, comme un site internet classique. Il n'y a aucun logiciel tiers à télécharger.
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-4" className="border border-border bg-surface/30 rounded-xl px-4 overflow-hidden shadow-lg data-[state=open]:border-info/30 transition-colors">
                                <AccordionTrigger className="hover:no-underline py-4 text-sm font-semibold text-foreground/90 hover:text-foreground">
                                    Qui a créé SigilOS ?
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground leading-relaxed text-sm pb-4">
                                    SigilOS a été conçu et développé bénévolement par <strong className="text-foreground">Wylan</strong>, un développeur passionné par l'univers de Dofus et par la cybersécurité. Le projet est né de la volonté de sécuriser et simplifier la gestion des guildes. Vos données sont donc entre de bonnes mains !
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </section>

                    {/* CATEGORY 2: Sécurité */}
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-success/10 rounded-lg">
                                <Lock className="w-4 h-4 text-success" />
                            </div>
                            <h2 className="text-xl font-bold text-foreground tracking-tight">Sécurité & Confidentialité</h2>
                        </div>
                        <Accordion type="single" collapsible className="w-full space-y-4">
                            <AccordionItem value="item-sec-1" className="border border-border bg-surface/30 rounded-xl px-4 overflow-hidden shadow-lg data-[state=open]:border-success/30 transition-colors">
                                <AccordionTrigger className="hover:no-underline py-4 text-sm font-semibold text-foreground/90 hover:text-foreground">
                                    Comment fonctionne la connexion si je ne donne pas mes pass Dofus ?
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground leading-relaxed text-sm pb-4">
                                    La connexion s'effectue <strong className="text-foreground">uniquement via Discord</strong> (Système OAuth2). Nous utilisons l'authentification officielle de Discord pour vérifier que vous appartenez bien au serveur Discord de votre guilde. Nous n'avons accès qu'à votre ID Discord, votre pseudo public, votre avatar et la liste de vos serveurs Discord. Aucune adresse e-mail n'est collectée.
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-sec-email" className="border border-border bg-surface/30 rounded-xl px-4 overflow-hidden shadow-lg data-[state=open]:border-success/30 transition-colors">
                                <AccordionTrigger className="hover:no-underline py-4 text-sm font-semibold text-foreground/90 hover:text-foreground">
                                    Est-ce que vous collectez mon adresse email ?
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground leading-relaxed text-sm pb-4 space-y-2">
                                    <p><strong className="text-foreground">Non.</strong> SigilOS ne collecte <strong className="text-foreground">ni ne stocke</strong> votre adresse e-mail. Lors de la connexion via Discord, nous ne demandons que les permissions strictement nécessaires : votre <strong className="text-foreground">ID Discord</strong>, votre <strong className="text-foreground">pseudo public</strong> et la <strong className="text-foreground">liste des serveurs Discord</strong> auxquels vous appartenez (pour vérifier votre appartenance à une guilde gérée par SigilOS).</p>
                                    <p>Votre adresse e-mail Discord n'est jamais demandée, jamais transmise à nos serveurs, et jamais stockée dans notre base de données.</p>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-sec-2" className="border border-border bg-surface/30 rounded-xl px-4 overflow-hidden shadow-lg data-[state=open]:border-success/30 transition-colors">
                                <AccordionTrigger className="hover:no-underline py-4 text-sm font-semibold text-foreground/90 hover:text-foreground">
                                    Qui a accès à mes données (API Metamob, absences, etc.) ?
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground leading-relaxed text-sm pb-4 space-y-2">
                                    <p>Vos données sont strictement isolées au sein de votre guilde. Seuls les Administrateurs désignés sur le Discord de <strong>votre</strong> guilde peuvent voir vos informations détaillées (API Metamob, dates de vacances).</p>
                                    <p>De plus, toutes les données sensibles (comme votre clé API Metamob ou les jetons de connexion Discord) sont systématiquement <strong className="text-foreground">chiffrées de bout en bout</strong> dans notre base de données. Même en cas d'accès physique à nos serveurs, ces informations sont illisibles.</p>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-sec-3" className="border border-border bg-surface/30 rounded-xl px-4 overflow-hidden shadow-lg data-[state=open]:border-success/30 transition-colors">
                                <AccordionTrigger className="hover:no-underline py-4 text-sm font-semibold text-foreground/90 hover:text-foreground">
                                    Que se passe-t-il si je quitte le Discord de ma guilde ?
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground leading-relaxed text-sm pb-4">
                                    Dès que le bot Discord détecte votre départ, votre compte SigilOS est automatiquement passé en statut "Archivé" et vos accès sont révoqués. Conformément au RGPD, vos données sont conservées pendant un délai maximum de 30 jours (pour faciliter un éventuel retour), puis détruites informatiquement et définitivement de nos serveurs.
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </section>

                    {/* CATEGORY 3: Fonctionnement */}
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-pink-500/10 rounded-lg">
                                <Fingerprint className="w-4 h-4 text-pink-400" />
                            </div>
                            <h2 className="text-xl font-bold text-foreground tracking-tight">Fonctionnement & Utilisation</h2>
                        </div>
                        <Accordion type="single" collapsible className="w-full space-y-4">
                            <AccordionItem value="item-func-1" className="border border-border bg-surface/30 rounded-xl px-4 overflow-hidden shadow-lg data-[state=open]:border-pink-500/30 transition-colors">
                                <AccordionTrigger className="hover:no-underline py-4 text-sm font-semibold text-foreground/90 hover:text-foreground">
                                    Le lien avec Metamob, comment ça marche ?
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground leading-relaxed text-sm pb-4">
                                    En renseignant votre clé API Metamob (une clé de lecture seule fournie par le site Metamob) et votre pseudo, SigilOS va synchroniser vos captures d'Archimonstres de manière sécurisée. Cela permet à votre guilde de voir qui possède quels monstres pour s'entraider sur la quête de l'Ocre. <strong className="text-foreground">Les mots de passe Metamob ne sont jamais demandés.</strong>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-func-2" className="border border-border bg-surface/30 rounded-xl px-4 overflow-hidden shadow-lg data-[state=open]:border-pink-500/30 transition-colors">
                                <AccordionTrigger className="hover:no-underline py-4 text-sm font-semibold text-foreground/90 hover:text-foreground">
                                    J'ai été banni ou archivé par erreur, que faire ?
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground leading-relaxed text-sm pb-4">
                                    Vous devez contacter un Administrateur ou un Officier de votre guilde directement sur Discord. Eux seuls ont le pouvoir de réactiver votre accès ("Débannir" ou "Désarchiver") depuis leur propre Panneau de Configuration SigilOS.
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-func-3" className="border border-border bg-surface/30 rounded-xl px-4 overflow-hidden shadow-lg data-[state=open]:border-pink-500/30 transition-colors">
                                <AccordionTrigger className="hover:no-underline py-4 text-sm font-semibold text-foreground/90 hover:text-foreground">
                                    Comment ajouter SigilOS à ma propre guilde ?
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground leading-relaxed text-sm pb-4">
                                    SigilOS est actuellement un projet en bêta fermée. L'accès est limité à certaines guildes partenaires pour garantir la stabilité et la qualité du service. Cependant, si vous êtes <strong>Meneur ou Officier d'une guilde ambitieuse</strong>, vous pouvez formuler une demande d'accès en rejoignant le serveur Discord officiel du projet : <a href="https://discord.gg/uX7G6SUDgN" target="_blank" rel="noreferrer" className="text-info hover:text-info underline font-semibold transition-colors">Rejoindre le Discord SigilOS</a>.
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </section>
                </div>
            </div>
        </>
    );
}
