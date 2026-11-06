---
description: Espace visiteur — compte Discord public, profil perso, progression de rush en base, Progression Communautaire par serveur, Succès Donjons entre visiteurs, modération God ; décisions du 02/11/2026 révisées le 06/11/2026
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
> **Dernière MAJ : 06/11/2026** — V1c livré (écrans, DTO étanche, `touchLastSeen`, migration unique) · **porte d'entrée (D-V13)** · **coque publique (D-V14)** · **succès (V1i)**.

## 1. Décisions verrouillées

### 1.0 Socle (02/11/2026, V1a/V1b)

| # | Décision | Conséquence |
|---|---|---|
| **D-V1** | **Tables dédiées** : `PublicProfile` + `PublicRushProgress` + `PublicProfession` + `PublicDungeonAchievement` | isolation **structurelle** : un visiteur ne peut pas atteindre une guilde, et inversement. Suppression RGPD = cascade depuis `User` |
| **D-V2** | **Un seul `User`** porte les deux vies (guildé **et** visiteur) | un guildé garde son profil de guilde **et** un profil visiteur ; l'écran les présente ensemble, sans second compte |
| **D-V3** | Un visiteur **ne voit jamais le roster d'une guilde** | ce chantier n'ouvre **aucune** lecture inter-guilde |
| **D-V4** | Visibilité = **consentement individuel**, opt-in, révocable — **`PublicProfile.showOnDirectory`** (défaut `false`) ; présence temps réel = **`PublicProfile.showPresence`** (défaut `false`), consentement **distinct** (D9) | on publie des **volontaires**, jamais une guilde ; le tag `Guilde` n'affiche le **nom** que si la guilde est déjà publique (`GuildConfig.presentationEnabled`). ⚠️ **`User.rushServerVisible` n'existe pas** : c'était le nom pré-V1a, corrigé ici |
| **D-V5** | Rétention **365 jours** sans connexion (`User.lastSeenAt`) pour **tous** les comptes orphelins, purge par le cron `account-retention` existant | décision du **06/11/2026** (remplace « 12 mois visiteurs seulement » et « 90 j ») : une seule durée, aucun cas particulier |

### 1.1 Implémentation V1c (06/11/2026)

