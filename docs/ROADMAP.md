# 🗺️ ROADMAP — SigilOS (backlog priorisé + workflow de session)

> **Ce fichier est LA référence en mode plan.** Le backlog priorisé y est condensé.
> À chaque session, lire **uniquement** : `docs/ROADMAP.md` + `src/temp/chantier-actif.md`
> (+ `PROMPT_START.md` pour les exigences de type).
> **Historique long** (`CONTEXT.md` intégral, `src/temp/chantier.md`, `archive/`) : **À LA DEMANDE UNIQUEMENT**.
> Réouvrir l'historique en mode plan = gaspillage de tokens.

---

## 🧭 Règle mode plan (économie de tokens)

1. Lire `docs/ROADMAP.md` + `src/temp/chantier-actif.md`.
2. Ouvrir `PROMPT_START.md` pour le bloc exigences (type : dev / sécu / infra / SEO / données).
3. Ouvrir un fichier de référence (`RULES.md`, `SECURITY.md`, `MAINTENANCE.md`, `docs/SEO_REPRISE.md`)
   **uniquement si la tâche le touche**.
4. NE JAMAIS ouvrir en plan mode : `src/temp/chantier.md`, `CONTEXT-historique-*.md`,
   `src/temp/archive/`, `docs/audits/`. (Historique → consultation ponctuelle.)

---

## 🔴 Bloquant / Prod

- **#57 — Ouverture prod** : checklist `docs/DECISION-OUVERTURE-LANDING.md`
  (+ `src/temp/checklist-ouverture-prod-57.md`). Action VPS : retirer `rewrite * /maintenance.html`
  sur `sigilos.fr`, noindexer la beta, resoumettre le sitemap, remplir les URLs Discord
  (CU / privacy / install), vérifier `/legal/*`. **+ trancher la décision landing immersive** (`page.tsx`).

## 🔴 En cours / continuation

