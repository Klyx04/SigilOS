# PLAN — Rôles automatiques par **points de succès** (chantier « S »)

> **Demande user (verbatim, 14/10/2026)** : « Bonus en + pour attribuer rôle conditionné aux point de
> succès ladder du joueur ! »
> **Statut : plan écrit, en attente du go.** Il y a une **migration** (nouvelles colonnes) : la règle
> maison impose un **arrêt immédiat + accord explicite** avant d'écrire le SQL.

## 1. Le besoin

Un membre qui atteint un **seuil de points de succès** (score ladder Dofus) reçoit un rôle Discord —
la mécanique du chantier `Y`, mais l'axe devient le **score** au lieu de l'**ancienneté**.

## 2. État mesuré (14/10/2026)

| Chercher | Où c'est | Verdict |
|---|---|---|
| Les points | `UserProfile.successPoints` (`prisma/schema.prisma:724` — `Int? @default(0)`) | **déjà en base** : rien à créer côté membre |
| Qui les écrit | `src/app/api/cron/ladder-sync/route.ts:89-103` (cron, 5 profils/passe, `lastLadderUpdate` 12 h) · `src/workers/ladder-sync-worker.ts:297` (worker BullMQ) · `src/server/actions/profile-actions.ts:2386` (`refreshUserSuccessPoints`) et `:2484` (onboarding) | **4 chemins d'écriture** ⇒ on ne s'y accroche **pas** (4 points d'insertion = 4 occasions d'oublier) : on **réconcilie** comme Y |
| La source amont | `cloudflare-workers/dofus-ladder-proxy` · `sigil-ladder-ankama` (`?type=succes`, `X-SigilOS-Key`) | hors périmètre |
| L'affichage existant | `src/app/dashboard/[guildId]/ladder/**` + `successPointsDisplay` (`src/app/api/discord/interactions/route.ts:3245`) | existe déjà, rien à dupliquer |
| La mécanique de pose | chantier Y : `src/lib/seniority-roles.ts`, `src/server/seniority-roles-core.ts`, `seniority-roles-actions.ts`, `seniority-roles-panel.tsx` | **≥ 90 % agnostique à l'axe** : diff cumulatif, périmètre fermé, cible, annonce, surcharges de texte par palier (Y-5) |
| L'idempotence | table `SeniorityRoleAnnouncement`, unicité `(guildId, discordId, tierDays)` | ⚠️ **piège si réutilisée telle quelle** : un seuil **30 jours** et un seuil **30 points** collisionnent → une annonce avalée **en silence** |

## 3. Décisions à trancher

| # | Question | Options | Recommandation |
|---|---|---|---|
| 1 | **Schéma** | (a) colonnes dédiées `GuildConfig.successRoles*` + `successRolesTiers` JSON (b) réutiliser `seniorityRoles*` avec un discriminant | **(a)** : deux axes = deux réglages ; mélanger mettrait deux significations dans une colonne. ⇒ **migration additive** (à accorder, règle maison) |
| 2 | **Généralisation** | (a) extraire le cœur en fonctions **neutres d'axe** (`resolveTierIndex(tiers, value)`, `computeTierRoleDiff({ value })`, annonce avec variable `{points}`, bornes passées en paramètre) réutilisées par Y **et** S (b) dupliquer un `success-roles.ts` | **(a)** : « une seule source de vérité par règle ». Le refactor reste borné — Y est frais et ses **filets sont là pour l'attraper** |
| 3 | **Annonces** | (a) 2ᵉ table `SuccessRoleAnnouncement` (b) colonne `kind` sur la table existante | **(a)** : chaque axe trace ses propres seuils, aucun mélange ; (b) suppose d'élargir la contrainte unique **et** de migrer une table vivante |

## 4. Lots

| Lot | Contenu | Taille |
|---|---|---|
| **S-1** | **Données + règles pures** : migration additive (`successRolesEnabled` OFF par défaut, `successRolesTiers` JSON, `successRolesChannelId`, `successRolesAnnouncement`, `successRolesActivatedAt`) + extraction des règles **neutres d'axe** + bornes de points (0 → 10 000 000) + variable d'annonce `{points}` | M |
| **S-2** | **Réconciliation** : passe cron (même forme que Y-2 — claim d'annonce atomique, rattrapage muet, diff cumulatif) + route `/api/cron/success-roles` + `KNOWN_CRON_TASKS` + télémétrie | M |
| **S-3** | **Écran** : onglet « Points de succès » dans Membres (paliers = points → rôles, **texte par palier** comme Y-5) + vue « prochains paliers » en points + salon dans `Paramètres → Points de succès` (une porte par réglage, comme G) | M |

## 5. Tests et acceptation

- **S-1** : les filets de Y doivent rester **verts sans changement de comportement** (preuve que
  l'extraction n'a rien cassé) · bornes de points · variable `{points}`.
- **S-2** : **idempotence par axe** (un seuil de 30 j et un seuil de 30 pts ⇒ **deux** annonces),
  rattrapage muet avant activation, diff cumulatif, retrait si les points baissent.
- **S-3** : onglet déclaré/rendu, éditeur de paliers, texte par palier, aperçu.
- **Acceptation** : un franchissement de points pose les rôles **et** annonce **une seule fois** ; un
  palier d'ancienneté n'est **jamais** confondu avec un palier de points.

## 6. Vigilance

- `successPoints` est **nullable** ⇒ traité comme **0**, jamais comme « inconnu » qui accorderait un
  rôle à tort (fail-closed).
- Les points peuvent **baisser** (recalcul ladder) ⇒ le diff **retire** comme il ajoute : même
  sémantique que Y, **périmètre fermé** (seuls les rôles déclarés sont touchés).
- Une passe coûte un appel Discord par membre ⇒ même garde-fou que Y (borne de guildes par passe,
  erreur par membre qui n'interrompt pas les autres).
- **Ne pas** toucher aux 4 chemins d'écriture des points : ils restent la **source** ; la
  réconciliation est le **seul** écrivain des rôles.
- Le piège d'idempotence du §2 est un **verrou de test**, pas une note : il se teste.
