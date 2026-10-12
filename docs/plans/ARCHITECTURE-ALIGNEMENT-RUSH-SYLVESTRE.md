# Architecture & Intégration de l'Arborescence d'Alignement dans le Rush Sylvestre

> **Document de conception technique pour SigilOS**  
> Ce document définit comment intégrer le choix de Cité (**Bontarien** vs **Brâkmarien**) et le choix d'**Ordre** (1 parmi les 6 ordres) dans le module Rush Sylvestre (guide web interne/public et overlay PiP interne/public).

---

## 1. Explication du Delta de Quêtes (Tougli 529 quêtes vs Dofusyelle 346 quêtes)

Beaucoup de joueurs s'interrogent sur l'écart de près de 180 quêtes entre Tougli et Dofusyelle. L'explication est purement structurelle :

### A. La duplication des branches d'alignement (125 quêtes alternatives)
- **Tougli stocke l'intégralité des deux voies dans sa base** :
  - Quêtes d'alignement Bonta : **97 quêtes**
  - Quêtes d'alignement Brâkmar : **100 quêtes**
  - Quêtes des 6 ordres de cité (5 rangs x 6 ordres) : **30 quêtes**
- **Or, un personnage donné ne réalise qu'une seule voie** :
  - Il fait 1 alignement (Bonta ou Brâkmar) = ~70 à 97 quêtes.
  - Il fait 1 seul ordre = 5 quêtes.
- **Résultat :** Dans Tougli, **125 quêtes sont des alternatives mutuellement exclusives** qu'un même joueur ne fera jamais au cours d'un rush. Si l'on déduit ces alternatives :  
  `529 - 125 = 404 quêtes effectives`.

