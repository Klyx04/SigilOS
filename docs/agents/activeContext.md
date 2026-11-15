# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).
## 📝 Session 15/11/2026 (suite 3) — **Docs · un seul fichier de chantiers, audit sécurité soldé, branches mortes purgées** — branche `docs/consolidation-chantiers`

> **Décisions user** : « tout doit être clean à jour » ; « concentrer tous les chantiers exhaustivement dans un seul fichier » ; plus aucun fichier d'amorce ; le prototype Dark Vlad et la procédure d'extraction Unity **ne sont pas versionnés** (chemin machine + couleurs en dur).
> **Mesure** : l'audit sécurité du 13/11 est **entièrement livré** — PR **#1361**, **#1362**, **#1363**, **#1364**, **#1367** mergées ; le ROADMAP affichait encore « PR → dev » comme prochain lot. `dev` = `origin/dev` (0/0), aucun stash ; 10 branches locales avaient une PR mergée, 1 branche morte (`feat/visiteur-quete-ocre-rush`, PR #1312 fermée, contenu déjà dans `dev` via #1313).
> **Fait** : ROADMAP **compacté 61 031 → 46 477 octets** (récits de session retirés ; `god-rush-ux` 6 995 → ~450) et **corrigé** (8 lignes d'audit en ✅ livré ; §1bis = vrais restes ; ops consolidées en §0) · **6 fichiers supprimés** (`AMORCE-DEMO-PUBLIQUE`, `AMORCE-RAID`, `AMORCE-REFONTE-GOD-GUILDES`, `AMORCE-STUFF-VARIANTES-RESTE`, `PLAN-NOTIFICATIONS`, `PLAN-SUCCES-SPECIAUX`) · **2 renommés** `AMORCE-*` → `PLAN-*` (`GUILDES-CYCLE-DE-VIE`, `SOUVERAINETE-IMAGES`) + test `plan-guildes-cycle-de-vie` · README aligné · branche morte supprimée (locale + distante) · 7 branches locales mergées purgées · artefacts locaux déplacés en zone volatile (`src/temp/dark-vlad/`).
> **Preuves** : `plan-guildes-cycle-de-vie` **3** · `harness-config` **9** (ROADMAP < 60 Ko) · `git status` propre · aucune citation morte hors journal/archives.
> **Reste / ops** : vrais sujets sécurité au §1bis du ROADMAP (**TOCTOU DNS** et **Caddy POST** = seul code à écrire ; CSP, jeton legacy, intent Discord, rebuild WS = réglages/ops) · prototype Dark Vlad dans `src/temp/dark-vlad/` (non versionné).
> **Rotation** : bloc « 13/11/2026 (suite 5) — Sondages : modale responsive + embed sans doublon » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 15/11/2026 (suite 2) — **Notifications · N1→N4 + N2-bis + hub signalements + garde bannissement** — branches `feat/notifications-*` et `fix/visitor-feedback-ban-guard`

> **Décisions user** : bouton bug **inchangé** (icône globale du header public pour les connectés, cachée pour les anonymes) ; audience du changelog = **tout le monde**, une notification par personne ; news = changelog uniquement ; **les signalements vont dans Notifications** ; **opt-out dans Réglages** ; **Rush v2 reporté (toasts live, rien de persisté)** ; rétention existante 30/90.
> **Fait** : N1 boîte compte (`userId` + `guildId: null`, écriture bornée, lecture ≤ 50, marquage lu/tout lu) · N2 migration additive `20270205000000_add_changelog_notification_type` + fan-out `changelog-notifications` (lots de 500, `after()`, entrées internes exclues, lien page compte) · N3 page `/espace-visiteur/notifications` + 8ᵉ onglet + pastille de non-lues · **N3-bis** « Mes signalements » déplacé de Général vers Notifications, réponse God **toujours** en notification de compte (la cloche de guilde n'est plus utilisée pour ce message) · **N2-bis** `User.accountNotificationsEnabled` (migration `20270206000000`, défaut `true`), interrupteur dans Réglages, fan-out filtré et écriture qui respecte l'opt-out · **garde bannissement** de `submitVisitorFeedbackAction` alignée sur `getPublicSession`.
> **Preuves** : `account-notifications-scope` **20** · `changelog-notifications-fanout` **5** · `feedback-account-notification` **2** · `visitor-feedback-ban-guard` **3** · suite **710 fichiers / 7 520 tests ✓** · `tsc` 0 · ESLint 0 erreur · migrations `20270205000000` et `20270206000000` appliquées en local · PR **#1376 → #1381 mergées**, N2-bis à merger.
> **Reste / ops** : migrations `20270205000000` (changelog) et `20270206000000` (opt-out) à jouer **bêta puis prod** ; vérifier en bêta : publier un changelog, répondre à un signalement, couper l'opt-out et vérifier qu'aucune nouvelle notification n'arrive ; **Rush v2 reporté (toasts live, rien de persisté)**.
> **Rotation** : bloc « 13/11/2026 (suite 4) — Sécurité · révocation WS des membres exclus » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 15/11/2026 (suite) — **Notifications · N1 : boîte du compte (`userId` + `guildId: null`)** — branche `feat/notifications-compte-n1`

> **Décisions user** : notifications = **espace du compte** ; audience = **tout le monde** (interne + visiteur avec espace), le scope compte garantit **une notification par personne** ; Rush en v2 ; pas d'e-mail/push ; opt-out possible mais proposé en **N2-bis** (migration) ; rétention existante **30 j lues / 90 j non lues**.
> **Fait** : N1 sans migration — `src/server/account-notifications.ts` (scope `userId` + `guildId: null` défini **une seule fois**, écriture bornée Zod, lecture ≤ 50, total + non-lues) · `src/server/actions/account-notification-actions.ts` (marquage lu / tout lu, `getPublicSession`, rate limit Redis, `updateMany` propriétaire) · **le verrou `notification-guild-isolation` reste intact** ; `guild-actions-rbac` a révélé le littéral `guildId` dans l'action → scope extrait dans une fonction, action sans `guildId`.
> **Preuves** : `account-notifications-scope` **14** · ciblé **32** · suite **707 fichiers / 7 501 tests ✓** · `tsc` 0 · ESLint 0 erreur · **aucune migration**.
> **Reste / ops** : N2 (émission changelog : migration additive d'enum, audience à mesurer, lien de destination à trancher), N3 (page + pastille), N4 (réponse au signalement) ; rien à déployer pour N1.
> **Rotation** : bloc « 13/11/2026 (suite 3) — SEC-04 · cAdvisor supprimé » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


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


