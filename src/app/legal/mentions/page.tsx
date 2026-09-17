import { Metadata } from "next";
import { getAppBaseUrl } from "@/lib/utils";

/**
 * Mentions légales — document « registre ».
 *
 * Texte juridique conservé au mot près. Seul le rendu change : plus de titre
 * centré en dégradé, plus de capitales espacées, plus de `prose-invert` qui
 * forçait le sombre en thème clair. Liens sortants en `.reg-link` avec
 * `rel="noopener noreferrer"` systématique.
 */

export const metadata: Metadata = {
    title: "Mentions Légales",
    description: "Mentions légales de SigilOS : éditeur, hébergement OVH, propriété intellectuelle Ankama Games, cookies et droit applicable.",
    alternates: {
        canonical: `${getAppBaseUrl()}/legal/mentions`,
    },
};

export default function MentionsPage() {
    return (
        <article>
            <header>
                <h1 className="text-[clamp(1.6rem,2.8vw,2rem)] font-bold tracking-tight text-foreground">
                    Mentions légales
                </h1>
                <p className="reg-mono mt-2 text-xs text-muted-foreground">Informations réglementaires</p>
            </header>

            <div className="reg-doc mt-8">
                <h2>1. Édition du Site</h2>
                <p>
                    Le site <strong>SigilOS</strong> est une plateforme de services éditée de manière indépendante par <strong>Wylan</strong>, joueur passionné du Monde des Douze.
                </p>
                <p>
                    <strong>Responsable de la publication :</strong> Wylan (Développeur Indépendant).<br />
                    <strong>Contact :</strong> Le support et la communication s'effectuent prioritairement via le serveur Discord officiel de la plateforme.
                </p>

                <h2>2. Hébergement</h2>
                <p>
                    Le site est hébergé par la société <strong>OVH Cloud</strong> :
                </p>
                <p className="border-l-2 border-border-strong pl-4">
                    OVH SAS<br />
                    2 rue Kellermann<br />
                    59100 Roubaix - France<br />
                    Site web : <a href="https://www.ovhcloud.com" target="_blank" rel="noopener noreferrer">www.ovhcloud.com</a>
                </p>

                <h2>3. Propriété Intellectuelle</h2>
                <p>
                    La structure générale du site, ainsi que les textes et l'interface logicielle sont la propriété exclusive de l'éditeur du site.
                </p>
                <p>
                    <strong>Propriété d'Ankama Games :</strong><br />
                    Toutes les marques, logos, images et noms issus de l'univers du jeu <strong>Dofus</strong> sont la propriété exclusive de la société <strong>Ankama Games</strong>. SigilOS n'est pas affilié à Ankama Games. L'utilisation des assets du jeu sur ce site est faite dans un but purement utilitaire pour la communauté des joueurs, sans aucune intention de porter atteinte aux droits de propriété d'Ankama.
                </p>

                <h2>4. Crédits et Sources de Données Tiers</h2>
                <p>
                    SigilOS s'appuie sur des ressources et bases de données communautaires ouvertes pour offrir une expérience optimisée :
                </p>
                <ul>
                    <li>
                        <strong>DofusDB :</strong> Données cartographiques, monstres, objets et API issues de <a href="https://dofusdb.fr/" target="_blank" rel="noopener noreferrer">DofusDB</a>. <em>« Données issues de DofusDB. Utilisation soumise à la licence LPNC-IA 1.0. »</em>
                    </li>
                    <li>
                        <strong>Ganymède :</strong> Parcours d'optimisation, guides et étapes de quêtes issus du site <a href="https://ganymede-app.com/" target="_blank" rel="noopener noreferrer">Ganymède</a>.
                    </li>
                    <li>
                        <strong>Dofensive :</strong> Données de combat, sorts, géométries de donjons et bestiaire issues de l'API du site <a href="https://dofensive.com/" target="_blank" rel="noopener noreferrer">Dofensive</a>.
                    </li>
                    <li>
                        <strong>Dofus pour les Noobs :</strong> Guides, parcours de quêtes et contenus de référence du site <a href="https://www.dofuspourlesnoobs.com/" target="_blank" rel="noopener noreferrer">Dofus pour les Noobs</a>.
                    </li>
                </ul>

                <h2>5. Cookies</h2>
                <p>
                    SigilOS utilise exclusivement des cookies techniques strictement nécessaires au fonctionnement de la plateforme (gestion de session d'authentification). Aucun cookie publicitaire ou de tracking tiers n'est utilisé.
                </p>

                <h2>6. Droit Applicable</h2>
                <p>
                    Le présent site et ses mentions légales sont soumis au droit français.
                </p>
            </div>
        </article>
    );
}
