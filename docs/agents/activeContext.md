# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).
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


## 📝 Session 12/11/2026 (suite 7) — **Rush : E3c + E4 + T-4a + bloc B, une seule PR** — branche `feat/rush-studio-masse-da-block`

> **Demande user (verbatim)** : « on fais 1 2 4 5, 3 plus tard, une seule PR, un commit par chantier ».
> **E3c (`83f287cd`)** : sélection multiple dans l'inspecteur de bloc (cases, tout sélectionner, barre d'actions) + **3 actions serveur** bornées (route / déplacement / suppression, **200 ids max**), appartenance au guide `rush-sylvestre` vérifiée **dans une transaction** (rollback si un id manque), rate limit Redis et `logGodWrite`. Règles pures `rush-bulk-selection` + verrous `rush-bulk-actions` / `rush-bulk-selection`.
> **E4 (`a71e0cd8`)** : **572 → 0** motif interdit dans `RushEditorStudio.tsx` (zinc 316, emerald 94, font-black 78, tracking-widest 52, purple 27, backdrop-blur 4, rounded-3xl 1) et **29 → 0** dans le kit God ; couleurs en dur (indigo/cyan/blue/violet/rose) remplacées par les tokens, rayons ≤ 12 px, overlays `bg-background/80`, boutons `text-primary-foreground` ; verrou `rush-editor-ui` (studio + kit).
> **T-4a (`95fd3e0c`)** : `RushCollapse` (dépli `grid-template-rows` `0fr → 1fr`, `inert`, `aria-hidden`, `motion-reduce`), rotation infinie coupée si `useReducedMotion`, célébration tokenisée (`--da-amber`, `bg-background`, plus de `zinc`/`blur`, éclats coupés en reduced motion). **G7 (hero) et la composition G9 restent ouverts** (captures attendues).
> **Bloc B (`ef8ce3d7`)** : route publique `/guides/rush-sylvestre/q/[slug]` (lecture `cache`, 404 si non publiée, `noindex` si guide en construction), slug **figé** à la première publication (collisions `-2`, `-3`), action `publishRushSequence` (rate limit, journal, appartenance au guide), bouton publier/dépublier dans l'inspecteur de bloc, sitemap conditionnel. Règles `rush-public-slug` + verrou `rush-public-quest`.
> **Preuves** : suite complète **674 fichiers / 7 255 tests ✓** · `tsc` 0 · ESLint 0 (hook pre-commit) · `git status` propre · **aucune migration**.
> **Reste / ops** : **G7** (hero) et **composition G9** (captures) · **E5** (finitions studio) · **V-C** (purge WebP, ops VPS) · **nouveau lot demandé** : blocs **Combat tactique / semi-tactique** + liens nommés (favicon) + markdown couleur + modale de bloc + image du monstre/combat importable (migration enum + `GuideMilestone.links` à prévoir).
> **Rotation** : bloc « 12/11/2026 — numérotation des blocs » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.
