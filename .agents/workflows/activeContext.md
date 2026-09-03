# Active Context — SigilOS

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
- 🔴 **Ops** — `prisma migrate deploy` (migration `alignmentBefore`) : néces. BDD + commande infra, **non lancée**.
- 🔴 **Ops** — Ménage `Songes_Pour_Les_Noobs/` (177 f, 8.4 Mo) → `git rm -r --cached`.
- 🟠 **Data** — 15 `unresolved` restants (Feuille de Salace, Mesure de poivre, Bière du Chabrulé, Poiskaille en Fricassée, Kamas, « L' », phrases « ou 1 x »…) : pas d'équivalent `name.fr[]` DofusDB → mapping manuel ou acceptation.
- 🟠 **Data** — Intégrer les 15 quêtes « Apprentissage » (Ordres) : hors des 374 séquences ; mapping `alignReq`/camp requis.
- 🟡 **UI** — Liens NOOBS/DOFUSDB → modale (aujourd'hui nouvel onglet).
- 🟡 **UI** — Badges `activityTags` → pack « 2 » + « +N » sur le dashboard (l'overlay l'a déjà).
- 🟡 **UI** — Responsive : auto-replier aussi la barre de chapitre / le bloc recherche sur très petite hauteur ; mode compact en fallback auto très petit.
- 🟡 **Perf** — Factoriser `getSequenceHelpers` par guide / agréger « qui peut aider » par chapitre.
- 🟣 **Tech** — Nettoyer `as any` (~70 admin, ~64 timeline) ; confirmer suppression `RushOverlayQuestPanel.tsx` (orphelin).

## Références clés
- Backlog canonique : `docs/ROADMAP.md` (à lire en premier en mode plan).
- Demandes ouvertes + annotations : `src/temp/chantier-actif.md`.
- Plan maître #223 : `src/temp/refonte-long-terme-discord-compatibilite/PLAN-MAITRE-RESILIENCE-DISCORD-LONG-TERME.md` + `sigilos-discord-resilience.md`.
- Dernier mémo détaillé : `src/temp/memo-2026-10-06-chantier-fiche-boss.md`.

## Vérifications globales habituelles
`npx tsc --noEmit` 0 · `npm run test:run` vert · `npm run build` OK · pas de `console.*` en prod.
