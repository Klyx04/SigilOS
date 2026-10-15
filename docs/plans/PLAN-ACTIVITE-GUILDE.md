---
description: Chantier « Activité de guilde & notifications » — enrichir le feed et faire vivre l'activité (paliers de points, dofus validés, temps réel, préférences) sur l'infra existante
---

# PLAN — **Activité de guilde enrichie & notifications** (chantier « N »)

> **Demande user (verbatim, 15/10/2026)** : « activité guilde : enrichi l'activité je ne sais pas moi
> validation mission, validation dj quetes songes avec les points, des paliers quand des gens montent en
> points de succès via le ladder (genre tous les 1000 points ?) les dofus validés par les gens, ya tellement
> matière à alimenter ce bloc et pk pas faire une notif sympa réélement visible qui pop pour tous le monde
> en haut à droite sous le profil, genre "wylan a validé ceci" "wylan est desormais 3eme du ladder succès
> guilde !" etc etc (ajouter pissiblité coté profil perso de dexactiver cette notif via l'ongelt notif
> existant) » + « et j'oublies surement des trucs sympa qui pourrait faire des notif ».
> **Statut : plan écrit.** **Aucune migration** n'est nécessaire (mesuré §2) : les modèles, les enums, le
> polling et les préférences existent déjà.

## 1. Le besoin

Le bloc « Flux de vie de la guilde » du tableau de bord doit **raconter** ce qui se passe (validations,
paliers, Dofus, records) et l'activité marquante doit **se voir** — notification visible en haut à droite
sous le profil, désactivable par chaque membre.

## 2. État mesuré (15/10/2026) — tout existe déjà

| Chercher | Où c'est | Verdict |
|---|---|---|
| Table des notifications | `prisma/schema.prisma:1273-1291` — `Notification` : `userId`, `guildId?`, `title`, `message`, `type`, `category`, `read`, `link` ; index `(userId, read, createdAt)` et `(guildId)` | **existe** : rien à créer |
| Types disponibles | `prisma/schema.prisma:3163-3177` — `MISSION_VALIDATED`, `MISSION_REJECTED`, `ACHIEVEMENT_VALIDATED/REJECTED`, `SONGES_JOIN_REQUEST`, `OCRE_TRADE_*`, `POLL_CREATED/CLOSED`, `EVENT_REMINDER`, `FINDER_JOIN_REQUEST`, `NEW_SUBMISSION_PENDING`, `SYSTEM_INFO` | **riche** : la plupart des besoins sont couverts **sans migration** |
| Catégories (le grain des préférences) | `prisma/schema.prisma:3192-3202` — `MISSION`, `SUCCESS`, `SONGES`, `EVENT`, `POLL`, `DONJONS`, `OCRE`, `MARKET`, `ADMIN_ALERT`, `SYSTEM` | **existe** |
| « Temps réel » | `src/components/notifications/notification-bell.tsx:102` — `setInterval(() => fetchNotifications(true), 10000)` | déjà un **polling 10 s** : on l'écoute, on n'invente **aucune** WebSocket |
| Source unique du feed | `src/server/actions/unified-activity-actions.ts:30` — `getUnifiedGuildActivity(guildId, limit = 15)` ; agrège les `AuditLog` (`:143`, `log.module as ActivityType`) + `MISSION_VALIDATED` (`:157`) + `OCRE_TRADE` (`:171`) + `DONATION_VALIDATED` (`:185`) | **une seule** source à enrichir (jamais un 2ᵉ feed) |
| Ce qui **manque** au feed | DJ/donjons, songes, paliers de points de succès, Dofus validés | le cœur du chantier |
| Le bloc rendu | `src/app/dashboard/[guildId]/page.tsx:285` — `<GuildActivityFeed logs={guildLogs} guildId canViewLogs={user.canViewAuditLogs} />` | le feed est **déjà borné par RBAC** ⇒ la notification ne doit pas divulguer ce que le feed cache (fail-closed) |
| Préférences | `src/server/actions/dungeon-finder-actions.ts:2033-2034` — `notificationPrefs` (**Json** sur `UserProfile`), patron `notifPrefs.donjons !== false` (défaut **ON**, seul un `false` explicite désactive) | **le patron à réutiliser**, aucune colonne à ajouter |
| Écran des préférences | `src/components/profile/user-settings.tsx:66` — onglet Notifications, un interrupteur par clé (`market.<clé>`) | l'onglet existe : on y ajoute les clés du chantier |
| L'axe « points de succès » | `UserProfile.successPoints` (`prisma/schema.prisma:724`, `Int? @default(0)`) — **nullable** ; écrit par **4 chemins** (plan **S** §2) | le palier se détecte dans la **passe ladder**, pas à la validation |