| # | Décision | Conséquence |
|---|---|---|
| **D-V6** | **Route `/espace-visiteur/<segment>`** — `general`, `mules`, `presentation`, `succes`, `metiers`, `reglages` | un onglet = **un segment d'URL** (deep-link, retour arrière, `loading.tsx`/`error.tsx` par segment), jamais un état client. Garde dans **chaque page ET chaque action** |
| **D-V7** | **Aucun logo de guilde** : seul le **nom déclaratif** existe (`declaredGuildName`) | `declaredGuildLogoUrl` est **retirée par migration** (colonne vide par construction : aucun writer). Pas d'upload, pas d'URL d'image, pas de modération d'image |
| **D-V8** | **Pas de « progression commune » agrégée** dans l'annuaire | la statistique vit dans le **panneau « Progression Communautaire »** : reproduction du panneau interne par Dofus (nom, % par Dofus, détail **par bloc**, quête en cours par membre) + **donjons requis** (« qui l'a coché », « à faire ») via `PublicRushProgress.dungeonChecks` |
| **D-V9** | Onglet **Succès Donjons** de l'espace visiteur : **boss + titans + avis uniquement**, pas le reste | vue « qui a quoi **entre visiteurs du même serveur** », filtres et recherche, alimentée par `PublicDungeonAchievement` + profils consentants |
| **D-V10** | Suppression depuis l'espace visiteur = **vie publique seulement** si le `User` a aussi un `UserProfile` ACTIVE | refus explicite avec la marche à suivre ; jamais de suppression qui emporterait l'historique de guilde. Sans vie de guilde : suppression dure, **sans archivage** |
| **D-V11** | **`touchLastSeen()` dans la garde visiteur** (`requirePublicAccount`) | sans ça, un visiteur n'est **jamais** marqué « vu » (seul `getUserContext` l'écrit) ⇒ il serait purgé à l'échéance malgré des visites quotidiennes. **Obligatoire avant `PUBLIC_VISITOR_ENTRY=1`** |
| **D-V12** | **Guide public connecté = bandeau de l'interne** : 5 tuiles (Personnage actif, Alignement, Metamob, Rush Live, Ouvrir Overlay), recherche + Options **entre** le bloc Rush et le bloc Progression, puis **Progression Communautaire** | non connecté : mode local actuel inchangé. La tuile Metamob est un **agrégat serveur** (la clé API ne part jamais au client) ; Rush Live dépend de `showPresence` |
| **D-V16** | **Vérifications** : pseudo Dofus via le ladder Ankama (helper **partagé** `src/server/ladder-pseudo.ts`, repli manuel du toggle God `ladderManualFallback`) et clé Metamob immédiate (`/v1/me`) | **fail-open** sur le ladder (worker indisponible ⇒ `found: null`, jamais un refus d'enregistrement) ; garde + rate limit sur chaque action ; la clé Metamob ne sort jamais du serveur, aucun log du pseudo |
| **D-V15** | **Les assets du produit, pas des glyphes** : serveurs (`assets/dofus/servers`), classes (`DOFUS_CLASSES[].icon`), métiers (`DOFUS_JOBS[].icon`), activités (`ACTIVITY_ASSETS`), aide « Où trouver ma clé API ? » sur Metamob | `ALL_DOFUS_SERVER_ENTRIES` est la **source unique** de l'icône serveur (`ALL_DOFUS_SERVERS` reste la liste de noms validée côté serveur) ; `tests/unit/visitor-assets.test.ts` vérifie que **chaque chemin existe sur disque** (zéro 404 `/_next/image`) |
| **D-V14** | **Coque = chrome public, pas chrome de guilde** : `PublicHeader` + `GalacticFooter` rendus dans le layout, `dashboardHref` reste dans l'espace, chaque onglet porte un **asset du jeu** | D-V6 interdisait le chrome **de guilde**, pas celui du site : sans lui le visiteur était enfermé (seule sortie « Se déconnecter »). Les six chemins d'assets sont vérifiés **sur disque** par `tests/unit/visitor-shell.test.ts` (piège du 404 `/_next/image`) |
| **D-V13** | **Porte d'entrée** : entrée « Mon espace visiteur » dans le menu avatar (tout compte connecté, D-V2) + redirection `/dashboard` et `/` → `/espace-visiteur/general` pour un compte **sans aucune guilde** | une seule règle (`src/lib/visitor-entry.ts`), une seule garde (`src/server/visitor-entry.ts`) ; **jamais** de redirection quand l'interrupteur est fermé, que Discord échoue ou que le compte est banni (fail-closed, anti-boucle `/` ⇄ espace). Aucune migration |

### 1.2 Matrice de visibilité

| Qui regarde ↓ / affiché → | consentant (`showOnDirectory = true`) | non consentant |
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
| **`lastSeenAt` n'est écrit que par `getUserContext`** (dashboard) | `src/server/last-seen.ts`, un seul appelant (`user-actions.ts:523`) | un visiteur n'est **jamais** marqué « vu » ⇒ purge à l'échéance malgré des visites quotidiennes (corrigé par **D-V11**) |
| `getPublicAccount()` rend le profil **entier**, `metamobApiKey` **déchiffrée** | `src/server/public-account.ts:51` + hook `result.publicProfile` (`src/lib/prisma.ts`) | un **`select` explicite / DTO** est obligatoire avant tout passage au client |

## 3. Modèle retenu (option 2)

```text
User (existant)
 ├── Account / Session            (JWT, 8 h)                    ← inchangé
 ├── UserProfile[]                (guildé, guilde-scopé)        ← inchangé
 ├── lastSeenAt                    (Date?)  ← source de la rétention (D-V5, D-V11)
 └── PublicProfile (1:1, userId @unique)
      ├── dofusServerId (NOT NULL), pseudoDofus, classe
      ├── declaredGuildName (nom déclaratif), introduction, objectifs
      ├── alignment / alignmentOrder / alignmentLevel
      ├── dofusLevel, totalXp, successPoints, lastLadderSync
      ├── metamobPseudo, metamobApiKey (chiffrée), metamobVerified
      ├── showOnDirectory, showPresence                     (deux consentements fermés)
      ├── PublicRushProgress[]   (1 ligne = 1 personnage, JSON borné)
      │     guideId, characterSlot,
      │     completedMilestones, completedSteps, bookmarks,
      │     dungeonChecks, currentStep
      ├── PublicProfession[]     (table normalisée, index [metierId, level])
      └── PublicDungeonAchievement[]  (succès de donjon cochés)
```

⚠️ Le schéma **réel** (V1a, l. 910-1008 de `prisma/schema.prisma`) diffère du croquis du 02/11 :
les métiers et les succès sont des **tables dédiées**, pas des JSON — un `Json` ne s'indexe pas, et
l'annuaire filtre par métier.

- **Une ligne JSON par personnage** : la progression d'un visiteur est un **instantané** (lecture/écriture
  atomique, last-write-wins). Les **règles** ne changent pas : `isSequenceBlockedByPrereqs`, cascade,
  verrous de donjons et de palier s'exécutent **avant** l'écriture, côté serveur.
- **Pas** de `profileId` nullable sur les tables existantes : une colonne de propriétaire nullable rend
  un `where` oublié **fail-open**. On refuse ce risque.
