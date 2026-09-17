import { getAppBaseUrl } from "@/lib/utils";
import { Metadata } from "next";
import { headers } from "next/headers";
import {
    HelpCircle,
    Users,
    Layers,
    MessageSquare,
    Lock,
    LifeBuoy,
    type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { JsonLd } from "@/components/shared/json-ld";

export const metadata: Metadata = {
    title: "FAQ & Aide | SigilOS",
    description: "Réponses aux questions fréquentes sur SigilOS : accès via Discord, gestion de guilde Dofus, permissions, modules (Almanax, quêtes, événements, archimonstres), données collectées et RGPD.",
    alternates: {
        canonical: `${getAppBaseUrl()}/legal/faq`,
    },
};

type FaqItem = { q: string; a: string };
type FaqSection = { id: string; title: string; icon: LucideIcon; items: FaqItem[] };

const FAQ_SECTIONS: FaqSection[] = [
    {
        id: "acces",
        title: "Accès & compte",
        icon: HelpCircle,
        items: [
            { q: "Qu'est-ce que SigilOS ?", a: "SigilOS est un outil web de gestion de guilde pour Dofus, relié à votre serveur Discord. Il regroupe au même endroit le suivi des quêtes et de la progression, les sorties et événements, le calendrier, l'annuaire, les guides ainsi que le suivi des archimonstres. L'accès se fait uniquement via Discord." },
            { q: "Comment installer SigilOS pour ma guilde ?", a: "Connectez-vous directement avec votre compte Discord. Si vous êtes administrateur du serveur de votre guilde, l'installation se fait immédiatement en autonomie en 1 clic. Vous pouvez également ouvrir un ticket sur notre serveur Discord officiel si vous préférez un accompagnement VIP." },
            { q: "Comment se connecter ?", a: "La connexion se fait uniquement avec votre compte Discord (OAuth2). Il n'existe ni compte ni mot de passe SigilOS : vous vous connectez à Discord, puis vous accédez aux guildes où vous êtes membre ou administrateur. SigilOS ne récupère que votre identité et la liste de vos serveurs." },
            { q: "Est-ce que SigilOS est gratuit ?", a: "Oui. SigilOS est 100% gratuit et sans publicité pour toutes les guildes Dofus." },
            { q: "Pourquoi ne vois-je pas ma guilde après connexion ?", a: "Si votre guilde n'est pas encore configurée et que vous administrez son serveur Discord, vous pouvez la déployer en 1 clic depuis votre tableau de bord. Si vous êtes simple membre, demandez à un meneur ou un officier d'installer SigilOS sur le serveur Discord." },
        ],
    },
    {
        id: "guilde",
        title: "Guilde & permissions",
        icon: Users,
        items: [
            { q: "Quels rangs existent dans une guilde ?", a: "Les rangs sont définis par le meneur dans les réglages de la guilde : meneur, officiers, rangs personnalisés. Ils s'appuient sur les rôles de votre serveur Discord, qui sont propres à chaque serveur et que chaque guilde configure librement. Les permissions associées à chaque rang se règlent dans les paramètres de la guilde." },
            { q: "Comment sont gérées les permissions ?", a: "Les permissions sont définies par le meneur dans les réglages de la guilde. Elles sont regroupées en familles (membres, activités, contenu, coffre, etc.) et peuvent être déléguées aux officiers. Le meneur peut créer, modifier ou supprimer des rangs, chacun étant associé à son propre jeu de permissions." },
            { q: "Comment inviter ou retirer un membre ?", a: "L'invitation et le retrait se font depuis l'espace de gestion des membres de la guilde, sous réserve des permissions accordées à votre rang. Les modifications sont enregistrées et un indicateur signale les changements non sauvegardés." },
            { q: "Puis-je gérer plusieurs guildes ?", a: "Oui. Un même compte Discord peut accéder à plusieurs guildes. Vous changez de guilde depuis le menu de l'application (sélecteur de guilde)." },
            { q: "Un membre a été banni ou archivé par erreur, que faire ?", a: "Seul un meneur ou un officier peut le réactiver (débannir ou désarchiver) depuis les réglages de la guilde. Contactez-le directement sur Discord." },
        ],
    },
    {
        id: "modules",
        title: "Fonctionnalités & modules",
        icon: Layers,
        items: [
            { q: "Comment fonctionne l'Almanax ?", a: "L'Almanax affiche la ressource du jour et le bonus qui lui est associé. Il est consultable publiquement et intégré à l'espace guilde pour la planification collective." },
            { q: "Comment est suivi la progression Dofus ?", a: "Les quêtes et leur progression sont suivies par joueur et affichées dans la guilde. Valider une quête met à jour automatiquement la complétion des Dofus associés et le pourcentage global." },
            { q: "Comment organiser les sorties et événements ?", a: "Le calendrier permet de créer sorties, événements et groupes, avec notification sur Discord et suivi des disponibilités des membres. Les inscriptions et désinscriptions sont gérées depuis la guilde." },
            { q: "Comment fonctionne le suivi des Songes / donjons ?", a: "Chaque run peut être publié avec la classe, le chef et le stuff associé. Les membres s'inscrivent et le déroulé est partagé avec la guilde. Un lien peut être créé vers un équipement (stuff)." },
            { q: "Comment intégrer les archimonstres / la quête de l'Ocre ?", a: "Vous renseignez votre pseudo Dofus et votre clé API Metamob (en lecture seule). SigilOS synchronise alors les archimonstres que vous avez capturés afin que la guilde s'entraide sur la quête de l'Ocre. Aucun mot de passe Metamob n'est demandé." },
            { q: "Le suivi des points de succès est-il disponible ?", a: "Oui. Les points de succès des membres sont synchronisés et comparés pour suivre la progression de la guilde sur la durée." },
            { q: "Y a-t-il un annuaire, des guides ou des ressources ?", a: "Oui. Un annuaire de guildes, des guides Dofus et une section Ressources (liens organisés par catégories) sont disponibles. La gestion des ressources peut être déléguée aux officiers." },
        ],
    },
    {
        id: "discord",
        title: "Discord",
        icon: MessageSquare,
        items: [
            { q: "Comment configurer le serveur Discord ?", a: "La configuration se fait dans les réglages de la guilde : liaison du serveur Discord, mapping des rôles et choix des salons de notification. Le meneur ou un officier habilité gère ces réglages." },
            { q: "Comment fonctionnent les notifications ?", a: "Les sorties, événements et mises à jour envoient des notifications dans les salons Discord choisis via des embeds. Si l'API Discord est momentanément indisponible, les données sont conservées et la reprise est automatique." },
            { q: "Existe-t-il des commandes slash ?", a: "L'interface principale est web, avec notifications Discord. Les commandes slash et la granularité par rôle font partie des évolutions prévues." },
        ],
    },
    {
        id: "donnees",
        title: "Données & sécurité",
        icon: Lock,
        items: [
            { q: "Quelles données sont collectées ?", a: "Votre identifiant Discord, votre pseudo public, votre avatar, les données de guilde (rangs, permissions, quêtes, sorties, progression) et, si vous l'ajoutez, votre pseudo Dofus et votre clé API Metamob. Les jetons d'accès Discord sont stockés chiffrés." },
            { q: "Collectez-vous mon adresse e-mail ?", a: "Non. La connexion utilise uniquement Discord et le périmètre de permissions demandé est limité à votre identité et à vos serveurs (identify guilds). Aucune adresse e-mail n'est récupérée." },
            { q: "Demandez-vous mon mot de passe Ankama ?", a: "Non, jamais. SigilOS n'a aucun lien avec votre compte Ankama : vous connectez uniquement Discord, qui ne transmet ni mot de passe ni données de compte de jeu." },
            { q: "Comment mes données sont-elles protégées ?", a: "Les données sont isolées par guilde : chaque membre ne voit que sa guilde. Les jetons de session ont une durée limitée (8 heures) avec rotation, et les données sensibles sont chiffrées au repos en base." },
            { q: "Comment supprimer mes données (RGPD) ?", a: "Vous pouvez supprimer votre compte et vos données directement depuis votre profil (self-service), ou en faire la demande auprès du meneur de votre guilde ou via le support Discord, conformément au RGPD. Sans guilde active, le compte est également retiré des listes." },
            { q: "D'où viennent les données Dofus ?", a: "Les ressources et données complémentaires proviennent de DofusDB (licence LPNC-IA 1.0) et de Ganymède. Dofus est une marque déposée d'Ankama Games ; SigilOS est une plateforme indépendante." },
        ],
    },
    {
        id: "support",
        title: "Support & dépannage",
        icon: LifeBuoy,
        items: [
            { q: "Comment signaler un bug ?", a: "Le plus simple est de passer par le serveur Discord officiel du projet. Précisez votre guilde, la page concernée, ce que vous faisiez et ce qui s'est passé, pour faciliter la reproduction." },
            { q: "Comment connaître l'état du service ?", a: "Une page dédiée affiche l'état en temps réel des services (page Statut), accessible depuis le menu principal." },
            { q: "Comment obtenir de l'aide ?", a: "Rejoignez le serveur Discord officiel pour un accompagnement rapide par la communauté et l'équipe du projet." },
        ],
    },
];

export default async function FAQPage() {
    // [AUDIT 2026] Retrieve nonce for inline scripts
    const headersList = await headers();
    const nonce = headersList.get("x-nonce") ?? "";

    // FAQPage structured data — generated from the same data as the UI to keep
    // visible content and rich snippets strictly in sync.
    const faqJsonLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQ_SECTIONS.flatMap((section) =>
            section.items.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
            }))
        ),
    };

    return (
        <>
            <JsonLd id="json-ld-faq" nonce={nonce} data={faqJsonLd} />

            <header className="max-w-2xl">
                <p className="reg-eyebrow">FAQ &amp; aide</p>
                <h1 className="mt-3 text-[clamp(1.6rem,2.8vw,2rem)] font-bold tracking-tight text-foreground">
                    Vos questions, nos réponses.
                </h1>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    Tout ce qu&apos;il faut savoir pour démarrer et utiliser SigilOS au quotidien :
                    accès, permissions, modules, Discord, données et sécurité.
                </p>
            </header>

            {/* Sommaire — liens textuels, pas de pastilles bordées */}
            <nav aria-label="Sommaire de la FAQ" className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                {FAQ_SECTIONS.map((section) => (
                    <Link key={section.id} href={`/legal/faq#${section.id}`} className="reg-link-quiet">
                        {section.title}
                    </Link>
                ))}
            </nav>

            {/* Sections — accordéons natifs (aucun cadre autour de chaque question) */}
            <div className="mt-12 space-y-12">
                {FAQ_SECTIONS.map((section) => (
                    <section key={section.id} id={section.id} className="scroll-mt-24">
                        <div className="flex items-center gap-2.5">
                            <section.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            <h2 className="text-base font-bold text-foreground tracking-tight">{section.title}</h2>
                        </div>
                        <div className="reg-faq mt-3">
                            {section.items.map((item, idx) => (
                                <details key={`${section.id}-${idx}`}>
                                    <summary>{item.q}</summary>
                                    <p>{item.a}</p>
                                </details>
                            ))}
                        </div>
                    </section>
                ))}
            </div>

            {/* CTA support — un panneau, une action */}
            <div className="reg-panel mt-14 p-6 md:p-8">
                <h2 className="text-base font-bold text-foreground">Vous n&apos;avez pas trouvé votre réponse ?</h2>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground leading-relaxed">
                    Posez votre question sur le serveur Discord officiel : la communauté et
                    l&apos;équipe du projet vous répondent rapidement.
                </p>
                <a
                    href="https://discord.gg/uX7G6SUDgN"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="reg-btn reg-btn-primary mt-5"
                >
                    Rejoindre le Discord SigilOS
                </a>
            </div>
        </>
    );
}

