---
description: Deslop de l'annuaire (volet « membres » du §16 → chantier M / M-1) — contrat registre, icônes en assets Dofus réels, gardes mesurées
---

# 🧹 Deslop de l'annuaire — volet `membres` de M-1

> **Chantier `M`** (Guildes & admin), volet `membres` du **§16** — première partie de **M-1**.
> File d'exécution : `docs/plans/FILE-EXECUTION.md` (§1 ligne `M`, §2).
> Toutes les mesures sont horodatées (02/10/2026) et reproductibles **en lecture seule**.

---

## 1. Besoin

`src/components/directory/member-directory.tsx` (43 Ko) et `member-card.tsx` (24 Ko) portaient l'ancien
vocabulaire visuel — celui que la refonte « registre » du 16/09/2026 avait précisément écarté pour la
landing. Constat user (02/10/2026, capture de `/demo`) : la barre de filtres affiche des **glyphes
génériques** (épée, mallette, étoiles) et un libellé à `★`, là où le produit possède des **icônes Dofus
réelles**. Demande : « refaire le deslop de l'annuaire et iso démo ».

## 2. État mesuré (baseline, 02/10/2026)

| Fichier | Rayons gonflés | Teintes décoratives | Verre | Fonds noirs | Animations |
|---|---|---|---|---|---|
| `member-directory.tsx` (43 Ko) | 2 × 16 px + 13 × 12 px | **30 lignes** `bg-*` (familles `info` / `warning` / `success`) | 0 | 3 | 1 entrée |
| `member-card.tsx` (24 Ko) | 1 × 12 px | 9 lignes `*-info` | **3 `glass-premium`** | 1 | 2 entrées |

Autres constats : l'état vide utilisait `EmptyState variant="premium"` — soit `rounded-3xl`,
`shadow-2xl`, `backdrop-blur-md`, deux traits en dégradé et **deux halos `blur-[100px]`** ;
l'en-tête collant des catégories de métiers portait un `backdrop-blur-md` ; un badge de sélection
était rempli en `bg-info` plein ; la carte liait vers `/dashboard/…` (déjà corrigé en S-1 par `readOnly`).

Icônes de filtre : **5 glyphes lucide** (`Swords`, `Briefcase`, `Shield`, `Sparkles`) + un `★` décoratif,
au lieu des assets `public/assets/dofus/game-icons/*` que le dépôt utilise déjà ailleurs
(`public-header.tsx`, `kamas-page-client.tsx`, `PublicRushGuideClient.tsx`…).

## 3. Changements

1. **Une seule source de classes** en tête de `member-directory.tsx` : `FILTER_TRIGGER`,
   `FILTER_TRIGGER_ACTIVE`, `FILTER_ICON`, `FILTER_CLEAR`, `FILTER_CLEAR_ICON`, `PICKER_ITEM`,
   `PICKER_ITEM_IDLE`, `PICKER_ITEM_ACTIVE`, `PICKER_TILE`. Les **six** filtres les consomment :
   la dérive visuelle entre filtres devient mécaniquement impossible.
2. **Rayons serrés** : `rounded-xl`/`rounded-2xl` → `rounded-md`/`rounded-lg` (3/4/6 px dans `.registre`,
   8/10 px ailleurs — les deux restent très en deçà des 16 px d'origine).
3. **Neutre par défaut, accent pour l'état actif** : plus aucun remplissage coloré décoratif
   (`bg-info/*`, `bg-warning/*`, `bg-success/*`) ; l'actif se lit au bord éclairci + au texte, et
   l'accent (vert) reste réservé à l'action et au positif. Les **teintes de bord et de texte** restent
   autorisées : c'est l'endroit sanctionné pour un statut court (faction du jeu, absence, administration).
4. **Ni verre, ni flou, ni ombre** : `glass-premium` → `bg-surface`, `backdrop-blur-md` retiré,
   `EmptyState` passé en `variant="minimal"` + `rounded-lg`.
5. **Animations d'entrée supprimées** (`animate-in … slide-in-from-*`).
6. **Icônes = assets Dofus réels**, via un composant unique `GameIcon` (décoratif : `alt=""` +
   `aria-hidden`, le sens est porté par le libellé) :
   `crossed-swords` (classe) · `hammer` (métier) · `shield` (alignement + en-tête « Factions ») ·
   `crown` (ordre) · `chest` (butin légendaire) · `party` (effectif) · `recipe` (artisan légendaire) ·
   `tick` (objet sélectionné). La carte remplace son glyphe de faction par les **emblèmes `/ordres/*`**
   (`neutre` / `bonta` / `brakmar`) — l'`alt` porte le nom de la faction.
7. **`★` retiré** du libellé « Service Familier » ; l'asset `croquette.png` (déjà réel) reste, en
   `alt=""` décoratif.
8. **Chiffres en mono** (« N membres trouvés » via `reg-mono`), conformément au contrat.

Le **comportement est inchangé** : mêmes filtres, mêmes ancres de la visite guidée in-app
(`data-tour="annuaire-grid|annuaire-filters|annuaire-search"`), même mode `readOnly` (S-1).

## 4. Gardes (à demeure)

`tests/unit/deslop-annuaire.test.ts` — 10 cas :
classes interdites (`rounded-xl|2xl|3xl`, `glass-premium`, `bg-black/`, `animate-in`, `slide-in-from`,
`bg-gradient`, `blur-[`, `backdrop-blur`, `shadow-2xl`, `bg-info/|bg-warning/|bg-success/|bg-danger/`) ;
**chaque asset cité existe sur le disque** (`existsSync`) ; plus aucun glyphe générique dans les imports
lucide (limite de mot : `ShieldCheck` reste permis) ; `★` interdit ; ancres du tour et `readOnly`
conservés ; état vide plus jamais `premium`.

`tests/unit/demo-publique.test.ts` — durci : un ordre de la source de démo doit exister **pour sa
faction** (défaut trouvé : `brakmarien/brutal`, ordre inexistant → corrigé en `malsain`).

## 5. Preuves

- `npx tsc --noEmit` **0** · `eslint` **0 erreur** · `npm run test:run` ✓ (détail dans le bloc de session
  du `docs/ROADMAP.md`).
- Runtime (`/demo`, serveur local) : HTML rendu à **0** sur tous les motifs interdits
  (`rounded-2xl`, `bg-info/`, `glass-premium`, `★`) ; les assets de jeu sont bien servis par
  `next/image` (`crossed-swords`, `hammer`, `shield`, `chest`, `party`, `recipe` ×2) ;
  **taille du HTML 126 873 → 124 764 octets**.

## 6. Suite de M-1 (non fait ici)

Volets restants du §16 : `calendrier`, `profil`, `stuff` (+ `G·R8` filtre `OTHERS`) — **à mesurer**
avant tout codage, comme pour ce volet. Aucune virtualisation n'est introduite ici (l'idée
« skeletons + virtualisation annuaire » reste au backlog).
