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
> **Dernière MAJ : 09/11/2026** — V1c livré (écrans, DTO étanche, `touchLastSeen`, migration unique) · **porte d'entrée (D-V13)** · **coque publique (D-V14)** · **succès (V1i)** · **V2f F8→F17a** · **Ocre public ISO** (09/11).

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
| **Visiteur connecté** (panneau Progression Communautaire) | ✅ nom de personnage, blocs terminés, donjons cochés — **si** `showRushProgress = true` | ❌ absent du panneau, même présent dans l'annuaire |
| **Membre** (guide / overlay interne) | ✅ idem | ✅ **ses propres collègues** uniquement (comportement actuel, inchangé) |

Filtre = **même serveur**. Le serveur d'un visiteur vient de `PublicProfile.dofusServerId`, celui d'une
guilde de `GuildConfig.dofusServerId` — même référentiel (`DOFUS_UNITY_SERVERS`,
`src/lib/presentation-constants.ts`).

**Aucune interaction** : on affiche, on copie `/w <pseudo>` au clic, rien d'autre. Pas de messagerie,
pas de demande d'aide, pas de chat.

### 1.3 Implémentation V2e — annuaire privé (06/11/2026)

| # | Décision | Conséquence |
|---|---|---|
| **D-V18** | **Annuaire privé** : `/visiteurs` et `/visiteurs/<id>` exigent une **session valide + un profil public** ; le serveur lu est **celui du profil**, jamais un paramètre d'URL | un compte sans profil obtient l'écran « crée ton profil », pas la liste — conséquence assumée : un membre de guilde sans profil visiteur ne lit pas l'annuaire (D-V3, aucune lecture inter-guilde). `showOnDirectory: true` est dans **chaque** requête ; 404 sur un profil non consentant ou d'un autre serveur |
| **D-V19** | **Champs publics** de la fiche : pseudo, serveur, classe, niveau, points de succès, guilde déclarée, métiers, présentation, objectifs, **nombre** de succès de donjons | jamais les mules (`altPseudos`), jamais Metamob, jamais `userId` : les trois sont **absents du `select`**, donc un champ non lu ne peut pas fuir. Aucun agrégat de progression (D-V8) |
| **D-V20** | `PublicRushProgress.characterSlot` est une **chaîne** — `"PRINCIPAL"` ou le slug du personnage — comme les trois tables `PlayerGuide*` | migration `20270128000000_public_rush_progress_slot_text` (table **vide** : aucune perte). Un index entier se décale dès que la liste des mules change : la progression aurait sauté d'un personnage à l'autre |
| **D-V21** | **Progression Communautaire = consentement distinct** — `PublicProfile.showRushProgress` (défaut `false`) | publier ses blocs, sa quête en cours et ses donjons cochés à tout le serveur n'est ni « figurer dans l'annuaire » (`showOnDirectory`) ni « être vu en ligne » (`showPresence`) : réutiliser l'un des deux publierait des progressions **déjà en base** sans consentement. Le panneau exige `showRushProgress` **seul**, n'affiche qu'un nom de personnage et deux compteurs — jamais `userId` ni `publicProfileId` |

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

**V1d — progression en base + adoption — livré le 06/11/2026**
- `src/lib/public-rush-progress.ts` : Zod **borné** (300 blocs, 500 étapes par bloc, 2 000 donjons,
  emplacement = slug) — au-delà on **refuse**, jamais une troncature silencieuse.
- `src/server/rush-public-store.ts` : `save` (upsert), `adopt` (`createMany skipDuplicates` →
  **idempotent**), `reset` (`deleteMany` ciblé), `load` (existe ?). `publicProfileId` vient de
  `getPublicAccount()`, `guideId` est une **constante serveur**, rate limit sur chaque mutation.
- Guide public : adoption **une fois par emplacement**, miroir **débouncé 2 s**, « Réinitialiser »
  efface aussi la base. **Non connecté : aucun appel réseau**, le `localStorage` reste la source (D1).
- **Migration** `20270128000000_public_rush_progress_slot_text` : `characterSlot` Int → String
  (**D-V20**), table vide par construction.
- Limite assumée : `resources` (5ᵉ clé locale) n'a **pas** de colonne — elle reste locale jusqu'à V2a.
- Verrou `tests/unit/public-rush-progress.test.ts` (15 cas) + parité de schéma (16).

