# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).
## 📝 Session 15/11/2026 — **Tickets God · G4-1 → G4-4 : configuration dédiée, panneau, runtime, nettoyage** — branche `feat/tickets-god-config`

> **Décisions user** : « G4-1 à 4, go, un commit par G, une PR finale » · catégories **libres** (option B : création, désactivation, jamais de suppression) · migration additive acceptée avant écriture.
> **Fait** : `GodTicketConfig` + `GodTicketCategory` (migration `20270204000000`, seed des 4 catégories, backfill `categoryKey`, `csatRating`) · panneau `/god/ticket-bot` (serveur, salon, rôles staff/mention, nom du fil, fermeture, archivage, CSAT, catégories, publication ; RBAC God, Zod borné, rate limit, validation Discord fail-closed) · runtime : menu et modales depuis les catégories, création/fermeture/archivage/CSAT depuis la configuration · nettoyage : panneau manuel retiré, console Support alimentée par les catégories, `getBotGuilds` / `getChannelsForGuild` supprimées.
> **Preuves** : suite **706 fichiers / 7 487 tests ✓** · `tsc` 0 · ESLint 0 erreur · verrous `god-ticket-config` **14**, `god-ticket-actions-guards` **12**, `god-ticket-runtime` **15**, `discord-interaction-ratelimit` **3** · migration appliquée en local (4 catégories, 12 tickets backfillés) · 4 commits de lots + docs + 2 correctifs, PR **#1374**.
> **Reste / ops** : bêta puis prod → `20270204000000` ; God → `/god/ticket-bot` (serveur + salon + rôles, vérifier les catégories, **publier le panneau**) ; un ticket de test par catégorie + une fermeture avec CSAT ; la garde `discord-interaction-ratelimit` passe de 6 à 7 (CSAT).
> **Rotation** : bloc « 13/11/2026 (suite 2) — RGPD · Ladder sur les messages » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 14/11/2026 (suite) — **Support · captures paramétrables (textuel/forum), doc produit, cadrage G4 et notifications** — branches `feat/support-canal-captures` → `fix/support-canal-captures-console` → `feat/support-tags-forum`

> **Décisions user** : capture d'écran = **aucun upload**, on renvoie vers un **salon configurable côté God** (console **Support → Signalements**) ; un admin de guilde **ne répond pas** (seul le God répond) ; G4 = **panneau God dédié, paramétrable bout en bout, aucun ID en dur** (route 2) ; pas d'auto-onboarding dans ce chantier ; notifications = **espace de notifications du compte** (changelog, news, réponses ; Rush en v2).
> **Fait** : PR #1368 réparée (conflit `activeContext` uniquement, merge `dev` + rotation) · salon des captures : règle pure + service **fail-closed** (salon → serveur via `fetchChannel`, cache Redis) + réglage God dans la console Support → Signalements (validation réelle + rate limit) + lien cliquable dans l'overlay Rush, le bouton visiteur et le formulaire dashboard, **plus d'invitation en dur** · **forum accepté** (post créé par le bot : titre `[SIG-n] type — extrait`, **tag choisi par type côté God** parmi les tags réels du forum, URL conservée dans `forumLink`) · doc produit `signalements` (bouton sur le tracker, route `/tracker`, fiche locale volatile) · `PLAN-TICKETS-GOD.md` (G4 route 2 actée) et `PLAN-NOTIFICATIONS.md` (N1→N4) · ROADMAP rang 65 + prod mis à jour (`main` = `c190f2c7`).
> **Preuves** : verrou neuf `feedback-screenshot-channel` **19** · ciblé **70 tests** · suite **703 fichiers / 7 446 tests** · `tsc` 0 · ESLint 0 erreur · **migration additive `20270203000000_feedback_forum_tag_map`** appliquée en local · PR #1370, #1371, #1372 **mergées** · `dev` = `6a73bbfd` · **0 PR ouverte**.
> **Reste / ops** : renseigner le salon (textuel ou forum) **et les tags par type** dans Support → Signalements (bêta puis prod) · **doc `signalements` à uploader** via God → Docs · **G4-1** (migration additive de la configuration dédiée) à valider avant écriture · notifications : trancher news / opt-out / rétention · ops signalements inchangées (`20270201000000` → script → filet → drop).
> **Rotation** : bloc « 13/11/2026 — Sécurité · AUD-01/02/03 » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 14/11/2026 — **Signalements · fusion dans `SupportTicket`, console God et tracker membre** — branche `feat/fusion-signalements-tickets`

