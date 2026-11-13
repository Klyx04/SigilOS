# 🎫 Refonte « Tickets v2 » — plan vivant (où en est le module, ce qui reste)

> Le **28/09/2026**, l'onglet « Parcours » et « Catégories & Modals » ont été
> **remplacés par un onglet unique « Motifs »** (`ticket-motifs-tab.tsx`) :
> un motif = un bouton sur un panneau + salon + équipe + fermeture + questionnaire
> (20 questions, 4 natures), enregistré = publié. Les tables `TicketBotCategory`
> (v1) et `TicketJourney` restent en base (tickets existants intacts) ; les
> catégories se convertissent en un clic (`migrateCategoriesToMotifsAction`,
> idempotent, panneaux remappés). Fichiers supprimés : `ticket-categories-tab.tsx`,
> `ticket-journeys-tab.tsx` ; actions d'édition v1 supprimées (lecture gardée).

> **Rôle de ce fichier** : dire **où en est** le module Tickets et **ce qui reste pour le
> boucler**, dans l'ordre, avec les fichiers exacts. Il remplace le brouillon de session
> `temp/PROMPT-REPRISE-TICKETS-V2.md` (zone volatile, non versionnée).
> Le **mode d'emploi destiné aux chefs de guilde** ne vit pas ici : il est dans le **guide
> in-app** (fiche `admin-tickets` en base, éditée via `/god/docs`).

## 0. Session 16/10/2026 — **retours utilisateur** : 4 lots livrés (branche `fix/tickets-lot1-bugs`)

> **Demande user (verbatim)** : 13 questions sur le module ticket (« il n'y a aucun endroit où on
> définit quel rôle Discord est autorisé à ouvrir un ticket », « pk les gros bots ont des rôles
> invités ? », « les questions à choix unique et oui/non n'affichent même pas la question »,
> « je veux définir si oui ou non on ping un ou plusieurs rôles + un message », « on n'a pas les
> boutons fermer/prendre en charge dans le ticket », « à quoi sert le bouton copie ? », « il y a un
> bug dans la mention de la personne qui prend en charge », « pk à la clôture le vote satisfaction
> ne part pas », « les boutons rouvrir/supprimer/copie devraient avoir des droits », « laisse 3-4
> secondes avant la suppression », « on devrait pouvoir ordonner les questions »).
>
> **Mesure (avant tout code, dans le code)** : la mention cassée venait de `user.id` (`User.id`
> interne, cuid) utilisé comme flocon Discord (`claimTicketAction`, `closeTicketAction`) ;
> `closeTicketAction` **n'envoyait aucune enquête** de satisfaction ; la barre du salon était
> construite avec `viewerIsStaff: false` et **jamais** publiée ; `ACTION_ACCESS` figeait les droits
> des boutons ; le tunnel servait **tous les choix avant** les modales (`splitTicketForm`) ; aucune
> liste blanche d'ouverture n'existait (seulement une blacklist) ; le libellé du sélecteur partagé
> disait « Liste blanche / rôles autorisés » **sur l'écran de blacklist**.
>
> **Fait (4 lots, 4 commits, aucun fichier laissé derrière)** :
> ① **bugs** — `getUserContext` expose `discordId` (le flocon, distinct du cuid) et les actions
> dashboard n'écrivent/pingent plus qu'un flocon ; **une seule** enquête de satisfaction
> (`src/server/tickets/csat.ts`) sert les **deux** chemins de clôture, avec **repli dans le salon
> fermé** si les MP sont fermés (décision user) et mention du demandeur ; libellés du sélecteur de
> rôles **paramétrables** (blacklist = « Rôles bloqués ») ; la question est **écrite** au moment du
> choix (boutons `Oui — {question}` + liste numérotée) ; une réponse coupée le **dit** et le
> plafond de champs reste au-dessus de la borne des questions (testé).
> ② **salon** — la barre n'affiche que **Prendre en charge** et **Fermer le ticket** ; à la clôture
> elle **révèle** Rouvrir / **Transcript** (renommé, plus « Copie ») / Supprimer ; l'embed d'accueil
> est **mis à jour en direct** (embed patché via `metadataJson.welcomeMessageId`, « Pris en charge
> par <@…> ») et le demandeur est mentionné en même temps que le preneur ; **nom + icône
> personnalisables** et **RBAC par bouton** (`settingsJson.buttons`, `disabled` retire le bouton,
> refus au clic) ; **suppression après compte à rebours de 4 s** (`after()`, droits revérifiés — un
> ticket rouvert n'est pas supprimé).
> ③ **ouverture** — **liste blanche par motif** (`settingsJson.categories[<motif>].allowedRoleIds`,
> vide = tout le monde, admin Discord toujours autorisé, refus motivé au clic) ; **interrupteur**
> « Prévenir l'équipe » ; **message personnalisé** du ping de rôles (`{membre}` `{motif}`
> `{numero}`) et **message personnalisé du demandeur** (mention garantie).
> ④ **questionnaire** — `buildTicketFormSteps` : plan d'étapes **ordonné** (5 textes par modale,
> chaque groupe de choix **à sa place**) ; le tunnel parcourt ce plan (le bouton « Continuer »
> porte l'**index d'étape**), et l'éditeur a des **flèches monter/descendre**.
>
> **Preuves** : `npx tsc --noEmit` **0** · `npm run lint` **0 erreur** · suite **405 fichiers
> passés** (dont **193 cas tickets**, 4 filets neufs : `tickets-lot1-bugs` 12, `tickets-boutons`
> 11, `tickets-ouverture` 10, + le cas « choix APRÈS des textes ») · `git status --short` **propre**.
> **Aucune migration** : tout tient dans `TicketGuildConfig.settingsJson` et `TicketRecord.metadataJson`.
>
> **Reste / à valider côté humain** : ① déployer puis vérifier en bêta le parcours complet (ouvrir,
> prendre en charge → embed mis à jour, fermer → boutons révélés, supprimer → décompte) ; ② les
> tickets ouverts **avant** ce lot n'ont pas de `welcomeMessageId` : leur message de modération
> porte les boutons (repli assumé) ; ③ les anciens panneaux **v1** (catégories) doivent être migrés
> (« Tout passer en Motifs ») pour disposer du réglage « Qui peut ouvrir » ; ④ SLA / auto-fermeture
> restent des réglages **sans exécutant** (hors brief).

