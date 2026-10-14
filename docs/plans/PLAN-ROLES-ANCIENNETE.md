---
description: Chantier Y — rôles automatiques par ancienneté : besoin, état mesuré, lots Y-1 → Y-3, tests, acceptation, vigilance
---

# 🎖️ Chantier Y — Rôles automatiques par ancienneté

> **Rôle.** Ce fichier est la **référence de contenu** du chantier Y : le besoin, l'état mesuré,
> les changements, les tests, l'acceptation et la vigilance. Il ne porte **pas** l'ordre
> d'exécution (c'est `docs/plans/FILE-EXECUTION.md`, étape 59) ni le fil des demandes
> (`docs/plans/BRIEF-REPRISE.md` §3).
> Référence produit : module « **Autoroles** » de **Dyno**. Cadrage : 14/10/2026.
> **Statut : Y-1 ✅ livré** (14/10/2026) — voir §6.

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
| 4 | Emplacement de l'écran (§7-2 du brief) | **Onglet « Rôles d'ancienneté » dans `/admin/members`** — ni page dédiée du Centre de contrôle, ni onglet de Réglages | la page est **déjà gardée** (`isAdmin \| canManageMembers \| canManageRelance`) et **a déjà** des onglets + `?tab=` ⇒ **aucune permission, aucune carte, aucune entrée de menu** à inventer |
| 5 | Message de l'annonce | **Personnalisable** (ping, titre, description à variables, couleur, miniature) | demande explicite du 14/10 ; les variables sont une **allowlist fermée** (`{membre}`, `{pseudo}`, `{anciennete}`, `{roles}`, `{guilde}`), aucun `eval` |
| 6 | Rattrapage des membres déjà présents (**backfill**) | **⟳ à trancher avant Y-2** (décision §7-1 du brief) | Y-1 n'en dépend pas : le palier cible et le diff sont les mêmes dans les deux cas |
| 7 | Idempotence de l'annonce (embed une seule fois) | Table de suivi `(guildId, discordId, palier)` + **garde d'état dans le `WHERE`** — **migration portée par Y-2** | même contrat que la publication des sondages programmés (revendication atomique) |

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

### Y-2 — cron + embed (à faire)

1. **Table de suivi** (migration additive portée par ce lot) : `(guildId, discordId, palier)` unique ⇒ l'annonce d'un palier part **une seule fois**.
2. **Route cron** `src/app/api/cron/seniority-roles/route.ts` : `verifyCronSecret` (fail-closed), `recordCronExecution` + `KNOWN_CRON_TASKS`, ligne de crontab (procédure `docs/agents/add-cron-task.md`).
3. **Par membre** : `resolveJoinedAt` + `computeSeniorityDays` → `computeSeniorityRoleDiff` → `addRoleToMember` / `removeRoleFromMember`. Échec Discord = **fail-closed** : on n'écrit rien, on log, on retentera au passage suivant.
4. **Annonce** : `renderSeniorityAnnouncement` + PP Discord (`thumbnail`) dans le salon réglé ⇒ `sendChannelMessage`. Un embed par palier **franchi**, jamais deux.
5. **Backfill** : selon la décision §7-1 du brief — soit on ne traite que les franchissements à venir, soit on rattrape les membres déjà présents (fenêtre + annonce à définir).

### Y-3 — onglet, éditeur, aperçu (à faire)

1. **Onglet « Rôles d'ancienneté »** dans `src/components/admin/members/member-management.tsx` (3ᵉ onglet, à côté de « Membres » et « Blacklist »), lien profond `?tab=anciennete`, onglet visible si `canManageMembers`.
2. **Écran** : activation, choix du salon (`DiscordChannelPicker`), liste des paliers (seuil en jours + rôles, ajout/suppression), éditeur du message (ping, titre, description, couleur, miniature).
3. **Aperçu live** : `DiscordEmbedPreview` alimenté par le **même rendu pur** que l'envoi réel — l'aperçu ne peut pas mentir.
4. **État lisible** : « X membres au palier N », « dernière passe : hier 04:00 » (télémétrie du cron).
5. **Action serveur** `updateSeniorityRolesSettings` : Zod bornée, `getUserContext` + garde fail-closed (mêmes flags que la page), rate limit, isolation de guilde, salon vérifié (`validateChannelBelongsToGuild`).

