---
description: Amorce de reprise — Rush : merger A/B, puis E1 du studio God (3 panneaux), file des chantiers
---

# 🧭 Amorce — Rush : éditeur God (E1→E5) + file des chantiers

> **Rôle unique.** Ce fichier **cadre la prochaine session** : ce qui est livré, ce qu'on merge,
> par quel lot on commence, et ce qui reste. Il **ne duplique pas** le plan :
> `docs/plans/REFONTE-EDITEUR-RUSH.md` (E1→E5) et `docs/ROADMAP.md` (ordre unique) font foi.
> **Dernière MAJ : 05/11/2026.**

## 0. État à la rédaction — deux PR empilées, aucune mergée

| Lot | Branche | PR | Base | État |
|---|---|---|---|---|
| **A — déplacement** | `fix/rush-move-sequence` | **#1254** | `dev` | ouverte, mergeable |
| **B — split** | `feat/rush-split-blocks` | **#1255** | `fix/rush-move-sequence` | ouverte, **empilée** |
| **Docs — cette amorce** | `docs/amorce-rush-editeur` | à ouvrir | `feat/rush-split-blocks` | empilée |

- `dev` = `79a60282` à la rédaction · studio = **5 242 lignes** · **77/77** fichiers `src/app/god/**` ·
  **66** fichiers `rush-*` / **817** tests · suite **603 / 6 344**.
- **A** : `moveRushSequence` — le bouton « Déplacer vers » existe et ne perd plus la route (Ordre / palier / classe / icône).
- **B** : `splitRushSequence` + bouton « Scinder en N quêtes » — les blocs bêta (palier 20, Ordre 5, 19 classes)
  deviennent des quêtes individuelles, route conservée, progression reportée.
- **Reste connu** : la base **locale** a encore les 19 quêtes de classe en `classReq='cra'` ; le split bêta
  utilise `RUSH_CLASS_QUESTS` (19 entrées justes). Un patch local séparé est à faire.

> ⚠️ Les états ci-dessus sont ceux de la **rédaction**. À la reprise : `gh pr view 1254/1255` et
> `git log -1 --oneline origin/dev` avant de conclure.

## 1. Avant de coder — 4 gestes

1. Merger **#1254**, puis **#1255** (retarget de #1255 sur `dev` après le merge de #1254).
2. Merger cette amorce (retarget sur `dev`).
3. `git switch dev && git pull` ; créer la branche du prochain lot **depuis `dev`** — jamais depuis une branche empilée.
4. Lire : `AGENTS.md` · `docs/ROADMAP.md` (rang **59** `god-rush-ux`, rang **10** `rush-donnees`) ·
   `docs/plans/REFONTE-EDITEUR-RUSH.md` · `docs/agents/activeContext.md` (bloc 05/11) · les **7** verrous sources du §3.

## 2. Prochain lot — E1, le squelette du studio

**Objectif** : arrêter de perdre sa place. Un **studio 3 panneaux** (arbre / liste / inspecteur), une barre
unique, une recherche, et les formulaires **existants montés tels quels** dans l'inspecteur. Aucune
réécriture de formulaire en E1.

**Livrable**
- `src/components/god/rush-editor/**` (**à créer**) : `shell`, `topbar`, `tree`, `inspector-host`,
  `command-palette`, `selection`.
- `src/app/god/rush-sylvestre/RushSylvestreAdminClient.tsx` devient une **coquille mince** (importe le shell) ;
  **aucun fichier neuf dans `src/app/god/**`** (plafond 77/77 — les nouveaux composants vivent **hors** du dossier God).
- Arbre persistant chapitres → blocs → quêtes ; recherche (nom, qid, bloc, cité / Ordre / classe) ; filtres ;
  `Ctrl+K` ; garde de sauvegarde (`UnsavedChangesGuard`) ; responsive (arbre en `Sheet` < 1024, inspecteur en `Sheet` < 768).
- Les formulaires `SequenceEditForm` / bloc sont **montés dans l'inspecteur**, pas réécrits.

**Interdits E1**
- Pas de nouvelle route, pas de migration, pas de re-seed.
- Pas d'import de code serveur dans un composant client.
- Ne pas affaiblir les 7 verrous sources ; mise à jour des **chemins** seulement.

**Preuves attendues**
- `rush-editor-shell` (nouveau) : 3 panneaux, arbre, recherche, sélection, garde, **zéro formulaire inline dans la liste**.
- Les **7** verrous existants verts : `rush-alignment-source`, `rush-god-studio-robustesse`, `rush-prereq-id`,
  `rush-route-tooling`, `rush-sylvestre-construction`, `rush-tips-block-studio`, `rush-twin-branch`.
- Rush **≥ 817** tests · suite complète · `tsc` 0 · ESLint 0 erreur.
- Contrôle visuel 390 / 768 / 1024 / 1440.

**Taille** : L (1-2 PR). Détail des lots E2→E5 : `REFONTE-EDITEUR-RUSH.md` §3.

## 3. File des chantiers (l'ordre reste `docs/ROADMAP.md`)

| File | Chantier | Prochain lot | Plan |
|---|---|---|---|
| **Éditeur** | `god-rush-ux` (rang 59) | **E1** squelette → E2 inspecteur quête → E3 bloc/masse/problèmes → E4 DA → E5 finitions | `REFONTE-EDITEUR-RUSH.md` |
| **Données** | `rush-donnees` (rang 10) | **V-H** ocre (27 donjons) → V-C purge WebP → bloc B (route par quête) | `MODULE-RUSH-SYLVESTRE.md` · `RUSH-DEVELOPPEMENT-SUITE.md` |
| **Contenu** | dans rang 10 | 194 conseils (98 Brâkmar sans source), 18 réf. Ali/Ordre, V-D2 (51 + 67 ids) | `MODULE-RUSH-SYLVESTRE.md` §D |
| **Public** | `espace-visiteur` (rang 57) | V1 auth + tables (**migration ⇒ accord**) → V2 guide public + annuaire | `PLAN-ESPACE-VISITEUR.md` |
| **Overlay** | lot **D** du plan éditeur | payload figé → route live (petit lot séparé) | `REFONTE-EDITEUR-RUSH.md` §5 |

**Séquence de session recommandée** (l'ordre global reste le ROADMAP) :
`E1` → `E2` → `V-H` (petit, visible) → `E3` (panneau Problèmes : 15 Bonta, 194 tips, 336 qids, 73 tags) →
contenu → `E4` → `D` → `E5` → `bloc B` / `espace-visiteur` (décision).

## 4. Décisions à trancher (elles changent l'ordre)

- **E2** : position dans le bloc cible → **ajout en fin + réordonnancement** (recommandé) ou choix de la position.
- **E3** : blocs de palier vides après split → suppression (recommandé) ou repères INFO.
- **D** : overlay live dans le même lot que E1, ou séparé (recommandé).
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