## 0-bis. One-shot R2 (16/10/2026) — **fin v1, message d'ouverture unifié, boutons par motif, slug FR** — branche `feat/tickets-oneshot-r2`

> **Déclencheur** : comparatif TicketTool du propriétaire (panneau, questionnaire, form
> create, ticket avec message libre + pings + bloc Q/R + bouton Fermer) + doc TicketTool
> lue en entier (8 pages : `messages-options`, `button-options`, `form-options`,
> `variables`, `custom-commands`, `ticket-options`, `moderator-options`,
> `claiming-options`). Tranché avec l'utilisateur : custom commands dédiées ⇒ **chantier Z**,
> pas ce lot.
>
> **Fait (aucune migration : tout en `settingsJson` / `metadataJson`)** :
> ① **v1 morte** — migration **auto** à l'ouverture de l'onglet (fini bouton « Tout
> convertir » et bannières), `migrateCategoriesToMotifsAction` bascule les panneaux sur les
> parcours **et vide leurs `categoryIds`**, tout enregistrement de panneau n'expose plus
> que des parcours, `internalHandleTicketCreate` **refuse** une `categoryId` héritée avec un
> message qui guide (vieux bouton Discord non redéployé) ;
> ② **message d'ouverture en un bloc** (étapes 2 du formulaire : texte d'accueil + ping
> d'équipe + message demandeur, variables `{membre}` `{motif}` `{numero}`, aperçu live
> construit par les **mêmes fonctions pures** que l'envoi) ;
> ③ **boutons par motif** (`settingsJson.categories[<motif>].buttons` : `disabled` retire,
> `label` renomme, le reste hérite du global) appliqués aux **5 barres** (ouverture, prise
> en charge, 2 clôtures, réouverture) via `motifButtonsOf` + `ticketButtonLayoutForMotif` ;
> ④ le **résumé des listes ne part plus** sur Discord (l'accueil = texte du motif + notice) ;
> ⑤ **`P2002` → FR** (`TICKET_MOTIF_DUPLICATE_MESSAGE`, jamais le nom brut de la
> contrainte) + reprise du formulaire gagnant en cas de course ;
> ⑥ formulaire **guidé en 5 étapes**, vocabulaire simple (« Équipe qui traite »,
> « Résumé affiché sur les listes — ne part jamais sur Discord », liste blanche explicite).
>
> **Preuves** : `tsc` **0** · `lint` **0 erreur** · suite **405/406 fichiers, 4403/4407**
> (les 4 échecs `ladder-actions` sont **pré-existants sur `dev`**, prouvés sans mes
> changements) · filet neuf `tests/unit/tickets-oneshot-r2.test.ts` (**17 cas**).
>
> **Reste / ops (humain)** : la migration auto ne **redéploie pas** les panneaux (aucune
> écriture Discord surprise) : après conversion, **redéployer chaque panneau** ; les tickets
> ouverts avant R2 gardent leurs boutons globaux (pas de surcharge, héritage total).



| Lot | État | Où |
|---|---|---|
| Moteur v2 : schéma, migration additive, 6 modules purs, service d'archive, gate d'accès, sélecteurs Discord | ✅ **fusionné** | PR **#724** → `dev` |
| Contrat de formulaire : **20 questions** paginées (4 modales, aucune perdue) | ✅ fusionné | `form-schema.ts` (`TICKET_FORM_MAX_FIELDS`, `buildTicketModalPage`) |
| Règles de l'assistant « Parcours » | ✅ écrit + testé (36 cas) | PR **#725** (**brouillon**) · `journey-wizard.ts` |
| Tunnel d'ouverture : choix → modales → bouton « Continuer » | ✅ écrit + testé (14 cas) | PR #725 · `journey-tunnel.ts` |
| Ping de rôles à l'ouverture (parcours, repli équipe) | ✅ écrit + testé (10 cas) | PR #725 · `notifications.ts` + migration `20261222000000_tickets_journey_notify_roles` |
| **Écran « Parcours »** (onglet + assistant) | ✅ **écrit** (PR #725) | `_components/tabs/ticket-journeys-tab.tsx` (règles : `journey-wizard.ts`, 38 cas) |
| **Branchement Discord** (panneaux + route + création depuis un parcours) | ✅ **fait** (PR #725) | `journey-dispatch.ts` · `src/server/tickets/journey-open.ts` · route d'interactions · `internalHandleTicketCreate` |
| Onglets Formulaires (T2) / Équipe (T3) | ✅ **remplacés** (28/09/2026) | constructeur 20Q **intégré au motif** (`motif-fields.ts`, 4 natures) ; équipes = rôles directs sur le motif (actions `TicketTeam` conservées, sans UI) |
| **Motifs unifiés (fin des onglets Parcours + Catégories)** | ✅ **fait** (28/09/2026) | `ticket-motifs-tab.tsx` + `saveTicketMotifAction` (motif + questionnaire publiés d'office) + `migrateCategoriesToMotifsAction` (idempotent, panneaux remappés) + `setTicketMotifEnabledAction` |
| **Everyone modifiable dans la matrice** | ✅ **fait** (28/09/2026) | refusé par défaut + avertissement « tickets publics » si « Voir » activé |
| **Plafonds plateforme God + purge janitor** | ✅ **fait** (28/09/2026) | migration `20261228000000_ticket_platform_limits` (6 colonnes `PlatformConfig`) · `platform-limits.ts` (défauts 90/90/180, caps 5/100) · captures branchées dessus · quotas guildes plafonnés serveur · carte God · janitor §12 (transcripts expirés, notes, audit) |
| **UX sobre** : identifiant auto, nommage en Avancé, aperçu live du motif | ✅ **fait** (28/09/2026) | `ticket-motifs-tab.tsx` (`sm:max-w-6xl`, simulateur bouton + embed + boutons staff) |
| SLA, auto-fermeture, purge, quota serveur | ❌ | réglages **encore affichés**, aucun exécutant |
| **Boutons complets + confirmations + modération post-fermeture** | ✅ **fait** (28/09/2026) | `ticket-texts.ts` (FR/EN vulgarisé) · `embeds.ts` (`buildCloseConfirmRows`, `buildDeleteConfirmRows`, `buildModerationRows`) · handlers release/add/remove/reopen/transcript/delete + route |
| **Permissions salon 4 groupes × Ouvert/Fermé (façon TicketTool, à notre sauce)** | ✅ **fait** (28/09/2026, sans migration) | `channel-permissions.ts` (8 perms, Oui/Non) + `category-permissions.ts` (+ `additionalRoleIds`, blacklist) · `settingsJson` · bascule à la clôture/réouverture · matrice dans Réglages, invités par motif |
| **Icônes boutons (unicode + custom) + styles 4 couleurs** | ✅ **fait** (28/09/2026) | `ticket-icons.ts` (presets, validation, payload custom) · sélecteur dans Motifs |
| Participants (`$add`/`$remove`), `THREAD_PRIVATE`, suppression de salon observée | ✅ **partiel** (28/09/2026) | `setMemberChannelPermissionDiscord` **appelé** (add/remove + modales) · suppression **observée** (`ARCHIVE_FAILED` si refus) · `THREAD_PRIVATE` toujours ignoré (dit, non proposé) |

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

