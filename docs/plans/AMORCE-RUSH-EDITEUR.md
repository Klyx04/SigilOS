---
description: Amorce de reprise — Rush : ce qui est livré (E1→E3b), les décisions prises, la file des chantiers restants
---

# 🧭 Amorce — Rush : éditeur God, route et guides (reprise)

> **Rôle unique.** Ce fichier **cadre la prochaine session** : ce qui est livré, ce qui reste,
> par quoi commencer et **quelles décisions sont déjà prises** (pour ne pas les re-débattre).
> Il ne duplique pas : `docs/ROADMAP.md` (ordre unique) · `docs/plans/REFONTE-EDITEUR-RUSH.md`
> (E1→E5) · `docs/plans/MODULE-RUSH-SYLvestre.md` (contenu) · `docs/reference/TOUGLI-API.md`.
> **Dernière MAJ : 12/11/2026.**

## 0. État au 12/11/2026

| Élément | Valeur mesurée |
|---|---|
| Branche | `feat/rush-route-variants` (lot **4**) — lots **1**, **2**, nav et reset mergés dans `dev` |
| PR | **#1346→#1351** mergées · PR du **lot 4** à ouvrir |
| Suite | **666 fichiers / 7 153 tests ✓** · `tsc` 0 · ESLint 0 erreur |
| Studio | `RushEditorStudio.tsx` **~5 300 lignes** (5 472 au départ) · dette DA **644 → 577** |

**Livré sur cette branche** (du plus ancien au plus récent) :

