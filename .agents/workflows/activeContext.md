# Active Context — SigilOS

## État actuel (chantier Overlay Rush Sylvestre très mature + dashboard à finir)
- ✅ **Module Rush Sylvestre** (guide) **fonctionnel** — S4 « qui peut aider » (métier+niveau), S6 micro-célébration, S5 éditeur GOD (import icônes), S7 contexte chapitre (PR #571–#576 mergés dans `dev`).
- ✅ **Overlay Rush Sylvestre TRÈS MATURE** (`GuideOverlayClient` + `components/RushOverlay*`) : recherche globale accent-insensible, arbre de chapitres (`<select>` + progression), objectif doré « À FAIRE MAINTENANT », modale **Ressources** globale (bascule **Restantes/Toutes**, décrément en direct via `aggregateRushResources(milestones, completedSeqIds)`), modale Membres (qui est là), modale tutoriel, mode compact, header **7 boutons** (thème, ressources, masquer faites, tutoriel, dashboard, **bug**, **reset**) + puce **personnage** (pseudo+classe Main/Mule), validation « chapitre » fiable (synchro `completedStepsByMs` + rollback), blocs non cochables (`SEPARATEUR`/`INFO`/`DOFUS_OBTAINED`), `goToNextMs` saute les blocs faits, exclusivité validé/repère, **synchro dashboard↔overlay** via `BroadcastChannel` (`useGuideProgressSync`).
- ✅ **Fix bug « repère disparaît après 2 s »** : le dashboard ne relisait que `seq:`-préfixé dans son effet `[milestones]` → il republiait un snapshot vide → l'overlay écrasait le repère. Normalisation brut/`seq:` + validation par séquences (init + resync) + `handleBookmark` préserve les autres blocs.
- ✅ **Fiche Boss & Simulation tactique** (Dofensive) **TERMINÉ** — sync local-first (`DofensiveDungeon`/`DofensiveMap`/`MonsterStat`, crons `/api/cron/…`), refonte `SuccesBossGuide`, simulation AoE (`SpellRangeGrid`), sorts enrichis.
- ✅ **Hygiène récente** : PWA icônes (#573), hydration #418 (#577), dé-duplication veille Discord (#578), télémétrie cron (#579), fix Prisma `sync-members` (#580).

## PR en cours
- **#580** `fix/sync-members-prisma-include-select` — corrige erreur Prisma `include+select`. ✅ mergé.
- **Ce chantier** (branche `fix/cron-maintenance-scripts`) : refonte/UX overlay + correctifs dashboard Rush + bug repère → PR vers `dev`.

## Branche de travail actuelle
`fix/cron-maintenance-scripts` (contient les 3 commits cron poussés + ce chantier overlay/dashboard Rush).

## NEXT (priorités)
- **🟡 Dashboard Rush Sylvestre — reste à finir (aligner sur l'overlay)** : ① modale **Ressources** globale + bascule **Restantes/Toutes** (l'overlay l'a via `aggregateRushResources`, le dashboard n'a que `RushChapterSidebar` par chapitre) ; ② « Signaler » (`QuestFeedbackButton`) pré-remplit le **contexte d'étape** (`context`) comme dans l'overlay (`overlayBugContext`) ; ③ puce **personnage** Main/Mule persistante dans le module (le sélecteur existe via `CharacterQuestSelector`, pas de badge) ; ④ supprimer `RushOverlayQuestPanel.tsx` (orphelin, non importé) ; ⑤ résoudre les ressources `kind:"unresolved"` (tâche données — re-run `scripts/resolve-rush-sylvestre-item-tags.mjs`).
- **#223 Résilience Discord long terme** (échéance **16/11/2026**) — P3+ : outbox BullMQ/Redis écritures Discord, révocation session Auth.js sur `APPLICATION_DEAUTHORIZED`, rapatrier fetch directs (`dungeon-finder-actions`, `service-actions`, `profile-actions`, `god-discord-actions`), veille mensuelle changelog + jour J.
- **Restes prioritaires** : #192 darkmode modale Succès · #186a perf (useOptimistic/prefetch/skeletons/virtualisation) · #129 responsivité · #34/#194 télémétrie God Insights · #197 PWA · #198 Badges · #196 API Webhooks · #143 dépendances API · #38 siphonnage WebP.
- **Anti-slop restant** : worldmap, Songes, Guides · purge `AuroraBackground` · micro-typo.

## Références clés
- Backlog canonique : `docs/ROADMAP.md` (à lire en premier en mode plan).
- Demandes ouvertes + annotations : `src/temp/chantier-actif.md`.
- Plan maître #223 : `src/temp/refonte-long-terme-discord-compatibilite/PLAN-MAITRE-RESILIENCE-DISCORD-LONG-TERME.md` + `sigilos-discord-resilience.md`.
- Dernier mémo détaillé : `src/temp/memo-2026-10-06-chantier-fiche-boss.md`.

## Vérifications globales habituelles
`npx tsc --noEmit` 0 · `npm run test:run` vert · `npm run build` OK · pas de `console.*` en prod.