## 3. Décisions à trancher

| # | Question | Recommandation |
|---|---|---|
| 1 | **Fan-out** : une ligne `Notification` par membre pour chaque événement ? | **Non** : 350 membres × chaque validation = 350 lignes. Le **flux** porte l'événement (0 destinataire) et le **toast** en découle ; `Notification` reste pour les événements **adressés** (mission validée → son auteur, demande de run → son auteur) |
| 2 | Ajouter des valeurs d'`enum` (`LADDER_MILESTONE`, `DUNGEON_VALIDATED`) ? | **Non dans ce chantier** : réutiliser `ACHIEVEMENT_VALIDATED`/`MISSION_VALIDATED`/`SYSTEM_INFO` + la **catégorie**. Une valeur d'enum ⇒ migration (arrêt obligatoire) et rien ne l'exige à l'écran |
| 3 | « tous les 1000 points » : paliers **fixes** ou **réglables** ? | Paliers **fixes de 1000** (constante pure) et **une seule** règle de palier de points : celle du chantier **S** si elle arrive ⇒ sinon deux vérités pour la même notion (interdit `AGENTS.md` §4.3) |
| 4 | Anti-bruit | Plafond **par guilde et par heure** + idempotence (on ne fête **jamais** deux fois le même franchissement — même verrou que le chantier **Y**) |
| 5 | RBAC | Le toast ne s'affiche que pour ce que le membre a le droit de voir (`canViewAuditLogs` pour les lignes d'audit, `canViewMissions`…) — **fail-closed**, jamais un flux « tous droits » |

## 4. Lots

