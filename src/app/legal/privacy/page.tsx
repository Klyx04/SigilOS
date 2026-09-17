import { ShieldCheck } from "lucide-react";
import { Metadata } from "next";
import { getAppBaseUrl } from "@/lib/utils";

/**
 * Politique de confidentialité — document « registre ».
 *
 * Texte juridique conservé au mot près. Seul le rendu change : titre
 * gauche-aligné en Source Sans 3 (plus de dégradé ni de mot coloré), plus de
 * `prose-invert` qui forçait le sombre, plus de capitales espacées sur les
 * sections, encadré à filet plutôt qu'à halo.
 */

export const metadata: Metadata = {
    title: "Politique de Confidentialité",
    description: "Politique RGPD de SigilOS : données collectées, finalités, sécurité, hébergement UE et droits des utilisateurs.",
    alternates: {
        canonical: `${getAppBaseUrl()}/legal/privacy`,
    },
};

export default function PrivacyPage() {
    return (
        <article>
            <header>
                <h1 className="text-[clamp(1.6rem,2.8vw,2rem)] font-bold tracking-tight text-foreground">
                    Politique de confidentialité
                </h1>
                <p className="reg-mono mt-2 text-xs text-muted-foreground">Conformité RGPD · 2026</p>
            </header>

            <div className="reg-callout reg-callout-accent mt-8">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                <div>
                    <h3>Protection des données</h3>
                    <p>
                        SigilOS est conçu selon le principe de la "minimisation des données". Il ne collecte que les
                        informations strictement nécessaires à l'authentification et au fonctionnement de vos outils de
                        guilde.
                    </p>
                </div>
            </div>

            <div className="reg-doc mt-8">
                <h2>1. Nature des Données Collectées</h2>
                <p>SigilOS traite les catégories de données suivantes :</p>
                <ul>
                    <li><strong>Identité Numérique :</strong> l'identifiant Discord unique (ID), le pseudonyme et l'avatar. Ces données sont récupérées via l'API officielle Discord lors de la connexion.</li>
                    <li><strong>Données de Jeu :</strong> les informations relatives à l'avancement Dofus (niveaux, succès, monstres d'Ocre possédés), renseignées manuellement par le membre ou synchronisées.</li>
                    <li><strong>Preuves Visuelles :</strong> les captures d'écran de jeu soumises pour valider un succès. La capture est analysée automatiquement (OCR) puis archivée uniquement pour la traçabilité, avant purge périodique.</li>
                </ul>

                <h2>2. Le traitement par OCR (lecture automatique)</h2>
                <p>
                    Le <strong>OCR</strong> (reconnaissance optique de caractères) est utilisé exclusivement pour lire le texte visible sur une capture d'écran de jeu que vous soumettez volontairement (par exemple le nom d'un succès ou un compteur de points). Cette lecture permet d'éviter une saisie manuelle et de rapprocher la capture du succès correspondant. L'OCR ne s'exécute que sur une image fournie par le membre, avec son consentement explicite, et ne collecte aucune donnée en dehors de cette image.
                </p>

                <h2>3. Finalités du Traitement</h2>
                <p>Les données sont utilisées exclusivement pour :</p>
                <ul>
                    <li>Gérer l'authentification et les droits d'accès.</li>
                    <li>Permettre aux administrateurs de la guilde de coordonner les activités.</li>
                    <li>Fournir la lecture automatique (OCR) des preuves soumises par les membres.</li>
                </ul>

                <h2>4. Conservation des Données</h2>
                <p>
                    Les données de profil sont conservées tant que le compte est actif. Les captures d'écran soumises en preuve peuvent être purgées régulièrement après validation afin de limiter l'empreinte de stockage.
                </p>

                <h2>5. Sécurité et Hébergement</h2>
                <p>
                    SigilOS est hébergé sur des serveurs sécurisés situés en <strong>Union Européenne (France)</strong>. Le protocole HTTPS protège tous les échanges et des mesures strictes d'isolation des données par guilde sont appliquées.
                </p>

                <h2>6. Partage avec des Tiers</h2>
                <p>
                    <strong>Aucune donnée n'est vendue, louée ou partagée avec des régies publicitaires ou des sociétés tierces.</strong>
                </p>

                <h2>7. Vos Droits</h2>
                <p>
                    Conformément au Règlement Général sur la Protection des Données (RGPD), chaque utilisateur dispose d'un droit d'accès, de rectification et de suppression de ses données. Ces droits s'exercent depuis l'interface dashboard ou en contactant l'administrateur via Discord.
                </p>
            </div>
        </article>
    );
}
