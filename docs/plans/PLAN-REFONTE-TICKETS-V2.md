# 🎫 Refonte « Tickets v2 » — plan vivant (où en est le module, ce qui reste)

> **Rôle de ce fichier** : dire **où en est** le module Tickets et **ce qui reste pour le
> boucler**, dans l'ordre, avec les fichiers exacts. Il remplace le brouillon de session
> `temp/PROMPT-REPRISE-TICKETS-V2.md` (zone volatile, non versionnée).
> Le **mode d'emploi destiné aux chefs de guilde** ne vit pas ici : il est dans le **guide
> in-app** (`src/lib/docs-catalog.ts`, entrée `admin-tickets`), appliqué par `npm run seed:docs`.

## 1. Où en est le chantier (mesuré le 24/09/2026)

| Lot | État | Où |
|---|---|---|
| Moteur v2 : schéma, migration additive, 6 modules purs, service d'archive, gate d'accès, sélecteurs Discord | ✅ **fusionné** | PR **#724** → `dev` |
| Contrat de formulaire : **20 questions** paginées (4 modales, aucune perdue) | ✅ fusionné | `form-schema.ts` (`TICKET_FORM_MAX_FIELDS`, `buildTicketModalPage`) |
| Règles de l'assistant « Parcours » | ✅ écrit + testé (36 cas) | PR **#725** (**brouillon**) · `journey-wizard.ts` |
| Tunnel d'ouverture : choix → modales → bouton « Continuer » | ✅ écrit + testé (14 cas) | PR #725 · `journey-tunnel.ts` |
| Ping de rôles à l'ouverture (parcours, repli équipe) | ✅ écrit + testé (10 cas) | PR #725 · `notifications.ts` + migration `20261222000000_tickets_journey_notify_roles` |
| **Écran « Parcours »** (onglet + assistant) | ✅ **écrit** (PR #725) | `_components/tabs/ticket-journeys-tab.tsx` (règles : `journey-wizard.ts`, 38 cas) |
| **Branchement Discord** (panneaux + route + création depuis un parcours) | ✅ **fait** (PR #725) | `journey-dispatch.ts` · `src/server/tickets/journey-open.ts` · route d'interactions · `internalHandleTicketCreate` |
| Onglets Formulaires (T2) / Équipe (T3) | ❌ | actions serveur livrées (10) |
| SLA, auto-fermeture, purge, quota serveur | ❌ | réglages **encore affichés**, aucun exécutant |
| Participants (`$add`/`$remove`), `THREAD_PRIVATE`, suppression de salon observée | ❌ | `setMemberChannelPermissionDiscord` importé, jamais appelé |

✅ Depuis la suite 27 (PR #725), le branchement est **fait** : `isPublished` est lu par le
déploiement des panneaux (`deployTicketPanelAction` → `buildPanelRows`, parcours publiés
d'abord, repli catégories v1) **et** par le tunnel d'ouverture (`journey-open.ts` refuse un
parcours brouillon, désactivé, ou dont le questionnaire n'est pas figé). « Publier » a donc un
**effet observable** : le bouton apparaît, les questions se posent (choix → modales paginées →
« Continuer »), le salon naît avec le nom et l'embed du parcours, le brouillon est supprimé, et
les `notifyRoleIds` sont **mentionnés** (jamais `@everyone`).

Ce qui **n'est pas** promis pour autant : `APPROVAL` et `THREAD_PRIVATE` ne sont ni proposés ni
enregistrés (aucun exécutant), les boutons de staff ne sont **jamais** publiés dans le salon du
demandeur (invariant #1 — le staff agit depuis la boîte de réception), et les réglages
SLA/auto-fermeture/purge restent sans exécutant.

## 2. Le modèle de données (v2)

- **`TicketJourney`** — le parcours, l'unité que comprend un chef de guilde : nom, slug,
  emoji, style de bouton, catégorie Discord (`channelParentId`), `staffRoleIds`,
  **`notifyRoleIds`** (rôles à mentionner), `teamId`, `formId` + `formVersion` (figée à la
  publication), `namingPattern`, `openMode`, `closePolicy`, `order`, `isEnabled`,
  `isPublished`/`publishedAt`/`publishedVersion`.
- **`TicketForm` / `TicketFormVersion`** — brouillon éditable + versions **figées** créées à
  chaque publication (un ticket garde la version avec laquelle il a été rempli).
- **`TicketTeam`** — équipe réutilisable : `staffRoleIds` + `notifyRoleIds`.
- **`TicketDraft`** — brouillon d'ouverture : réponses **clés par `id` de champ**, `step`
  (`CHOICES` ou `TEXTS:<page>`), TTL 30 min, supprimé après création.
- **`TicketRecord`** — le ticket : `journeyId` (v2) **ou** `categoryId` (v1), `formVersionId`,
  statuts (`REQUESTED`/`OPEN`/`CLAIMED`/`PENDING_USER`/`CLOSED`/`ARCHIVE_FAILED`/`REFUSED`),
  CSAT, `priority`, `tags`, `intakeAnswersJson`.
- **`TicketTranscript`** — **deux** documents par ticket (`SHAREABLE` sans notes internes /
  `INTERNAL`), avec `expiresAt`, `revokedAt`, `accessCount` et complétude honnête.
- **`TicketBotCategory` / `TicketBotPanel.categoryIds`** — **v1 conservé en lecture** : les
  tickets et panneaux déjà déployés continuent de fonctionner.

## 3. Invariants à ne pas casser (constats de l'audit du 24/09/2026)

1. Le demandeur ne reçoit **jamais** les boutons de staff (`buildActionRows`).
2. La note interne n'est **jamais** publiée dans le salon du demandeur (inbox staff + annexe).
3. `tb` reste **hors** de `DISCORD_PERM_MAP` : une carte par préfixe ne sait pas distinguer
   « ouvrir » de « fermer ». L'autorisation est construite dans la route puis **revalidée**
   par `guardTicketAction` (`decideTicketAccess`, fail-closed).
4. Les réponses sont **clés par `id` de champ** : renommer une question ne casse pas la
   relecture d'un ticket passé.
5. Une archive partielle est **annoncée partielle** ; le jeton partageable respecte
   `expiresAt`/`revokedAt` et ne sert **jamais** l'annexe interne.
6. `@everyone` n'est jamais mentionné implicitement (`sanitizeTicketNotifyRoleIds` : flocons
   valides uniquement, 25 mentions maximum).
7. Garde de test : `tests/unit/tickets-runtime-guards.test.ts` verrouille 1 à 5 par lecture du
   source — s'il casse, la fuite correspondante est revenue.

## 4. Ce qui reste, dans l'ordre (fichiers exacts)

### 4.1 Écran « Parcours » — l'onglet et son assistant ✅ **LIVRÉ (PR #725)**

- ✅ `src/app/dashboard/[guildId]/tickets/_components/tabs/ticket-journeys-tab.tsx` : liste des
  parcours + assistant 5 étapes (Identité → Ouverture → Équipe → Questionnaire → Résumé),
  publier / activer / supprimer, état `Brouillon` / `Publié (vN)` / « modifications non publiées ».
- ✅ Branché dans `ticket-bot-manager.tsx` (onglet « Parcours » + badge) et `page.tsx`
  (`listTicketJourneysAction`, `listTicketFormsAction`, `listTicketTeamsAction`).
- ✅ Aucune saisie d'identifiant : `TicketCategoryPicker` / `TicketRolesPicker`
  (`ticket-discord-pickers.tsx`) ; ce qui n'a **pas** d'exécutant (fils privés, approbation) est
  **dit** au lieu d'être proposé.
- Reste dans cet écran : la sélection d'un formulaire dépend du constructeur (T2) — l'étape
  « Questionnaire » le dit explicitement quand aucun formulaire n'existe.

### 4.2 Branchement Discord de l'ouverture — **le lot qui rend le reste réel** ✅ **FAIT (PR #725)**

- ✅ `journeyIds` exposé : `TicketPanelSchema` + `saveTicketPanelAction` (appartenance à la
  guilde vérifiée) + `deployTicketPanelAction` (`buildPanelRows` : parcours publiés d'abord,
  repli catégories v1, `buildPanelEmbed`) + `ticket-panels-tab.tsx`.
- ✅ `src/lib/tickets/journey-dispatch.ts` (pur, testé) : une étape du tunnel → une réponse
  Discord — éphémère des choix, **modale au `custom_id` routable**, bouton « Continuer » après
  une soumission (Discord interdit une modale dans une modale), refus motivé.
- ✅ `src/server/tickets/journey-open.ts` : parcours **publié et activé**, questionnaire **figé**
  relu par sa version, `TicketDraft` (TTL 30 min, reprise à la page mémorisée) lu / écrit / purgé,
  `advanceTicketJourney` (choix et champs de modale revalidés, brouillon jamais pollué).
- ✅ `route.ts` : `tb_pick`, `open`/`select_journey`, `modal_open`, `modal_page` — fail-closed via
  `parseTicketCustomId`, **repli v1 conservé** (catégorie relue **dans la guilde**).
- ✅ `internalHandleTicketCreate` : `journeyId` + `formVersionId` + réponses clés par `id` de
  champ, **revalidation** (`evaluateAnswers` sur la version figée), `formatTicketChannelName`,
  `buildTicketWelcomeEmbed`, `buildActionRows` (**vue du demandeur**, invariant #1),
  `journeyId`/`formVersionId` écrits sur le `TicketRecord`, **ping** `notifyRoleIds` avec un
  `allowed_mentions` explicite, puis **suppression du brouillon**.
- ⏳ Reste : `APPROVAL` (aucun handler `approve`/`refuse`), `THREAD_PRIVATE`, et un **préflight des
  permissions Discord** du bot (le refus est aujourd'hui rendu par l'API Discord, message compris).

### 4.3 Onglet Formulaires (chantier T2)

Constructeur des 6 types de champs (dont le **vrai Oui/Non** avec politique `onNo`), aperçu
Discord live, **20 questions** maximum (contrat prêt : `TICKET_FORM_MAX_FIELDS`,
`TICKET_MODAL_PAGES_MAX`), publication qui crée une `TicketFormVersion` **figée**.
Actions déjà livrées : `listTicketFormsAction`, `saveTicketFormAction`, `publishTicketFormAction`.

### 4.4 Onglet Équipe (chantier T3)

`staffRoleIds` + `notifyRoleIds`, réutilisables par plusieurs parcours.
Actions déjà livrées : `listTicketTeamsAction`, `saveTicketTeamAction`, `deleteTicketTeamAction`.

### 4.5 Permissions Discord (chantier T5)

- **Participants** : `setMemberChannelPermissionDiscord` est importé mais **jamais appelé**
  ⇒ aucun ajout/retrait de participant à un ticket (l'équivalent de `$add`/`$remove`).
- **`THREAD_PRIVATE`** : stocké, **jamais lu** (toujours un salon texte) ⇒ implémenter **ou**
  retirer de l'interface (aujourd'hui : signalé en avertissement et jamais enregistré).
- **Préflight** « le bot peut-il voir / écrire / créer ici ? » : permission manquante au niveau
  du serveur (un *override* est alors ignoré), limite de salons, hiérarchie des rôles, permission
  de catégorie. Un avertissement orange côté ticket vaut mieux qu'un échec Discord.
- **Suppression du salon à la clôture** : `void deleteChannelDiscord(...).catch(() => {})`
  ⇒ **échec silencieux**, aucun état `ARCHIVE_FAILED` écrit. À observer, ou à assumer
  (garder le salon et le dire).

### 4.6 Jobs et honnêteté des réglages (chantier T6)

- SLA 1ʳᵉ réponse / résolution, auto-fermeture et **quota serveur** (`maxTicketsTotalGuild`) :
  affichés dans `ticket-categories-tab.tsx` / `ticket-settings-tab.tsx`, **aucun exécutant**
  ⇒ soit un worker BullMQ (procédure `docs/agents/add-cron-task.md`), soit **retirer** les
  réglages. Ne jamais laisser l'écran promettre un délai que rien ne mesure.
- Purge par rétention (`transcriptRetentionDays`, `noteRetentionDays`, `auditRetentionDays`)
  dans le même worker.

### 4.7 Écran des archives

`ticket-transcripts-tab.tsx` : sélecteur **partageable / interne**, bouton de **révocation**,
compteur d'accès et date d'expiration — les colonnes existent (`kind`, `revokedAt`,
`accessCount`, `expiresAt`) mais ne sont pas exposées.

### 4.8 Finitions recensées

- `TicketGuildConfig.enableDmNotifications` : colonne conservée, **aucun consommateur**.
- `TicketFormVersion.publishedById` : **jamais rempli**.
- Onglet v1 « Catégories & Modals » : à marquer **hérité** quand les parcours seront en ligne.
- `TicketAuditLog` : journal d'actions en base, **aucun écran**.
- Borner la longueur d'un `id` de champ dans le constructeur : un `custom_id` reste limité à
  **100 caractères** (`tb_pick:<parcours>:<champ>:<yes|no>`).

## 5. Pièges mesurés (à relire avant d'y toucher)

- **Base locale en dérive préexistante** : `prisma migrate status` signale 1 migration absente
  du dépôt et 5 non appliquées ⇒ **ne jamais lancer `prisma migrate dev`** (il propose un *reset*
  = perte de données). Une migration s'écrit **à la main** puis se **prouve** avec
  `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <base shadow> --script`
  (créer la base *shadow*, vérifier qu'aucune ligne résiduelle ne sort, puis la **supprimer**).
- **Une modale Discord = 5 lignes**, et une modale soumise **ne peut pas en ouvrir une autre** :
  d'où le bouton « Continuer » du tunnel (`buildTicketModalContinueRows`).
- **Limites Discord** : `custom_id` ≤ 100 caractères, 5 composants par ligne, 25 options par
  menu, 25 mentions de rôles, 45 caractères de libellé de champ.
- **Le schéma ne se committe jamais seul** : le hook pre-commit bloque `schema.prisma` sans
  migration ⇒ committer les deux ensemble (`docs/agents/prisma-schema-change.md`).
- **PowerShell** : `[guildId]` est un joker ⇒ toujours `-LiteralPath`.

## 6. Commandes utiles

```bash
npm run test:run                 # suite complète (~2 360 cas)
npx tsc --noEmit                 # types
npm run lint                     # 0 erreur attendue
npx prisma generate              # après tout changement de schéma
npm run seed:docs                # après un changement de docs-catalog.ts (guide in-app)
```

## 7. Base locale : appliquer les tables v2 (état au 24/09/2026, suite 27 : ✅ **déjà appliqué**)

**Mesuré le 24/09/2026 (suite 27) : les tables v2 sont présentes en base locale** — `TicketDraft`,
`TicketForm`, `TicketFormVersion`, `TicketJourney`, `TicketTeam` **plus** les 8 tables v1
(13 tables `Ticket*`), et les colonnes `TicketBotPanel.journeyIds` /
`TicketJourney.notifyRoleIds` **vérifiées par `information_schema`**. Un test fonctionnel du
tunnel (sonde de la suite 27) a tourné **sur la base réelle**.

Historique (à lire **avant** de conclure que ça ne marche pas) : au 24/09/2026 (suite 26),
`information_schema` ne listait que les tables **v1** (`TicketBotCategory`, `TicketBotPanel`,
`TicketGuildConfig`, `TicketRecord`, `TicketNote`, `TicketTranscript`, `TicketAuditLog`,
`TicketFeedback`) ; `TicketJourney`, `TicketForm`, `TicketFormVersion`, `TicketTeam` et
`TicketDraft` n'existaient pas, d'où des `relation does not exist` sur toute la partie v2.

La cause est la dérive **préexistante** (§5) : `20260919130000_add_dungeon_slug` n'est toujours
pas appliquée localement, et une migration présente en base n'existe plus dans le dépôt.
`prisma migrate deploy` / `migrate dev` ne sont donc pas utilisables tels quels — et
`migrate dev` propose un **reset** (perte de données) : **ne pas le lancer**.

Procédure **sûre** (les migrations v2 sont additives et idempotentes : `CREATE TABLE IF NOT
EXISTS`, enums gardés par `DO $$ … duplicate_object`, colonnes `IF NOT EXISTS`) :

```powershell
# 0. sauvegarde de la base locale (hors dépôt : un dump ne se committe jamais)
docker exec sigilos-db pg_dump -U user -d sigilos > $env:TEMP\sigilos-local-avant-v2.sql

# 1. appliquer les migrations en attente (PowerShell ne gère pas `<` : on passe par stdin)
Get-Content -LiteralPath 'prisma\migrations\20261221000000_tickets_v2_refonte\migration.sql' -Raw |
    docker exec -i sigilos-db psql -U user -d sigilos
Get-Content -LiteralPath 'prisma\migrations\20261222000000_tickets_journey_notify_roles\migration.sql' -Raw |
    docker exec -i sigilos-db psql -U user -d sigilos

# 2. les marquer comme appliquées (sinon `migrate status` les redemande)
npx prisma migrate resolve --applied 20261221000000_tickets_v2_refonte
npx prisma migrate resolve --applied 20261222000000_tickets_journey_notify_roles

# 3. régénérer le client puis vérifier que les tables sont là
npx prisma generate
"SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'Ticket%' ORDER BY 1;" |
    docker exec -i sigilos-db psql -U user -d sigilos -t
```

Attendu après l'étape 3 : `TicketBotCategory`, `TicketBotPanel`, `TicketDraft`, `TicketFeedback`,
`TicketForm`, `TicketFormVersion`, `TicketGuildConfig`, `TicketJourney`, `TicketNote`,
`TicketRecord`, `TicketTeam`, `TicketTranscript`.

> `20260919130000_add_dungeon_slug` reste en attente : elle **n'appartient pas** à ce chantier
> (autre sujet) — à appliquer si un test local en a besoin, jamais de « reset » de la base.

