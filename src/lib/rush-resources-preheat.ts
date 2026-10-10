/**
 * 🔥 Pré-chauffage des icônes d'objets du **guide Rush Sylvestre**.
 *
 * 🐛 Mesure du 10/10/2026 (constat user : « les ressources quand on ouvre la fenêtre des +300
 * ressources des guides sylvestres on voit des espèces de chargement ») : la modale
 * « Ressources à prévoir » rend un `<ResourceImage>` par ligne, qui demande **d'abord** le WebP
 * local `/uploads/assets-dofus/items/{id}.webp`. Après la purge du cache, ce fichier manque pour
 * la quasi-totalité des lignes ⇒ **des centaines de 404 d'un coup**, puis autant de seconds appels
 * au proxy `/api/assets-dofus/items/{id}`, qui va chercher l'image chez DofusDB **sous un budget
 * partagé de 30 req/min**. Les icônes arrivent donc une par une : c'est exactement ce que
 * l'utilisateur voit.
 *
 * Ce module est le remède **ciblé** (le périmètre qui fait mal : les ressources du guide) en
 * attendant le pré-chauffage complet du catalogue (~21 000 objets). C'est aussi la première brique
 * du chantier U « zéro dépendance DofusDB » : son étape **U-3** (« plus de repli réseau ») exige un
 * cache **rempli et correct**, sinon chaque icône absente devient un placeholder.
 *
 * ⚠️ **Règle de sécurité non négociable** : on ne devine **jamais** le chemin d'image d'un objet.
 * L'id d'entité (celui du guide, celui du nom de fichier local) n'est **pas** l'id d'apparence
 * (`/img/items/{iconId}.png`) : le 09/10/2026, l'objet 11107 avait pour `iconId` 38677. Le
 * pré-chauffage passe donc `allowGuessedPath: false` à `siphonAndCompressImage` — l'image vient de
 * la fiche `/items/{id}` **avec garde d'identité**, ou bien on échoue **en le nommant**.
 *
 * ⚠️ **Module PUR, client-safe** (aucun import de `@/lib/dofus-asset-siphon`, qui tire `sharp`) :
 * le lanceur « dans l'onglet » s'en sert pour découper ses tranches, exactement comme
 * `@/lib/game-items-cadence` pour les items. Le **cœur d'exécution** (téléchargement + WebP) vit
 * dans `@/lib/dofus-asset-siphon` (`siphonItemIconsBatchCore`) : il n'est appelé que côté serveur.
 */

/**
 * Le guide visé. Un seul guide « rush » est servi publiquement aujourd'hui ; le paramètre reste
 * ouvert côté action (`slug`) pour ne pas figer le nom ici le jour où il y en aura un autre.
 */
export const RUSH_GUIDE_SLUG = 'rush-sylvestre';

/**
 * Icônes par **appel serveur**. Borné volontairement : chaque icône coûte 1 à 2 requêtes sur un
 * budget partagé de 30 req/min, et une action serveur ne doit jamais durer plusieurs minutes
 * (le panneau boucle sur les tranches, comme pour les fiches boss).
 */
export const GUIDE_ICON_CHUNK_SIZE = 10;

// ─── Règles PURES (testables sans disque, ni réseau, ni base) ────────────────────────────────

/**
 * Ids **numériques** exploitables d'une liste de ressources agrégées
 * (`aggregateRushResources`) : dédupliqués et triés, parce qu'**un id = un fichier local**.
 *
 * Les ids non numériques (rares) sont écartés : le cache local est nommé par id de jeu, on ne peut
 * pas leur prédire un nom de fichier — le proxy les sert à la volée, et on le **dit** au God
 * (`unmapped` dans l'inventaire) plutôt que de les compter en silence comme « faits ».
 */
export function guideResourceNumericIds(resources: readonly { id?: string | null }[]): number[] {
    const ids = new Set<number>();
    for (const resource of resources) {
        const value = Number(resource?.id);
        if (Number.isInteger(value) && value > 0) ids.add(value);
    }
    return [...ids].sort((a, b) => a - b);
}

/**
 * Sépare ce qui **manque** de ce qui est déjà sur disque. La vérification d'existence est
 * **injectée** (`exists`) : c'est ce qui garde ce module pur et testable sans système de fichiers.
 */
export function splitMissingGuideIcons(
    ids: readonly number[],
    exists: (id: number) => boolean,
): { missing: number[]; present: number[] } {
    const missing: number[] = [];
    const present: number[] = [];
    for (const id of ids) (exists(id) ? present : missing).push(id);
    return { missing, present };
}

/** Découpe une liste d'ids en tranches d'appel (jamais de tranche vide). */
export function chunkItemIconIds(ids: readonly number[], size = GUIDE_ICON_CHUNK_SIZE): number[][] {
    const step = Math.max(1, Math.floor(size));
    const chunks: number[][] = [];
    for (let i = 0; i < ids.length; i += step) chunks.push(ids.slice(i, i + step));
    return chunks;
}
