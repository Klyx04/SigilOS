# Active Context — SigilOS

## Chantier du jour (2026-09-04) — Rush Sylvestre : Pense-bête + modale de lancement + config GOD (PR #588)
> Branche `feat/chantier-2026-09-03-rush-ui-pense-bete` (9 commits) → PR #588 (base `dev`), **MERGEABLE**.
- ✅ **Retrait bouton + modale « Ressources » du dashboard** (conservés dans l'overlay).
- ✅ **Pense-bête** : bouton + modale **lecture seule** (liste des choses à préparer, une seule croix de fermeture).
- ✅ **Modale de lancement (4 étapes)** : choix perso → **préparation** (Metamob détecté + bouton « Lier », reset alignement optionnel, **métiers requis** déclarés ✓ / non déclarés → bouton « Déclarer ») → avancée membres → prêt. **Reset « Réinitialiser ce personnage »** ré-ouvre la modale ; **reset d'un autre perso (main + mules)** depuis la modale.
- ✅ **Config UI/UX éditable GOD** : `OptimizedGuide.rushUIConfig` (JsonB) + migration `20261013000000_add_rush_ui_config` + action `updateRushUIConfig` (audit `GOD_RUSH_UI_UPDATE`). **Onglet GOD « Lancement »** : aperçu + éditeur pense-bête (CRUD sections/items, métiers + **alternative**, **réordonnancement ↑/↓**) + toggles modale. **Fallback statique** si config vide. Côté membre : `resolveRushUIConfig`.
- ✅ **UI polish** : badges activité « pack +N » sur le dashboard (`classifyTags`), **célébration au changement de chapitre** (jade), **checkboxes 3 états** (à faire / en cours doré / terminée jade).
- ✅ **Bloc alignement** → lien vers `/dashboard/[guildId]/profile` (plus d'édition inline).
- ✅ **Modale Ocre +/−** : re-render immédiat + patch Metamob en direct (état local).
- ✅ **Fix** crash `AlignmentSection` (profil) — garde-fou `ORDERS[selectedAlignment] || []`.
- ✅ **Prisma** : migrations locales bloquantes résolues (`20261009`-`20261013`) → `Database schema is up to date!` (colonne `rushUIConfig` en base).
- ✅ **Vérifs** : `tsc` 0 · `eslint` 0 · vitest 484/484 · `npm run build` OK.

## État actuel (chantier Rush Sylvestre — session UX/sync)
- ✅ **Module Rush Sylvestre** (guide) **fonctionnel** — S4 « qui peut aider » (métier+niveau), S6 micro-célébration, S5 éditeur GOD (import icônes), S7 contexte chapitre (PR #571–#576 mergés dans `dev`).
- ✅ **Positions GPS copiables** dans l'overlay (liste, modale détail, objectif courant) via `RushCoordinateChip` + helper central `getSequenceCoord` (priorité `pos_tags` > titre > tips > note) dans `rush-guide-utils.ts`.
- ✅ **Dashboard aligné sur l'overlay** : modale **Ressources** globale (bascule **Restantes/Toutes** via `aggregateRushResources`), badge Main/Mule, fix `/travel` **2D** (plus de `worldId` parasite), suppression anciennes stats-pills, sidebar chapitre (rail). **Sync chapitre** : clic sur un header de chapitre (feed) → sélection auto dans la sidebar.
- ✅ **Copie du nom** d'une ressource (sans le chiffre) → modale ressources / liste overlay / sidebar chapitre (helper `copyToClipboard`).
- ✅ **Fix clipboard overlay** : `RushCoordinateChip` consomme `src/lib/clipboard.ts` (fallback `execCommand` pour webview / PiP) → n'affiche « Copié » que sur succès réel.
- ✅ **Ressources 200 → 515** : cause racine = séquence « Ressources à prévoir » **absente en base** (seed non idempotent). Corrigé en base (insert 477 items) + **seed rendu idempotent** (CLI `seed-rush-sylvestre-cli.mjs` + action serveur `seedRushSylvestreFromGuide`).
- ✅ **Item tags** : résolution accent-insensible + dictionnaire d'alias → unresolved **38→15** ; enrichissement propagé aux séquences DB.
- ✅ **Images ressources LOCAL-FIRST** : `resolveItemImage` sert directement le WebP siphonné `/uploads/assets-dofus/items/{id}.webp` (0 appel proxy, **0 dépendance DofusDB**) ; fallback `getItemImageFallback` → proxy (siphon à la volée). Composant partagé `ResourceImage` (`onError` → proxy). Les `249` items enrichis en remote DofusDB deviennent autonomes.
- ✅ **Modale Ressources « Restantes » décrémente** : cause = le dashboard passait `completedIds` (IDs de **chapitres**) à `aggregateRushResources` (filtré sur IDs de **séquences**) → rien n'était exclu. Corrigé : `allCompletedSeqIds` (séquences validées, en incluant les chapitres validés d'un coup) utilisé pour `resourcesRemaining` ; `gateAllCompleted` (overlay) inclut aussi les séquences des chapitres complétés d'un coup. **Synchro live** (BroadcastChannel).
- ✅ **Overlay responsive / compact** :
  - Scroll des quêtes **visible** : `<main>` passe en `min-h-0 overflow-y-auto overscroll-contain custom-scrollbar` (le `flex-1` seul ne scrollait pas, `min-height:auto`).
  - Panneau « À faire maintenant » **repliable** + chips en **rangée unique** (flex-nowrap, plus de wrapping) ; **auto-repli** quand l'overlay est réduit (`defaultCollapsed`).
  - Header **compact** : masque le label « Guide de progression » + la ligne perso, paddings réduits, **menu ⋯** regroupant les actions secondaires (tutoriel/guide/reset) — détection fiable de la taille réelle via **ResizeObserver** sur le conteneur (plus de `window.matchMedia` trompeur).
- ✅ **Validation** : `tsc` 0 · `eslint` 0 erreur (fichiers touchés) · `vitest` **484/484** (dont tests `resolveItemImage`/`getItemImageFallback` et `aggregateRushResources`).

## PR / Branche
- **Session UX/sync** → branche **`feat/rush-sylvestre-ux-v2`** (créée depuis `origin/dev` = `b185e5e61`, après merge PR #586) → PR vers `dev`.
- Merge propre : aucun chevauchement de fichiers avec `dev` (seuls `package-lock.json` + `sync-actions.ts` différaient dans `origin/dev`).

## NEXT (priorités — à faire)
- ⚠️ **Prod/Infra** — `prisma migrate deploy` sur l'env **déployé** : en local c'est réglé (`resolve --applied` sur `20261009`-`20261013`). À refaire là-bas si même cause « already exists ».
- 🔴 **Ops** — Ménage `Songes_Pour_Les_Noobs/` (177 f, 8.4 Mo) → `git rm -r --cached`.
- 🟠 **Data** — 15 `unresolved` restants (Feuille de Salace, Mesure de poivre, Bière du Chabrulé, Poiskaille en Fricassée, Kamas, « L' », phrases « ou 1 x »…) : pas d'équivalent `name.fr[]` DofusDB → mapping manuel ou acceptation.
- 🟠 **Data** — Intégrer les 15 quêtes « Apprentissage » (Ordres) : hors des 374 séquences ; mapping `alignReq`/camp requis.
- 🟡 **UI** — Liens NOOBS/DOFUSDB → modale (aujourd'hui nouvel onglet).
- 🟡 **UI** — Responsive : auto-replier aussi la barre de chapitre / le bloc recherche sur très petite hauteur ; mode compact en fallback auto très petit.
- 🟡 **Perf** — Factoriser `getSequenceHelpers` par guide / agréger « qui peut aider » par chapitre.
- 🟣 **Tech** — Nettoyer `as any` (~70 admin, ~64 timeline) ; confirmer suppression `RushOverlayQuestPanel.tsx` (orphelin).

## Références clés
- 🎨 **SOURCE D'ICÔNES OFFICIELLE (permanente, tout module)** : `C:\Users\user\Desktop\dofus_assets` (~23 770 fichiers : icônes 1x/2x, items 2x, sorts, monstres, UI…). On peut y piocher des icônes pour n'importe quel module, **UNIQUEMENT après les avoir proposées au user ET validées** avant intégration.
- Backlog canonique : `docs/ROADMAP.md` (à lire en premier en mode plan).
- Demandes ouvertes + annotations : `src/temp/chantier-actif.md`.
- Plan maître #223 : `src/temp/refonte-long-terme-discord-compatibilite/PLAN-MAITRE-RESILIENCE-DISCORD-LONG-TERME.md` + `sigilos-discord-resilience.md`.
- Dernier mémo détaillé : `src/temp/memo-2026-10-06-chantier-fiche-boss.md`.

## Vérifications globales habituelles
`npx tsc --noEmit` 0 · `npm run test:run` vert · `npm run build` OK · pas de `console.*` en prod.