> **Décisions user** : option B (fusion dans `SupportTicket`, pas de vue unifiée), migration de **tout** (signalements + notes internes), tracker global visible par tous les membres, anonymisation inter-guildes (pseudo visible seulement dans sa guilde), pas de `TicketRecord` par signalement.
> **Mesure** : `SystemIssue` n'était lu que par 2 fichiers (8 usages) ; `sendTicketReply` exige un thread Discord ; les liens de notification étaient `?bug=SIG-<id>`.
> **Fait** : schéma additif (`TicketOrigin`, `publicRef`, `legacySystemIssueId`, champs de suivi, `discordGuildId` nullable) · script de reprise idempotent (`--dry-run` par défaut) · **filet SQL** qui copie les lignes restantes avant la migration destructive · bascule des actions · tracker membre anonymisé et paginé côté serveur · onglet « Signalements » dans la console Support · console Support (tickets Discord) réalignée sur les tokens de la landing (plus de zinc/indigo/amber, rayons ≤ 12 px) · refonte `/god/bugs` + tracker aux tokens (responsive 390→1440) · **volet visiteur connecté** (`submitVisitorFeedbackAction` sans appartenance, bouton global du header public sur profil/élevage/guides, historique « Mes signalements », panneau Rush corrigé) · suppression de `SystemIssue` (`20270202000000`).
> **Preuves** : suite **701 fichiers / 7 419 tests ✓** · `tsc` 0 · ESLint 0 erreur · migrations `20270201000000`, `20270201500000`, `20270202000000` appliquées en local · verrous `feedback-*` + `visitor-feedback-surfaces` + `system-issue-removal`.
> **Reste / ops** : en bêta puis prod, jouer `20270201000000` → `migrate-system-issues-to-support-tickets --dry-run` puis `--apply` (compteurs + échantillon) → `20270201500000` (filet) → `20270202000000` ; redéployer ; vérifier un ancien lien `?bug=SIG-<n>`. Lots séparés : console Support God (`ticket-bot` G4), screenshot, auto-onboarding.
> **Rotation** : bloc « 13/11/2026 — Blocs Combat + liens + markdown + modale de bloc » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

## 📝 Session 13/11/2026 (suite 5) — **Sondages : modale responsive + embed sans doublon** — branche `fix/sondages-responsive-embed`

> **Mesure** : la modale « Lancer un sondage » débordait horizontalement — le `DialogContent` est un `grid` sans `grid-cols-1` (colonne implicite `auto` qui se dilate sur un mot long), et l'aperçu Discord n'avait ni `min-w-0` ni césure (`whitespace-pre-wrap` seul). Le bas était coupé par `max-h-[90vh]`.
> **Fait** : `grid-cols-1` sur le composant Dialog (correctif structurel, toutes modales) · `min-w-0` + `break-words` + `[overflow-wrap:anywhere]` sur l'aperçu · `max-h-[calc(100dvh-2rem)]` · règle pure `poll-embed-content` : la description identique à la question n'est plus répétée dans l'embed (casse/ponctuation/espaces ignorés), l'aperçu l'annonce.
> **Preuves** : verrou `poll-embed-content` **7** · `tsc` 0 · ESLint 0 erreur · aucune migration.
> **Reste / ops** : PR #1368 **mergée** (`ece727ce`) ; contrôle visuel bêta 390/768/1024/1440 après déploiement.
> **Rotation** : bloc « 13/11/2026 — Sécurité · AUD-01/02/03 » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


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


