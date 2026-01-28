export default function PrivacyPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white mb-4">Politique de Confidentialité</h1>
            <p className="text-sm italic opacity-50">Dernière mise à jour : Janvier 2026</p>

            <section className="space-y-2">
                <h2 className="text-lg font-semibold text-zinc-200">1. Collecte des Données</h2>
                <p>
                    Nous collectons uniquement les données strictement nécessaires au fonctionnement de l'application via l'API Discord :
                </p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>Identifiant Discord (ID)</li>
                    <li>Pseudo et Avatar</li>
                    <li>Rôles sur le serveur de la guilde</li>
                </ul>
            </section>

            <section className="space-y-2">
                <h2 className="text-lg font-semibold text-zinc-200">2. Utilisation des Données</h2>
                <p>
                    Ces données sont utilisées pour :
                </p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>Gérer votre authentification et vos permissions.</li>
                    <li>Afficher votre profil aux autres membres de la guilde.</li>
                    <li>Suivre votre progression dans les modules (Missions, Songes).</li>
                </ul>
                <p>
                    Aucune donnée n'est revendue à des tiers.
                </p>
            </section>

            <section className="space-y-2">
                <h2 className="text-lg font-semibold text-zinc-200">3. Vos Droits (RGPD)</h2>
                <p>
                    Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression de vos données.
                    Pour exercer ce droit, veuillez contacter un administrateur via Discord ou utiliser le bouton "Supprimer mon compte" dans votre profil.
                </p>
            </section>
        </div>
    );
}
