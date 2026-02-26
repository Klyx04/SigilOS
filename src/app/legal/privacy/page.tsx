import { ShieldCheck } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Politique de Confidentialité",
    description: "Politique RGPD de SigilOS : données collectées, finalités, sécurité, hébergement UE et droits des utilisateurs.",
};

export default function PrivacyPage() {
    return (
        <div className="space-y-8">
            <div className="text-center space-y-4 mb-12">
                <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
                    Politique de <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Confidentialité</span>
                </h1>
                <p className="text-sm text-zinc-500 font-mono uppercase tracking-widest">Conformité RGPD / 2026</p>
            </div>

            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-8 backdrop-blur-md flex gap-6 items-start">
                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 shrink-0">
                    <ShieldCheck className="w-8 h-8" />
                </div>
                <div>
                    <h3 className="text-emerald-400 font-bold text-lg mb-2">Protection des Données</h3>
                    <p className="text-emerald-200/80 text-sm leading-relaxed">
                        SigilOS est conçu selon le principe de la "minimisation des données". Nous ne collectons que les informations strictement nécessaires à l'authentification et au fonctionnement de vos outils de guilde.
                    </p>
                </div>
            </div>

            <div className="prose prose-invert prose-emerald max-w-none prose-headings:text-white prose-strong:text-emerald-400">

                <h2 className="text-xl font-bold mt-8 mb-4 uppercase tracking-wider">1. Nature des Données Collectées</h2>
                <p>Nous traitons les catégories de données suivantes :</p>
                <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Identité Numérique :</strong> Votre identifiant Discord unique (ID), votre pseudonyme et votre avatar. Ces données sont récupérées via l'API officielle Discord lors de votre connexion.</li>
                    <li><strong>Données de Jeu :</strong> Les informations relatives à votre avancement synchronisées manuellement ou via OCR (niveaux, succès, monstres d'Ocre possédés).</li>
                    <li><strong>Preuves Visuelles :</strong> Les captures d'écran de jeu que vous soumettez pour valider vos succès. Ces images sont traitées par nos algorithmes de reconnaissance avant d'être archivées.</li>
                </ul>

                <h2 className="text-xl font-bold mt-8 mb-4 uppercase tracking-wider">2. Finalités du Traitement</h2>
                <p>Vos données sont utilisées exclusivement pour :</p>
                <ul className="list-disc pl-6 space-y-2">
                    <li>Gérer votre authentification et vos droits d'accès.</li>
                    <li>Permettre aux administrateurs de votre guilde de coordonner les activités.</li>
                    <li>Améliorer la précision de nos outils de lecture automatique (OCR).</li>
                </ul>

                <h2 className="text-xl font-bold mt-8 mb-4 uppercase tracking-wider">3. Conservation des Données</h2>
                <p>
                    Vos données de profil sont conservées tant que votre compte est actif. Les preuves visuelles (screenshots) peuvent être purgées régulièrement pour optimiser nos infrastructures une fois la validation effectuée.
                </p>

                <h2 className="text-xl font-bold mt-8 mb-4 uppercase tracking-wider">4. Sécurité et Hébergement</h2>
                <p>
                    SigilOS est hébergé sur des serveurs sécurisés situés en <strong>Union Européenne (France)</strong>. Nous utilisons le protocole HTTPS pour tous les échanges et appliquons des mesures strictes d'isolation des bases de données par guilde.
                </p>

                <h2 className="text-xl font-bold mt-8 mb-4 uppercase tracking-wider">5. Partage avec des Tiers</h2>
                <p className="font-bold text-emerald-400">
                    Aucune donnée n'est vendue, louée ou partagée avec des régies publicitaires ou des sociétés tierces.
                </p>

                <h2 className="text-xl font-bold mt-8 mb-4 uppercase tracking-wider">6. Vos Droits</h2>
                <p>
                    Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Vous pouvez exercer ces droits depuis votre interface dashboard ou en contactant l'administrateur via Discord.
                </p>
            </div>
        </div>
    );
}
