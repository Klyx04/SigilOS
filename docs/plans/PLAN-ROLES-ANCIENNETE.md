---
description: Chantier Y — rôles automatiques par ancienneté : besoin, état mesuré, lots Y-1 → Y-3, tests, acceptation, vigilance
---

# 🎖️ Chantier Y — Rôles automatiques par ancienneté

> **Rôle.** Ce fichier est la **référence de contenu** du chantier Y : le besoin, l'état mesuré,
> les changements, les tests, l'acceptation et la vigilance. Il ne porte **pas** l'ordre
> d'exécution (c'est `docs/plans/FILE-EXECUTION.md`, étape 59) ni le fil des demandes
> (`docs/plans/BRIEF-REPRISE.md` §3).
> Référence produit : module « **Autoroles** » de **Dyno**. Cadrage : 14/10/2026.
> **Statut : chantier ✅ CLOS** — **Y-1, Y-2, Y-3 et Y-4 livrés** (14/10/2026). Voir §6.

---

## 1. Besoin (contrat retenu)

Une guilde déclare des **paliers** `seuil en jours → rôles Discord`. Un membre qui atteint un
palier **reçoit** les rôles ; un palier qu'il **n'a plus** (date d'arrivée corrigée, seuil remonté,
rôle posé à la main) est **retiré**. L'arrivée sur un palier est fêtée par un **embed** publié
dans un salon réglable, avec un **message personnalisable** (ping du membre, PP Discord en grand,
rôle obtenu, « tu es là depuis X mois »).

**Hors périmètre** : les rôles par réaction (module existant, `reactionRoles`), les rôles
temporaires (`TimedRoleGrant`, module existant), toute écriture Discord depuis une règle pure.

---

## 2. État mesuré (14/10/2026) — ce qui existe déjà, à réutiliser

| Besoin | Brique existante (mesurée) | Décision |
|---|---|---|
| Calculer l'ancienneté | `computeSeniorityDays`, `resolveJoinedAt` — `src/lib/member-registry.ts:79` et `:87` | **réutilisé** (Y-1 ne recalcule rien, il reçoit l'ancienneté) |
| Libellé humain d'une durée | `formatSeniority` — `src/lib/ladder-utils.ts:8` | **réutilisé** pour la variable `{anciennete}` |
| Valider un identifiant Discord | `isDiscordSnowflake` — `src/lib/discord-ids.ts:40` | **réutilisé** pour les rôles et le salon |
| Date d'arrivée du membre | `UserProfile.guildJoinedAt` (`prisma/schema.prisma:777`), repli `discordJoinedAt` (`:692`) | source unique, alimentée par le registre |
| Rôles courants du membre | **aucun cache** : seuls `discordRoleName`/`discordRoleColor` (`:694-695`) ; la vérité vient de `fetchGuildMember` (`src/server/discord.ts:373`) | le diff prend `currentRoleIds` **en entrée** : la règle ne lit ni base ni Discord |
| Poser / retirer un rôle | `addRoleToMember` (`src/server/discord.ts:1601`), `removeRoleFromMember` (`:1620`) | Y-2 les appelle ; Y-1 ne les connaît pas |
| Aperçu fidèle d'un embed | `DiscordEmbedPreview` (`src/components/discord/DiscordEmbedPreview.tsx`) | Y-3 l'utilise ; le texte vient de la **même fabrique pure** que l'envoi |
| Précédent « aperçu = envoi réel » | `buildMarketDiscordPayload` (`src/lib/market/discord-payload.ts`) consommé par l'aperçu **et** la publication (Marché) | contrat repris pour l'annonce |
| Salon de l'écran | `DiscordChannelPicker` ; veille des salons : `CHANNEL_FIELDS` **et** le `select` de `src/server/actions/discord-channel-watch-actions.ts:20` et `:36` | Y-3 ; un salon neuf se déclare **dans les deux listes** |
| Cron | `src/app/api/cron/<tâche>/route.ts` + `KNOWN_CRON_TASKS` (`src/lib/cron-telemetry.ts:19`), procédure `docs/agents/add-cron-task.md` | Y-2 |
| Onglets du module Membres | `Tabs/TabsList/TabsTrigger` — `src/components/admin/members/member-management.tsx:7`, onglets déclarés `:35`, garde de page `src/app/dashboard/[guildId]/admin/members/page.tsx:40`, lien profond `?tab=` déjà lu (`:21`, `:155`) | Y‑3 : **3ᵉ onglet**, aucune permission nouvelle |

