import { DocContent } from "@/components/doc/doc-content";

const DEV_GUIDE_CONTENT = `
# Guide Développeur : Comment écrire la documentation ?

<p class="lead">Ce système de documentation est conçu pour être simple : <strong>1 Dossier = 1 Page</strong>.</p>

<div class="callout callout-tip">
<strong>💡 Astuce</strong>
Vous n'avez pas besoin de créer d'API ou de base de données. Tout est géré par les fichiers (File System Routing) de Next.js pour les pages statiques, ou via le dashboard pour les pages dynamiques.
</div>

## Étape 1 : Créer le fichier
Allez dans le dossier \`src/app/docs/\` et créez un nouveau dossier, par exemple \`mon-nouveau-guide\`.
Ensuite, créez un fichier \`page.tsx\` à l'intérieur.

\`\`\`typescript
// src/app/docs/mon-nouveau-guide/page.tsx

export default function MaPage() {
    return (
        <div>
            <h1>Mon Titre</h1>
            <p>Mon contenu...</p>
        </div>
    );
}
\`\`\`

## Étape 2 : Le Style Elite (Magie !)
Vous n'avez pas besoin de mettre des classes Tailwind partout. Le système utilise une configuration **Elite Prose** hautement optimisée.

<div class="steps">
- **Utilisez les balises standard** : Utilisez \`<h1>\`, \`<h2>\`, \`<p>\`, \`<ul>\` normalement.
- **Rendu Automatique** : Le style sera automatiquement appliqué (couleurs, espacements, tailles) pour correspondre au thème "High-Focus SaaS 2026".
- **Composants Avancés** : Vous pouvez utiliser les classes \`callout\`, \`steps\`, ou des balises \`<details>\` pour des docs riches.
</div>

## Étape 3 : Ajouter au Menu
Pour que votre page apparaisse dans la barre latérale de gauche :
1. Ouvrez \`src/app/docs/layout.tsx\`
2. Ajoutez un lien \`<Link>\` dans la liste appropriée.

<hr />

## Référence des Composants Elite

### Les Callouts (Alertes)
Le système injecte automatiquement des icônes selon le type. Utilisez la syntaxe HTML suivante :

\`\`\`html
<div class="callout callout-info"><strong>Info</strong> Votre contenu...</div>
\`\`\`

| Type | Utilisation | Couleur | Icone Auto |
| :--- | :--- | :--- | :--- |
| \`callout-info\` | Informations générales | Bleu | Info |
| \`callout-tip\` | Astuces et bonnes pratiques | Émeraude | Ampoule |
| \`callout-success\` | Succès ou validation | Vert | Check |
| \`callout-important\` | Points critiques | Violet | Alerte Cercle |
| \`callout-warning\` | Avertissements | Ambre | Triangle |
| \`callout-danger\` | Erreurs ou risques graves | Rouge | Danger |
| \`callout-bug\` | Signalement de bugs | Rose | Bug |
| \`callout-question\` | FAQ ou interrogations | Indigo | Question |
| \`callout-todo\` | Tâches à accomplir | Teal | Checkbox |
| \`callout-note\` | Remarques mineures | Zinc | Livre |

<div class="callout callout-important">
<strong>Attention aux lints</strong>
N'oubliez pas de lancer \`npm run build\` pour vérifier qu'aucune erreur TypeScript ne bloque le robot CI.
</div>

<div class="callout callout-bug">
<strong>Lueur d'espoir</strong>
Si vous voyez un bug d'affichage dans le DocViewer, rafraîchissez la page (le HMR peut parfois être capricieux avec les injections DOM).
</div>
`;

export default function DevGuidePage() {
    return (
        <div className="max-w-4xl">
            <DocContent content={DEV_GUIDE_CONTENT} />

            <div className="not-prose flex gap-4 mt-8">
                <button className="px-6 py-3 bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 rounded-2xl font-bold hover:bg-indigo-600/30 transition-all hover:scale-105">
                    Bouton Exemple
                </button>
                <div className="px-6 py-3 bg-white/5 text-zinc-400 rounded-2xl border border-white/10 font-bold">
                    Badge Elite
                </div>
            </div>
        </div>
    );
}