**V1e — synchro ladder — livré le 06/11/2026**
- Noyau **extrait** de `updateUserProfile` vers `src/server/ladder-snapshot.ts` (un seul endroit
  pour les deux appels `succès` + `general`) : bornes dures (niveau 1..300, XP 15 chiffres,
  points entiers ≥ 0), **fail-open** (worker absent/lent ⇒ `{}`, la sauvegarde passe).
- Branché sur `PublicProfile` : enregistrer son identité **ou** vérifier son propre pseudo
  récupère `dofusLevel`, `totalXp`, `successPoints`, `lastLadderSync` (timeout 6 s).
- `classe` n'est **jamais** écrite depuis le ladder : le profil stocke un **id** (`iop`), le
  ladder un **libellé** (« Iop ») — l'écrire casserait le filtre par classe de l'annuaire.
- Verrou `tests/unit/ladder-snapshot.test.ts` (8 cas) · **aucune migration**.

### V2 — Visibilité communautaire

**V2a — guide public connecté** (**D-V12**)

*V2a-1 — bandeau du visiteur — livré le 06/11/2026*
- Bandeau au-dessus du guide : classe + pseudo, serveur (icône + nom), **niveau** et **points de
  succès** (remplis par V1e), lien vers l'espace visiteur. Cinq scalaires
  (`src/lib/public-guide-visitor.ts`), jamais de mule / Metamob / `userId`.
- Page : `getPublicAccount()` **uniquement s'il y a une session** ; anonyme ⇒ aucune requête,
  aucun bandeau, guide inchangé. Les tuiles qui dépendent d'une guilde (Metamob, Rush Live)
  restent hors du public : elles n'ont pas de source côté visiteur.
- Verrou `tests/unit/public-guide-visitor.test.ts` (6 cas).

*V2a-2 — Progression Communautaire — livré le 08/11/2026*
- Consentement **propre** : `PublicProfile.showRushProgress` (**D-V21**), `false` par défaut, colonne indexée
  par migration additive ; règle pure `rush-community-progress`, serveur du lecteur **imposé**, nom de
  personnage seulement.
- Bloc alimenté par les profils **consentants** du même serveur ; détail **par bloc** ; donjons
  requis → qui l'a coché, qui l'a « à faire » (`resolveSequenceDungeons` +
  `PublicRushProgress.dungeonChecks`).
- `GuildStatusPanel` extrait en composant partagé (interne + public), jamais dupliqué.
- **Renommé « Progression Communautaire »** (demande du 06/11) : la version publique ne parle
  jamais de « guilde ».

### V2a — refonte de la surface Rush public (brief du 06/11/2026)

> Retour user (verbatim) : « UI UX encore mauvaise », « la 1ere arrivée doit lui ouvrir une modale
> avec choix classe > alignement > lancer le rush », « tour guidé complet à créer et rejouable via
> un bouton (tour une seule fois) », « reset son rush avec un bouton », « l'image de fond […] est
> flou, renomme en Rush Dofus Sylvestre […] ajoute l'icône du dofus sylvestre à coté », « ma cité
> […] mange de la place bêtement », « je voudrais ceci [vue interne] », « rush live : uniquement les
> visiteurs connectés du même serveur ? », « encourage […] à proposer la création de son profil ».

**Constat mesuré.** Le guide public **connecté** rend aujourd'hui **exactement** la même surface que
l'anonyme (seul un bandeau d'identité a été ajouté en V2a-1). La vue cible est celle de l'**interne**.
Deux causes mesurées pour l'en-tête : ① `.da-guide-hero-art` n'a **aucun `filter: blur`** — le flou
vient de l'**agrandissement** d'une source basse résolution (`object-fit: cover`) ; ② un système de
tour existe déjà (`src/components/tour/tour-provider.tsx`, `ModuleTourReplayButton`) — on le
**réutilise**, on n'en crée pas un second.