- ✅ **Game Data — État des lieux & UI (27/08)** (`feat/chantier-2026-08-27-game-data-ui`, branche créée depuis `dev`, PR → dev) :
  **bug « Siphonner les quêtes » corrigé** (DofusDB pagine via `$limit`/`$skip` — avec `limit`/`page` l'API renvoie `total:0` → « 0 quête siphonnée », reproduit) ·
  dé-doublonnage des points d'entrée (`/god/game-data` → `redirect` vers l'onglet canonique `/god?tab=game-data`,
  qui porte déjà stats réelles + GameDataInterface + EventZoneManager) · galerie des modales (succès/boss) enrichie
  (**recherche** + **suppression d'image**, nouveau `DELETE /api/god/list-local-images` fail-closed anti path-traversal) ·
  onglets aérés (rangée unique qui défile, padding/gap élargis) · onglet Quêtes clarifié (« Import initial » vs « Synchronisation »).
  Vérifs : **test:run 340/340** · **tsc 0** · **eslint 0 erreur** · **build OK**. Mémo : `src/temp/memo-2026-08-27-game-data.md`.
  ⚪ RESTE (optionnel) : « Archis & Boss » = onglet (tab) **et** route standalone `/god/game-data/archimonstres` (2 views du même module) ·
  2 galeries d'assets parallèles (`LocalImagePicker` vs `AssetGalleryModal`) à unifier · `EventZoneManager` à ne monter qu'une fois ·
  déploiement = re-build app.
  ➕ **Compléments (27/08 — A/B/C)** : `searchGameQuests` = **local-first + fallback DofusDB** (le picker membre profite désormais du fallback,
  + test `tests/unit/quest-picker-fallback.test.ts`) · bouton « Associer familles (auto) » = matching **normalisé** (casse/accents) + diagnostic
  `archisWithZone` (explique quand 0 association) · onglet Import/Export documenté (couverture = **4 tables** seulement, export Git **dev-only**,
  **complémentaire** au siphon DofusDB — pas obsolète mais partiellement supplanté). Vérifs : test:run **343/343** · tsc 0 · build OK.
  ✅ **COMMIT + PUSH** : `4b58cfe45` sur `feat/chantier-2026-08-27-game-data-ui` (poussée → origin, PR → dev). Ajouts finaux :
  donjon à 0 succès **visible** dans `/succes?dungeon=` (`SuccesTracker`) · même emplacement + **plusieurs boss** (aide de sémantique +
  seed `scripts/seed-harebourg-double-boss.ts` pour les 4 variantes du Comte Harebourg) · fiche boss = **map du boss uniquement**
  (`SpellRangeGrid`, filtre `shownMaps`). RESTE : merger la PR → dev · `sudo ./scripts/deploy-cd.sh beta` (aucun migrate Prisma,
  pas de changement de schéma) · siphonner les quêtes + ajouter les 4 variantes (UI recommandé ou seed tsx). `#57` ouverture prod toujours bloquant.

- 📌 **Doubles boss & module Défi (27/08, ONE SHOT A+B+C+D)** (`feat/chantier-2026-08-27-double-boss-defi`, depuis `feat/chantier-2026-08-27-game-data-ui`, PR → dev) :
  **A — Correctif doubles boss + dropdown map** : cause racine = `bossName` « Comte + Klime » ne matche pas le monstre Dofensive → `shownMaps` affichait toutes les maps. Fix = dissociation **affichage / résolution** : `name`/`bossName` restent « Comte et X », + 2 champs optionnels `Dungeon.dofensiveMonsterName` (`Klime`…) + `Dungeon.dofensiveDungeonName` (« Donjon du Comte Harebourg ») → `resolveDofensiveDungeonDirect` cible la bonne « Balcon » (et lève l'ambiguïté vs les donjons **solo** homonymes). `SpellRangeGrid` ne retombe plus sur toutes les maps. Script `scripts/fix-double-boss-resolution.ts` (idempotent, préserve les donjons solo) + seed MAJ. ·
  **B — Donjon sans succès** : toggle « Donjon sans succès » (`Dungeon.isNoAchievement`) → pseudo-succès « Donjon validé » (challenge `donjon-valide`) relié au donjon → cochable dans « Mes Succès ». ·
  **C — Sources communautaires** : déplacé dans les `actions` du `UnifiedModuleHeader` (`succes/page.tsx`). ·
  **D — Module « Défi »** : modèle dédié `Defi` + `UserDefiProgress` + `DjSearchMode`=DEFI ; onglet « Défi » God (`DefiManager`) et `/succes` (`SuccesDefiTab`) ; 3ᵉ mode DJ (pièce, embed, clôture → `applyDefiValidation`), filtres/cartes/détail/close ; type image `defi` whitelisté.
  Vérifs : **test:run 344/344** · **tsc 0** · **build OK** · eslint 0 erreur. Mémo : `src/temp/memo-2026-08-27-double-boss-defi.md`.
  ⚠️ **Migration** `20261006000000_add_defi_double_boss_resolution` (SQL manuel) — la base locale est en **drift** (`add_inter_guild`), ne pas faire `migrate dev` (reset), utiliser **`prisma migrate deploy`** en CI/prod. Merger **d'abord** la PR game-data-ui → dev (fichiers communs). ⚪ RESTE (non fait) : multi-défis DJ, annuaire « qui a fait / pas fait » par membre (compteur simple), ingestion Dofensive des boss de défi, flag événement.
- **#223 — Résilience Discord long terme** (point dur **16/11/2026**)
  P0 + P1 + P2 + fix CodeQL : ✅ FAIT + MERGÉ (PR #520, `6e5a779a3`).
  **RESTE (P3)** : outbox BullMQ/Redis écritures Discord · révocation session Auth.js sur
  `APPLICATION_DEAUTHORIZED` · rapatrier les fetch directs restants
  (`dungeon-finder-actions`, `service-actions`, `profile-actions`, `god-discord-actions`) ·
  veille mensuelle changelog + jour J.
  📄 Plan maître : `src/temp/refonte-long-terme-discord-compatibilite/PLAN-MAITRE-RESILIENCE-DISCORD-LONG-TERME.md`
  · ⚠️ §12 = VEILLE (à relire à chaque itération Discord).
- **Fiche Boss / Simulation** (06/10, terminé — 283/283) — ✅ **25/08** (`feat/chantier-2026-08-25-succes-fiche-boss-map-dofensive`, PR #548) : resolution donjon multi-boss par **token-overlap** (gère « Temple de l'Eliocalypse » ↔ « Tempête de l'Eliocalypse » chez Dofensive, générique pour futurs DJ) → la vraie map Dofensive (Déluge 204476422) se charge ; passage du `dungeonName` au resolver. ⚪ RESTE : icônes résistances/vitalité
  `public/assets/module-succes/*.png` (**à brancher ou supprimer**, chantier en cours) · onglet
  « Mes succès / Succès Commun » · prévisu zone sous-monde · bug faces noires 3D · butin par grade · zaaps · (option « graphe multi-boss en cartes séparées » à cadrer).
- **Accès membres / Discord (25/08)** : réglé le « Accès Banni » après réintégration (invalidation cache+session, PR #541 mergée) + UX « Exclure (réintégrable) ». **✅ CHANTIER 25/08** (`feat/chantier-2026-08-25-acces-timeout-archivage`) : reflet du **timeout Discord** (écran « Accès Temporairement Suspendu » + compte à rebours) · bug « Accès Banni » après réintégration définitivement corrigé (tombstone `findFirst({ liftedAt: null })`) · `wipeUserProfile` crée son tombstone · `getGuildMemberBans` sans `take:100` · **archivage auto 12 mois** · messaging honnête Archiver vs Supprimer. ⚪ RESTE (→ #223 résilience Discord) : invalidation des caches `member:`/`roles:`/`user:ctx` à un **changement de rôle / timeout Discord** — cache membre en mémoire (process app) non partageable avec le bot Gateway → Redis/endpoint interne ; + « Supprimer définitivement » réel = retrait du rôle d'accès Discord via le bot.
- **🧪 Session debug 26/08** (`feat/chantier-2026-08-26-dofus-icones-locales`, PR → dev) : fixes console/UI —
  icônes Dofus servies en **local** (`/module-dofus/*.png`, helper `dofus-image-url.ts` local-first, plus de dofusdb pour le profil/hub) ·
  recherche Ressources : partie **dofusbook retirée** (dofusdb seul) · recette craft sans « Copier la liste » ni copie/quantité (nom seul) ·
  WS `/socket.io/*` : **fix CORS même-origine** (400 → temps réel OK) · bloc **« Tarifs Forgemagie » retiré** de la carte Métiers du profil ·
  **Sigil Bomb** : volume son appliqué, décompte 3s synchronisé, mort subite **pré-avertie** (~3 échanges) + nouveau réglage (on/off + nb d'échanges).
  Vérifs : tsc 0 · eslint 0 · **340/340**. Mémo : `src/temp/memo-2026-08-26-fixes-console-ui-sigil-bomb.md`.


## 🟠 Bloc B — UX / Perf (valeur immédiate)

- **#186a** Optimistic UI (`useOptimistic` sur Rejoindre/Cocher/Toggle) + prefetch routes +
  skeletons + **virtualisation** (ladder, annuaire, galerie).
- **#129 / #1038** Responsivité : audit composant par composant (sweep à poursuivre).

## 🟠 Retours user (suite #202)

- **#227** — ✅ FAIT (24/08) : Épuration globale UI des notifications (cloches `NotificationBell` / `FeedBell` / `GodNotificationPanel` / page notifs — harmonisation des badges de compteurs, suppression des glow/gradients et ombres criardes, tokens OKLCH, dates en français).
- **#228** — ✅ FAIT + VALIDÉ (23/08, `feat/chantier-2026-08-23-one-shot`) : garde appliquée à galerie /
  présentation / services / donjons + interception `router.push`/`replace` **validée** : mécanisme confirmé
  sur Next 16 (`useRouter()` → instance router partagée & modifiable, `window.next.router`). Tests unitaires
  ajoutés (`tests/unit/unsaved-changes-guard.test.ts` : `isDirty` + `isExecutableScheme` sécu).

## 🟡 Bloc C — Fonctionnalités (valeur moyenne)

- **#198** Badges & Achievements (méta-succès, configurable God, raretés, ping Discord épique/légendaire).
- **#71** Prêts / Coffre : rappel auto @ping si prêt non clos (cron worker), historique/export par guilde, refonte modale.
- **#265** Épuration cartes + filtres + mode multi-donjons (2-5) + multi-embed Discord unique (1 ping).
- **#196 + #197** API Webhooks (HMAC, rate-limit, retry, OpenAPI) + PWA (service worker, push, install) — même socle.

## 🟡 Bloc D — God / Télémétrie

- **#34 / #194** Refonte Télémétrie God + **God Insights** (WAU/MAU, funnel d'activation, heatmap
  d'activité par module/heure, alertes, export).

## 🟢 Long terme / à planifier

#38 WebP items/ressources (God game-data) · #190 Worldmap (routes farm, zaaps, mines, traversées de mer)
· #175 écart Ganymède→Sylvestre · #172 musiques de fond + réglages son + interface God sons
· #205 Guesser (dictionnaires API, modale fin d'épreuve responsive) · #234 audit scalabilité worldmap/guesser
· #40 benchmark galerie stuff · #1610 sécurité/infra (à cadrer en réunion) · #186b SEO long terme
· #4 grille agenda (semaine/mois) · #188 passe module Succès · #229 plan de croissance (**NOT FAIT**, lié ouverture prod).

## ✅ Déjà soldé (surveiller)

- **#242** — ✅ FAIT (26/08) : Refonte UI/UX de la **Fiche Boss** (module Succès) — `SuccesBossGuide.tsx` dé-sloppé (tokens OKLCH, type-scale, suppression ombres/`font-black`/`tracking-widest`/`transition-all`/scales, couleurs en dur→tokens) + enrichissement des onglets (synthèse « Mécaniques clés — N sorts à anticiper », cartes sorts détaillés en sections Effet principal / Déclenchement / Effets critiques, grades alignés à droite, butin en cartes homogènes icône+nom+taux, monstres de salle compacts). Vérifs : tsc 0 · lint 0 erreur · 339/339 · build OK.

#192 bouton « Suivant » · #199 tour tuto Succès · #202 / #204 RBAC · #206 Dofoobz centralisé
· #223 P0/P1/P2 · #127 audit RBAC · #85 blacklist embeds · #169 · #101 SEO almanax · #176 fiches boss
· #181 privacy OCR · #96 README déploiement CD · #41bis circuit-breaker Dofusbook · #140 landing God → `page.tsx`
· ✅ #228 garde anti-nav (4 formulaires + `router.push`/`replace` — interception validée + tests) · ✅ #226 cartes dj/quêtes (P1/3/4, P5 drawer → modale fermable, P2 hiérarchie créneau en tête, P6 transitions) · ✅ #225 Dokille (édition image God + seed 4 quêtes Safari + prérequis + trackeur krokilles 20 archis) · ✅ #233 Guide gestion guilde & Discord (permissions, architecture, sorties, synergie SigilOS) · ✅ #208 Planning & dispos (plages horaires explicites, icônes distinctes, chips textuelles) · ✅ #209 Contraste bouton « Suivant » / « Créer » Calendrier (`text-warning-foreground`) · ✅ #221 Polish UI/contrastes (onglets création Songes, modale marché Ocre + filtre hideOwned, harmonisation boutons DofusDB) · ✅ #224 Fiches Boss & Siphon (chargement instantané du catalogue, lazy-loading par boss sélectionné avec cache, sous-onglets épurés, alertes/notifications God crons siphon Dofensive, fix réactivité MonsterImage au changement de boss, garde isNumericId anti-CUID route proxy `/?url=`, monsterId de grille gardé par `typeof number`) · ✅ #180 Ocre, Metamob Sync, Troc & Place de Marché UI (transfert unitaire strict -1/+1, troc bilatéral avec étape archimonstre, boutons de stock +/-, refonte onglets) · ✅ Songes UI (bouton clôturer dé-jauni dark mode, boutons pros h-11) · ✅ Module Monumental Reaction Roles (RBAC, 4 modes NORMAL/UNIQUE/VERIFY/REVERSE, 2 styles BUTTONS/SELECT_MENU, swap auto removeRoleId, prérequis, blacklists, simulateur Discord live, 1-clic deploy, packs d'icônes GOD drag & drop visual importer) · ✅ Module Monumental Bot Ticket Discord Pro (Flotte GOD /god/ticket-bot, Module Guilde /dashboard/[guildId]/tickets, Inbox Zendesk-like, Formulaires Intake Modals dynamiques, Multi-Panels Discord live simulateur, Transcripts HTML horodatés, Notes internes staff chiffrées, Enquête CSAT 1-5 étoiles, RBAC staff:tickets) · ✅ Gestion membres & accès (`liftGuildMemberBan` : invalidation `user:ctx` + purge sessions à la réintégration · action « Supprimer » → « Exclure (réintégrable) » + modale honnête, PR #541). (#207 FAQ · #23/#134 avatar · #26/#177 donjons : traités/poussés le 23/08.)

- ✅ **#542 / #544 — Infra build & déploiement (25/08)** : pin `prisma@7.9.1` partout. **#542** = `npx prisma` dans `services/discord-bot/Dockerfile` (CI build du bot KO car `npx prisma` tirait `prisma@latest` = RC cassée `8.0.0-rc.10` sans la cmd `generate`). **#544** = pin dans `deploy-cd.sh` / `deploy.sh` / `audit.sh` (deploy VPS en ÉTAPE 4/5 : « No command registered for `migrate` »). ⚠️ Règle : **toujours épingler `prisma@<version>`** dans les cas où le CLI n'est pas installé localement (image runner = `.next/standalone`). ⚪ RESTE (optionnel) : durcir `deploy-cd.sh` (re-exec après `git pull` réussi — piège du « SHA local »).


---

## 🔄 Workflow d'une session (sur une branche propre)

1. `git checkout dev` puis `git pull origin dev`.
2. Créer la branche : `git checkout -b feat/chantier-<AAAA-MM-JJ>-<sujet>`
   (ex : `feat/chantier-2026-08-23-ouverture-prod`).
3. **ONE SHOT** : 1 chantier = 1 session (max 2 petits). Limite le scope, facilite la revue.
4. Avant tout commit : `npm run test:run` + `npm run build` (tsc + lint inclus).
   Ne jamais committer : `docs/audits/`, `src/audit-*`, `AUDIT_*.md`, `.env*`, `src/temp/`.
5. Mettre à jour en fin de session : `src/temp/chantier-actif.md` (statut) + `docs/ROADMAP.md` +
   un mémo `src/temp/memo-<AAAA-MM-JJ>-<sujet>.md`.
6. Pousser `feat/...` → PR vers `dev` (jamais directement sur `main`/`dev`).

## 📌 Semaine type (ordre conseillé)

1. **Semaine 1** : trancher la décision landing immersive → exécuter la checklist #57 (ouverture prod)
   + #227 / #228 (retours user).
2. **Semaine 2** : **Bloc B** (perf dashboard : Optimistic UI + virtualisation) — valeur ressentie max.
3. **Semaine 3** : un choix — **#198 Badges** (engagement) OU **#71 rappels prêts** (bouchage).
4. **En creux** (si session longue) : #223 P3 Discord + reliquats fiche boss (#188 icônes module-succès).
5. **Veille** : relecture du changelog Discord avant le **16/11/2026** (jour J résilience).