### B. Découpage atomique vs Succès agrégés (~58 quêtes)
- Dofusyelle regroupe souvent les quêtes au niveau du succès :
  - Par exemple à l'étape 2 : Dofusyelle cite le succès *La Grande Bibliothèque* et liste 18 quêtes principales.
  - Tougli liste individuellement chaque micro-quête d'introduction et d'accès.
  - Pour le *Dofus des Veilleurs* : Tougli détaille **49 quêtes** (tous les mini-donjons dimensionnels, quêtes d'accès aux dimensions et quêtes de portails), là où Dofusyelle ne liste que les 10 jalons majeurs et préconise de pré-chasser les portails en amont.
- **En résumé :** Le parcours réel d'un joueur en rush est d'environ **350 à 400 quêtes réelles**, les deux guides étant alignés à **98,5%** sur le contenu requis.

---

## 2. Modèle de Données : Structure Conditionnelle des Jalons

Pour supporter l'alignement sans dupliquer le guide, chaque jalon (`Milestone` ou étape) dans SigilOS peut contenir soit des quêtes communes, soit des blocs conditionnels.

### Interface TypeScript recommandée (`src/types/rush-guide.ts`)

```typescript
export type AlignmentChoice = 'bonta' | 'brakmar';

export type OrderChoice = 
  | 'coeur_vaillant'    // Bonta (CV)
  | 'oeil_attentif'     // Bonta (OA)
  | 'esprit_salvateur'  // Bonta (ES)
  | 'coeur_saignant'    // Brakmar (CS)
  | 'oeil_putride'      // Brakmar (OP)
  | 'esprit_malsain';   // Brakmar (EM)

export interface QuestRef {
  id: number;
  title: string;
  url?: string;
  zone?: string;
  npc?: string;
  pos?: string;
  isCombatSolo?: boolean;
  isDungeon?: boolean;
}

export interface ConditionalBranch {
  type: 'alignment' | 'order';
  condition: AlignmentChoice | OrderChoice;
  quests: QuestRef[];
  notes?: string[];
  stops?: string[];
}

export interface RushStep {
  stepNumber: number;
  title: string;
  category: string;
  tips: string[];
  warnings?: string[];
  stops?: string[]; // Ex: "S'arrêter devant Kanigroula"
  dungeons?: { name: string; saveRecommended: boolean }[];
  achievements?: { name: string; url?: string }[];
  
  // Quêtes directes (si l'étape n'est pas conditionnelle)
  commonQuests?: QuestRef[];
  
  // Branches conditionnelles (ex: Étapes 3, 12, 21, 24, 34, 46)
  branches?: ConditionalBranch[];
}
```

---

## 3. Les 6 Paliers d'Alignement & Correspondance Bonta / Brâkmar

Voici le mapping exact des 6 blocs d'alignement identifiés entre Bonta et Brâkmar :

| Étape Rush | Palier d'Alignement | Quêtes Bonta (Exemple) | Quêtes Brâkmar (Exemple) | Arrêt / Donjon Mutualisé |
|:---:|:---:|---|---|---|
| **Étape 3** | Initiation (Quête 1) | *Entraînement avec Tarche* | *Cliquetis fou* | Combat solo d'initiation |
| **Étape 12** | Quêtes 33 à 65 | *La serveuse Dame Cloude* ... | *Le professionnel* ... | Farm extérieur & intermède |
| **Étape 21** | Quêtes 65 à 70 | *Course-poursuite* ... | *Les documents avant tout* ... | Farm Alhyène + **Stop Kanigroula** |
| **Étape 24** | Quêtes 70 à 85 + Ordre 1 à 4 | *Un coupable idéal* ... | *L'épée maudite* ... | **Stop Korriandre** (Ali) + **Stop Ougah** (Ordre) |
| **Étape 34** | Quêtes 85 à 99 | *L'ascension de Qu'Tan (Partie 1)* | *L'essor de Qu'Tan (Partie 1)* | Enchaînement Frigost / Dazak |
| **Étape 46** | Quêtes 99 à 100 + Ordre 5 | Fin 100 + Quête Ordre 5 | Fin 100 + Quête Ordre 5 | **Prérequis ultime Dofus Ivoire** |

---

## 4. Intégration dans l'UI (Guide Web et Overlay PiP)

### A. Sélecteur de Cité & d'Ordre (`RushAlignmentSelector.tsx`)
Un composant discret placé :
- **Sur le Guide Web (`RushTimelineClient.tsx`)** : dans l'en-tête de filtre, à côté du compteur d'avancement.
- **Sur l'Overlay PiP (`RushOverlayHeader.tsx` ou `RushOverlayChapterBar.tsx`)** : via une icône bouclier ou un dropdown compact.

```tsx
// Exemple de composant compact pour Overlay et Web
export function RushAlignmentToggle({ 
  alignment, 
  onAlignmentChange, 
  order, 
  onOrderChange 
}: RushAlignmentProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex bg-neutral-900 border border-neutral-800 rounded p-0.5">
        <button 
          onClick={() => onAlignmentChange('bonta')}
          className={`px-2 py-1 rounded flex items-center gap-1.5 ${alignment === 'bonta' ? 'bg-sky-500/20 text-sky-300 font-medium' : 'text-neutral-400'}`}
        >
          <img src="/assets/dofus/align/bonta.png" alt="Bonta" className="w-3.5 h-3.5" />
          Bonta
        </button>
        <button 
          onClick={() => onAlignmentChange('brakmar')}
          className={`px-2 py-1 rounded flex items-center gap-1.5 ${alignment === 'brakmar' ? 'bg-red-500/20 text-red-300 font-medium' : 'text-neutral-400'}`}
        >
          <img src="/assets/dofus/align/brakmar.png" alt="Brâkmar" className="w-3.5 h-3.5" />
          Brâkmar
        </button>
      </div>

      <select 
        value={order} 
        onChange={(e) => onOrderChange(e.target.value as OrderChoice)}
        className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-neutral-300"
      >
        {alignment === 'bonta' ? (
          <>
            <option value="coeur_vaillant">Cœur Vaillant</option>
            <option value="oeil_attentif">Œil Attentif</option>
            <option value="esprit_salvateur">Esprit Salvateur</option>
          </>
        ) : (
          <>
            <option value="coeur_saignant">Cœur Saignant</option>
            <option value="oeil_putride">Œil Putride</option>
            <option value="esprit_malsain">Esprit Malsain</option>
          </>
        )}
      </select>
    </div>
  );
}
```

### B. Gestion de l'État & Persistance (Fail-closed & Offline-first)
1. **Mode Invité / Overlay PiP :**
   - Stocké dans `localStorage` sous la clé `sigilos_rush_alignment` (`'bonta'` par défaut) et `sigilos_rush_order`.
   - L'overlay lit instantanément cette clé au montage.
2. **Mode Membre Connecté (Dashboard) :**
   - Stocké dans la table Prisma `GuildMemberGuidePreference` ou dans les métadonnées de progression du guide.
   - Si la DB est injoignable, fallback transparent sur `localStorage`.

### C. Résolution des Quêtes dans la Liste
Dans `RushOverlayQuestListItem` et `RushTimelineClient` :
```typescript
function getStepQuests(step: RushStep, alignment: AlignmentChoice, order: OrderChoice): QuestRef[] {
  let list = [...(step.commonQuests || [])];
  
  if (step.branches) {
    step.branches.forEach(branch => {
      if (branch.type === 'alignment' && branch.condition === alignment) {
        list.push(...branch.quests);
      } else if (branch.type === 'order' && branch.condition === order) {
        list.push(...branch.quests);
      }
    });
  }
  
  return list;
}
```

---

## 5. Synthèse & Plan de Déploiement

1. **Phase 1 (Préparation des données)** : Générer le fichier JSON unifié contenant l'intégralité des 57 étapes avec branches conditionnelles.
2. **Phase 2 (Page HTML Autonome)** : Mettre à disposition la vue interactive complète (livrable 2).
3. **Phase 3 (Intégration SigilOS)** :
   - Mettre à jour l'admin God (`src/app/god/rush-sylvestre/`).
   - Intégrer `RushAlignmentToggle` dans l'overlay PiP et la timeline de guilde.

---

## 6. Décisions VERROUILLÉES le 10/10/2026 (ne pas re-débattre)

> Arbitrages tranchés avec le propriétaire. Le détail d'exécution vit dans
> `docs/plans/MODULE-RUSH-SYLVESTRE.md` (§ F) ; l'ordre, dans `docs/plans/FILE-EXECUTION.md`.

1. **Un seul guide** `rush-sylvestre`, branché par **données** : `alignReq` (cité), `alignOrderReq` (ordre),
   `alignLevelReq` (seuil). **Jamais deux guides** (un « bontarien » et un « brâkmarien »).
2. **Choix de l'Ordre** à la **1ʳᵉ quête d'Ordre (seuil 20)** ; rangs d'« Apprentissage » aux seuils
   **20 / 40 / 60 / 80 / 100**.
3. **Changement de cité = logique jeu** : **reset** de l'alignement du personnage (+ `alignmentBefore`) et
   **retour à la 1ʳᵉ quête** de la nouvelle cité ; les quêtes communes sont conservées.
4. **Résolution** : `resolveRushRoute` **filtre d'abord** ; `buildRushGuideView`, `isSequenceBlockedByPrereqs`
   et `aggregateRushResources` **calculent sur le set filtré** (un prérequis masqué ne bloque pas).
5. **God** : marquage par séquence + action de masse par bloc + vue « Branches » + « créer la jumelle »
   (les deux camps sont **miroir par slot** — la source le donne déjà).
6. **Le bord visible** : sélecteur de cité/ordre **commun** au guide interne, au guide public et à l'overlay
   (une seule implémentation, jamais une copie par surface).