- **E2c** — onglet **Branches actionnable** (`panels/RushBranchesCockpit.tsx` : emplacement rempli =
  la quête s'ouvre ; emplacement vide = création **pré-remplie** cité + Ordre + palier + classe) ;
  **Lancement** et **Config** en pleine largeur (aperçu membre réel) ; `fields/RushClassSelect.tsx`
  et `panels/RushRoutePreview.tsx` sortis du monolithe.
- **E2b** — inspecteur quête en **3 groupes** (`src/lib/rush-editor-sections.ts`), **pied sticky**,
  « Déplacer vers » en tête, scission derrière un menu « … », **sections vides masquées** + « Tout afficher ».
- **E2d** — bouton **Plein écran** : la **même** instance dans une modale 1 100 px ; inspecteur
  élargi **520–720 px** au-delà de 1536 px.
- **E3a** — **route du bloc** dans l'inspecteur (elle vivait sous la ligne dépliée), **séparateur**
  édité au même endroit, **quêtes du bloc** listées + « + Quête » (`tests/unit/rush-block-inspector.test.ts`).
- **E3b** — onglet **« Problèmes »** (`src/lib/rush-editor-problems.ts` + `panels/RushProblemsPanel.tsx`),
  5 familles, pastille de compte, **pagination 12 puis 50** ; **menu « … »** par quête.
- **Correctifs** — `selectQuest` **bascule sur Contenu** (sinon aucun clic ne semblait marcher) ;
  un camp `alignment_set` qui **contredit la route** est signalé (`alignmentSetContradictsCamp`) ;
  **route publique à 3 étages** (le guide public ne filtrait que la cité : 15 quêtes d'Ordre au lieu
  de 5, 19 classes au lieu d'une) ; **vocabulaire** quête / bloc / chapitre (`tests/unit/rush-vocabulary.test.ts`).
- **Doc** — `docs/reference/TOUGLI-API.md` (API **mesurée** le 12/11 : endpoints, formes réelles,
  modèle `choice` / `condition`).

## 1. Avant de coder — 3 gestes

1. **PR #1346 mergée** le 12/11 (`e04dbe58`, squash) : `git switch dev && git pull`, puis créer la
   branche du lot **depuis `dev`**.
2. Lire : `AGENTS.md` · `docs/ROADMAP.md` (rang **59** `god-rush-ux`, rang **10** `rush-donnees`,
   rang **57** `espace-visiteur`) · `docs/plans/REFONTE-EDITEUR-RUSH.md` §3 · le bloc **12/11** de
   `docs/agents/activeContext.md`.
3. `npm run dev` → `/god/rush-sylvestre` : **contrôler ce qui est livré avant d'ajouter**.

> ⚠️ Les états ci-dessus sont ceux du **12/11**. À la reprise : `gh pr list --state open` puis
> `git log -1 --oneline origin/dev` — ne jamais conclure depuis ce tableau seul.

## 2. Décisions déjà prises (12/11/2026 — ne pas les re-débattre)

| Sujet | Décision |
|---|---|
| **Reset de progression** au changement de cité/Ordre | **OUI** — automatique, sur le personnage sélectionné (mule comprise), avec annonce de ce qui a été décoché |
| **Texte différent selon le camp** pour une même quête | **OUI** — mais **migration à trancher** : colonne `routeVariants Json?` **ou** deux quêtes « Jumelle » |
| **Numérotation des blocs** dans les guides navigateur | **OUI** — même règle que l'overlay (`rushChapterPosition`) |
| **E2a-reste** (découper les 3 formulaires) | **proposé à l'abandon** : les verrous lisent déjà le **dossier**, un déplacement ne casse plus rien, et c'est invisible pour l'utilisateur |
| **API Tougli** | **jamais d'appel à l'exécution** (88 Ko à 1,2 Mo) ; usage = veille / import ponctuel |

## 3. La file des chantiers restants

| # | Lot | Quoi exactement | Taille | Bloqué par |
|---|---|---|---|---|
| 2 | **2 contrôles « Problèmes »** | ✅ **livré le 12/11** — voir la note ci-dessous | S | — |
| 3 | **Reset automatique** | ✅ **livré le 12/11** — `alignmentChangeReset` + `resetProgressOnAlignmentChange` avant l'écriture, annonce `cleared`, actions manuelles supprimées | M | décision prise (§2) |
| 4 | **Variante de texte par camp** | ✅ **livré le 12/11** — colonne `routeVariants Json?` (migration additive), résolution dans `resolveRushRoute` (3 surfaces), studio « Texte par camp » | M | **GO migration** (donné) |
| 5 | **Brouillon local** (E2b-suite 2/2) | `localStorage` par quête, restauration au rechargement, purge à l'enregistrement | M | — |
| 6 | **E3c — sélection multiple** | cocher N blocs/quêtes → route / déplacer / supprimer ; **action serveur en masse à créer** (Zod, rate limit Redis, garde guilde, `logGodWrite`) | L | — |
| 7 | **E4 — dette DA** | **577** motifs interdits → 0 dans `RushEditorStudio.tsx` | M | — |
| 8 | **E5 — finitions** | raccourcis (Ctrl+S, Échap, Alt+↑/↓, J/K), virtualisation, états vides/chargement | M | — |
| 9 | **V-C — images** | purge WebP / nettoyage (ops VPS : le local n'a pas tous les donjons) | M | humain |
| 10 | **V-D2** | 51 ids Tougli + 67 Dofusyelle, ou acter la cible **517** | ? | arbitrage |
| 11 | **Bloc B** | route publique du bloc (`publicSlug` / `isPublished` posés en base, **aucune route**) | L | arbitrage |
| 12 | **Fiche visiteur — affinage** | deslop assets / hiérarchie, sans règle métier | M | — |
| 13 | **Flaky** | `tests/unit/lot4-slash-commands-api-keys.test.ts` dépasse son timeout de 5 s sous charge (**5 023 ms** mesurés) | S | — |

**Ordre recommandé** : **13 → 5** → **7** → **6** → **8** → 9/10/11/12 selon arbitrage.

> **Lot 1 livré le 12/11/2026** — branche `feat/rush-numerotation-blocs` : table partagée
> `rushChapterNumbers` (bandeaux exclus), calculée une fois sur le guide complet et passée aux
> deux guides ; l'ancien index brut est supprimé des deux surfaces. Verrou `rush-block-numbering`.

> **Lot 2 livré le 12/11/2026** — branche `feat/rush-problemes-route` : `class-quest-misrouted`
> (nom citant une classe **en mot entier** ≠ `classReq`) et `alignment-quest-without-camp`
> (Ordre ou palier sans cité). ⚠️ **Mesure locale (seed 5433)**, pas la prod : 19 quêtes de classe
> toutes en `cra`, 4 détectables par leur nom ; le VPS a ses éditions God — **aucune correction de
> données**, c'est l'écran qui dit la vérité.

> **Navigation par bloc livrée le 12/11/2026** — branche `feat/rush-nav-blocs` : le sommaire des
> deux guides liste **tous les blocs numérotés** (chapitre en mention secondaire) et le dashboard
> passe à **une page = un bloc** ; le mode **« Tout »** est supprimé (c'était le rendu des 54 blocs
> d'un coup). Repère, prérequis et « Reprendre » visent le bloc. **Corrigé** : le pager ancre sur
> `#guide-blocs` et le rail (progression, donjons, objets) est calculé sur le **bloc** affiché.

## 4. Interrogations tranchées — le modèle de route (à relire avant de créer le guide)

**Une seule route**, filtrée **par données** (`resolveRushRoute`), **avant** la vue, les prérequis et
l'agrégation des ressources. Quatre champs par quête — **vide = commune** :

| Ce que tu veux | Ce que tu saisis |
|---|---|
| Quête commune (le gros du guide) | **rien** |
| Quête bontarienne | Cité = **Bontarien** |
| Quête d'Ordre | Cité + Ordre + Palier (20/40/60/80/100) |
| Quête de classe (les 19) | Classe = Féca / Iop / … (**une seule** par quête) |
| Quête différente selon le camp | **deux quêtes** au même endroit, une par camp (bouton **« Jumelle »**) |

- **Changement d'alignement en cours** : l'**affichage** suit immédiatement (route recalculée depuis
  le profil). La **progression** n'était pas réinitialisée → c'est le lot **3**.
- **Tougli** fait la même chose autrement : trame linéaire d'`objectives` + `choice` portant une
  `condition: "Classe=Feca"`, résolue par le personnage actif. Formes mesurées et correspondance
  champ par champ : `docs/reference/TOUGLI-API.md`.
- **Trois unités, trois mots** (verrou `rush-vocabulary`) : **quête** (ligne cochable) · **bloc**
  (regroupement du guide) · **chapitre** (regroupement de blocs — la pagination 1/5).

## 5. Points de vigilance

- **PR #1346** est déjà grosse (30 fichiers) : un correctif urgent part en **PR séparée**, pas empilé.
- **« Problèmes » ne couvre pas** les deux erreurs de saisie du lot 2 : tant qu'elles manquent, une
  quête de classe oubliée s'affiche pour **les 19 classes**.
- **Flaky connu** : `lot4-slash-commands-api-keys` (timeout 5 s) — sans rapport avec le studio, mais
  il fait rougir la suite complète une fois sur deux.
- **Dette DA** : 577 motifs encore dans le studio ; E4 est le seul lot qui la fait baisser.

## 6. Ce qu'on ne fait pas maintenant

- Re-seed du guide (écraserait les éditions God).
- Drop de colonnes (`alignOrderReq`, `achievements[]`) — migration ⇒ GO.
- Appel Tougli à l'exécution, ou données Tougli dans le HTML servi.
- Un lot Rush empilé sur une branche non mergée : **chaque lot repart de `dev`**.

## 7. Définition de fini (par lot)

`npm run test:run` · `npx tsc --noEmit` · `npm run lint` · `git status --short` propre ·
`docs/ROADMAP.md` (statut) + bloc `activeContext` · **aucune migration sans GO** ·
contrôle visuel 390 / 768 / 1024 / 1440 · rapport final ≤ 15 lignes.

---

**Commandes de reprise**

```bash
gh pr view 1346 --json state,mergeStateStatus
git switch dev && git pull
git switch -c feat/<lot> origin/dev
npm run install:safe ; docker compose up -d db redis ; npx prisma migrate deploy
npm run dev
```

