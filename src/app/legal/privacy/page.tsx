export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-black text-white pt-32 pb-16 px-6">
            <div className="max-w-3xl mx-auto prose prose-invert prose-lg">
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400 mb-8">
                    Politique de Confidentialité
                </h1>

                <div className="bg-zinc-900/50 border border-emerald-500/20 rounded-xl p-6 mb-8">
                    <p className="m-0 text-emerald-200">
                        <strong>En bref :</strong> Nous ne vendons pas vos données. Nous stockons uniquement le strict nécessaire pour gérer votre guilde.
                    </p>
                </div>

                <h3>1. Données Collectées</h3>
                <ul className="list-disc pl-5 space-y-2 text-zinc-300">
                    <li><strong>Identifiant Discord :</strong> Pour vous authentifier et gérer vos permissions.</li>
                    <li><strong>Pseudo & Avatar :</strong> Affichés sur votre profil de guilde.</li>
                    <li><strong>Screenshots de jeu :</strong> Uploadés pour valider vos missions (supprimés après validation).</li>
                </ul>

                <h3>2. Cookies</h3>
                <p>
                    Nous utilisons uniquement des cookies de session "essentiels" pour maintenir votre connexion (Auth.js).
                    Aucun traceur publicitaire, aucun pixel Facebook/Google.
                </p>

                <h3>3. Vos Droits</h3>
                <p>
                    Conformément au RGPD, vous pouvez demander la suppression complète de vos données (Droit à l'oubli)
                    directement via le bouton "Supprimer mon compte" dans vos paramètres, ou en nous contactant sur Discord.
                </p>

                <h3>4. Hébergement</h3>
                <p>
                    Vos données sont hébergées en France (OVHcloud) et sécurisées selon les standards de l'industrie.
                </p>
            </div>
        </div>
    );
}
