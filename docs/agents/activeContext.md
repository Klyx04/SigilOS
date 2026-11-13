# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).
## 📝 Session 13/11/2026 (suite 4) — **Sécurité · révocation WS des membres exclus** — branche `fix/ws-revocation-membres`

> **Mesure** : l'appartenance n'était vérifiée qu'aux `*:join` ; les heartbeats guide/dofus ne font aucune requête DB, donc `leave()` ne suffit pas — il faut couper le socket. Le bot Discord (`GuildMemberRemove`/`GuildBanAdd`) n'a ni Redis ni HTTP : un canal web seul aurait laissé le cas principal à ≤ 30 min.
> **Fait** : canal `guild:member:revoked` + publisher best-effort · 6 chemins publiés (départ/ban manuel, archivage, purge RGPD, God soft-delete, suppressions définitives admin/God/RGPD) · module WS (`guild-revocation.ts`) qui retire les rooms `guild:<id>*`, émet `guild:access-revoked` et coupe le socket · sweep d'appartenance 60 s borné (couvre bot, Discord, `updateMany` en masse) · garde client (`router.refresh()` → écran d'accès refusé).
> **Preuves** : verrou `ws-guild-revocation` **23** · `tsc` 0 · ESLint 0 erreur · bundle `build:ws` ✓ · aucune migration.
> **Reste / ops** : PR → `dev` ; rebuild `ws-prod`/`ws-beta` au déploiement ; vérifier en bêta avec un second compte (archivage admin → coupure immédiate ; exclusion Discord → ≤ 60 s). Option non retenue : publication directe depuis le bot (ioredis) — le sweep couvre le besoin.
> **Rotation** : bloc « 12/11/2026 (suite 7) — Rush : E3c + E4 + T-4a + bloc B » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 13/11/2026 (suite 3) — **SEC-04 · cAdvisor supprimé : plus de socket Docker monté** — branche `chore/monitoring-sans-cadvisor`

> **Décision user (verbatim)** : « toi qui gères » — après mesure : la carte God « Conteneurs » était vide depuis le 19/10 et le socket Docker n'était monté que pour cAdvisor.
> **Fait** : service `cadvisor` retiré des composes prod **et** dev (`privileged: true` en dev), scrape job retiré de `monitoring/prometheus/prometheus.yml`, requêtes `container_last_seen`/`container_start_time_seconds` et champs `containers`/`restarts` retirés de `god-system-actions`, carte « Conteneurs » retirée du dashboard God, `scripts/deploy.sh` ne tire plus `grafana` (déjà supprimé) ni `cadvisor`, doc `MAINTENANCE.md` mise à jour.
> **Preuves** : `monitor-private` **5** (dont « ne monte plus le socket Docker ») · suite **668 fichiers ✓** · `tsc` 0 · **aucune migration**.
> **Reste / ops** : PR → `dev` ; au prochain déploiement, la stack monitoring ne recrée plus cAdvisor — supprimer le conteneur existant (`docker rm -f sigilos-cadvisor`, action humaine) et vérifier que Prometheus ne scrape plus `cadvisor:8080`.
> **Rotation** : bloc « 12/11/2026 (suite) — Numérotation des blocs » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.
## 📝 Session 13/11/2026 (suite 2) — **RGPD · Ladder sur les messages, intent `MessageContent` retiré** — branche `feat/ladder-messages`