**V2a-3 — surface connectée alignée sur l'interne** *— livré le 07/11/2026*
- Bloc du haut : Personnage actif · Alignement · Metamob · Rush Live · Ouvrir Overlay.
  **Fait** : les cinq tuiles, dans cet ordre ; le bandeau d'identité de V2a-1 est **fusionné**
  dans la tuile « Personnage actif » (une seule tuile, comme l'interne).
- **Rush Live = visiteurs connectés du même serveur uniquement**, consentement `showPresence`
  (D-V4/D9), « présence indisponible » si la source manque. La room par serveur est **V2c** ;
  V2a-3 affiche la tuile avec l'état réel, jamais un compteur inventé. **Fait** : tuile non
  interactive, texte « présence indisponible ».
- **Alignement** : `PublicProfile.alignment` existe en base mais **aucune action ne l'écrit**
  (mesuré) → bouton « renseigner » dans la modale de première arrivée (V2a-4), pas une tuile
  vide. **Fait** : la tuile existante (alignement **déduit des quêtes validées**) est conservée
  telle quelle ; aucune tuile nouvelle ne lit `PublicProfile.alignment`.
- **Metamob** : pseudo + « vérifié » (données déjà présentes côté visiteur) ; jamais la clé.
  **Fait** : `metamobPseudo` + `metamobVerified` ajoutés au DTO (`public-guide-visitor.ts`) et
  à la règle pure `metamobState` (3 états) — **zéro requête neuve**, aucun accès `@/server/`.
- Bloc **« Rechercher une quête » + Options** entre le haut et la progression (anatomie interne).
  **Fait** : le champ a quitté la colonne du détail ; « Options » porte la densité
  (« Masquer les étapes faites »), V2a-4 y branchera « Revoir le tour ».
- Le guide lui-même (blocs, coches, donjons, ressources) reste **le même composant partagé** :
  la parité est verrouillée par `rush-public-parity`, aucun composant dupliqué.
- Verrous : `rush-public-parity` **42** (ordre des 5 tuiles, Rush Live honnête, recherche+Options
  entre tuiles et progression) · `public-guide-visitor` **10** (7 scalaires, liste blanche des
  identifiants `metamob*`, clé non recopiable, `metamobState` ×3).

**V2a-4 — première arrivée (non connecté et connecté)** *— livré partiellement : 07/11 (alignement, mules) puis 08/11 (accueil en 3 étapes)*
- **Alignement réglable — fait**, pour **tout le monde**. Connecté : action `updatePublicAlignment`
  (`src/server/actions/public-profile-actions.ts` + schéma `publicAlignmentSchema`), appelée par
  l'action colocalisée `_actions/public-alignment.ts` (le client public n'importe toujours aucun
  `@/server/`) ; modale `PublicAlignmentModal` (cité → Ordre), l'Ordre étant **vérifié contre la
  cité** côté serveur. Anonyme : **même modale, mode local** (`localOnly`) — aucune écriture serveur,
  la cité pilote la route (`resolveRushRoute`) et l'Ordre est conservé dans le navigateur.
  `PublicProfile.alignmentOrder` entre dans le DTO (`PublicProfileView` + `select`). La tranche reste
  déduite des quêtes validées.
