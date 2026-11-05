# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).

## 📝 Session 05/11/2026 — **Rush : le déplacement d'une quête réparé (lot A)** — branche `fix/rush-move-sequence`

> **Demande user (verbatim)** : « ok pour les lots … l'editeur god rush … je dois pouvoir manipuler ici pendant des h sans chercher partout » → le lot A (déplacement) de la reprise, avant la refonte E1→E5.
> **Mesures** : ① le contrôle « Déplacer vers » ne s'affichait **jamais** : `MilestoneRow` passait `milestones={[milestone]}` à `SequenceEditForm`, donc `milestones.length > 1` était toujours faux ; ② l'action appelée (`upsertRushSequence`) **ignorait `milestoneId`** et remettait `alignOrderCode`, `alignLevelReq`, `classReq`, `isSuccess`, `icon`, `metamobMonsterId` à `null`/`false` (perte de route) ; ③ `RushSylvestreAdminClient.tsx` = **5 128 lignes**, **405** motifs UI interdits, **77/77** fichiers God.
> **Fait** : action dédiée `moveRushSequence` (Zod borné, rate limit 60/min, transaction, cible relue dans le même guide, séparateur + bloc Conseil/Tips refusés, no-op même bloc) qui n'écrit que `milestoneId` + `order` (`nextSequenceOrder`) ; `SequenceEditForm` reçoit la liste complète des blocs et appelle `onMove` ; mise à jour optimiste + `router.refresh()` en échec ; garde en commentaire dans `upsertRushSequence`. Plan de la refonte : `docs/plans/REFONTE-EDITEUR-RUSH.md`.
> **Preuves** : `rush-move-sequence` **10** · Rush **65 / 805 ✓** · suite **602 / 6 332 ✓** · `tsc` 0 · ESLint 0 erreur · **aucune migration**.
> **Reste / ops** : E1 (squelette 3 panneaux) → E2 → B (split bêta) → E3 → E4 → D → E5 ; contrôle visuel du studio (le contrôle « Déplacer vers » est visible en bas du formulaire, à remonter dans l'inspecteur en E2).
> **Rotation** : bloc « 04/11/2026 (suite 4) — Fluidité du scroll » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

## 📝 Session 04/11/2026 (suite 9) — **Module DJ/Quête : la DA landing partout** — branche `feat/dj-da-landing`

> **Demande user (verbatim)** : « dans le module dj quete pk on reaplique pas partout le theme landing plus propre sobre ? … les boutons etc » · « ouvert caché par la croix » · « le bouton soutenir qui cache le bas » · « le dropdown de transfert immonde, les bouton stand by etc tout doit etre sobre landing like » · « on a pas indiqué dans les skills qu'on doit systématiquement uniformiser comme les landing partout sur le produit ? ».
> **Mesures** : ① le tiroir empilait `emerald-*`/`amber-*` en dur (≈ 45 occurrences) + `rounded-2xl` + ombres colorées ; la carte de post ajoutait `backdrop-blur-sm` et un `hover:-translate-y-0.5` ; ② la croix du `Sheet` (absolue à droite) recouvrait le badge « Ouvert » posé dans le même coin (`px-5` sans réserve) ; ③ le transfert de lead était un **`<select>` natif** (options bleues du navigateur) ; ④ `SupportOrb` était en `z-[100]`, donc **au-dessus** du tiroir (`z-50`) et des boutons d'action ; ⑤ la règle UI existante disait « deslop » mais **pas** « une seule DA, celle de la landing, partout ».
> **Fait** : ① `docs/RULES.md` gagne la section **« UI — une seule DA (la landing), partout »** (+ ligne miroir dans `.clinerules/02-ui.md`) ; ② tiroir : `pr-12` (croix), badges `success`/`warning`, boutons uniformes `h-11 rounded-xl` (secondaires neutres, « Terminer » en `success`), input et sélecteur de classe en tokens ; ③ transfert de lead en **`Select` maison** (Radix) ; ④ carte : `rounded-xl`, plus de blur ni de lift, statuts/avatars/places en tokens, « Terminer » en `success` ; ⑤ `SupportOrb` en `z-40` (sous les modales) ; ⑥ verrou `ui-tokens-dj` (4 tests : couleurs en dur, `pr-12`, `Select`, z-index).
> **Preuves** : `ui-tokens-dj` **4/4** · `tsc` 0 · ESLint 0 erreur (warnings `<img>` antérieurs) · ROADMAP < 60 Kio (2 doublons `RUSH-*` retirés).
> **Reste / ops** : passe identique sur les modales de **création** (`DjPostCreateModal` : 65 occurrences) et d'édition, `DungeonFinderClient` (11), `DjFiltersBar` (9) — même règle, lot suivant ; contrôle visuel 390 / 768 / 1024 / 1440 du tiroir et de la liste.
> **Rotation** : bloc « 04/11/2026 (suite 3) — Avatars Discord » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 04/11/2026 (suite 8) — **Barre du haut : vrais visuels d'événements, zéro boîte imbriquée** — branche `feat/headbar-evenements-assets`

> **Demande user (verbatim)** : « dans le bouton event header bar ajoute la vrai asset de l'event … titan : tu affiche son icone, idem donjons, idem mission » · « texte pas responsive à l'intérieur du flux » · « ce contour là, et cette barre verticale on garde ca c ui 2026 ? » · « pk un contour + un autre dans la date ? ».
> **Mesures** : ① le bouton ne connaissait que le Kralamoure, en **PNG statique** (`kralamoure-head.png`), tout le reste retombait sur un picto calendrier + `animate-ping` ; ② les miroirs DJ portent `metadata.source.mode` (`DONJON`/`TITAN`) + `metadata.mirror.names`, mais `getUpcomingGuildEvents` **jetait** ce metadata ; ③ en base : `Dungeon` « Antre du Kralamoure Géant » → `/game-data/dungeons/antre-du-kralamoure-g-ant.webp`, `Titan` « Gargandyas » → `/game-data/titans/gargandays.webp` (chemins réels) ; ④ le cluster cumulait **deux** séparateurs au même endroit (un dans `SmartBar`, un `border-r`) + une bordure externe ⇒ une boîte dans la boîte ; ⑤ le titre `[Titan] …` est le format **généré par `djMirrorTitle`** (pas une devinette).
> **Fait** : ① `eventIllustrationRef(metadata, title)` + `isKralamoureEvent` (purs, `calendar-event-images`) : metadata d'abord, **repli titre** `[Titan]`/`[DJ]` pour les miroirs anciens, résolution BDD bornée (≤ 2 requêtes, noms tronqués à 80) puis repli sur le visuel du type ; ② `UpcomingEvent.imageUrl`, `metadata` **retiré** de la charge client ; ③ `EventThumb` (repli `onError` sur le picto Dofus) dans le bouton **et** la liste ; ④ `TYPE_COLOR` supprimé au profit de `calendarEventTheme` (source unique) ; ⑤ cluster : **zéro contour, zéro séparateur**, icônes nues 36 px, badge de date **sans boîte** ; ⑥ libellés complets en `xl`, nom/rôle du profil tronqués (`7rem` / `12rem`) ; ⑦ `kralamoure-head.png` supprimé (0 référence code + 0 `DocPage` locale).
> **Preuves** : `calendar-event-images` **18** (11 neufs) · `harness-config` **9** · suite **600 fichiers / 6 316 tests ✓** · `tsc` 0 · ESLint 0 erreur · ROADMAP 61 347 o (< 60 Kio, 2 doublons `RUSH-*` retirés).
> **Reste / ops** : contrôle visuel 390 / 768 / 1024 / 1440 (bouton, popover, profil) ; `kralamoure-head.png` : 0 `DocPage` en local, bêta/prod non mesurables.
> **Rotation** : bloc « 04/11/2026 (suite 2) — Annonces de créateurs » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 04/11/2026 (suite 7) — **Stats, Phase 2b : la colonne morte est supprimée** — branche `chore/stats-phase2b`

> **Demande user (verbatim)** : « c'est quoi le mieux ? » — après la question d'accord sur une suppression **irréversible** ; choix retenu : drop, avec sauvegarde et bêta d'abord.
> **Mesures** : ① la colonne ne portait plus aucune lecture : `readGuildModules` merge champ par champ sans `stats` (`module-actions.ts:117-146`), `GUILD_CONFIG_CACHE_SELECT` ne la sélectionne pas (`user-actions.ts:428-469`) ; ② en base locale, **6 lignes `GuildModules` dont 1 à `stats = false`** ⇒ la donnée perdue est réelle, pas seulement un défaut ; ③ asset `guildActivity.png` : **0** référence code, **0** `DocPage` locale ; ④ `stats` existe aussi dans `MonsterStat`/`MarketListing` ⇒ le verrou de test scope le **modèle** `GuildModules` ; ⑤ `deploy-cd.sh` démarre l'image **puis** joue `migrate deploy` : après le drop, l'image précédente ne peut plus tourner.
> **Fait** : ① schéma sans `stats` + migration écrite à la main `20270125000300_drop_guild_modules_stats` (`DROP COLUMN IF EXISTS`, en-tête **irréversible** + SQL inverse documenté) ; ② `RETIRED_MODULE_KEYS` retiré (`module-types` + filtre télémétrie) ; ③ `LEGACY_MODULE_LABELS` retiré, `moduleLabel("stats")` rend `stats` ; ④ asset orphelin supprimé ; ⑤ `stats-page-removal` réécrit en **10 tests** (schéma scopé, SQL exact, absence de compat, asset) ; ⑥ fixtures `stats: true` retirées (`onboarding-console`, `user-context`) ; ⑦ `prisma-schema-change.md` gagne un § « migration destructive ».
> **Preuves** : `stats-page-removal` **10** · `user-context` **46** · `onboarding-console` **19** · `telemetry-product-stats` **11** ⇒ **86/86 ✓** · colonne absente en base (`information_schema` = 0) · `migrate deploy` + `generate` joués.
> **Reste / ops** : **`pg_dump` avant** `migrate deploy` en bêta puis prod ; **aucun rollback vers l'image pré-drop** (le client Prisma précédent sélectionne `stats`) — procédure d'urgence = `ADD COLUMN IF NOT EXISTS … DEFAULT true`, valeurs perdues ; conteneur local `sigilos-app` (image du 23/10/2026) à recréer s'il sert encore.
> **Rotation** : bloc « 04/11/2026 — Rush : ressources par quête » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 04/11/2026 (suite 6) — **Stats, Phase 2a : la clé quitte le registre, la colonne reste** — branche `chore/stats-phase2a`

> **Demande user (verbatim)** : « on casse quoi rien j'espère ? » — puis « GO » sur la Phase 2a (nettoyage code, sans migration).
> **Mesures** : ① `canViewStats` est un **alias strict** de `canViewWelcome` (`DASHBOARD_LOGIN || isAdminFinal`), consommé uniquement par la sidebar (2 conditions), `user-actions` et 4 assertions de test — aucun service/bot ; ② la colonne `GuildModules.stats` n'est lue que par `module-actions` (`dbModules.stats`) et le `select` de `getUserContext` ; la **supprimer** exposerait un rollback et les vieux clients Prisma (`column does not exist`) ; ③ `RETIRED_MODULE_KEYS` filtre déjà la colonne dans la télémétrie et `moduleLabel("stats")` garde le libellé historique ; ④ `tsc` a révélé deux écrans oubliés (ordre God, explorateur de modules) qui listaient encore la clé.
> **Fait** : ① `stats` retiré de `ModuleKey`, `GuildModulesState`, `DEFAULT_MODULES`, du Zod et du merge de `module-actions`, du `select` et du `applyModule` de `user-actions` ; ② `canViewStats` retiré (type, défauts, calcul, application, verrou onboarding) et les 2 conditions sidebar ramenées à `canViewWelcome || canViewPresentation` — **aucun changement de visibilité** ; ③ 4 assertions retirées, le verrou « `stats:view` ne donne pas Audit Logs » conservé ; ④ `stats-page-removal` étendu à **8 tests**, entrées `stats` retirées de l'explorateur de modules et de l'ordre God ; ⑤ **conservés** : colonne `GuildModules.stats`, `RETIRED_MODULE_KEYS`, libellé legacy, asset `guildActivity.png` — **aucune migration**.
> **Preuves** : `stats-page-removal` **8** · `user-context` **46** · `module-lock` **27** · `onboarding-funnel` **34** · `modules-select` **3** ⇒ **118/118 ✓** · suite **600 fichiers / 6 305 tests ✓** · `tsc` 0 · ESLint 0 erreur · **aucune migration**.
> **Reste / ops** : Phase 2b (hors lot) — `DROP COLUMN` seulement après la fenêtre de rollback, avec accord explicite ; sinon la colonne peut rester indéfiniment.
> **Rotation** : bloc « 04/11/2026 — Rush : 25 conseils écrits » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 04/11/2026 (suite 5) — **Suppression de la page morte « Stats Guilde »** — branche `chore/remove-stats-page`

> **Demande user (verbatim)** : « analyse 'src/temp/debug.md' … attention je veux uniquement supprimer cette page de stat morte et ses composants sans casser d'autres composant utilisés » — puis « oui » au libellé legacy.
> **Mesures** : ① le mémo était faux sur `guild-stats-actions.ts` : `getGuildStats` alimente aussi **`QuickStatsRow`** sur l'accueil du dashboard — la supprimer cassait l'accueil ; ② la page = **15 fichiers** (page + 14 composants), tous privés à `stats-client.tsx` ; ③ la télémétrie d'adoption relit **`GuildModules` en direct** (`moduleKeysOf`), donc `stats` serait réapparu comme module « activé non mesuré » — pas seulement dans l'historique ; ④ `docs-modules.test.ts` exige que chaque clé de `MODULE_DOC_COVERAGE` existe dans `MODULE_GROUPS` : catalogue et doc doivent partir ensemble ; ⑤ `module-lock.test.ts` listait `stats/page.tsx` en dur.
> **Fait** : ① suppression des **15 fichiers** ; ② catalogue (`MODULE_GROUPS`, `MODULE_DOFUS_ASSETS`, import `BarChart3`), `MODULE_ROUTES`, **3 alias** sidebar, tour stats (`STATS_STEPS`, phase, route) et entrée du bouton de replay retirés ; ③ `MODULE_DOC_COVERAGE.stats` retiré ; ④ `RETIRED_MODULE_KEYS = { stats }` + filtre dans `moduleKeysOf` (télémétrie) ; ⑤ `moduleLabel("stats")` garde « Stats Guilde » pour les données historiques ; ⑥ **conservés** : `getGuildStats`, `QuickStatsRow`, `canViewStats`, `GuildModules.stats` et les types/Zod — **aucune migration** ; ⑦ verrou `stats-page-removal` (6 tests) + fixtures `module-lock` nettoyées.
> **Preuves** : `stats-page-removal` **6** · `module-lock` **27** · `docs-modules` **16** · `user-context` **46** ⇒ **95/95 ✓** · suite **600 fichiers / 6 303 tests ✓** · `tsc` 0 · ESLint 0 erreur · **aucune migration**.
> **Reste / ops** : Phase 2 (hors lot) — retirer `stats` de `ModuleKey`/`GuildModulesState`/`DEFAULT_MODULES`/Zod/`user-actions`, `canViewStats`, et la colonne `GuildModules.stats` (migration + accord) ; asset `guildActivity.png` orphelin à supprimer.
> **Rotation** : bloc « 03/11/2026 (suite) — Rush : notes Tougli siphonnées » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.