> **Décision user (verbatim)** : « oui je veux faire la modif, du coup la modif ladder UI module à faire aussi et tout le code autour ».
> **Mesure** : la métrique « caractères » était la seule raison de demander l'intent privilégié `MessageContent` ; le bot ne lisait que `message.content.length` (jamais le texte, jamais stocké). Les compteurs `discordCharacters*` restent en base (historique, `@default(0)`) mais ne sont plus alimentés.
> **Fait** : `ladder-client.tsx` (option + affichage + description retirés), `ladder-actions.ts` (union + branche `characters` retirées), `member-discord-activity.tsx` (carte « Caractères » retirée), bot (`MessageContent` retiré, `message.content` plus lu, reset hebdo/mensuel sans caractères, 4 logs sans snowflake Discord).
> **Preuves** : verrou `ladder-messages-only` (6) · suite **669 fichiers ✓** · `tsc` 0 · aucune migration (colonnes conservées).
> **Reste / ops** : déployer le bot **puis** désactiver `Message Content Intent` dans le portail Discord (l'ordre inverse ferait refuser le démarrage) ; vérifier que le Ladder affiche bien « Messages » par défaut.
> **Rotation** : bloc « 12/11/2026 (suite) — Numérotation des blocs » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.
## 📝 Session 13/11/2026 (suite) — **Sécurité · durcissements AUD-04/05/07/09/10/11 + SEC-02/03** — branche `fix/durcissements-audit`

> **Mesures VPS (13/11, lecture seule)** : `CSP_ENFORCE=true` sur `sigilos-beta` (SEC-01 déjà clos) · `ENCRYPTION_KEY` `HEX64` sur prod **et** bêta · cAdvisor monte `/var/run/docker.sock` en `ro`, `Privileged=false` (SEC-04 confirmé, lot infra à part) · `agent-ro.sh csp` refuse en manuel car le script lit `SSH_ORIGINAL_COMMAND` (pas `$1`) — comportement normal.
> **Fait** : SEC-03 (clé strictement 64 hex, fallback scrypt à sel fixe supprimé) · SEC-02 (le process WS refuse `WS_AUTH_ENABLED=false` en prod via `ws-auth-policy`) · AUD-04 (`STORAGE_LEGACY_TOKENS_UNTIL`, inerte sans date, date invalide = fail-closed) · AUD-05 (SVG/XML refusés dans `proxy-image`, `nosniff`, cache `.svg` retiré) · AUD-07 (`execFile` pour les deux `curl`) · AUD-09 (limiteur IP borné partagé, fail-closed à saturation) · AUD-10 (`console.error` → `logger`) · AUD-11 (cache 5 s + rate-limit sur `/api/health/maintenance`).
> **Preuves** : 7 tests neufs / **27** cas · suite **675 fichiers ✓** · `tsc` 0 · ESLint 0 erreur · aucune migration, aucun changement d'interface publique.
> **Reste / ops** : PR `fix/actions-god-auth` puis `fix/durcissements-audit` → `dev` ; AUD-08 (garder `MessageContent` ou changer la métrique), SEC-04 (socket-proxy, fenêtre), CSP prod (vérifier `CSP_ENFORCE` avant ouverture).
> **Rotation** : bloc « 12/11/2026 (suite) — Numérotation des blocs » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.
## 📝 Session 13/11/2026 — **Sécurité · AUD-01/02/03 : actions God sans garde, stockage inter-guildes** — branche `fix/actions-god-auth`

> **Demande user (verbatim)** : « refais une passe d'audit avec les audits précédents dans le contexte », puis validation du plan de correction (AUD-02 → AUD-01 → AUD-03).
> **Mesures (2ᵉ passe, statique)** : `notifyGod` était exportée d'un fichier `"use server"` et importée par **deux composants client** (`proof-upload-dialog.tsx`, `safety-client.ts`) ⇒ action publique : écriture `GodNotification` + embed Discord via le bot **multi-tenant** avec `forceChannelId`/`ping` contrôlés. `markGodNotificationRead`/`markAllGodNotificationsRead` sans garde ⇒ masquage de toutes les alertes God. `/api/storage` sautait le contrôle d'appartenance quand `getUserContext()` (sans argument, guilde d'accueil) renvoyait `isAdmin` ⇒ lecture inter-guildes des preuves.
> **Fait** : `notifyGod` déplacé dans `src/server/god-notifications.ts` (**sans** `"use server"`, invariant commenté) ; 28 importeurs serveur recâblés ; les 2 imports client supprimés (l'alerte God est créée **côté serveur** par `reportSecurityIncident`, avec `webOnly`, sans `forceChannelId`) ; garde `hasGodPanelAccess()` sur les 4 actions du panneau ; `reportSecurityIncident` exige `ctx.isMember` (AUD-06) et borne la description ; `/api/storage` exige l'appartenance à la guilde cible (God seul exempté, CUID → discordGuildId, cible inconnue = 403).
> **Preuves** : 3 tests neufs — `server-actions-god-guard` (5, invariants), `security-report-auth` (3, comportement), `storage-guild-isolation` (4) — + 15 fichiers impactés **147 tests ✓** · suite **671 fichiers ✓** · `tsc` 0 · ESLint **0 erreur** · **aucune migration**.
> **Reste / ops** : PR `fix/actions-god-auth` → `dev` ; puis AUD-04 (jeton legacy sans expiration), AUD-05 (SVG proxy-image), AUD-07→11 (durcissements). Rapport complet : `src/temp/audit-sec-2.md` (zone volatile).
> **Rotation** : bloc « 12/11/2026 (suite) — Numérotation des blocs » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.
## 📝 Session 13/11/2026 — **Blocs Combat + liens + markdown + modale de bloc** — branche `feat/rush-studio-masse-da-block` (PR #1360)

> **Demande user (verbatim)** : « mets aussi tous les autres type de bloc stp en modale éditable et les champ libre c imbuvable la zone est mini pas possible de l'agrandir » · « ajoute un nouveau type de bloc : Combat tactique / Combat semi tactique » · « pouvoir ajouter un ou plusieurs liens vers des sites… donner un nom à la vidéo + afficher sa favicon automatiquement… pouvoir ajouter un champ libre aussi d'édition pour expliquer brièvement la strat, markdown couleur etc » · « pouvoir importer une image aussi du combat / du monstre etc comme d'hab ».
> **Schéma** : migration additive `20270131000000_add_rush_combat_blocks` — enum `GuideMilestoneType` + `COMBAT_TACTIQUE` / `COMBAT_SEMI_TACTIQUE`, colonne `GuideMilestone.links Json?` (liens nommés, 10 max). Appliquée en local.
> **Images** : les deux fichiers fournis étaient des **PNG déguisés en `.webp`** (585×427 et 541×461) ; convertis en vrai WebP (25 Ko / 18 Ko) dans `public/assets/rush/blocks/`, métadonnées retirées.
> **Règles pures** : `rush-block-types` (`isRushInfoBlock`, `isRushNonQuestBlock`, méta des deux types), `rush-block-links` (`safeExternalUrl`, 10 max, 120 car., dédoublonnage), `rush-markdown` (gras, italique, titres, listes, liens http(s), couleurs `{or}/{vert}/{danger}/{ambre}/{info}` ; HTML brut jamais interprété) — **26 tests**.
> **Rendu** : `RushCombatBanner` partagé (dashboard, guide public, overlay `page`/`pip`), `RushMarkdown`, `SiteFavicon` (DuckDuckGo + repli `Globe`, CSP `img-src` mise à jour) ; les blocs Combat sont **non cochables** et exclus des compteurs par `isRushNonQuestBlock`.
> **Studio** : palette +2 (image en icône), formulaire de bloc en **modale 1 100 px** pour tous les types (`blockForm` monté une seule fois), champ libre `resize-y` (min-h 160 px), barre d'outils markdown, aperçu du texte, éditeur de liens (nom + URL + favicon), aperçu membre réel ; l'image du bloc reste importable (`BlockImageField`).
> **Preuves** : suite complète **678 fichiers / 7 295 tests ✓** · `tsc` 0 · ESLint **0 erreur** · migration appliquée en local · verrou `rush-combat-blocks` **14**.
> **Reste / ops** : **jouer la migration `20270131000000` en bêta puis en prod** · G7 (hero) et composition G9 (captures) · E5 · V-C · backfill contraintes Tougli.
> **Rotation** : bloc « 12/11/2026 — numérotation des blocs » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

