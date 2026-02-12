export default function DevGuidePage() {
    return (
        <div>
            <h1>Guide Développeur : Comment écrire la documentation ?</h1>

            <p className="lead text-xl text-zinc-200">
                Ce système de documentation est conçu pour être simple : <strong>1 Dossier = 1 Page</strong>.
            </p>

            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl my-6">
                <h3 className="text-amber-500 font-bold m-0 flex items-center gap-2">
                    💡 Astuce
                </h3>
                <p className="text-amber-200/80 m-0 text-sm">
                    Vous n'avez pas besoin de créer d'API ou de base de données. Tout est géré par les fichiers (File System Routing) de Next.js.
                </p>
            </div>

            <h2>Étape 1 : Créer le fichier</h2>
            <p>
                Allez dans le dossier <code>src/app/docs/</code> et créez un nouveau dossier, par exemple <code>mon-nouveau-guide</code>.
                <br />
                Ensuite, créez un fichier <code>page.tsx</code> à l'intérieur.
            </p>

            <pre className="bg-black/50 p-4 rounded-lg border border-white/10 text-sm font-mono text-zinc-300 overflow-x-auto">
                {`// src/app/docs/mon-nouveau-guide/page.tsx

export default function MaPage() {
    return (
        <div>
            <h1>Mon Titre</h1>
            <p>Mon contenu...</p>
        </div>
    );
}`}
            </pre>

            <h2>Étape 2 : Le Style (Magie !)</h2>
            <p>
                Vous n'avez pas besoin de mettre des classes Tailwind partout. Le layout utilise le plugin
                <code>@tailwindcss/typography</code> (la classe <code>prose</code>).
            </p>
            <ul>
                <li>Utilisez <code>&lt;h1&gt;</code>, <code>&lt;h2&gt;</code>, <code>&lt;p&gt;</code>, <code>&lt;ul&gt;</code> normalement.</li>
                <li>Le style sera automatiquement appliqué (couleurs, espacements, tailles) pour correspondre au thème "Dark SaaS" de SigilOS.</li>
            </ul>

            <h2>Étape 3 : Ajouter au Menu</h2>
            <p>
                Pour que votre page apparaisse dans la barre latérale de gauche :
            </p>
            <ol>
                <li>Ouvrez <code>src/app/docs/layout.tsx</code></li>
                <li>Ajoutez un lien <code>&lt;Link&gt;</code> dans la liste appropriée.</li>
            </ol>

            <hr className="my-8 border-white/10" />

            <h3>Exemple de Composant Riche</h3>
            <p>
                Vous pouvez aussi utiliser tous les composants React de l'application (boutons, alertes, icônes) :
            </p>

            <div className="not-prose flex gap-4">
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-md font-bold hover:bg-indigo-500 transition">
                    Bouton Exemple
                </button>
                <div className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-md border border-white/5">
                    Badge Exemple
                </div>
            </div>
        </div>
    );
}