- **Pas** de « guilde fantôme » : `GuildConfig.discordGuildId` est requis et unique, et le bot, les crons
  de synchro et les écrans God **itèrent** sur les guildes ⇒ contamination silencieuse.

## 4. RGPD & sécurité (non négociable)

1. **Consentement explicite** à la création (case non pré-cochée) + consentements **séparés** pour la
   visibilité (`showOnDirectory`) et la présence (`showPresence`), tous révocables.
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

> L'**ordre** vit dans `docs/ROADMAP.md` ; ici, le **quoi** et les dépendances.

### V1 — Compte visiteur + progression en base

**V1a / V1b — livrés le 06/11/2026 (#1279)** : 4 tables, chiffrement Metamob étendu, règle du nom
déclaré, `decideSignInAccess`, garde `requirePublicAccount`, interrupteur `PUBLIC_VISITOR_ENTRY`
(fermé par défaut), audit RBAC des actions (10 gardées, 6 noyaux sortis).

**V1c — écran de profil — livré le 06/11/2026**
- Routes `/espace-visiteur/<segment>` (**D-V6**) : `general`, `mules`, `presentation`, `succes`,
  `metiers`, `reglages`, chacun avec `loading.tsx` / `error.tsx`. Chaque **page** appelle
  `requirePublicAccount()` ; `general` est la seule à utiliser `requirePublicSession()` pour
  porter l'écran de **création** (serveur obligatoire). `touchLastSeen()` est appelé par la
  garde de session (**D-V11**), donc par **toutes** les pages.
- **DTO étanche** : `src/lib/public-profile-dto.ts` (`select` explicite, `hasMetamobApiKey`,
  mules et activités normalisées) — `metamobApiKey` ne sort **jamais** vers un composant client.
- **Migration unique** `20270127000000_visitor_profile_v1c` : retrait du logo (**D-V7**),
  `altPseudos Json?` (mules, même forme que `UserProfile.altPseudos`), `PublicProfession.metierId`
  en **texte** (slug `DOFUS_JOBS` ; l'entier n'avait aucun référentiel stable). `metiers Json`
  reste **non écrit** : la source est la table normalisée.
- **10 actions** `src/server/actions/public-profile-actions.ts` : garde, Zod borné, rate limit,
  `where: { userId }`, cible relue (succès, métier), `revalidatePath` par segment ; suppression
  **D-V10** ; export JSON borné ; `/espace-visiteur/` en `disallow` robots.
- **Rétention** : D-V5 passe dans le code (`ORPHAN_ACCOUNT_RETENTION_DAYS = 365`,
  `src/lib/account-retention-policy.ts`) — le cron ne passe plus `90` en dur.
- **Porte d'entrée livrée le 06/11/2026 (D-V13)** : entrée « Mon espace visiteur » dans le menu
  avatar, redirection `/dashboard` et landing → `/espace-visiteur/general` pour un compte sans
  aucune guilde. Une seule règle (`src/lib/visitor-entry.ts`), une seule garde
  (`src/server/visitor-entry.ts`) : interrupteur fermé, échec Discord ou compte banni n'ouvrent
  **rien** (fail-closed, anti-boucle). **Aucune migration.**
- **Coque livrée le 06/11/2026 (D-V14)** : `PublicHeader` + `GalacticFooter` dans le layout,
  bandeau « Espace visiteur » + `VisitorNav` à six assets réels (`party`, `guilde-et-mules`,
  `parchment`, `trophy-1`, `hammer`, `assets/nav/cog.png`). `dashboardHref` reste dans
  l'espace ; la déconnexion vit dans le menu avatar (plus de bouton maison).
- **Assets livrés le 06/11/2026 (D-V15)** : icône du serveur dans le sélecteur (source unique
  `ALL_DOFUS_SERVER_ENTRIES`), icône de classe dans Identité et Mules, activités en vignettes,
  métiers en icônes, lien « Où trouver ma clé API ? » sur Metamob. Chemins vérifiés sur disque.
- **Vérifications livrées le 06/11/2026 (V1h)** : bouton « Vérifier » sur le pseudo (Identité et
  Mules) et sur la clé Metamob ; helper ladder **extrait et partagé** avec le profil interne ;
  toggle God respecté ; les quatre issues (trouvé, introuvable, indisponible, manuel) passent
  par `src/lib/pseudo-verification.ts`.
- **Ops** : `PUBLIC_VISITOR_ENTRY=1` en **bêta** après contrôle à l'écran (390 / 768 / 1 440).

**V1i — Succès — livré le 06/11/2026**
- `LEVEL_PRESETS` de l'interne (`SuccesTracker.tsx`) : **Tous 1-1000 · 1-99 · 100-149 · 150-199 ·
  200+**. **Extraits** dans `src/lib/succes-level-brackets.ts` (source unique, résolution stricte
  côté serveur) et consommés des deux côtés — les tranches ne peuvent plus diverger.
- La page visiteur (`src/app/espace-visiteur/succes/page.tsx`) lit `Dungeon.level`, `slug` et l'icône résolue :
  `getDungeonAchievementIconUrl` en source unique, borne `SUCCES_DUNGEONS_TAKE` partagée avec l'action.
- Action **batch** `togglePublicDungeonAchievementsBracket` **livrée** : Zod borné (`bracketId` + action fermée), 5/min,
  `where` sur le profil public, cibles relues, `createMany skipDuplicates` ; même geste que `toggleLevelBracketAchievements`
  (interne), **sans** `guildId`.
- Onglet : filtre par tranche, bouton « Valider / Décocher la tranche », icône de succès par ligne,
  lien vers la fiche `/boss/<slug>`.
- Verrou : `tests/unit/visitor-succes-brackets.test.ts` (15 cas) — parité, bornes, résolution stricte, action gardée ; aucun nouvel asset.
- **Mise en page alignée sur l'interne (06/11/2026)** : liste (vignette du boss, niveau, progression,
  tranche) + fiche à droite (succès en grille, « Tout cocher / Tout décocher », lien `/boss/<slug>`),
  **sans bouton de groupe** ; **avis de recherche** (96 siphonnés) servis comme fiches — un avis n'a
  aucun succès à cocher ; onglet **Métiers** sur le modèle du profil de guilde (onglets par catégorie,
  cartes, icônes 24 px, pas de « Gérer ») ; états actifs des filtres portés par `warning`.
  Verrous : `visitor-succes-brackets` **21**, `visitor-metiers-ui` **5**, `visitor-assets` **6**.