**Migrations** : dernière = `20270106000000_add_presentation_internal_rules` ⇒ Y-1 ajoute
`20270107000000_add_seniority_roles_config`. `npx prisma migrate dev` est **inutilisable** sur cet
historique (migration pré-existante cassée `20261010000000_add_component_stats`) : le SQL est écrit
**à la main**, additif, aligné sur le datamodel — même méthode que `20270102000000_add_scheduled_polls`.

---

## 3. Décisions tranchées

| # | Question | Décision | Pourquoi |
|---|---|---|---|
| 1 | Sémantique d'un palier | **Cumulative** : un membre porte les rôles de **tous** les paliers atteints. Monter n'enlève rien ; le retrait n'existe que pour un palier **qu'il n'a plus** | lecture littérale du brief ; `resolveSeniorityRoleTier` isole le choix (une fonction à changer si on passe au « grade unique ») |
| 2 | Périmètre des retraits | **Fermé** : seuls les rôles **déclarés dans les paliers** sont touchés ; tout autre rôle du membre est hors périmètre | fail-closed : on ne retire jamais un rôle que la guilde n'a pas déclaré |
| 3 | Stockage | 4 **colonnes** sur `GuildConfig` (`seniorityRolesEnabled`, `seniorityRolesChannelId`, `seniorityRolesTiers`, `seniorityRolesAnnouncement`) | pattern maison (`scheduledPolls*`, `marketAllowedPingRoleIds`) ; le salon reste **visible de la veille des canaux**, contrairement à un bloc unique |
| 4 | Emplacement de l'écran (§7-2 du brief) | **Onglet « Rôles d'ancienneté » dans `/admin/members`** — ni page dédiée du Centre de contrôle, ni onglet de Réglages | la page est **déjà gardée** (`isAdmin \| canManageMembers \| canManageRelance`) et **a déjà** des onglets + `?tab=` ⇒ **aucune permission, aucune carte, aucune entrée de menu** à inventer — **révision du 14/10 (lot G)** : le **salon**, et lui seul, part dans **Paramètres → Ancienneté** (les 16 salons du dépôt s'y déclarent) ; paliers, message, aperçu et vues restent dans l'onglet Membres |
| 5 | Message de l'annonce | **Personnalisable** (ping, titre, description à variables, couleur, miniature) | demande explicite du 14/10 ; les variables sont une **allowlist fermée** (`{membre}`, `{pseudo}`, `{anciennete}`, `{roles}`, `{guilde}`), aucun `eval` |
| 6 | Rattrapage des membres déjà présents (**backfill**) | **✅ tranché le 14/10/2026 — « on marque sans poster »** : les **rôles** se rattrapent (le diff est un état), mais **un palier franchi avant l'activation n'est jamais annoncé**. La règle est portée par un **marqueur d'activation** (`seniorityRolesActivatedAt`), pas par une heuristique de « première passe » | évite un salon inondé le jour de l'activation ; le marqueur rend la règle **pure et testable** (`shouldCelebrateSeniorityTier`) |
| 7 | Idempotence de l'annonce (embed une seule fois) | ✅ **livré (Y-2)** : table `SeniorityRoleAnnouncement`, unicité `(guildId, discordId, tierDays)`, **revendication atomique avant l'envoi**, relâchée si l'envoi échoue | ajouter ou réordonner un palier ne rejoue rien : on trace le **seuil**, pas l'index |
| 8 | Texte par palier (**Y-5**) | **Surcharge partielle** : un palier peut redéfinir le message, le titre et/ou la description ; un champ vide **hérite** du global. **Couleur et miniature restent communes** | demande user du 14/10 ; l'héritage champ par champ évite de recopier le global sur chaque palier, et l'identité visuelle reste stable. Aucune migration : c'est le JSON `seniorityRolesTiers` |

---

## 4. Changements, par lot

### Y-1 ✅ — données + règles pures (livré le 14/10/2026)

**Base** — bloc ajouté dans `GuildConfig` (`prisma/schema.prisma`, après `recruitmentWelcomeTemplate`)
et migration **additive** écrite à la main `20270107000000_add_seniority_roles_config`
(`ADD COLUMN IF NOT EXISTS`, aucune donnée réécrite) :

| Colonne | Type | Rôle |
|---|---|---|
| `seniorityRolesEnabled` | `Boolean @default(false)` | activation par guilde — **OFF par défaut** |
| `seniorityRolesChannelId` | `String?` | salon de l'annonce (`NULL` = rôles posés sans annonce) |
| `seniorityRolesTiers` | `Json @default("[]")` | paliers `[{ days, roleIds }]` |
| `seniorityRolesAnnouncement` | `Json?` | message personnalisable (ping, titre, description, couleur, miniature) |

**Règles pures** — `src/lib/seniority-roles.ts` (aucun appel Discord, aucune lecture de base, donc
testable seul — c'est la contrainte de fond du lot) :

| Export | Contrat |
|---|---|
| `normalizeSeniorityTiers` | relit le JSON stocké : seuils entiers `1–3650` j, rôles = snowflakes, doublon de rôle ⇒ un seul palier le porte, palier sans rôle écarté, tri par seuil, plafonds **20 paliers × 10 rôles** |
| `resolveSeniorityRoleTier` | index du **plus haut palier atteint**, `-1` si aucun — compare les seuils, ne suppose jamais le tri |
| `resolveSeniorityTargetRoleIds` | union des paliers **atteints** (sémantique cumulative), indépendante de l'ordre reçu |
| `resolveSeniorityManagedRoleIds` | union des rôles **déclarés** = le seul ensemble que la synchro a le droit de toucher |
| `computeSeniorityRoleDiff` | `{ toAdd, toRemove, targetTierIndex, targetRoleIds, changed }` — module éteint, aucun palier configuré ou aucun palier atteint ⇒ **diff vide** |
| `buildSeniorityAnnouncementValues` | `{membre}` = mention Discord, `{pseudo}`, `{anciennete}` = `formatSeniority`, `{roles}` = mentions de rôles, `{guilde}` |
| `renderSeniorityAnnouncementText` / `renderSeniorityAnnouncement` | variables en **allowlist fermée** (une variable inconnue reste visible à l'aperçu), textes bornés à 2000 / 256 / 4096 |
| `mergeSeniorityAnnouncement` / `mergeSeniorityRolesConfig` | relecture **fail-safe** des 4 colonnes : tout ce qui est douteux retombe sur les défauts |

### Y-2 ✅ — cron + embed (livré le 14/10/2026)

**Base** — migration additive `20270108000000_add_seniority_role_announcements` :
`GuildConfig.seniorityRolesActivatedAt` (marqueur d'activation) + table `SeniorityRoleAnnouncement`
(`@@unique([guildId, discordId, tierDays])`, index `[guildId]`, cascade sur la guilde).

**Règles pures ajoutées** (`src/lib/seniority-roles.ts`) :
`resolveSeniorityCrossingIso` (arrivée + seuil) et `shouldCelebrateSeniorityTier`
(**franchissement strictement postérieur à l'activation** ; sans marqueur ⇒ on ne fête rien).
`resolveJoinedAt` (`src/lib/member-registry.ts`) gagne le repli **`discordJoinedAt`** : un profil
créé à la première visite du dashboard ne fait plus perdre des mois d'ancienneté.

**Cœur** — `src/server/seniority-roles-core.ts` (sans `"use server"`, injectable `now`) :

1. ne lit que les guildes **actives**, **activées**, à paliers non vides ;
2. **estampille** le marqueur d'activation à la première passe (jamais déplacé ensuite) ;
3. pour chaque **profil `ACTIVE`** : id Discord (compte `discord`, jamais « le premier venu ») →
   `resolveJoinedAt` → `computeSeniorityDays` → `fetchGuildMember` → `computeSeniorityRoleDiff` →
   `addRoleToMember` / `removeRoleFromMember` ;
4. **annonce** chaque palier **franchi depuis l'activation**, **une seule fois** : revendication
   atomique (`create` + P2002), envoi via le **même rendu pur** que l'aperçu (Y-3), et
   **relâchement** de la revendication si l'envoi échoue (le palier n'est pas perdu).

**Route** — `src/app/api/cron/seniority-roles/route.ts` (`verifyCronSecret` first, `HEAD`,
télémétrie `recordCronExecution("seniority_roles", …)`), déclarée dans `KNOWN_CRON_TASKS`
(`Quotidien 04h30`, `seniority-roles.log`) et dans le crontab de `docs/MAINTENANCE.md`
(`30 4 * * *`, `%` échappé `\%`).

**Invariants tenus** : membre inconnu de Discord ⇒ ignoré ; rôle non déclaré ⇒ jamais touché ;
échec de pose ⇒ **aucune annonce** ; aucun salon ⇒ rôles seuls ; jeton manquant ⇒ arrêt immédiat.

### Y-5 ✅ — texte **par palier** (livré le 14/10/2026)

**Demande user (verbatim)** : « j'aimerai pouvoir éditer … chaque palier créé et son texte ».

**Règle pure** (`src/lib/seniority-roles.ts`) : un palier porte une **surcharge partielle** de texte
(`SeniorityTierAnnouncementOverride` : message, titre, description). `resolveTierAnnouncement({ announcement,
tier })` recompose l'annonce **effective** : les champs fournis remplacent, **les autres héritent** du message
global — **couleur et miniature restent communes** (l'identité visuelle ne se règle pas palier par palier).
`normalizeTierAnnouncement` nettoie la surcharge relue (bornes identiques au message global, chaîne vide =
héritage, objet vide = pas de surcharge) et elle **survit** au dédoublonnage des rôles (le texte appartient
au **seuil**, pas à l'ordre reçu).

**Cron** (`seniority-roles-core.ts`) : l'embed part avec `resolveTierAnnouncement` — donc le texte du palier
**franchi**, jamais celui d'un autre seuil.

**Écran** : chaque palier a un bloc **replié** « Texte de ce palier — personnalisé / hérite du message
global » (3 champs, le message global en `placeholder`, un champ vidé reprend l'héritage), et l'aperçu gagne
un sélecteur **« Palier relu dans l'aperçu »** qui rejoue le **même rendu pur** que l'envoi pour le seuil
choisi. Aucune migration : le texte vit dans le JSON `seniorityRolesTiers` déjà en base.

### G ✅ — le salon de l'annonce vit dans **Paramètres** (livré le 14/10/2026)

**Mesure** : dans ce dépôt, **tous** les salons se déclarent dans Paramètres (16 encarts de modules) ;
l'onglet Membres était le seul écran de salon hors convention. Constat de l'utilisateur, confirmé.

**Fait** : réglage **narrow** `updateSeniorityRolesChannel(guildId, { channelId })` (RBAC
`canManageMembers`, rate limit, Zod strict à **un** champ, salon **vérifié auprès de Discord**, revalidation
des deux écrans) · onglet **Paramètres → Ancienneté** (groupe *Notifications & Canaux*) avec le seul champ
du salon · l'action de l'onglet Membres **n'écrit plus** ce champ (retiré de son schéma) et son écran n'a
plus de sélecteur : il **renvoie** vers Paramètres.

**Pourquoi une action à part** : **une porte par réglage** — l'écran du salon n'écrit que le salon,
l'écran des paliers n'écrit que les paliers ; aucun des deux ne peut écraser les réglages de l'autre.

**Au passage** : les **13 imports morts** de `settings/page.tsx` (mesurés **avant** le lot : une seule
occurrence à `HEAD`) sont nettoyés — c'est le fichier que le lot modifie.

### Y-4 ✅ — « Prochains paliers » (livré le 14/10/2026)

**Demande user (verbatim)** : « ajoute aussi dans ce module ancienneté un onglet pour voir qui va bientôt
basculer de rôle pour le staff juste informatif propre responsive etc ».

**Règle pure** (`src/lib/seniority-roles.ts`) : `resolveUpcomingTierChange({ tiers, seniorityDays })` →
`{ tierIndex, tierDays, daysUntil }` du **prochain palier non franchi**, `null` quand tous le sont ;
comme les autres règles, elle compare les **seuils** (l'ordre reçu ne change rien). Fenêtre affichée :
`SENIORITY_UPCOMING_WINDOW_DAYS = 30`.

**Côté serveur** (`getSeniorityRolesSettings`) : la **même** lecture des membres actifs alimente la liste
(`upcoming`, triée du plus proche au plus lointain puis par pseudo, **plafonnée à 25** avec `upcomingTotal`) —
aucune requête supplémentaire, aucune écriture, rien d'annoncé : c'est une **vue**.

**Côté écran** : section « Prochains paliers » dans l'onglet Membres → **tableau sur desktop, cartes en
dessous de `md`** (avatar, ancienneté lisible, palier visé, « dans X j »), badge du nombre, état vide clair,
et « N affichés sur M » quand la liste est plafonnée. **Aucun bouton, aucun champ** : purement informatif.

### Y-3 ✅ — onglet, éditeur, aperçu (livré le 14/10/2026)

**Action serveur** — `src/server/actions/seniority-roles-actions.ts` :
`getSeniorityRolesSettings` (réglages + **état lisible** : répartition par palier calculée en une
seule lecture, annonces envoyées, dernière passe issue de la télémétrie — jamais bloquante) et
`updateSeniorityRolesSettings` (Zod **borné aux mêmes limites que la règle**, rate limit, salon
vérifié auprès de Discord, écriture **normalisée**, marqueur d'activation posé une seule fois,
`revalidatePath`). Les deux exigent `canManageMembers` (ou admin), revérifié serveur.

**Écran** — `src/components/admin/members/seniority-roles-panel.tsx`, monté en **3ᵉ onglet** de
`/admin/members` (`?tab=anciennete`, onglet **visible seulement** si `canManageMembers`) :

- activation (OFF par défaut) et salon de l'annonce (`DiscordChannelPicker`) ;
- paliers : seuil en jours + rôles (sélecteur multiple avec recherche), ajout / suppression ;
- message : ligne de ping, titre, description, couleur, miniature — avec la liste des **variables
  disponibles** et un **aperçu live** construit par le **même rendu pur** que l'envoi
  (`renderSeniorityAnnouncement` → `DiscordEmbedPreview`) ;
- état réel : membres par palier, membres sous le premier palier, annonces envoyées, dernière
  passe du robot, date d'activation (et le rappel qu'aucune annonce n'est rétroactive).

**Veille de salons** — `seniorityRolesChannelId` déclaré dans les **deux** listes de
`src/server/actions/discord-channel-watch-actions.ts` (`CHANNEL_FIELDS` + `select`), sinon le
salon perdu ne serait jamais signalé.

---

## 5. Tests et acceptation

**Verrou de Y-1** — `tests/unit/seniority-roles.test.ts`, **26 cas** : normalisation (valeur non
conforme, seuils hors bornes / non entiers, doublons de rôle, plafonds paliers et rôles), palier cible
(seuil exact, **ordre non trié**, cumul), périmètre fermé, diff (ajout, retrait, aucun changement,
module éteint, aucun palier atteint, ancienneté absurde), relecture des colonnes (défauts, `true`
exact, salon snowflake, JSON corrompu), annonce (variables connues/inconnues, `$` littéral,
mentions, ancienneté lisible, bornes Discord, champs douteux).

**Verrou de Y-2** — `tests/unit/seniority-roles-cron.test.ts`, **24 cas** : règle du franchissement
(à fêter / rattrapage, seuil à l'instant même, absence de marqueur), éligibilité, marqueur
d'activation (estampé une fois, jamais déplacé), poses et retraits (périmètre fermé),
annonce (mention + PP, **une seule fois**, jamais sur un échec de pose, **relâchée** si l'envoi
rate, rien sans salon), profils sans compte Discord, membre absent de Discord, jeton manquant,
route (401 sans secret, télémétrie enregistrée) et câblage (tâche déclarée, migration, schéma,
le core ne réécrit aucune règle).

**Verrou de Y-3** — `tests/unit/seniority-roles-ui.test.ts`, **16 cas** : fail-closed de l'écriture
(sans `canManageMembers`, sous rate limit, config hors bornes — seuil, rôles, couleur, texte —
salon étranger), écriture **normalisée** + `revalidatePath`, marqueur d'activation (posé une fois,
jamais déplacé, jamais posé module éteint), lecture (refus sans permission, répartition en **une**
requête, télémétrie muette non bloquante) et câblage (aperçu = même rendu, onglet gardé, `?tab=`,
salon déclaré dans les deux listes du veilleur).

**Verrou de Y-4** — `tests/unit/seniority-roles-upcoming.test.ts`, **11 cas** : règle pure (prochain
palier non franchi, `null` quand tout est passé, indépendance à l'ordre reçu, ancienneté absurde bornée),
liste serveur (fenêtre de 30 jours, tri proche→lointain puis pseudo, plafond 25 avec total, liste vide
sans palier) et écran (section présente, fenêtre lue depuis la règle, tableau desktop + cartes mobile,
**aucun bouton ni champ** : vue, pas formulaire).

**Verrou de G** — `tests/unit/roles-anciennete-salon-settings.test.ts`, **9 cas** : garde RBAC fail-closed,
rate limit, Zod (salon invalide, **champ surnuméraire**), isolation (salon d'une autre guilde refusé **sans
écriture**), écriture **du seul** salon + revalidation des deux écrans, « aucun salon » sans requête
Discord, et les invariants d'architecture d'**une porte par réglage** (l'action des paliers ne touche plus
au salon, l'écran des paliers n'a plus de sélecteur, l'onglet est déclaré **et** rendu dans Paramètres).

**Verrou de Y-5** — `tests/unit/seniority-roles-tier-text.test.ts` (**9 cas**) : relecture de la surcharge
(champs fournis gardés, champs vides ignorés, palier sans surcharge **sans** objet vide, bornes, survie au
dédoublonnage des rôles), héritage `resolveTierAnnouncement` (même référence sans surcharge, remplacement
champ par champ, couleur/miniature communes), contrat serveur (accepté tel quel, refusé hors bornes **et** sur
clé inconnue **sans écriture**) et écran (bloc par palier, aperçu du palier choisi) — plus, dans
`seniority-roles-cron.test.ts`, le cas **bout en bout** : l'embed part avec le texte **du palier franchi** et
garde le global là où il n'y a pas de surcharge.

**Acceptation du chantier** (vérifiée au fil des lots) :
- un membre qui franchit un seuil **reçoit ses rôles** ; l'embed part **une seule fois** (cron relancé = rien de plus) ;
- un membre **hors** mapping de guilde ne reçoit rien (fail-closed) ;
- **aucun rôle non déclaré n'est jamais retiré** ;
- l'aperçu de l'écran **=** la réponse réelle sur Discord.

---

## 6. Statut et journal

| Lot | État | Preuves |
|---|---|---|
| **Y-1** — données + règles pures | ✅ **livré le 14/10/2026** (PR #964) | `tests/unit/seniority-roles.test.ts` (**26 cas**) · `src/lib/seniority-roles.ts` · 4 colonnes `GuildConfig` + migration additive `20270107000000_add_seniority_roles_config` |
| **Y-2** — cron + embed | ✅ **livré le 14/10/2026** | `tests/unit/seniority-roles-cron.test.ts` (**24 cas**) · `src/server/seniority-roles-core.ts` + `src/app/api/cron/seniority-roles/route.ts` · `GuildConfig.seniorityRolesActivatedAt` + table `SeniorityRoleAnnouncement` (migration `20270108000000_add_seniority_role_announcements`) · tâche déclarée (`KNOWN_CRON_TASKS`) + ligne de crontab documentée |
| **Y-3** — onglet + éditeur + aperçu | ✅ **livré le 14/10/2026** | `tests/unit/seniority-roles-ui.test.ts` (**16 cas**) · `seniority-roles-actions.ts` + `seniority-roles-panel.tsx` + 3ᵉ onglet de `/admin/members` (`?tab=anciennete`) · salon déclaré dans la veille des canaux |
| **Y-4** — vue « Prochains paliers » | ✅ **livré le 14/10/2026** | `tests/unit/seniority-roles-upcoming.test.ts` (**11 cas**) · règle pure `resolveUpcomingTierChange` + fenêtre `SENIORITY_UPCOMING_WINDOW_DAYS` · liste serveur (même requête, plafond 25) · section responsive dans l'onglet Membres (tableau desktop / cartes mobile), **aucune action** |
| **G** — salon → Paramètres | ✅ **livré le 14/10/2026** | `tests/unit/roles-anciennete-salon-settings.test.ts` (**9 cas**) · `updateSeniorityRolesChannel` (**une porte par réglage**) · onglet `Paramètres → Ancienneté` (`?tab=anciennete`) · renvoi depuis l'onglet Membres (plus de sélecteur) |
| **Y-5** — texte par palier | ✅ **livré le 14/10/2026** | `tests/unit/seniority-roles-tier-text.test.ts` (**9 cas**) + `seniority-roles-cron.test.ts` (**25**, dont le cas bout en bout) · `SeniorityTierAnnouncementOverride` + `resolveTierAnnouncement` (héritage champ par champ) · cron : l'embed part avec le texte du seuil franchi · écran : bloc de texte par palier + aperçu du palier choisi · **aucune migration** |

**Ops (côté humain)** :
- [ ] jouer les migrations `20270107000000_add_seniority_roles_config` **puis**
      `20270108000000_add_seniority_role_announcements` en **bêta puis prod** (les deux additives) ;
- [ ] ajouter la ligne de crontab `30 4 * * *` (déjà écrite dans `docs/MAINTENANCE.md` § Crontab —
      ⚠️ le `%` s'y écrit `\%`, sinon la ligne ne s'exécute **jamais**) ;
- [ ] vérifier que le **rôle du bot** est au-dessus des rôles de palier (sinon `403` : les rôles ne
      sont pas posés, rien n'est annoncé, et la passe suivante réessaiera) ;
- [ ] contrôles à l'œil : onglet « Rôles d'ancienneté » visible **seulement** avec la gestion des
      membres, aperçu fidèle au message enregistré, état qui se met à jour après enregistrement ;
- [ ] **redémarrer `npm run dev`** après toute régénération Prisma (piège mesuré le 14/10, brief §8).

---

## 7. Vigilance (pièges à ne pas repayer)

- **Le JSON de la base n'est jamais cru** : `seniorityRolesTiers` passe par `normalizeSeniorityTiers` avant tout usage — sinon un seuil absurde ou un rôle inconnu piloterait des écritures Discord.
- **Le périmètre est fermé** : la synchro ne touche **que** les rôles déclarés dans les paliers. Ne jamais élargir `toRemove` à « tous les rôles du membre » — on retirerait des rôles de jeu, de staff ou de réaction-rôle.
- **Sémantique cumulative** : une guilde qui veut des grades **exclusifs** (« Recrue → Membre → Vétéran ») doit le demander explicitement — le passage au modèle « grade unique » ne touche que `resolveSeniorityRoleTier` / `resolveSeniorityTargetRoleIds`.
- **Un salon neuf se déclare deux fois** dans `src/server/actions/discord-channel-watch-actions.ts` (liste `CHANNEL_FIELDS` **et** `select`) — sinon aucune veille « salon perdu ».
- **`UserProfile` ne stocke pas la liste des rôles** : le diff reçoit `currentRoleIds` **en entrée**. Déduire les rôles d'un cache local produirait des retraits à tort.
- **Le texte de l'annonce est borné par la règle** (2000 / 256 / 4096) : ne jamais envoyer le modèle brut à Discord.
- **`tsc` local peut mentir quand l'arbre est partagé** (piège mesuré le 14/10/2026) : si un fichier **d'un autre chantier en cours** contient des erreurs de **syntaxe**, TypeScript saute la phase **sémantique** du programme **entier** — une vraie erreur de typage dans le lot ne remonte donc pas localement. Vérification fiable : isoler le lot avec un `tsconfig` temporaire (créé puis supprimé) ou attendre la CI. C'est exactement ce qui a fait échouer `Verify & Build` sur le typage des rôles Discord (`color` est un **entier**, pas une chaîne).
- **Un test neuf doit être vert avant d'être laissé dans l'arbre** (piège du 14/10 : un WIP à moitié écrit cassait `tsc` chez le voisin).
- **Le marqueur d'activation ne se déplace pas** : `seniorityRolesActivatedAt` est posé une fois. Le déplacer (ou le vider) ferait **refêter** des paliers déjà franchis — c'est la seule chose qui retient les annonces rétroactives.
- **La ligne de crontab : `%` → `\%`** (piège n°1 du dépôt) et le log doit s'appeler exactement `seniority-roles.log`, sinon God affiche « Inconnu » à jamais.
- **Hiérarchie Discord** : le bot doit porter un rôle **au-dessus** des rôles de palier, sinon chaque `PUT` répond `403` — la passe ne pose rien, **n'annonce rien** (fail-closed) et réessaie au passage suivant. C'est un réglage, pas un bug.
- **La première passe est volumineuse par nature** (tous les anciens reçoivent leurs paliers d'un coup, en silence) : elle est idempotente, donc la relancer — ou attendre la suivante — est toujours sûr.
- **On trace le seuil, pas l'index du palier** : réordonner ou insérer un palier ne doit **jamais** rejouer une annonce (c'est `tierDays` qui est en base).
