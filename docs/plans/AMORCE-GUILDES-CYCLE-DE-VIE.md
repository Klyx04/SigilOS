# Amorce — Cycle de vie d'une guilde (création → sortie → purge)

> **Statut** : **document de travail** (amorce), pas une source d'ordre. L'ordre des chantiers vit
> dans `docs/ROADMAP.md` ; les décisions non prises sont listées ici **et** dans `ROADMAP` §4.
> **Public** : le mainteneur — ce texte est volontairement **vulgarisé** ; l'annexe A donne la
> preuve de chaque affirmation (fichier:ligne), pour qu'aucune ligne ne repose sur un souvenir.
> **Dernière mesure** : 01/11/2026, `dev` `8131eafe`.

---

## 0. Le sujet en trois phrases

Une guilde entre dans SigilOS quand quelqu'un **déploie** son serveur Discord. Elle en sort par
**trois portes** : le propriétaire clique « Supprimer », le bot est **retiré** du serveur, ou God
supprime depuis sa console. Entre la sortie et l'effacement définitif il y a une **grâce de 30
jours** — et, pour une personne qui n'a plus aucune guilde, une **seconde suppression** : celle de
son compte.

---

## 1. Le cycle en une image

```
   CRÉATION                 VIE                        SORTIE (3 portes)            GRÂCE 30 J          PURGE
┌───────────────┐   ┌──────────────────────┐   ┌────────────────────────────┐   ┌──────────────┐   ┌────────────────────┐
│ bot invité    │   │ dashboard            │   │ ① propriétaire : bouton    │   │ guilde       │   │ cron 04h45         │
│ → déploiement │ → │ Discord (boutons,    │ → │    « Zone sensible »       │ → │ désactivée,  │ → │ guild-purge        │
│ → GuildConfig │   │ commandes, embeds)   │   │ ② bot retiré du serveur    │   │ profils      │   │ (données + cascade)│
│ + profils     │   │ membres, quota 2     │   │ ③ God : soft/hard delete   │   │ archivés     │   │                    │
└───────────────┘   └──────────────────────┘   └────────────────────────────┘   └──────────────┘   └─────────┬──────────┘
                                                                                                              │
                                                                                            ┌─────────────────▼──────────────┐
                                                                                            │ cron 06h00 account-retention   │
                                                                                            │ supprime le COMPTE si plus     │
                                                                                            │ aucune guilde ACTIVE           │
                                                                                            └────────────────────────────────┘
```

**Les deux crons ne se remplacent pas** : le premier efface **les données de la guilde**, le second
peut effacer **la personne** (login + jetons Discord). Ce sont deux décisions différentes, prises à
deux endroits différents.

---

## 2. Ce qui est déjà solide (mesuré, pas déclaratif)

| Brique | Ce que ça garantit | Preuve |
|---|---|---|
| **Propriétaire = source de vérité** | seul le **propriétaire Discord live** peut supprimer ; un admin simple ne voit même pas l'onglet | `guards.ts` `requireGuildOwner`, `pilotage/page.tsx` |
| **Transfert de propriété** | si le serveur change de mains, la colonne `ownerId` se réaligne (événement bot + visite du dashboard) | bot `Events.GuildUpdate`, `user-actions.ts` (réconciliation) |
| **Quota de 2 guildes** | compte **toutes** les formes de propriété (snowflake ∪ UUID interne), God exempté, seuil borné 1..10 | `src/lib/guild-limit.ts`, `src/server/guild-limit.ts` |
| **Suppression self-service** | double confirmation par le nom, rate limit, garde d'état dans le `WHERE`, audit | `guild-lifecycle-actions.ts` |
| **Cohérence des surfaces** | une guilde désactivée ne répond **plus** sur Discord (boutons, commandes, modales) | `interactions/route.ts` (garde avant dispatch) |
| **Purge réelle** | bornée (20/passe), seulement les guildes **déséchées et échues**, une seule implémentation partagée avec God | `guild-purge-core.ts`, `cron/guild-purge` |
| **Écrans honnêtes** | « Serveur Supprimé » dit la vérité, affiche l'échéance, prévient le membre solo | `dashboard/[guildId]/layout.tsx` |
| **Verrous** | chaque règle ci-dessus est tenue par un test (≈ 80 cas sur ce sujet) | `tests/unit/guild-deletion.test.ts`, `tests/unit/guild-owner-reconciliation.test.ts`, `tests/unit/discord-interaction-guild-state.test.ts` |