- **Mules déclarées — fait.** `altPseudos` entre dans `PublicGuideVisitor` (`mules: {pseudo, classe}[]`,
  déjà publique dans l'annuaire) et `GuestCharacterModal` les propose en un clic ; la progression en base
  étant clé par `characterSlot`, une mule est un emplacement comme un autre.
- **Accueil de première arrivée — fait le 08/11/2026** : 3 étapes qui délèguent aux sélecteurs existants
  (drapeau local, rejouable via Options). **Reste** : le **tour guidé spotlight** (le `TourProvider`
  n'est monté que dans le dashboard — lot séparé).
- Tour **rejouable** par un bouton « Revoir le tour », et **une seule fois** en automatique
  (drapeau local par visiteur). Réutilise `ModuleTourReplayButton` + `tour-provider`.
- « Ma cité » (Bontarien / Neutre / Brâkmarien, `PublicRouteChoice`) quitte la barre : elle vit
  dans la modale et reste un **chip compact** ensuite (elle « mange de la place » aujourd'hui).

**V2a-5 — en-tête du guide** *— livré partiellement le 07/11/2026*
- Titre **« Aventure Rush Sylvestre »** + **icône du Dofus Sylvestre** à côté
  (`/module-dofus/Dofus_Sylvestre.png`). **Fait.**
- Image de fond **nette** : le flou n'était pas un `filter` mais l'agrandissement d'une source
  basse résolution en `cover`. **Fait** : l'image de fond est **supprimée**, le bandeau garde le
  dégradé peint de la DA ; le Dofus est posé à côté du titre. Prop `heroArt` retirée.
- **Corrections demandées le 07/11** (retour user sur V2a-3) — **faites** :
  « Ma cité » (les trois cités) **quitte la barre** → sous-menu radio de « Options » (le choix
  pilote toujours `resolveRushRoute`) ; le conseil « Conseillé dès le Niv. 200 » **n'est plus
  affiché** (public **et** interne) ; « Mon espace visiteur » monte dans le **bandeau du titre** ;
  le **pseudo est le déclencheur** du changement de personnage (bouton « Changer de personnage »
  supprimé) ; **Metamob est cliquable** → espace visiteur (le formulaire et les actions y sont
  déjà : aucun import `@/server/` dans le client) ; **le guide anonyme n'affiche ni Metamob ni
  Rush Live**.
- Bouton **« Réinitialiser »** : **mesuré le 08/11** — il est déjà dans la barre, rien à coder.
- **Reste aussi** : l'**alignement** cliquable comme l'interne. Mesuré : `PublicProfile.alignment`
  existe mais **aucune action ne l'écrit** et l'interne passe par `resetRushAlignment(guildId, …)`
  (pas de `guildId` côté visiteur) → il faut une action `updatePublicAlignment` (V2a-4), pas une
  tuile cliquable qui ouvrirait une modale vide.
- **Reste** : jouer le rush sur une **mule déclarée** (`PublicProfile.altPseudos`, déjà publique).
  Mesuré : la progression en base est clé par `characterSlot` (texte), donc **c'est possible** ;
  il manque seulement la liste des mules dans le sélecteur (V2a-4).

**V2a-6 — invitation au profil (anonyme) — livré le 08/11/2026**
- Le guide non connecté **encourage** à créer son profil visiteur (progression sauvegardée,
  qui a coché quoi, présence) — sans bloquer la lecture : CTA discret, jamais une modale forcée.
  **Fait** : CTA anonyme « Créer mon profil visiteur ».

**V2b — Succès Donjons visiteurs** (**D-V9**)
- Vue « qui a quoi » entre visiteurs du même serveur, filtrée **boss + titans + avis** uniquement
  (réemploi de la vue « Succès Commun » interne).

**V2c — Rush Live visiteurs**
- Room par serveur, consentement `showPresence`, fail-soft.

**V2d — Ladder serveur**
- Mêmes écrans que l'interne, métriques du worker (pas les onglets Discord).

**V2e — Liste des profils du serveur — livré le 06/11/2026**
- `/visiteurs` (liste) et `/visiteurs/<id>` (fiche), **connectés seulement**, `noindex` : filtres
  classe / métier, recherche bornée (40 car.), pagination par curseur stable (`id` décroissant).
- Règles pures `src/lib/public-directory.ts` (bornes, `where`, DTO **sans** mule / Metamob / `userId`) ;
  requêtes `src/server/public-directory.ts` (`showOnDirectory` + `dofusServerId` du lecteur, **aucun
  `guildId`**). La barre publique regroupe **Guides + Guildes + Visiteurs** sous « Explorer », chaque
  entrée portant un asset Dofus réel (menu `details` natif : les liens restent dans le HTML servi).
- Verrou `tests/unit/visitor-directory.test.ts` (18 cas) : filtres bornés et jamais bloquants, périmètre
  imposé par la requête, liste blanche du DTO, pages gardées + 404 hors périmètre.
- **Aucune statistique agrégée** (D-V8) et **aucune migration**.

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

**V2f — finitions demandées le 08/11/2026** *(livré en deux lots le 08/11 : F8→F11, puis F12→F15 + F17a ; reste F1→F7, F16, F17b)*

> **Décisions tranchées le 08/11/2026** : ① **F2** = export **et** import d un fichier JSON, dans l interface anonyme ; aucun secret dedans. ② **F13/F15** = vérification du pseudo **bloquante avant** création (espace et mule), repli manuel seulement si le God l active. ③ **Pas de Metamob anonyme** : la clé API est un secret, elle reste chiffrée en base derrière un compte ; le CTA (F5) dit ce que l anonyme perd.

> **Décisions complétées le 08/11/2026 (retours en cours de session)** :
> ④ **F11** — la modale de retour s ouvre pour **tout le monde** (plus de toast qui affichait l URL brute). Un visiteur **non connecté** n y voit que l encart **Discord Sigilos** — lien cliquable + « ouvre un post dans le canal associé » pour les captures — et un seul bouton Fermer. Un **compte connecté** garde le formulaire complet (catégories, position, description). Comme `isGuest` est codé en dur à `true` par le guide public, la session lui est transmise **séparément** (`feedbackSignedIn`), et le panneau reçoit `onlyDiscord = isGuest && !feedbackSignedIn`. Le panneau est monté **hors** de `.da-hero` (il y était rogné, et ses enfants sont plafonnés à `z-index: 2` sous le dock `sticky` à 30).
> ⑤ **Destination d un retour** — `submitQuestFeedbackAction` écrit un `SystemIssue`, notifie le God (`USER_FEEDBACK`) et pousse un embed Discord (`questFeedbackChannelId`, repli `godNotifyChannelId`). Le **tri côté God** (un seul endroit `?tab=tickets`, refonte UI/UX, module `ticket-bot` à revoir) est consigné dans `docs/plans/PLAN-TICKETS-GOD.md`.

**V2f — ce qui est livré (mesuré, 08/11/2026)**

- **F8** — frise et palier « Graine » retirés (le `h1` reste en `sr-only`), `.da-stage`/`.da-pips` et
  `rush-dofus-stage.ts` **supprimés** (plus aucun consommateur).
- **F9** — bandeau de rappel sous Tous/En cours/Faites/Verrouillées retiré (`.da-banner*`), la
  **description** du bloc conservée.
- **F10** — clignotement du mode clair : thème lu dans un *layout effect* isomorphe, donc **avant peinture**.
- **F11** — panneau de retour monté **hors** de `.da-hero` (il y était rogné) : non connecté = **Discord seul**,
  compte connecté = formulaire complet (`onlyDiscord = isGuest && !feedbackSignedIn`).
- **F12** — menu compte sur des assets du jeu : `modules/guild.png`, `game-icons/house.png`,
  `modules/character.png` (`UserRound` supprimé).
- **F13 / F15** — pseudo vérifié au **ladder avant** création (seul `false` bloque, `null` reste fail-open) ;
  les mules **nouvelles** seulement, sur le serveur du profil.
- **F14** — clé Metamob validée par `/v1/me` **avant** écriture, fail-closed ; le pseudo renvoyé fait foi.
- **F17a** — les quatre panneaux de métiers occupent une seule cellule (`forceMount` + `visibility: hidden`).

**V2f — ce qui reste**

- **F1→F7** : bandeau Dofus anonyme, export **et** import d'un fichier JSON (aucun secret dedans),
  espacement/aération, prérequis repliables, CTA « ce que tu perds » (pas de Metamob anonyme : la clé est
  un secret qui reste chiffré en base derrière un compte), grain.
- **F16** : « mes succès sur ce boss » par donjon + vue « succès en commun » sur `/visiteurs`.
- **F17b** : « qui a ce métier à ce niveau » (`?niveau=`) — l'annuaire filtre déjà par `metier` et
  `PublicProfession` porte déjà `@@index([metierId, level])`.

**Ocre public ISO — livré le 09/11/2026 (PR #1315)**

- `OcreQuestPanel` devient la **source unique** : liste, recherche, onglets, stepper ±1 et retour
  d'écriture ; la modale publique « Marquer » **disparaît**.
- Peau **DA** sur la modale publique (`daScopeProps(useDaTheme())` — le guide monte déjà `DaThemeProvider`) ;
  **clé Metamob repliée** derrière « Modifier » quand le compte est vérifié ; accusé « Enregistré sur Metamob ».
- Options **Gardiens / Archis** + ligne **zone · subzone** (`/v1/quests/{slug}/zones`, **même** clé de cache
  Redis que l'interne) ; lecture bornée **200 → 400** (la quête compte 337 cibles).
- Écriture publique par `useOcreWriteQueue` à **envoi injecté** (`patchPublicOcreMonster`) : même file de
  sérialisation, aucun chemin dupliqué. Règle pure `classifyOcreType`. Verrou `rush-overlay-ocre` **41**.

**Hero de l'overlay — livré le 09/11/2026 (PR #1316)**

- Sous **700 px de haut**, la densité `wide` est plafonnée à la hauteur de `normal` (**112 px**) : la bande
  vide de **276 px** disparaît, la liste remonte d'environ **170 px**. CSS seul, grand écran intact,
  aucun contenu, bouton ni libellé déplacé. Verrou `da-wakfu` **+2** (le plafond **et** la règle
  `276px / 30vh` restent tenus).

> **Livré le 08/11/2026 (suite de session)** — **F12** le menu compte reprend l'asset de la barre
> (`modules/guild.png`, `game-icons/house.png`, `modules/character.png` : deux `LayoutDashboard`
> identiques et un `UserRound` disparaissent) ; **F13** `createPublicProfile` interroge le ladder
> **avant** d'écrire (seul `false` bloque, `null` reste fail-open, toggle God honoré) ; **F14**
> `updatePublicMetamob` prouve la clé par `/v1/me` **avant** écriture — une clé refusée ne remplace
> plus une clé qui marchait (fail-closed, l'ancienne est conservée) ; **F15** seules les mules
> **nouvelles** passent au ladder, sur le serveur du profil ; **F17 (1/2)** l'onglet Métiers ne fait
> plus bouger l'écran (les quatre panneaux occupent une seule cellule : Élevage = **1** métier contre
> 6 et 7 ailleurs).
> **Reste** : **F16** (« mes succès sur ce boss » par donjon + vue « succès en commun » sur
> `/visiteurs`) · **F17 (2/2)** « qui a ce métier à ce niveau » — l'annuaire filtre **déjà** par
> `metier` (`buildVisitorDirectoryWhere`), il manque `?niveau=` ;
> `PublicProfession` porte déjà `@@index([metierId, level])`, la donnée est prête.

*Guide public — anonyme*
- **F1** Avancement **par Dofus** pour l anonyme, alimenté par la progression **locale** (mêmes clés d étapes), sans serveur.
- **F2** Import/export du profil local : tout vit dans `localStorage` ; un nettoyage de cookies perd progression, cité et alignement. Proposer un **fichier** JSON (export/import), jamais une synchro serveur implicite.
- **F3** Espacement des tuiles (Personnage / Alignement / Overlay trop serrées) et **Metamob remis dans l alignement** des tuiles.
- **F4** Aérer la rangée « Rechercher une quête + Options ».
- **F5** Dire à l anonyme ce qu il **perd** (communautaire, sauvegarde multi-appareils) près du CTA.
- **F6** Prérequis nombreux : 12 chips illisibles → liste repliable.

*Guide public — rendu*
- **F7** Aspect « granuleux » du guide navigateur alors que l overlay est net (grain / filtre de la DA à vérifier).

*Overlay*
- **F8** Retirer « Rush Sylvestre » et « Graine » du bandeau (redondants).
- **F9** Supprimer le bandeau de rappel sous Toutes / En cours / Faites / Verrouillées.
- **F10** Mode clair : clignotement avant stabilisation.
- **F11** Modale « Signaler un bug » : passe **sous** le contenu (z-index) + ajouter le lien du Discord support.

*Espace visiteur connecté*
- **F12** Menu : assets Dofus pour « Mes guildes », « Tableau de bord », « Mon espace visiteur ».
- **F13** Création de profil : vérification du pseudo **bloquante avant** la création (mécanique de l interne), repli manuel si le God l autorise.
- **F14** Metamob : refuser l enregistrement d une clé invalide (`/v1/me` avant écriture) ; la clé ne doit plus disparaître sans retour.
- **F15** Mules : vérification du pseudo **bloquante** à l ajout.
- **F16** Succès : bouton « mes succès sur ce boss » dans chaque donjon (guide navigateur, jamais l overlay) ; vue « succès en commun / qui peut faire quoi » sur `/visiteurs` (+ asset) ; même mécanique côté guide interne.
- **F17** Métiers : l onglet Élevage fait bouger l écran ; lier métier ↔ quête (« qui a ce métier à ce niveau »).