---

## 5. Tests et acceptation

**Verrou de Y-1** — `tests/unit/seniority-roles.test.ts`, **26 cas** : normalisation (valeur non
conforme, seuils hors bornes / non entiers, doublons de rôle, plafonds paliers et rôles), palier cible
(seuil exact, **ordre non trié**, cumul), périmètre fermé, diff (ajout, retrait, aucun changement,
module éteint, aucun palier atteint, ancienneté absurde), relecture des colonnes (défauts, `true`
exact, salon snowflake, JSON corrompu), annonce (variables connues/inconnues, `$` littéral,
mentions, ancienneté lisible, bornes Discord, champs douteux).

**Acceptation du chantier** (vérifiée au fil des lots) :
- un membre qui franchit un seuil **reçoit ses rôles** ; l'embed part **une seule fois** (cron relancé = rien de plus) ;
- un membre **hors** mapping de guilde ne reçoit rien (fail-closed) ;
- **aucun rôle non déclaré n'est jamais retiré** ;
- l'aperçu de l'écran **=** la réponse réelle sur Discord.

---

## 6. Statut et journal

| Lot | État | Preuves |
|---|---|---|
| **Y-1** — données + règles pures | ✅ **livré le 14/10/2026** | `tests/unit/seniority-roles.test.ts` (**26 cas**) · `src/lib/seniority-roles.ts` · 4 colonnes `GuildConfig` + migration additive `20270107000000_add_seniority_roles_config` · `npx tsc --noEmit` **0** · `eslint` **0** |
| **Y-2** — cron + embed | ⏳ à faire | ⏸ bloqué par la décision **backfill** (§7-1 du brief) |
| **Y-3** — onglet + éditeur + aperçu | ⏳ à faire | dépend de Y-2 pour l'« état lisible » (télémétrie du cron) |

**Ops (côté humain)** :
- [ ] jouer la migration `20270107000000_add_seniority_roles_config` en **bêta puis prod** (additive : 4 colonnes, aucune donnée touchée) ;
- [ ] au lot **Y-2** : poser la ligne de crontab (⚠️ le `%` s'écrit `\%` dans un crontab, cf. `docs/agents/add-cron-task.md`) ;
- [ ] au lot **Y-3** : ajouter la page de doc vivante du module via `/god/docs` (`src/lib/docs-catalog.ts` n'est qu'une référence figée) ;
- [ ] **redémarrer `npm run dev`** après toute régénération Prisma (piège mesuré le 14/10, brief §8).

---

## 7. Vigilance (pièges à ne pas repayer)

- **Le JSON de la base n'est jamais cru** : `seniorityRolesTiers` passe par `normalizeSeniorityTiers` avant tout usage — sinon un seuil absurde ou un rôle inconnu piloterait des écritures Discord.
- **Le périmètre est fermé** : la synchro ne touche **que** les rôles déclarés dans les paliers. Ne jamais élargir `toRemove` à « tous les rôles du membre » — on retirerait des rôles de jeu, de staff ou de réaction-rôle.
- **Sémantique cumulative** : une guilde qui veut des grades **exclusifs** (« Recrue → Membre → Vétéran ») doit le demander explicitement — le passage au modèle « grade unique » ne touche que `resolveSeniorityRoleTier` / `resolveSeniorityTargetRoleIds`.
- **Un salon neuf se déclare deux fois** dans `src/server/actions/discord-channel-watch-actions.ts` (liste `CHANNEL_FIELDS` **et** `select`) — sinon aucune veille « salon perdu ».
- **`UserProfile` ne stocke pas la liste des rôles** : le diff reçoit `currentRoleIds` **en entrée**. Déduire les rôles d'un cache local produirait des retraits à tort.
- **Le texte de l'annonce est borné par la règle** (2000 / 256 / 4096) : ne jamais envoyer le modèle brut à Discord.
- **Un test neuf doit être vert avant d'être laissé dans l'arbre** (piège du 14/10 : un WIP à moitié écrit cassait `tsc` chez le voisin).