---

## 3. Les cinq décisions à prendre (elles bloquent les lots)

| # | Question à trancher | Ce que ça change pour l'utilisateur | Effort | Si on ne décide pas |
|---|---|---|---|---|
| **D-A** | Mesure-t-on l'**inactivité réelle** ? | aujourd'hui : un compte **ancien** qui perd sa dernière guilde est purgé à J+30 même s'il s'est connecté la veille | **migration** (`User.lastSeenAt`) | on garde « âge du compte » (désormais documenté) |
| **D-B** | Garde-t-on une **preuve de suppression** ? | le journal d'audit de la guilde part **avec** elle (cascade) : plus aucune trace de qui a supprimé quoi | petit (log **plateforme** `guildId: null`, `isGodLog: true`) | aucun historique après purge |
| **D-C** | Peut-on **geler** une purge (litige, incident) ? | God peut purger n'importe quand, sans frein | petit (drapeau `purgeHold` + garde dans le cron) | une purge peut détruire une preuve en cours d'examen |
| **D-D** | Offre-t-on un **export** des données d'une guilde ? | la suppression existe (RGPD), la **portabilité** non | moyen (sérialisation + lien signé) | demande RGPD traitée à la main |
| **D-E** | Prévenir **hors application** (e-mail) ? | aujourd'hui seul celui qui **revient** sur le dashboard voit le compte à rebours | moyen (fournisseur + gabarits) | suppression sans aucun préavis |

> ⚠️ **D-A est le seul qui exige une migration de schéma** : par règle interne, c'est un arrêt
> explicite, jamais glissé dans un correctif.

---

## 4. Les trois lots faisables **sans** décision

### Lot 4.1 — Voir les guildes **dormantes** (le cas de tes guildes de test)

**Ce qui se passe** : `guild-orphan-watch` ne signale que les guildes **sans admin** (zéro
propriétaire, zéro rôle Administrateur, zéro délégation). Une guilde où le propriétaire est **seul**
n'est donc **jamais** signalée — elle peut rester active indéfiniment avec un membre fantôme.

**Ce qu'on peut faire sans migration** : `GuildActivity` journalise déjà chaque connexion au
dashboard (type `LOGIN`/`NEW_MEMBER`, index `guildId + createdAt`). Un cron « dormance » peut donc
lister les guildes actives dont **la dernière activité dépasse N jours** et dont l'effectif est
faible, puis :
1. notifier God (bilan), et
2. poster **un message dans le salon système** de la guilde : « ce serveur est inactif depuis N
   jours ; le propriétaire peut le supprimer en un clic » (avec le lien du portail).

Aucune suppression automatique : on **informe**, l'humain décide.

**Effort** : petit (une route cron + une requête agrégée). **Risque** : faible (lecture seule).

### Lot 4.2 — Restaurer **soi-même** dans les 30 jours

**Ce qui existe** : `reactivateGuild` (God) remet la guilde en service. Mais un propriétaire qui a
supprimé **par erreur** doit ouvrir un ticket et attendre.

**Ce qu'on ajoute** : une action `restoreMyGuild`, gardée par `requireGuildOwner`, avec garde
d'état dans le `WHERE` (`deletedAt != null` **et** `scheduledDeletion > now`), audit, et un bouton
dans la « Zone sensible » (remplacé quand la guilde est désactivée). Les profils archivés sont
réactivés **selon le même plafond** que les autres réactivations (garde G5).

**Effort** : moyen (une action + un écran + un verrou). **Risque** : faible, entièrement encadré.

### Lot 4.3 — Éviter le **contexte fantôme** après un retrait du bot

**Ce qui se passe** : sur `GuildDelete`, le bot désactive la guilde et archive les profils, mais ne
purge **pas** les caches. Un membre peut donc naviguer **jusqu'à 60 s** sur une guilde morte.
**Correctif** : purger les caches dans le même handler (le web expose déjà `purgeGuildCaches`).

**Effort** : très petit. **Risque** : nul (le contraire est le risque).

---

## 5. Chantiers **déjà dans la ROADMAP** qui touchent ce sujet (ne pas les absorber)

