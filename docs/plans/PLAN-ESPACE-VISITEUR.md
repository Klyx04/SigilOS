---
description: Espace visiteur — compte Discord public, profil perso, progression de rush en base, annuaire par serveur, modération God ; décisions du 02/11/2026
---

# 👤 Espace visiteur — compte public, profils, annuaire par serveur

> **Rôle unique.** Ce fichier porte le **quoi** et les **décisions** de tout ce qui concerne un
> utilisateur **sans guilde** (le « visiteur ») : qui peut entrer, où vit son profil, où vit sa
> progression, qui voit qui, ce que le God peut faire, et ce que le RGPD impose.
>
> Il **ne duplique pas** : l'ordre d'exécution vit dans `docs/ROADMAP.md` ; l'état du module Rush dans
> `docs/plans/MODULE-RUSH-SYLVESTRE.md` ; la route d'alignement dans
> `docs/plans/ARCHITECTURE-ALIGNEMENT-RUSH-SYLVESTRE.md`.
>
> **Dernière MAJ : 02/11/2026.**

## 1. Décisions verrouillées (02/11/2026)

| # | Décision | Conséquence |
|---|---|---|
| **D-V1** | **Tables dédiées** : `PublicProfile` + `PublicRushProgress` (une ligne JSON par personnage) | isolation **structurelle** : un visiteur ne peut pas atteindre une guilde, et inversement. Suppression RGPD = 2 lignes |
| **D-V2** | **Un seul `User`** porte les deux vies (guildé **et** visiteur) | un guildé garde son profil de guilde **et** un profil visiteur ; l'écran les présente ensemble, sans second compte |
| **D-V3** | Un visiteur **ne voit jamais le roster d'une guilde** | ce chantier n'ouvre **aucune** lecture inter-guilde |
| **D-V4** | Visibilité = **consentement individuel**, opt-in, révocable (`User.rushServerVisible`, défaut `false`) | on publie des **volontaires**, jamais une guilde ; le tag `Guilde` n'affiche le **nom** que si la guilde est déjà publique (`GuildConfig.presentationEnabled`) |
| **D-V5** | Rétention **12 mois** sans connexion (`User.lastSeenAt`), purge par le cron `account-retention` existant | + suppression immédiate sur demande, **sans archivage** |

### 1.1 Matrice de visibilité

| Qui regarde ↓ / affiché → | consentant (`rushServerVisible = true`) | non consentant |
|---|---|---|
| **Visiteur** (guide / overlay public) | ✅ pseudo, classe, Dofus + étape, tag `Visiteur` ou `Guilde` | ❌ invisible |
| **Membre** (guide / overlay interne) | ✅ idem | ✅ **ses propres collègues** uniquement (comportement actuel, inchangé) |

Filtre = **même serveur**. Le serveur d'un visiteur vient de `PublicProfile.dofusServerId`, celui d'une
guilde de `GuildConfig.dofusServerId` — même référentiel (`DOFUS_UNITY_SERVERS`,
`src/lib/presentation-constants.ts`).

**Aucune interaction** : on affiche, on copie `/w <pseudo>` au clic, rien d'autre. Pas de messagerie,
pas de demande d'aide, pas de chat.

## 2. Blocage mesuré avant tout code

| Mesure | Fichier | Conséquence |
|---|---|---|
| `signIn` **refuse** tout compte Discord sans guilde gérée (`NO_MANAGED_GUILD`, journalisé + fail-closed) | `src/auth.ts:64-175` | **un visiteur ne peut pas se connecter** aujourd'hui : c'est la porte d'entrée de la plateforme qu'il faut ouvrir, pas un écran à ajouter |
| `UserProfile` est **cloisonné par guilde** (`guildId` obligatoire, `@@unique([userId, guildId])`, FK `GuildConfig`) | `prisma/schema.prisma:728-888` | un profil public ne peut pas réutiliser cette table |
| La progression est clé `profileId` | `PlayerGuideProgress:3205`, `PlayerGuideResourceCheck:3231`, `PlayerGuideDungeonState:3258` | idem : pas de réutilisation directe |
| La progression publique vit dans **le navigateur** | `src/lib/guest-progress.ts`, `src/lib/rush-dungeon-storage.ts` | à supprimer **après** adoption en base (voir §6) |
| Le serveur de la guilde existe déjà | `GuildConfig.dofusServerId` | rien à créer pour le filtre par serveur |

## 3. Modèle retenu (option 2)

```text
User (existant)
 ├── Account / Session            (JWT, 8 h)                    ← inchangé
 ├── UserProfile[]                (guildé, guilde-scopé)        ← inchangé
 └── PublicProfile (1:1)
      ├── pseudoDofus, dofusServerId, classe
      ├── mules (JSON borné), metiers (JSON borné), succes (JSON borné)
      ├── introduction, objectifs, visibilité
      └── PublicRushProgress[]  (1 ligne = 1 personnage)
            guideId, characterSlot,
            completedMs, steps, bookmarks, resources, dungeons   (JSON, borné)
```