| Lot | Contenu | Taille |
|---|---|---|
| **N-1** ✅ | **Règles pures + préférences** — `src/lib/guild-activity.ts` : `resolveSuccessPointsMilestones` (paliers **fixes** de 1000, jamais une baisse, rattrapage borné, `successPoints` **null ⇒ 0**), `resolveLadderTopEntry` (entrée dans le top 3, **une fois**), `shouldNotifyGuildActivity` (défaut ON, **seul un `false` explicite** coupe), `buildGuildActivityCopy` (texte borné). **Zéro I/O.** *Livré le 15/10/2026 — PR **#978**, 23 cas.* | M |
| **N-2** ✅ | **Émission** — **soldée le 15/10/2026 (suite 5)** : les paliers de points sont détectés dans la **passe ladder** (`src/server/ladder-milestones.ts`, PR **#979**) ; **l'entrée dans le top 3** est émise au même endroit (`emitLadderTopEntry`, l'avant/après rang ne se lit que là) ; Dofus validés, donjons/DJ et songes étaient **déjà** branchés sur `emitGuildActivity` (`dofus-quest-actions.ts:1038`, `dungeon-finder-actions.ts:1943`, `dream-run-actions.ts:686`) — c'est ce plan qui était **périmé** sur ce point. **Reste soldé** : `succes` (les **2** chemins de validation : `profile-actions.ts` dashboard et `discord-validation-actions.ts` Discord), `events` (les **2** chemins de création dans `calendar-actions.ts`) et le nouvel interrupteur **`objectifs`** (l'annonce des missions de la semaine, qui remplace le fan-out de 1 324 lignes). **Plus aucun switch mort** : `tests/unit/notification-fanout-guards.test.ts` interdit le retour d'un fan-out. | M |
| **N-3** ✅ | **Notif visible** — `src/components/notifications/activity-toaster.tsx` : une bulle pour chaque **nouvelle** ligne du flux, pour **tout le monde**, montée dans `top-nav.tsx` (haut droite sous le profil), **Toaster dédié** (`id="guild-activity"`) ; premier chargement **muet** ; polling 30 s. Interrupteurs dans Profil → Notifications. *Livré le 15/10/2026 — PR **#979**.* **Complété le 15/10/2026 (suite 5)** : la bulle affiche désormais l'**asset de l'objet** annoncé (illustration de donjon, icône de Dofus, picto de succès — rangé dans `ServiceActivityLog.metadata`, relu par `unified-activity-actions.ts`), avec l'**avatar** de l'acteur en repli ; l'interrupteur **« Objectifs de la semaine »** est ajouté (`objectifs`). | M |
| **N-4** ✅ | **Flux enrichi** — `ActivityType` élargi aux modules d'activité de guilde, `getGuildActivityToasts` filtre les lignes **par les préférences du membre, côté serveur** (une annonce coupée ne quitte jamais la base). *Livré le 15/10/2026 — PR **#979**.* | S |

## 5. Tests et acceptation

- **N-1** : bords de palier (`0→999` **rien** · `999→1000` **un** · `1900→3100` **deux** : 2000 **et** 3000 ·
  `1500→900` **rien** — les points peuvent **baisser**) · `successPoints` **null** ⇒ traité comme `0` ·
  préférence à `false` ⇒ aucune émission · jamais deux fois le même palier.
- **N-2** : un donjon validé apparaît dans le flux · un palier franchi n'est annoncé **qu'une fois**.
- **N-3** : la préférence coupe le toast **et** l'entrée, pas seulement l'affichage · un membre sans le
  droit ne reçoit rien (fail-closed).
- **Acceptation** : un membre valide un Dofus → la guilde le voit dans le flux **et** reçoit le toast **une
  seule fois** ; passer de 900 à 2100 points annonce **2000** (ni 1000, ni 3000) ; couper la préférence
  arrête net les toasts.

## 6. Vigilance

- Le **polling 10 s** existe déjà : ne pas ajouter de socket, ne pas ajouter de table d'état par client.
- `successPoints` est **nullable** : le traiter comme **0** (jamais « inconnu »).
- Les points **baissent** (recalcul ladder) : un palier franchi puis reperdu **ne se re-fête pas**.
- **Une seule** règle de palier de points (chantier **S**) : si S livre la sienne, N la consomme.
- Ne pas transformer le flux en journal d'audit : il reste **borné** (`limit 15`) et **lisible**.
- Aucune écriture Discord ici : ce chantier est **in-app** (le panneau Discord a déjà ses propres envois).

## 7. Idées de notifications (au-delà de la demande)

Déjà typées en base, donc quasi gratuites : mission validée/refusée, succès validé/refusé, demande de run
Songes, demande de donjon, sondage créé/clos, rappel d'événement.

À ajouter au flux (et au toast) :
1. **Dofus validé** par un membre (« wylan valide le Dofus Émeraude ») — *demande user*.
2. **Palier de points de succès** (1000, 2000, …) — *demande user*.
3. **Entrée dans le top 3 du ladder succès** de la guilde (« wylan est désormais 3ᵉ ») — *demande user*.
4. **Donjon/raid bouclé en équipe** (DJ) — *demande user*.
5. **Record de guilde battu** (XP, activité, profondeur de songes) : un seul événement, très parlant.
6. **Première fois** (« premier donjon de la guilde », « premier Dofus de la semaine »).
7. **Anniversaire d'arrivée** (1 an) — ⚠️ **déjà** couvert par le chantier **Y** (rôles d'ancienneté) :
   une seule source, pas deux.
8. **Recrue confirmée / mule validée** — utile au staff, à borner par RBAC.
9. **Annonce vendue** (marché) — catégorie `MARKET` déjà présente.
10. **Série de présence** (streak) — `lastActivityAt` existe déjà ; à ne faire que si le bruit reste maîtrisé.
11. **Objectif de guilde atteint** (module Missions) — le module sait déjà valider des missions de guilde.
12. **Raid officiel ouvert** — la bannière de raid existe déjà : la notification la relaie.