| Rang | Chantier | Pourquoi il touche le cycle de vie |
|---|---|---|
| **5** | `migrations-ops` | des crontabs ne sont pas déployés — un cron non posé = une politique de rétention qui ne tourne pas |
| **24** | `god-refonte` (Guildes & Users) | c'est la console qui **restaure**, **purge** et **gèle** ; les décisions D-B/D-C y vivent |
| **26** | `demo-publique` + décision **D1** | « une guilde de démo ne doit pas exister en base » : même problème que les guildes jetables |
| **28** | `onboarding` + décision **D5** | c'est l'entrée du cycle (création de la guilde) ; non tranchée |
| **38** | `service-activity-log` + **D-S1** | table non bornée « preuve de litige » : la même question « on garde ou on purge » |
| **42** | `active-context-rotation` | dette documentaire (pas produit) |
| **47** | `telemetrie-retention` | `TelemetryEvent` sans purge : même famille (« rétention oubliée ») |

---

## 6. Hors périmètre (à ne **pas** mettre dans ces lots)

- **Facturation / plans payants** : aucun modèle économique aujourd'hui, rien à brancher.
- **Fusion de guildes** ou transfert de données entre deux serveurs : jamais demandé, très risqué.
- **Suppression en cascade manuelle** : Prisma le fait déjà (`onDelete: Cascade` sur **toutes** les
  relations de `GuildConfig`) — écrire des `deleteMany` à la main créerait deux vérités.
- **Purge immédiate (sans grâce)** : elle existe déjà pour God (`hardDeleteGuild`) et doit le rester.

---

## 7. Séquence proposée (une PR par ligne)

| # | Lot | Dépend de | Pourquoi dans cet ordre |
|---|---|---|---|
| **S1** | Preuve de suppression immuable (**D-B**) | — | c'est le manque le plus criant en audit, et le moins risqué |
| **S2** | Restauration libre-service (4.2) | — | pendant naturel du bouton supprimer |
| **S3** | Guildes dormantes (4.1) | — | règle le cas réel qui a ouvert le sujet |
| **S4** | Caches `GuildDelete` (4.3) | — | 30 minutes, à glisser quand on veut |
| **S5** | Décisions lourdes (**D-A**, **D-C**, **D-D**, **D-E**) | accord explicite | migration / fournisseur / politique |

---

## Annexe A — Preuves (chaque affirmation ci-dessus, vérifiée dans le code)

