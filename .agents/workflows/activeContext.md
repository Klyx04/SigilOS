# Active Context — SigilOS

## État actuel (chantier Rush Sylvestre — 03/09)
- ✅ **Module Rush Sylvestre** (guide) **fonctionnel** — S4 « qui peut aider » (métier+niveau), S6 micro-célébration, S5 éditeur GOD (import icônes), S7 contexte chapitre (PR #571–#576 mergés dans `dev`).
- ✅ **Positions GPS copiables** dans l'overlay (liste, modale détail, objectif courant) via `RushCoordinateChip` + helper central `getSequenceCoord` (priorité `pos_tags` > titre > tips > note) dans `rush-guide-utils.ts`.
- ✅ **Dashboard aligné sur l'overlay** : modale **Ressources** globale (bascule **Restantes/Toutes** via `aggregateRushResources`), badge Main/Mule, fix `/travel` **2D** (plus de `worldId` parasite collé à la commande), suppression anciennes stats-pills, sidebar chapitre (rail).
- ✅ **Sync chapitre** : clic sur un header de chapitre (feed) → sélection auto dans la sidebar « Chapitres » (état partagé `activeChapter`).
- ✅ **Copie du nom** d'une ressource (sans le chiffre) → modale ressources / liste overlay / sidebar chapitre (helper `copyToClipboard`).
- ✅ **Fix clipboard overlay** : `RushCoordinateChip` consomme `src/lib/clipboard.ts` (fallback `execCommand` pour webview / PiP) → n'affiche « Copié » que sur succès réel.
- ✅ **Ressources 200 → 515** : cause racine = séquence « Ressources à prévoir » **absente en base** (seed non idempotent). Corrigé en base (insert 477 items) + **seed rendu idempotent** (CLI `seed-rush-sylvestre-cli.mjs` + action serveur `seedRushSylvestreFromGuide`).
- ✅ **Item tags** : résolution accent-insensible + dictionnaire d'alias → unresolved **38→15** ; enrichissement propagé aux séquences DB.
- ✅ **Validation** : `tsc` 0 · `eslint` 0 erreur (fichiers touchés) · `vitest` **474/474**.

## PR / Branche
- **Ce chantier** → branche `feat/rush-sylvestre-refonte` (créée depuis `fix/cron-maintenance-scripts`) → PR vers `dev`.
- `dev` est ancêtre de la branche courante → merge propre (fast-forward possible).

## NEXT (priorités — à faire)
- 🔴 **Ops** — `prisma migrate deploy` (migration `alignmentBefore`) : néces. BDD + commande infra, **non lancée**.
- 🔴 **Ops** — Isoler le travail : branche `feat/rush-sylvestre-*` + PR `dev`. (En cours.)
- 🟠 **Ops** — Ménage `Songes_Pour_Les_Noobs/` (177 f, 8.4 Mo) → `git rm -r --cached`.
- 🟠 **Data** — 15 `unresolved` restants (Feuille de Salace, Mesure de poivre, Bière du Chabrulé, Poiskaille en Fricassée, Kamas, « L' », phrases « ou 1 x »…) : pas d'équivalent `name.fr[]` DofusDB → mapping manuel ou acceptation.
- 🟠 **Data** — Intégrer les 15 quêtes « Apprentissage » (Ordres) : hors des 374 séquences ; mapping `alignReq`/camp requis.
- 🟡 **UI** — Liens NOOBS/DOFUSDB → modale (aujourd'hui nouvel onglet).
- 🟡 **UI** — Badges `activityTags` → pack « 2 » + « +N » sur le dashboard (l'overlay l'a déjà).
- 🟡 **Perf** — Factoriser `getSequenceHelpers` par guide / agréger « qui peut aider » par chapitre.
- 🟣 **Tech** — Nettoyer `as any` (~70 admin, ~64 timeline) + retirer `RushOverlayQuestPanel.tsx` (déjà supprimé du working tree).

## Références clés
- Backlog canonique : `docs/ROADMAP.md` (à lire en premier en mode plan).
- Demandes ouvertes + annotations : `src/temp/chantier-actif.md`.
- Plan maître #223 : `src/temp/refonte-long-terme-discord-compatibilite/PLAN-MAITRE-RESILIENCE-DISCORD-LONG-TERME.md` + `sigilos-discord-resilience.md`.
- Dernier mémo détaillé : `src/temp/memo-2026-10-06-chantier-fiche-boss.md`.

## Vérifications globales habituelles
`npx tsc --noEmit` 0 · `npm run test:run` vert · `npm run build` OK · pas de `console.*` en prod.
