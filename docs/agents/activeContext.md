# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).
## 📝 Session 14/11/2026 (suite) — **Support · salon des captures paramétrable, doc produit, cadrage G4 et notifications** — branche `feat/support-canal-captures`

> **Décisions user** : capture d'écran = **aucun upload**, on renvoie vers un **salon configurable côté God** (page `/god/bugs`) ; un admin de guilde **ne répond pas** (seul le God répond) ; G4 = **module ticket God paramétrable bout en bout, aucun ID en dur** ; pas d'auto-onboarding dans ce chantier ; notifications = **espace de notifications du compte** (changelog, news, réponses ; Rush en v2).
> **Fait** : PR #1368 réparée (conflit `activeContext` uniquement, merge `dev` + rotation) · salon des captures : règle pure + service **fail-closed** (salon → serveur via `fetchChannel`, cache Redis) + réglage God sur `/god/bugs` (validation réelle + rate limit) + lien cliquable dans l'overlay Rush, le bouton visiteur et le formulaire dashboard, **plus d'invitation en dur** · doc produit `signalements` (bouton sur le tracker, route `/tracker`, fiche locale volatile) · `PLAN-TICKETS-GOD.md` (G4 mesuré, architecture à trancher) et `PLAN-NOTIFICATIONS.md` (N1→N4) · ROADMAP rang 65 + prod mis à jour (`main` = `c190f2c7`).
> **Preuves** : verrou neuf `feedback-screenshot-channel` **10** · ciblé **55 tests** · `tsc` 0 · ESLint 0 erreur · aucune migration · PR #1370.
> **Reste / ops** : renseigner le salon dans `/god/bugs` (bêta puis prod) · **G4-0** (mesurer un `GuildConfig` plateforme) avant toute migration · notifications : trancher news / opt-out / rétention · ops signalements inchangées (`20270201000000` → script → filet → drop).
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
## 📝 Session 13/11/2026 (suite 2) — **RGPD · Ladder sur les messages, intent `MessageContent` retiré** — branche `feat/ladder-messages`

> **Décision user (verbatim)** : « oui je veux faire la modif, du coup la modif ladder UI module à faire aussi et tout le code autour ».
> **Mesure** : la métrique « caractères » était la seule raison de demander l'intent privilégié `MessageContent` ; le bot ne lisait que `message.content.length` (jamais le texte, jamais stocké). Les compteurs `discordCharacters*` restent en base (historique, `@default(0)`) mais ne sont plus alimentés.
> **Fait** : `ladder-client.tsx` (option + affichage + description retirés), `ladder-actions.ts` (union + branche `characters` retirées), `member-discord-activity.tsx` (carte « Caractères » retirée), bot (`MessageContent` retiré, `message.content` plus lu, reset hebdo/mensuel sans caractères, 4 logs sans snowflake Discord).
> **Preuves** : verrou `ladder-messages-only` (6) · suite **669 fichiers ✓** · `tsc` 0 · aucune migration (colonnes conservées).
> **Reste / ops** : déployer le bot **puis** désactiver `Message Content Intent` dans le portail Discord (l'ordre inverse ferait refuser le démarrage) ; vérifier que le Ladder affiche bien « Messages » par défaut.
> **Rotation** : bloc « 12/11/2026 (suite) — Numérotation des blocs » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