| Affirmation | Où c'est vérifiable | Comment |
|---|---|---|
| Seul le propriétaire Discord **live** peut supprimer | `src/server/actions/guards.ts` (`requireGuildOwner` → `guildInfo.owner_id === discordUserId`) | lecture + test `guild-deletion` |
| Grâce de **30 jours** | `src/lib/guild-deletion.ts` (`GUILD_DELETION_GRACE_DAYS = 30`) | lecture + test |
| Purge **bornée** et **listée par état** | `src/server/guild-purge-core.ts` (`where: { deletedAt: { not: null }, scheduledDeletion: { lte: now } }`, `take: limit`) | lecture + test |
| Cron **protégé** et **télémétré** | `src/app/api/cron/guild-purge/route.ts` (`verifyCronSecret`, `recordCronExecution("guild_purge"`) | lecture + test |
| Toutes les relations de `GuildConfig` sont en **cascade** | `prisma/schema.prisma` (`onDelete: Cascade`, ~20 relations) | `git grep` |
| **Le journal d'audit part avec la guilde** | `prisma/schema.prisma:687` (`AuditLog.guild … onDelete: Cascade`) | lecture |
| Un **log plateforme** est possible | `prisma/schema.prisma:675 et 685` (`guildId String?`, `isGodLog`) | lecture |
| Discord **inerte** sur guilde désactivée | `src/app/api/discord/interactions/route.ts` (`readGuildActivityState`, garde avant le dispatch) | lecture + test |
| **Transfert** de propriétaire répercuté | bot `Events.GuildUpdate` ; `src/server/actions/user-actions.ts` (réconciliation, `OR: [{ ownerId: null }, …]`) | lecture + test `guild-owner-reconciliation` |
| Quota = **union** profils + propriété (2 formes) | `src/server/guild-limit.ts` (`ownerId: { in: ownerIds }`) · `src/lib/guild-limit.ts` | lecture + test |
| **Aucun e-mail** transactionnel | `git grep -i "nodemailer\|resend\|sendgrid\|postmark\|smtp"` sur `src/` et `package.json` → **aucun résultat** | grep négatif |
| **Aucun gel** de purge | `git grep "purgeHold\|legalHold"` sur `prisma/ src/ services/` → **aucun résultat** | grep négatif |
| **Aucun export** de données | `git grep "exportData\|portability"` → seul `game-data-admin-actions.ts` (jeu de données, sans rapport) | grep négatif |
| `guild-orphan-watch` **ignore une guilde solo** | `src/server/actions/guild-owner-actions.ts:342` (exige zéro admin natif **et** zéro délégation) | lecture |
| **Restauration = God seulement** | `reactivateGuild` appelé uniquement depuis `src/app/god/components/guild-table.tsx:596` | `git grep` |
| `GuildDelete` **ne purge pas** les caches | handler `services/discord-bot/index.ts` — aucun `purge`/`redis`/`cache` | `git grep` ciblé |
| **Signal d'activité disponible** sans migration | `GuildActivity` (`schema.prisma:699`, index `guildId+createdAt`) alimentée par `emitGuildActivity` à chaque connexion (`src/app/api/[guildId]/stream/route.ts:51-58`) | lecture |
| `UserProfile.lastActivityAt` n'est **pas** un « vu pour la dernière fois » | écrit uniquement par `market-actions.ts` (interactions marché) | `git grep` |
| Sessions **JWT** ⇒ aucune date de connexion en base | `src/auth.ts:58` (`strategy: "jwt"`) ; `lastSeenAt` n'existe que sur `GodSessionLog` | lecture |
| Rétention compte = **âge** (90 j) + grâce | `src/server/account-retention-core.ts` (`createdAt: { lt: cutoff }`, `profiles: { none: { status: "ACTIVE" } }`) | lecture + test |

> Ce qui n'est **pas** dans ce tableau n'est pas affirmé. Si une ligne devient fausse, c'est le code
> qui a raison : on corrige l'amorce dans le même commit.

---

## Annexe B — Glossaire (pour relire sans être du métier)

- **Guilde / `GuildConfig`** : l'espace SigilOS d'un serveur Discord. Une ligne en base = une guilde.
- **Profil (`UserProfile`)** : la fiche d'**une personne dans une guilde**. Une personne peut en avoir
  plusieurs (une par guilde).
- **Propriétaire « live »** : celui que **Discord** désigne aujourd'hui ; c'est lui qui fait foi, pas
  la colonne enregistrée en base.
- **Soft-delete** : on **désactive** et on date une échéance, sans rien supprimer. Réversible.
- **Grâce** : les 30 jours pendant lesquels la guilde désactivée est encore restaurable.
- **Purge** : la suppression **définitive** des données (cron 04h45).
- **Cascade** : quand la guilde est supprimée, la base supprime automatiquement tout ce qui en dépend
  (profils, événements, tickets…). D'où l'importance du **journal plateforme** (D-B).
- **Session JWT** : le login est un jeton signé dans un cookie, **pas** une ligne en base — donc pas de
  « dernière connexion » à lire.
- **Plafond (2 guildes)** : limite par personne, comptée en **union** (profils actifs ∪ guildes
  possédées), God exempté.
- **Cron** : tâche planifiée appelée par le VPS (`curl` + `x-cron-secret`), visible dans God
  (`/god?tab=cron-status`).
- **Dormance** : état d'une guilde **active** mais **sans activité** — c'est ce qu'aucun écran ne
  montre aujourd'hui.

---

## Comment démarrer (sans attendre S5)

1. Prendre **S1** (preuve de suppression immuable) : le champ existe, il ne reste qu'à écrire le log
   plateforme au moment de la purge et à le verrouiller par un test.
2. Puis **S2** (restauration libre-service) : le pendant exact du bouton supprimer.
3. Puis **S3** (dormance) : lecture seule, aucun risque, et ça règle le cas qui a ouvert le sujet.

Chaque ligne = **une branche, une PR, un verrou**. Les décisions D-A/D-C/D-D/D-E attendent un accord
explicite (migration ou fournisseur) et ne doivent **pas** être glissées dans ces lots.


---
