import { ShieldCheck } from "lucide-react";
import { Metadata } from "next";
import { getAppBaseUrl } from "@/lib/utils";

export const metadata: Metadata = {
    title: "Politique de Confidentialité",
    description: "Politique RGPD de SigilOS : données collectées, finalités, sécurité, hébergement UE et droits des utilisateurs.",
    alternates: {
        canonical: `${getAppBaseUrl()}/legal/privacy`,
    },
};

export default function PrivacyPage() {
    return (
        <div className="space-y-8">
            <div className="text-center space-y-4 mb-12">
                <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
                    Politique de <span className="text-transparent bg-clip-text bg-gradient-to-r from-success to-teal-400">Confidentialité</span>
                </h1>
                <p className="text-sm text-muted-foreground font-mono uppercase tracking-widest">Conformité RGPD / 2026</p>
            </div>

            <div className="bg-success/5 border border-success/20 rounded-2xl p-8 backdrop-blur-md flex gap-6 items-start">
                <div className="p-3 bg-success/10 rounded-xl text-success shrink-0">
                    <ShieldCheck className="w-8 h-8" />
                </div>
                <div>
                    <h3 className="text-success font-bold text-lg mb-2">Protection des Données</h3>
                    <p className="text-success/80 text-sm leading-relaxed">
                        SigilOS est conçu selon le principe de la "minimisation des données". Il ne collecte que les informations strictement nécessaires à l'authentification et au fonctionnement de vos outils de guilde.
                    </p>
                </div>
            </div>

            <div className="prose prose-invert prose-emerald max-w-none prose-headings:text-foreground prose-strong:text-success">

                <h2 className="text-xl font-bold mt-8 mb-4 uppercase tracking-wider">1. Nature des Données Collectées</h2>
                <p>SigilOS traite les catégories de données suivantes :</p>
                <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Identité Numérique :</strong> l'identifiant Discord unique (ID), le pseudonyme et l'avatar. Ces données sont récupérées via l'API officielle Discord lors de la connexion.</li>
                    <li><strong>Données de Jeu :</strong> les informations relatives à l'avancement Dofus (niveaux, succès, monstres d'Ocre possédés), renseignées manuellement par le membre ou synchronisées.</li>
                    <li><strong>Preuves Visuelles :</strong> les captures d'écran de jeu soumises pour valider un succès. La capture est analysée automatiquement (OCR) puis archivée uniquement pour la traçabilité, avant purge périodique.</li>
                </ul>

                <h2 className="text-xl font-bold mt-8 mb-4 uppercase tracking-wider">2. Le traitement par OCR (lecture automatique)</h2>
                <p>
                    Le <strong>OCR</strong> (reconnaissance optique de caractères) est utilisé exclusivement pour lire le texte visible sur une capture d'écran de jeu que vous soumettez volontairement (par exemple le nom d'un succès ou un compteur de points). Cette lecture permet d'éviter une saisie manuelle et de rapprocher la capture du succès correspondant. L'OCR ne s'exécute que sur une image fournie par le membre, avec son consentement explicite, et ne collecte aucune donnée en dehors de cette image.
                </p>

                <h2 className="text-xl font-bold mt-8 mb-4 uppercase tracking-wider">3. Finalités du Traitement</h2>
                <p>Les données sont utilisées exclusivement pour :</p>
                <ul className="list-disc pl-6 space-y-2">
                    <li>Gérer l'authentification et les droits d'accès.</li>
                    <li>Permettre aux administrateurs de la guilde de coordonner les activités.</li>
                    <li>Fournir la lecture automatique (OCR) des preuves soumises par les membres.</li>
                </ul>

                <h2 className="text-xl font-bold mt-8 mb-4 uppercase tracking-wider">4. Conservation des Données</h2>
                <p>
                    Les données de profil sont conservées tant que le compte est actif. Les captures d'écran soumises en preuve peuvent être purgées régulièrement après validation afin de limiter l'empreinte de stockage.
                </p>

                <h2 className="text-xl font-bold mt-8 mb-4 uppercase tracking-wider">5. Sécurité et Hébergement</h2>
                <p>
                    SigilOS est hébergé sur des serveurs sécurisés situés en <strong>Union Européenne (France)</strong>. Le protocole HTTPS protège tous les échanges et des mesures strictes d'isolation des données par guilde sont appliquées.
                </p>

                <h2 className="text-xl font-bold mt-8 mb-4 uppercase tracking-wider">6. Partage avec des Tiers</h2>
                <p className="font-bold text-success">
                    Aucune donnée n'est vendue, louée ou partagée avec des régies publicitaires ou des sociétés tierces.
                </p>

                <h2 className="text-xl font-bold mt-8 mb-4 uppercase tracking-wider">7. Vos Droits</h2>
                <p>
                    Conformément au Règlement Général sur la Protection des Données (RGPD), chaque utilisateur dispose d'un droit d'accès, de rectification et de suppression de ses données. Ces droits s'exercent depuis l'interface dashboard ou en contactant l'administrateur via Discord.
                </p>
            </div>
        </div>
    );
}