- **Une ligne JSON par personnage** : la progression d'un visiteur est un **instantané** (lecture/écriture
  atomique, last-write-wins). Les **règles** ne changent pas : `isSequenceBlockedByPrereqs`, cascade,
  verrous de donjons et de palier s'exécutent **avant** l'écriture, côté serveur.
- **Pas** de `profileId` nullable sur les tables existantes : une colonne de propriétaire nullable rend
  un `where` oublié **fail-open**. On refuse ce risque.
- **Pas** de « guilde fantôme » : `GuildConfig.discordGuildId` est requis et unique, et le bot, les crons
  de synchro et les écrans God **itèrent** sur les guildes ⇒ contamination silencieuse.

## 4. RGPD & sécurité (non négociable)

1. **Consentement explicite** à la création (case non pré-cochée) + consentement séparé pour la
   visibilité (`rushServerVisible`), tous deux révocables.
2. **Minimisation** : pseudo Dofus, serveur, classe, mules, métiers, succès, présentation. **Jamais**
   d'e-mail, d'id Discord, de token ni de capture.
3. **Suppression dure** (demande utilisateur, ou bannissement God) : `User` + cascade `PublicProfile` +
   progression. **Aucun archivage.** Un banni qui revient est **déconnecté** et retombe en visiteur
   sans profil.
4. **Export** : un JSON lisible, généré à la demande, borné.
5. **Audit** : toute action God (suppression, bannissement) écrit une ligne existante
   (`GodAccessLog` / `PlatformBan`), jamais un journal parallèle.
6. **Accès** : la liste par serveur est réservée aux comptes **authentifiés** de ce serveur ; pas d'API
   publique, pas d'export en masse, rate limit sur la recherche.
7. **Cloisonnement** : aucune requête d'un visiteur ne porte un `guildId` ; aucune requête de guilde ne
   lit `PublicProfile`, sauf la liste par serveur (lecture, filtrée par consentement).

## 5. Lots

> L'**ordre** vit dans `docs/ROADMAP.md`. Ici, le **quoi**.

### V1 — Compte visiteur + progression en base (migration)

- **Auth** : `signIn` laisse entrer un compte **sans guilde gérée** ; le contexte reste `isMember=false`
  ⇒ **aucune** page ni action du dashboard ne s'ouvre (les gardes existantes sont inchangées). Nouvelle
  garde `requirePublicAccount()` pour l'espace public.
- **Schéma** : `PublicProfile` (+ `User.publicProfile`, `User.rushServerVisible`), `PublicRushProgress`
  (unique `[publicProfileId, guideId, characterSlot]`, index `[publicProfileId]`).
- **Serveur** : `src/server/rush-public-store.ts` (lecture/écriture bornée + Zod), actions
  `savePublicRushProgress`, `resetPublicRushProgress`, `adoptLocalRushProgress` (reprise du
  `localStorage` à la première connexion, **une seule fois**).
- **Écrans** : profil public (Général / Présentation / Mules / Succès / Métiers / Réglages), suppression
  du compte, export.
- **Ops** : migration additive ; `npx prisma migrate deploy` bêta puis prod.

### V2 — Guide public authentifié + annuaire par serveur

- La page `/guides/rush-sylvestre` exige un compte ; suppression du `localStorage` (après adoption).
- **La modale de setup** est **le même composant** que l'interne (personnage/classe/serveur, route
  cité → Ordre, reset en deux temps, Metamob) : une seule implémentation, deux alimentations.
- **Annuaire** : recherche par serveur, page profil en lecture, tag `Visiteur` / `Guilde`, copie
  `/w pseudo`.
- **Bloc par Dofus** : la liste du serveur s'ajoute aux collègues, alimentée par le **seul consentement**.

### V3 — God des visiteurs

- Liste par serveur, suppression, bannissement (`PlatformBan`), réinitialisation de la visibilité.
- Aucune donnée personnelle dans les logs ; volumes uniquement.

## 6. Ce qu'on supprime (et quand)

1. `src/lib/guest-progress.ts` + `src/lib/rush-dungeon-storage.ts` : **après** V1 (adoption), pas avant —
   sinon les visiteurs déjà en cours perdent leur rush.
2. Le stockage local du guide public (`sigilos_rush_route_<slug>`, `<préfixe>resources|steps|…`) : même
   séquence.
3. Les tests de parité correspondants suivent la suppression ; **aucun** test n'est désactivé.

## 7. Pièges

- **Ne pas** élargir `signIn` sans vérifier qu'aucune garde ne s'appuie sur la seule présence d'une
  session (`auth()` seul) : la règle du dépôt est `getUserContext` **+** RBAC par page **et** par action.
- **Ne pas** réutiliser `showPresence` (préférence de présence de guilde) pour la visibilité serveur :
  sémantique différente, consentement différent.
- **Ne pas** exposer `PublicProfile` dans une page de guilde non filtrée : la seule lecture autorisée est
  la liste par serveur, consentement actif.
- **Ne pas** passer le `serverId` depuis le client : il est **résolu côté serveur** (profil).
- Un `PublicRushProgress` illisible ⇒ **refus** (fail-closed), jamais un état vide qui écraserait la
  progression.
