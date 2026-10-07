---
description: Démo publique — une guilde de démonstration en lecture seule, essayable sans compte depuis la landing ; source de démo statique + vues de démo dédiées quand le composant réel fetche lui-même
---

# 🎮 Démo publique — rendre SigilOS essayable sans compte

> **Chantier `S`** de la file d'exécution (`docs/plans/FILE-EXECUTION.md`).
> Plan durable : BESOIN → ÉTAT MESURÉ → DÉCISIONS → LOTS → GARDES → ACCEPTATION → VIGILANCE.
> **Toutes les mesures de ce fichier sont horodatées et reproductibles** (lecture seule) : rien n'est supposé.
> ⚠️ Aucune donnée personnelle, aucune capture d'écran, aucun serveur Discord : le dépôt est **public** (`AGENTS.md` §1 et §5.11).

---

## 1. Besoin

Un prospect (chef de guilde, officier) **ne peut pas juger SigilOS** : la landing *raconte* le produit
(mockups vectoriels) mais ne le *montre* jamais. Aucun site Dofus concurrent ne propose non plus
d'essayer. L'objectif : **une guilde de démonstration en lecture seule, essayable sans compte**, reliée
depuis la landing — et **honnête** (libellée « Démonstration », impossible à confondre avec une guilde réelle).

**Ce que la démo n'est pas** : un serveur Discord (interdit : un vrai serveur + un token, et un ID Discord
publié violerait la règle « zéro empreinte »), ni un faux film reconstitué (une caméra simulée sur des
écrans inventés se fait démonter par un joueur en deux secondes).

---

## 2. État mesuré (lecture seule)

### 2.1 Le canal « public, lecture seule, sans donnée sensible » existe déjà

| Élément | Emplacement mesuré | Portée |
|---|---|---|
| Opt-in public par guilde | `prisma/schema.prisma:353` — `presentationEnabled Boolean @default(false)` | le propriétaire décide |
| Annuaire public | `getPublicGuilds()` (`src/server/actions/presentation-actions.ts:189`) — filtre `isActive` + `presentationEnabled` | alimente `/guilds` |
| Fiche publique en lecture seule | `src/app/guilds/[guildId]/_components/guild-public-view.tsx` (17 Ko) : État-Major, Manifeste, Galerie, Recrutement | **la présentation**, pas la *vie* de guilde |
| Bascule privée + désindexation | `src/app/guilds/[guildId]/page.tsx:73-79` → `PrivateGuildView` + `robots: { index: false }` | le patron « hors index » existe |
| Agrégats sans donnée sensible | `presentation-actions.ts:68` — « Aucune donnée sensible : stats globales de guilde uniquement » | promesse déjà tenue par le code |
| Précédent de route de démo publique | `src/app/demo/boss-sim/page.tsx` | une démo publique est déjà assumée |
| Visite guidée **in-app** | `src/components/tour/tour-provider.tsx` (**78,8 Ko**, 19 phases, 26 pages du dashboard) | **à réutiliser comme vocabulaire, jamais à dupliquer** |

### 2.2 Mesure S-0 — le couplage des composants visés (fait le 02/10/2026)

Question posée : *le composant de rendu accepte-t-il ses données en props, ou fetche-t-il lui-même ?*

