# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).

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


## 📝 Session 04/11/2026 (suite 4) — **Fluidité du scroll : fin du verre, `content-visibility` sur les longues grilles** — branche `perf/scroll-galerie-stuff`

> **Demande user (verbatim)** : « https://beta.sigilos.fr/dashboard/1290442961380835451/galerie-stuff c'est pas encore assez fluide à mon gout ou sont les meilleurs techno pour rendre le scroll smooth etc , et peut-être pas uniquement sur ce module ? ».
> **Mesures** : ① la barre de filtres est **sticky** avec `backdrop-blur-xl` (flou recalculé à chaque frame), le hero cumule `backdrop-blur-xl` + **2 halos `blur(100px)`** + `mix-blend-luminosity`, et chaque carte a un voile `backdrop-blur-md` ; ② **24 cartes** sont montées d'un coup, chacune avec le `DofusbookPreview` (~20 tooltips d'items) — **~480 tooltips** hors du premier écran, aucune `content-visibility` ; ③ le layout dashboard est déjà opaque (`TopNav` sans blur, sidebar fixe) : le coût est **local à la galerie**.
> **Fait** : ① **zéro `backdrop-blur`** dans `gallery-client.tsx` (barre sticky, hero, onglets, voile des cartes, dialogue) — fonds opaques/alpha à la place ; ② halos `blur(100px)` remplacés par **deux `radial-gradient`** et `mix-blend-luminosity`/`scale-105` retirés ; ③ utilitaire **`.cv-auto`** (`content-visibility: auto` + `contain-intrinsic-size: auto 480px`) appliqué aux cartes de la galerie, de l'annuaire, du marché et des posts de donjon ; ④ favicon hors écran en `loading="lazy" decoding="async"` + dimensions ; ⑤ règle durable `docs/RULES.md` § Performance de défilement.
> **Preuves** : verrou `gallery-scroll-perf` **5** · suite **599 fichiers / 6 297 tests ✓** · `tsc` 0 · ESLint 0 erreur · **aucune migration**.
> **Reste / ops** : contrôle visuel bêta 390 / 768 / 1024 / 1440 (hero, barre sticky, voile des cartes) ; virtualiser (TanStack Virtual) seulement si une page dépasse ~100 cartes.
> **Rotation** : bloc « 03/11/2026 — Rush : les conseils réparés (« &1 ») » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 04/11/2026 (suite 3) — **Avatars Discord : l’absence d’avatar ne produit plus d’initiales** — branche `fix/avatars-discord-default`

> **Demande user (verbatim)** : « normaliser le placeholder icone discord partout pour ceux qui n'ont pas d'icone et si un jour ils mettent une icone comment ca marche ? l'impression qu'on est pas raccord partout ou les icones pp discord sont dispo sur le produit, on avait déjà fait une passe, annuaire par exemple c ok, post dj semblent ok aussi ».
> **Mesures** : ① base locale (4 comptes Discord) : **0 `User.image` null**, **2 avatars `embed/avatars`** — l’OAuth écrit donc bien le défaut officiel ; ② c’est **`avatar-sync`** qui l’écrasait : `buildDiscordAvatarUrl(...) ?? null` transformait « pas d’avatar personnalisé » en `null`, d’où des initiales ici et l’avatar Discord ailleurs ; ③ `lifecycle-actions` concaténait `User.image` (déjà une **URL**) comme un hash ⇒ `…/avatars/<id>/https://cdn…png`, un embed au visuel cassé.
> **Fait** : ① règle pure `resolveDiscordAvatarUrl(userId, hash)` — vrai avatar sinon `embed/avatars/{n}.png` déterministe, `null` seulement sans identité exploitable ; ② `avatar-sync` l’utilise (plus jamais `null`), le **cron quotidien répare l’existant** sans migration ; ③ URL d’embed du cycle de vie réparée (`normalizeDiscordAvatarUrl` + défaut officiel) ; ④ verrous `discord-avatars` + `avatar-sync` (43 tests ciblés).
> **Preuves** : `avatar-sync` **9** · `discord-avatars` **34** · `tsc` 0 · suite **598 fichiers / 6 292 tests ✓** · **aucune migration**.
> **Reste / ops** : lancer `/api/cron/avatar-resync` après déploiement (ou attendre 05:00) pour réécrire les éventuels `null` existants ; les icônes de **guilde** restent en initiales (Discord n’expose pas d’avatar de guilde par défaut).
> **Rotation** : bloc « 02/11/2026 (suite 10) — Rush : la modale d’accueil en DA Carnet (L3) » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.




