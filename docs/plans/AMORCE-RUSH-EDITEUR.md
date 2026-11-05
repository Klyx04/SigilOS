---
description: Amorce de reprise — Rush : merger A/B, puis E1 du studio God (3 panneaux), file des chantiers
---

# 🧭 Amorce — Rush : éditeur God (E1→E5) + file des chantiers

> **Rôle unique.** Ce fichier **cadre la prochaine session** : ce qui est livré, ce qu'on merge,
> par quel lot on commence, et ce qui reste. Il **ne duplique pas** le plan :
> `docs/plans/REFONTE-EDITEUR-RUSH.md` (E1→E5) et `docs/ROADMAP.md` (ordre unique) font foi.
> **Dernière MAJ : 05/11/2026.**

## 0. État au 05/11/2026 — A, B et **E1** livrés

| Lot | Branche | État |
|---|---|---|
| **A — déplacement** | `fix/rush-move-sequence` | **mergée** (#1254) |
| **B — split** | `feat/rush-split-blocks` | **mergée** (#1255) |
| **Docs — cette amorce** | `docs/amorce-rush-editeur` | **mergée** (#1256) |
| **E1 — squelette** | `feat/rush-editor-e1` | **livré** : studio 3 panneaux, hors de `src/app/god/**` |

- `dev` = `175eeb84` + E1 · studio = `src/components/god/rush-editor/RushEditorStudio.tsx`
  (**5 242 l.**, l'app file est un **ré-export**) · **77/77** fichiers `src/app/god/**` ·
  **68** fichiers `rush-*` / **857** tests · suite **605 / 6 384** · dette DA **644** motifs (674 avant).
- **E1** : `RushEditorShell` (3 panneaux), `RushEditorTopbar` (barre unique + recherche),
  `RushEditorTree` (arbre + filtres), `RushEditorInspector`, `RushEditorCommandPalette` (`Ctrl+K`),
  règles pures `src/lib/rush-editor-selection.ts` ; garde `UnsavedChangesGuard` + modale au
  changement de cible ; responsive **1024 / 768**. **Aucun formulaire dans la liste**.
- **Reste connu** : l'édition inline du **séparateur** (E3) ; la découpe du monolithe en
  `forms/`·`list/`·`fields/` (E2/E3/E4) ; la base **locale** garde 19 quêtes de classe en
  `classReq='cra'` (patch local séparé, hors dépôt). Détail : `REFONTE-EDITEUR-RUSH.md` §3
  (« Reste de E1 »).

> ⚠️ Les états ci-dessus sont ceux du **05/11**. À la reprise : `gh pr list --state open` et
> `git log -1 --oneline origin/dev` avant de conclure.

## 1. Avant de coder — 3 gestes

1. Merger la PR **E1** (`feat/rush-editor-e1`) vers `dev`.
2. `git switch dev && git pull` ; créer la branche du prochain lot **depuis `dev`**.
3. Lire : `AGENTS.md` · `docs/ROADMAP.md` (rang **59** `god-rush-ux`, rang **10** `rush-donnees`) ·
   `docs/plans/REFONTE-EDITEUR-RUSH.md` · `docs/agents/activeContext.md` (bloc 05/11 E1) · les **9**
   verrous sources du §3.

## 2. Prochain lot — E2, l'inspecteur de quête

**Objectif** : le formulaire de quête (**1 552 lignes**) devient lisible sans rien perdre : **3 groupes**
(**Essentiel** : titre, route, conseils · **Contenu** : prérequis, donjons, ressources, liens ·
**Avancé**), sections **vides masquées**, footer **sticky**, **brouillon local**, « Déplacer vers »
en tête, jumelles / suppression dans un menu « … », **aperçu membre** à côté.

**Livrable**
- `src/components/god/rush-editor/forms/**` (à créer) : découpe de `SequenceEditForm` en sections ;
  `SequenceEditForm` reste le **seul point d'entrée** — le contrat de l'inspecteur ne change pas.
- Allègement du monolithe `RushEditorStudio.tsx` : sortir `SequenceEditForm`, `AddSequenceForm`,
  `BlockInspectorForm` et les champs partagés (`fields/`), **sans changer le JSX des champs**.
- Les **9** verrous sources sont repointés sur un **bundle de dossier** (`walk` + concat, comme
  `god-deslop`) dès qu'un marqueur quitte le fichier principal ; **assertions inchangées**.

**Interdits E2**
- Pas de nouvelle route, pas de migration, pas de re-seed.
- Pas de changement d'action serveur ; pas d'import de code serveur dans un composant client.
- Ne pas affaiblir les verrous ; l'ordre des `blockOf` doit rester valide.

**Preuves attendues**
- `rush-editor-inspector` (nouveau) : 3 groupes, sections vides masquées, footer sticky, brouillon
  local, « Déplacer vers » en tête, menu « … », aperçu.
- Les **9** verrous verts · Rush ≥ **857** tests · suite complète · `tsc` 0 · ESLint 0 erreur.
- Contrôle visuel 390 / 768 / 1024 / 1440.

**Taille** : L (1-2 PR). Détail : `REFONTE-EDITEUR-RUSH.md` §3 (E2).

## 3. File des chantiers (l'ordre reste `docs/ROADMAP.md`)

| File | Chantier | Prochain lot | Plan |
|---|---|---|---|
| **Éditeur** | `god-rush-ux` (rang 59) | **E2** inspecteur quête → E3 bloc/masse/problèmes → E4 DA → E5 finitions (**E1** livré) | `REFONTE-EDITEUR-RUSH.md` |
| **Données** | `rush-donnees` (rang 10) | **V-H** ocre (27 donjons) → V-C purge WebP → bloc B (route par quête) | `MODULE-RUSH-SYLVESTRE.md` · `RUSH-DEVELOPPEMENT-SUITE.md` |
| **Contenu** | dans rang 10 | 194 conseils (98 Brâkmar sans source), 18 réf. Ali/Ordre, V-D2 (51 + 67 ids) | `MODULE-RUSH-SYLVESTRE.md` §D |
| **Public** | `espace-visiteur` (rang 57) | V1 auth + tables (**migration ⇒ accord**) → V2 guide public + annuaire | `PLAN-ESPACE-VISITEUR.md` |
| **Overlay** | lot **D** du plan éditeur | payload figé → route live (petit lot séparé) | `REFONTE-EDITEUR-RUSH.md` §5 |

**Séquence de session recommandée** (l'ordre global reste le ROADMAP) :
`E2` → `V-H` (petit, visible) → `E3` (panneau Problèmes : 15 Bonta, 194 tips, 336 qids, 73 tags) →
contenu → `E4` → `D` → `E5` → `bloc B` / `espace-visiteur` (décision).

## 4. Décisions à trancher (elles changent l'ordre)

- **E2** : position dans le bloc cible → **ajout en fin + réordonnancement** (recommandé) ou choix de la position.
- **E3** : blocs de palier vides après split → suppression (recommandé) ou repères INFO.
- **D** : overlay live en lot **séparé** (recommandé ; E1 est livré, ne pas le rouvrir) ou inclus dans E2.
- **Bloc B** : `publicSlug` / `isPublished` n'ont **aucune route** ; cadrer la page publique ou retirer les colonnes (**migration ⇒ accord**).
- **V-D2** : chercher les 51 ids Tougli / 67 Dofusyelle, ou acter la cible 517.
- **Espace visiteur** : GO migration (il règle cité / Ordre / classe du public).
- **G9** : célébration à arbitrer.

## 5. Ce qu'on ne fait pas maintenant

- Re-seed du guide (écraserait les éditions God).
- T-6 (perf) sans profiler.
- Drop `alignOrderReq` / `achievements[]` sans GO (migrations).
- Un lot Rush empilé sur une branche non mergée : **chaque lot repart de `dev`**.

## 6. Définition de fini (par lot)

`npm run test:run` · `npx tsc --noEmit` · `npm run lint` · `git status --short` propre ·
`docs/ROADMAP.md` + `activeContext` · aucune migration sans GO · rapport final ≤ 15 lignes.