| Écran | Composant réel | Données en props ? | Verdict mesuré |
|---|---|---|---|
| Annuaire | `src/components/directory/member-directory.tsx:19-25` | ✅ `{ initialMembers, legendaryItems, guildId }` — **0 import de `@/server/actions`** | **réutilisable tel quel** |
| Fiche membre | `src/components/directory/member-card.tsx` (rendu par l'annuaire) | ✅ `{ profile, guildId }` — 0 import d'action | **réutilisable** (⚠️ voir 2.4) |
| Songes | `src/components/songes/RunCardGrid.tsx:17-23` | ✅ `{ runs: initialRuns, currentUserId, canJoinSonges, … }` (typé Prisma `DreamRun & { members, waitlist, _count }`) | **réutilisable** — mais son enfant `RunCard` **importe** `@/server/actions/songes/dream-run-actions` (`RunCard.tsx:46`) ⇒ `canJoinSonges={false}` (mesuré : `canApply = canApplyConditions && canJoinSonges`, `RunCard.tsx:121`) |
| Sorties | `src/components/calendar/calendar-dashboard.tsx:62-85` | ❌ `{ guildId, currentUserId, canManage, … }` — fetche avec `guildId` | **vue de démo dédiée** |
| Succès | `src/components/succes/SuccesTracker.tsx:68-94` | ❌ `{ guildId, canEdit }` + **6 actions importées** (`toggleAchievementCompleted`, `getDungeonsWithAchievements`, `findMissingAchievements`…) | **vue de démo dédiée** |

⇒ **D4 est tranchée par la mesure**, écran par écran — pas par une opinion.

### 2.3 Champs réellement lus par `MemberCard` (mesuré)

`alignment`, `alignmentLevel`, `alignmentOrder`, `altPseudos`, `classe`, `discordNickname`, `displayName`,
`id`, `isAdmin`, `lastActivityAt`, `legendaryCrafts`, `metiers`, `pseudoDofus`, `roleColor`,
`user.image`, `vacationEnd`, `vacationStart`.

Formes attendues (mesurées) : `classe` = id de `DOFUS_CLASSES` (`"cra"`, `"panda"`…) ;
`metiers` = `string[]` ou `{ name|id, level }[]` (`src/lib/metiers.ts:11-35`) ;
`alignment` ∈ `ALIGNMENTS` (`neutre` / `bontarien` / `brakmarien`) ; `alignmentOrder` = id d'`ORDERS` ;
`altPseudos` = mules `{ pseudo, classe, alignment, alignmentOrder, level }` — **affichées seulement si
`alignment !== "neutre"` ET `alignmentOrder` présent** (`member-card.tsx:59-61`) ;
`legendaryCrafts` non vide ⇒ picto « Artisan Légendaire ».
**`getDisplayName` interdit `user.name` pour un autre membre** (`src/lib/display-name.ts`) ⇒ la source de
démo porte `discordNickname` + `pseudoDofus` et `user: { image: null }`, **jamais** un nom de compte.

### 2.4 Défaut mesuré à corriger (S-1)

`member-card.tsx:104` lie chaque carte vers `/dashboard/${guildId}/members/${pseudo}` ⇒ sur une page
**publique**, ce lien mène à un mur d'authentification. Correctif : prop **rétrocompatible** `readOnly`
(défaut `false`) sur `MemberDirectory` → `MemberCard`, qui rend la carte **sans** `<Link>` en mode démo.
Les usages existants (dashboard, admin) ne changent pas d'un octet.

### 2.5 Mesure de perf qui justifie le « statique » (build de prod du 02/10, `BUILD_ID` `gt1bl_DAoeQvc9ji6tolp`)

- **Aucune page n'est prérendue** : `prerender-manifest.routes` = 4 routes techniques seulement
  (`/_global-error`, `/llms.txt`, `/manifest.webmanifest`, `/robots.txt`) ; pas de `page.html`/`page.rsc`
  pour `/` ⇒ `export const revalidate = 3600` (`src/app/page.tsx:17`) est **inerte**.
  Cause racine : `src/app/layout.tsx:130-146` (`auth()` + `db.platformConfig.findFirst()` + `headers()` + `cookies()`).
- Graphe client de `/` : **24 chunks, 1 639 653 o brut → 364 Ko gzip**, dont un **CSS global unique de
  76,8 Ko gzip** (692 Ko brut) et **43,9 Ko gzip de dictionnaires FR + EN** dans un même chunk
  (`1knvfohwsa36h.js` porte `« Le tableau de bord de ta guilde Dofus »` **et** `« Your Dofus guild dashboard »`).
- `framer-motion` est dans le graphe de `/` : chaîne `public-header.tsx:36` → `dashboard-drawer.tsx:27`
  → `framer-motion`, alors que ce tiroir n'est monté que pour un **membre connecté** (`public-header.tsx:365`).

⇒ Une démo **rendue depuis une source statique** peut être **prérendue** : c'est la seule page du site qui
peut être rapide dès aujourd'hui, et c'est celle qu'on met devant un prospect.

---

## 3. Décisions (tranchées le 02/10/2026 — elles ne sont plus ouvertes)

| # | Décision | Motif mesuré |
|---|---|---|
| **D1** | **Source de démonstration statique et typée** dans `src/lib/demo/**`, **pas** de guilde en base | Zéro migration · **risque cron/worker nul** (une guilde absente de `GuildConfig` ne peut être ni synchronisée par `sync-members`, ni notifiée, ni purgée par `account-retention`/`guild-orphan-watch`) · zéro RGPD · données relues en PR · page prérendable |
| **D2** | `/demo` en **`noindex` au rodage** | Leçon almanax : une page faible devient « Explorée, actuellement non indexée » (`soft 404`). On ouvre l'indexation quand la page porte du contenu unique |
| **D3** | **Interactions locales non persistées** | Une instance partagée ne peut pas être écrivable : n'importe qui détruirait la démo. Une base de démo jetable est un chantier d'infra disproportionné ⇒ **écarté** |
| **D4** | **Réutilisation des composants réels quand ils sont prop-driven** ; **vue de démo dédiée** sinon | Mesure S-0 (§2.2) |
| **D5** | CTA **secondaire** « Essayer la démo » depuis `/` | Le CTA primaire reste « Configurer ma guilde » (conversion) |

**Contrepartie assumée de D1** : la démo ne prouve pas la couche base de données. Seul le **fetch**
diffère ; le **rendu** reste celui du produit. C'est écrit ici pour ne pas le découvrir plus tard.

---

## 4. Lots (1 lot = 1 branche = 1 PR → `dev`)

| Lot | Contenu | Statut |
|---|---|---|
| **S-0** | Mesure du couplage des composants visés (§2.2) | ✅ **fait le 02/10/2026** (lecture seule, 0 PR) |
| **S-1** | `src/lib/demo/**` (source typée) + route `/demo` + bandeau « Démonstration » + annuaire réel (`MemberDirectory`, mode `readOnly`) + `PUBLIC_PREFIXES` + `noindex` + gardes de test | ✅ **livré le 02/10/2026** (**PR #830**) |
| **S-2a** | Songes réels (`RunCardGrid`) en `canJoinSonges={false}` — après vérification qu'aucun bouton d'action n'est atteignable | à faire |
| **S-2b** | Sorties et succès en **vues de démo dédiées** (données de la source de démo, markup réel) | à faire |
| **S-3** | Interactions locales non persistées (inscription à une sortie, filtrage, scène Discord) | à faire |
| **S-4** | La landing autour : CTA « Essayer la démo » (FR+EN), hero sur l'écran réel, fuites produit (`tools.tsx:72` FR en dur ; `proof.tsx:76-88` état unique masqué) | à faire |
| **S-5** | Perf mesurée, activée par l'audit : pages publiques prérendables, **une seule** langue au client, `framer-motion` hors du graphe public | à faire |

> **Reprise de session** : `docs/plans/AMORCE-DEMO-PUBLIQUE.md` — état mesuré, ordre des lots, méthode et DoD, **bloc à coller** en tête de la nouvelle session.

---

## 5. Gardes et tests (à demeure, écrits avec le lot)

1. `tests/unit/demo-publique.test.ts` — **source** : identifiants uniques, compteurs bornés, aucun
   motif d'e-mail, aucun identifiant de 17-20 chiffres (snowflake Discord), aucune invitation Discord,
   chaque membre porte `discordNickname` **et** `pseudoDofus`, `user.image` jamais défini ;
   **étanchéité** : aucun `@/server/actions` ni `"use server"` dans `src/app/demo/**` et `src/lib/demo/**` ;
   **honnêteté** : la page de démo porte `robots: { index: false }` et affiche le libellé de démonstration.
2. `tests/unit/public-routes.test.ts` — `/demo` et `/demo/<segment>` reconnus publics ; `/demoniaque` **ne
   l'est pas** (piège de préfixe, comme `/guide` vs `/guides`).
3. Non-régression des composants touchés : `MemberDirectory`/`MemberCard` inchangés **sans** la prop
   `readOnly` (le mode par défaut doit rester identique au pixel).
4. i18n : **toute** chaîne neuve existe en `fr.ts` **et** `en.ts` (`demoPage.*`) — le type `Translations`
   est dérivé de `fr` (`fr.ts:1206`), donc l'oubli casse `tsc`.
5. Aucune image ajoutée ; si une l'est un jour : `node scripts/check-media-metadata.mjs`.

---

## 6. Acceptation

- [ ] `/demo` s'ouvre en **anonyme**, affiche la guilde de démonstration et le **bandeau « Démonstration »**.
- [ ] `git grep -n "server/actions" -- src/app/demo/page.tsx src/lib/demo` ⇒ **vide** (`src/app/demo/boss-sim/` est une démo pré-existante, hors périmètre S-1 : elle lit Dofensive en lecture).
- [ ] `npx tsc --noEmit` **0** · `npm run lint` **0 erreur** · `npm run test:run` ✓.
- [ ] Aucun lien vers `/dashboard/**` depuis `/demo` (mode `readOnly`) ⇒ zéro mur de connexion.
- [ ] `git status --short` propre (aucun artefact de session).

---

## 7. Vigilance (pièges écrits pour ne pas les rejouer)

1. **Ne pas dupliquer la visite guidée in-app** (`src/components/tour/`, 19 phases) : la démo s'inspire de
   son vocabulaire, elle ne réimplémente ni overlay ni étapes.
2. **Ne pas créer un second annuaire ni un second calendrier** : `member-directory.tsx` (44 Ko),
   `calendar/*` (jusqu'à 103 Ko pour `event-detail-modal.tsx`), `succes/SuccesTracker.tsx` (44 Ko) existent.
3. **Aucune écriture atteignable** depuis `/demo` (D3) — c'est la garde la plus importante du chantier.
4. **Zéro capture d'écran** et **zéro chemin machine** : dépôt public ; les visuels restent les mockups
   vectoriels ou des vues rendues par le code.
5. **Zéro CSS global ajouté** : le CSS global pèse déjà 76,8 Ko gzip ; la démo vit dans la couche
   `.registre` existante (`src/app/globals.css:247-535`), rayons 3/4/6, pas de gradient ni de glow.
6. **Ne pas toucher à `services/`** (bot Discord) : la démo n'a aucune dépendance Discord.
7. Ne **jamais** transformer la source de démo en « données réelles anonymisées » : ce serait une fuite
   différée. Les données sont **écrites à la main**, fictives, relues en PR.

---

## 8. Hors périmètre (explicite)

Vidéo d'écran réelle (dépend d'un enregistrement humain + hébergement hors dépôt) · démo **écrivable** ·
guilde de démonstration en base · animation au scroll (GSAP/Lenis : aucune dépendance ajoutée tant qu'une
mesure ne la justifie pas) · refonte visuelle de la landing (S-4 la traite, le reste vit au chantier **L**).