**V1d — progression en base + adoption**
- `src/server/rush-public-store.ts` (lecture/écriture bornée + Zod) : `savePublicRushProgress`,
  `resetPublicRushProgress`, `adoptLocalRushProgress` (**une seule fois**, idempotente).
- Le `localStorage` reste la source tant que V1d n'est pas livré (D1).

**V1e — synchro ladder**
- Extraire le noyau du worker Ankama (`profile-actions.ts`) en module partagé et le brancher sur
  `PublicProfile` (`dofusLevel`, `totalXp`, `successPoints`, `lastLadderSync`).

### V2 — Visibilité communautaire

**V2a — guide public connecté** (**D-V12**)
- Bandeau de l'interne : **5 tuiles** (Personnage actif, Alignement, Metamob, Rush Live, Ouvrir Overlay).
- Recherche + **Options** **entre** le bloc Rush et le bloc Progression.
- Bloc **Progression Communautaire** : `GuildStatusPanel` extrait en composant partagé, alimenté par les
  profils **consentants** du même serveur ; détail **par bloc** ; donjons requis → qui l'a coché,
  qui l'a « à faire » (`resolveSequenceDungeons` + `PublicRushProgress.dungeonChecks`).
- Non connecté : mode local actuel **inchangé**.

**V2b — Succès Donjons visiteurs** (**D-V9**)
- Vue « qui a quoi » entre visiteurs du même serveur, filtrée **boss + titans + avis** uniquement
  (réemploi de la vue « Succès Commun » interne).

**V2c — Rush Live visiteurs**
- Room par serveur, consentement `showPresence`, fail-soft.

**V2d — Ladder serveur**
- Mêmes écrans que l'interne, métriques du worker (pas les onglets Discord).

**V2e — Liste des profils du serveur**
- Liste **simple** : filtres serveur / classe / métier, pagination keyset — **aucune** statistique
  agrégée (la stat vit dans V2a).

### V3 — God des visiteurs

- Liste, détail, modification, suppression, bannissement (`PlatformBan`), réinitialisation de la visibilité.
- Aucune donnée personnelle dans les logs ; volumes uniquement.

## 6. Ce qu'on supprime (et quand)

1. `src/lib/guest-progress.ts` + `src/lib/rush-dungeon-storage.ts` : **après** V1d (adoption), pas avant —
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
- **`showPresence` existe deux fois** : `UserProfile.showPresence` (présence de guilde) et
  `PublicProfile.showPresence` (D9) — ne jamais confondre les deux au branchement.
- **`touchLastSeen` avant tout** : la purge ne « voit » que `User.lastSeenAt` (D-V11). Un écran visiteur
  qui ne l'écrit pas est un bug de rétention, pas un détail.
- **DTO obligatoire** : le hook `result.publicProfile` déchiffre `metamobApiKey` en lecture ; un profil
  passé brut à un composant client fuit la clé dans le payload RSC.
- **Ne pas dupliquer `GuildStatusPanel`** : l'extraire en composant partagé (deux alimentations), sinon
  la parité guide interne / public se re-casse à la première évolution.
