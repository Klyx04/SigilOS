import { Metadata } from "next";
import { getAppBaseUrl } from "@/lib/utils";

/**
 * CGU — document « registre ».
 *
 * Texte contractuel conservé au mot près. Seul le rendu change : plus de titre
 * centré en dégradé, plus de capitales espacées, plus de `prose-invert` ni de
 * `lead text-lg` ; la date de mise à jour reste affichée, en mono.
 */

export const metadata: Metadata = {
    title: "Conditions Générales d'Utilisation",
    description: "CGU de SigilOS : règles d'utilisation, propriété intellectuelle, obligations et limitation de responsabilité.",
    alternates: {
        canonical: `${getAppBaseUrl()}/legal/cgu`,
    },
};

export default function CGUPage() {
    return (
        <article>
            <header>
                <h1 className="text-[clamp(1.6rem,2.8vw,2rem)] font-bold tracking-tight text-foreground">
                    Conditions générales d&apos;utilisation
                </h1>
                <p className="reg-mono mt-2 text-xs text-muted-foreground">Dernière mise à jour : 19 février 2026</p>
            </header>

            <div className="reg-doc mt-8">
                <p className="text-base text-foreground">
                    Les présentes Conditions Générales d'Utilisation (ci-après "CGU") encadrent l'accès et l'utilisation de la plateforme <strong>SigilOS</strong>.
                </p>

                <h2>1. Objet du Service</h2>
                <p>
                    SigilOS est une plateforme logicielle indépendante conçue pour faciliter l'organisation et la gestion des guildes au sein de l'univers Dofus. Le service inclut, sans s'y limiter, la gestion des membres, le suivi des quêtes (notamment la quête de l'Ocre), et la coordination d'objectifs communautaires.
                </p>

                <h2>2. Accès et Authentification</h2>
                <p>
                    L'accès au service requiert obligatoirement un compte Discord valide. L'utilisateur reconnaît que son identité sur SigilOS est directement liée à son compte Discord. SigilOS se réserve le droit de restreindre l'accès à certaines fonctionnalités en fonction de l'appartenance de l'utilisateur à des guildes spécifiques partenaires.
                </p>

                <h2>3. Propriété Intellectuelle et Non-Affiliation</h2>
                <p>
                    <strong>SigilOS est un outil indépendant. Il n'est en aucun cas affilié, associé ou approuvé par Ankama Games.</strong>
                </p>
                <p>
                    Tous les éléments graphiques, noms de personnages, serveurs, items et autres contenus issus du jeu Dofus sont la propriété exclusive d'Ankama Games. SigilOS utilise ces références uniquement à titre informatif et utilitaire pour les joueurs.
                </p>
                <p>
                    Le design, le code source et l'interface de SigilOS sont la propriété de son éditeur. Toute reproduction totale ou partielle est interdite sans accord préalable.
                </p>

                <h2>4. Obligations de l'Utilisateur</h2>
                <p>
                    L'utilisateur s'engage à utiliser le service de manière loyale. Sont strictement interdits :
                </p>
                <ul>
                    <li>La tentative de contournement des protocoles de sécurité.</li>
                    <li>L'automatisation abusive (scraping, bots) des API du service.</li>
                    <li>L'usurpation d'identité ou la falsification de preuves de réussite (captures d'écran).</li>
                    <li>Tout comportement toxique ou malveillant nuisant à l'expérience des autres membres.</li>
                </ul>

                <h2>5. Limitation de Responsabilité</h2>
                <p>
                    SigilOS est actuellement fourni en version Bêta. L'éditeur ne peut être tenu responsable d'éventuels bugs, pertes de données temporaires ou indisponibilités du service. L'utilisateur accepte d'utiliser SigilOS "en l'état".
                </p>

                <h2>6. Modification des Conditions</h2>
                <p>
                    L'éditeur se réserve le droit de modifier les présentes CGU à tout moment afin de les adapter aux évolutions du service. La poursuite de l'utilisation du service après modification vaut acceptation des nouvelles conditions.
                </p>
            </div>
        </article>
    );
}
