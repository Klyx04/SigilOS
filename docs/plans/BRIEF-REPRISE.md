---
description: Brief de reprise — le fil complet des chantiers (demandes user, livré, restes, décisions, pièges) + les chantiers prêts (Y, Z), à donner en un seul prompt
---

# 🧵 Brief de reprise — tout le fil en une passe

> **Rôle.** Ce fichier **rassemble le fil** : ce qui a été demandé (verbatim), ce qui est livré, ce qui
> reste, ce qui doit être tranché, et les pièges déjà payés. Il est écrit pour être **donné tel quel** en
> début de prompt : un agent doit pouvoir reprendre **en une seule passe** sans relire dix documents.
>
> **Ce qu'il ne fait pas.** Il ne porte **pas l'ordre global** (c'est `docs/plans/FILE-EXECUTION.md`, seule
> source de l'ordre) et il **ne remplace aucune source de vérité** : les conventions restent `AGENTS.md` +
> `docs/RULES.md`, l'état technique `docs/CONTEXT.md`, l'historique de session `docs/agents/activeContext.md`.
> Une chose n'est jamais écrite deux fois : ici, on **synthétise** ce qui est dispersé, et on **pointe** le reste.
>
> **Il remplace** le mémo volatile `src/temp/CHANTIERS-RESTANTS.md` (gitignoré, supprimé le 14/10/2026) :
> ce qui survivait seulement dans un fichier non versionné vit désormais ici, dans `docs/`.
>
> **Mise à jour** : 14/10/2026 (nuit) · `dev` = `b3d132e4` (+ **chantier Y, lot Y-1** sur `feat/roles-anciennete-y1`) · journal au §9.

---

## 0. Comment s'en servir (un seul prompt)

1. **Prendre ce fichier** + `AGENTS.md` (racine, lu automatiquement) + `docs/RULES.md` § Security. Rien d'autre.
2. Choisir **une** case non cochée du **§5** (reste petit, livrable seul) ou ouvrir un chantier du **§3/§4** (§ Y, § Z).
3. Appliquer la règle d'or : **1 lot = 1 branche = 1 PR → `dev`** ; la branche naît de `dev`
   (`git fetch origin dev && git merge origin/dev`), on merge avant d'ouvrir le suivant.
4. Avant de rendre : `npm run test:run` · `npx tsc --noEmit` · `npm run lint` · `git status --short` **propre**
   (aucun artefact de la tâche — `AGENTS.md` §4).

**Les 4 arrêts obligatoires** (on demande avant de faire) : migration de schéma · interface **publique**
Discord · action **God** · suppression de données. Et si une mesure contredit le brief : on mesure d'abord,
on ne « corrige » pas une supposition.

---

## 1. Le fil des demandes (verbatim → état)

| Demande user (verbatim) | Traitement | État |
|---|---|---|
| « il y a une doc normalement pour refaire …/admin/members et tout, sincèrement proprement » | `docs/ROADMAP.md` § B : voie ① table `MemberRegistryEntry`, lots **B-1** (une liste + une modale + déslop), **B-2** (hors dashboard éditables, la migration), **B-3** (permission `staff:member_delete`) | ✅ `cf33e10e` |
| « Vérifie côté rbac staff gestion membres etc on m'a dit qu'il y avait des pb même avec les droits » | bug mesuré : `updateMemberPseudo` / `updateMemberAnkamaId` exigeaient l'admin **natif** alors que l'écran s'ouvre dès `canManageMembers` → patron maison partout | ✅ `23eaded9` |
| « dans le drop down des rôles filtré des résultats de sondages ne doivent apparaître que les rôles autorisés à voter » | règle pure `roleCanVote` (`community:access`), mapping lu côté serveur, RBAC vide ⇒ aucune restriction inventée | ✅ `23eaded9` |
| « la version « propre » du RBAC staff : ouvrir l'onglet Sondages de Paramètres au rôle staff, garde par onglet » | `staffOnlySondages`, nav filtrée au seul onglet, encart de réglages retiré de la page du module | ✅ `23eaded9` |
| « je vois tjrrs pas le reglement il est ou pour un user qui veut le consulter » | il était rendu **sous le manifeste** de l'onglet Présentation → **onglet dédié** `?tab=reglement` | ✅ `d43aeb66` |
| « le bouton enregistrer derniere tape reglement doit quitter et revenir sur la vue rendu user » | règle pure `hubTabAfterSave` → retour à la vue des membres, sur l'onglet Règlement si le règlement a bougé | ✅ `d43aeb66` |
| « je prefere le reglement dans un onglet dédié dans la presentation de la guilde ca evitera un scroll à ralong coté uix » | — (même lot) | ✅ `d43aeb66` |
| fiche membre : voir l'activité Discord du membre | onglet **Activité Discord** + action `getMemberDiscordPresence` (hors dashboard = `tracked: false`, jamais un zéro qui accuse) | ✅ `cb166cb9` |
| « n'affiche et ne filtre que sur les roles autorisés dashboard plus logique sans casser la vue des hors dashboard » | règle pure `roleHasDashboardAccess` (`rolesMapping`, calquée sur `roleCanVote`) ; les lignes hors dashboard restent affichées et filtrables | ✅ `7b1ce5c7` |
| « choix modale recruteur : affiche plus proprement une petite modale champ de recherche pseudo » | `recruiter-picker.tsx` : modale `Dialog` + `Command` (recherche), « Aucun recruteur » | ✅ `7b1ce5c7` |
| « pas besoin d'afficher le bandeau zone sensible pour qqun qui n'est pas présent dashboard » | pied de fiche et « Zone sensible » rendus **seulement si `isDashboard`** | ✅ `7b1ce5c7` |
| « idem pour les mules : pas de champ manuel : affichage responsive verif pseudo ladder (repli si bouton god manuel appliqué) choix icone classe » | `member-mules-editor.tsx` : liste responsive, grille des 19 classes, ajout **vérifié par le ladder** avec **repli God affiché**, plafond 10, doublons refusés, fin du `<textarea>` | ✅ `7b1ce5c7` |
| « me faut un document qui parle de tout ce dont on a pu discuter en chantier » | **ce fichier** | ✅ ici |
| chantier suivant : rôles automatiques par ancienneté (réf. Dyno « Autoroles ») | cadré, **aucun lot commencé** | ⏳ §3 (chantier **Y**) |
| puis : commandes slash personnalisées (réf. Dyno « Custom Commands ») | cadré, **aucun lot commencé** | ⏳ §4 (chantier **Z**) |

## 2. Livré le 14/10/2026 — la journée en six lots (tous mergés sur `dev`)

| PR | SHA | Ce que ça a livré |
|---|---|---|
| #955 | `23eaded9` | RBAC : la permission gouverne (`updateMemberPseudo`/`updateMemberAnkamaId` acceptent `canManageMembers`), Paramètres ouvert **par onglet** au staff, filtre de rôles = votants |
| #957 | `cf33e10e` | Module Membres : **une** liste, **une** modale, hors dashboard éditables (migration `MemberRegistryEntry`), suppression définitive (`staff:member_delete`) |
| #958 | `810188c7` | À la première connexion, la ligne de registre saisie avant l'inscription **est reportée sur le profil** puis libérée (plus de saisie qui disparaît) |
| #959 | `fb94eef6` | Suppression définitive **cliquable**, compteurs **facettés**, `/valider-recrue` applicable aux **hors dashboard** |
| #960 | `d43aeb66` | Le règlement a son **onglet** (`?tab=reglement`) et l'enregistrement de la page **ramène à la vue des membres** (`hubTabAfterSave`) |
| #961 | `cb166cb9` | Fiche membre : onglet **Activité Discord** (`getMemberDiscordPresence`, hors dashboard = `tracked: false`) |
| #962 | `7b1ce5c7` | Filtre de rôles **borné au RBAC**, **recruteur** en modale de recherche, bandeau sensible **hors dashboard** retiré, **mules** vérifiées au ladder avec icône de classe |

---

## 3. Chantier **Y** — rôles automatiques par ancienneté ⏳ *Y-1 livré, Y-2 / Y-3 à faire*

> Référence produit : module « Autoroles » de Dyno. Cadré le 14/10/2026. `docs/plans/FILE-EXECUTION.md`
> §1 « Y » + **étape 59** (« juste après l'étape 24 = chantier B », **livrée**). Plan durable : **créé** —
> **`docs/plans/PLAN-ROLES-ANCIENNETE.md`** porte désormais le besoin, l'état mesuré, les décisions
> tranchées, les tests, l'acceptation et la vigilance du chantier ; ce brief n'en garde que le fil.

**Ce que l'utilisateur veut** : une guilde déclare des paliers `seuil de jours → rôles Discord`. Un membre
qui atteint le palier **reçoit** les rôles (et **perd** ceux d'un palier qu'il n'a plus, si on revient en
arrière) ; l'arrivée d'un membre est fêtée par un **embed** dans un salon réglable.

**Briques déjà en place (mesuré, rien à créer)** : `GuildConfig.rolesMapping` (JSON, `prisma/schema.prisma:333`)
pour ne viser que des rôles connus du dashboard · `UserProfile.guildJoinedAt` (arrivée saisie à la main,
`schema.prisma:777`) avec repli `UserProfile.discordJoinedAt` (`schema.prisma:692`) · les crons sont des
routes `src/app/api/cron/<tâche>/route.ts` (procédure `docs/agents/add-cron-task.md`) · `DiscordChannelPicker`
(`src/components/shared/DiscordChannelPicker.tsx`) pour le salon · `logger` + rate limit Redis (jamais une
variable en mémoire).

**Lots**
- **Y-1 — données + règles pures.** Champs de configuration (paliers : seuil en jours + ids de rôles +
  salon + activation) et **règles pures dans `src/lib/**`** : calcul de l'ancienneté, palier cible, **diff**
  à appliquer (à ajouter / à retirer). Zéro appel Discord dans la règle → testable seule.
- **Y-2 — cron + embed.** Route cron idempotente (**garde d'état dans le `WHERE`, revendication atomique** :
  un palier déjà attribué ne se rejoue pas), application du diff par membre, embed de félicitation (ping,
  **PP Discord en grand**, rôle obtenu, « tu es là depuis X mois »), échec Discord = **fail-closed**
  (on n'écrit rien, on log, on retentera au prochain passage).
- **Y-3 — UI.** Édition des paliers (page dédiée du module ou onglet de Réglages — **à trancher**) + choix
  du salon (`DiscordChannelPicker`) + état lisible (« X membres au palier 3, dernière passe : hier 04:00 »).

**Acceptation** : un membre qui franchit un seuil reçoit ses rôles, l'embed part une fois (pas deux), le
cron relancé ne fait rien de plus ; un membre **hors** mapping de guilde ne reçoit rien (fail-closed) ;
un test unitaire couvre le diff (ajout, retrait, aucun changement) et la garde d'idempotence.

**⚠️ Décision à trancher avant Y-2** : **rattrape-t-on les membres déjà présents** (backfill, l'avantage
maison sur Dyno) ou seulement l'ancienneté à venir ? Si oui : fenêtre de rattrapage + annonce.

---

## 4. Chantier **Z** — commandes slash personnalisées ⏳ *cadré, après Y*

> Référence produit : doc Dyno « Custom Commands » + showcase. Cadré le 14/10/2026.
> `docs/plans/FILE-EXECUTION.md` §1 « Z » + **étape 60** (« après l'étape 59 »). Plan durable : **à créer**.

**Ce que l'utilisateur veut** : un admin fabrique **ses** commandes Discord (message ou embed, variables,
ajout/retrait de rôles) sans passer par le code, avec un créateur assisté et un aperçu.

**Lots**
- **Z-1 — données + registre de commandes.** Modèle de commande (nom, description, options, contenu,
  embed, rôles, salons autorisés, `staffOnly`) + **registre** ; c'est le lot qui porte la **migration**.
- **Z-2 — moteur d'exécution.** Rendu des **variables en allowlist** (`{user.mention}`, `{user.avatar}`,
  `{user.joined}`, `$N`… — **jamais d'`eval`**, jamais de HTML/Markdown brut), **actions** de rôles dans la
  même exécution, réponses respectant les limites Discord (embed : titre 256 / description 4096 / 25 champs).
- **Z-3 — créateur UI + aperçu.** Parcours nom → options → message/embed → rôles → salons → **test**, avec
  **aperçu live** ; édition et suppression ; état de synchronisation de la commande sur Discord (**action God**).
- **Z-4 — garde-fous + tests.** Plafond de commandes par guilde, **pas d'`@everyone`**, rate limit par
  (guilde, membre, commande) sur store Redis/DB, `staffOnly` vérifié **dans l'exécution** (pas seulement à l'écran),
  isolation de guilde avant toute écriture.

**Acceptation** : une commande créée répond sur Discord avec ses variables résolues ; son aperçu = sa
réponse réelle ; un membre sans le droit `staffOnly` est refusé **même en connaissant le nom** ; une
tentative d'`@everyone` est rejetée par le serveur ; le rate limit renvoie un refus propre.

**⚠️ Point ouvert** : les **salons éphémères** (salons de ticket) → autoriser par **catégorie de salon** +
mode « partout », pas une liste figée (sinon la commande casse à chaque nouveau ticket).

**Brique existante à réutiliser (mesuré)** : la page **`/dashboard/[guildId]/admin/commandes` existe déjà**
(elle règle aujourd'hui les rôles par défaut des commandes natives, cf. `src/app/dashboard/[guildId]/admin/page.tsx`)
et le modèle voisin **`GuildSlashCommandPermission`** (`prisma/schema.prisma:3974`, champ `config Json?`) porte
déjà cette configuration — Z-1 ne doit **pas** créer un doublon de ce modèle.

---

## 5. Restes petits, livrables seuls (du plus rapide au plus long)

1. **Rebascule God + Réglages** → permettre la suppression de `src/components/admin/member-management-table.tsx` :
   mesuré le 14/10/2026, il reste **2 consommateurs** — `src/app/god/guilds/[id]/page.tsx:4` et
   `src/app/dashboard/[guildId]/admin/settings/page.tsx:25`. Tant qu'ils l'affichent, ce fichier est un
   **second écran de gestion des membres** (double source : un correctif dans l'un ne va pas dans l'autre).
   C'est le lot **G3** de la refonte God (`docs/plans/PLAN-REFONTE-GOD-GUILDES.md`), chantier **O**,
   **étape 29** de la file.
2. **L'ancienne page `/dashboard/<guildId>/presentation`** rend **encore** le règlement (2ᵉ surface légère),
   et le bandeau de menu y renvoie (`src/components/layout/galactic-header.tsx:80`). Décision : **rediriger**
   vers `guild-hub?tab=presentation` (recommandé : l'URL continue de fonctionner) **ou** retirer le bloc et
   l'entrée de menu.
3. **`src/lib/harebourg-solver.ts`** : committé (PR #960) mais **importé nulle part** — module orphelin en
   attendant son écran. À **brancher** ou à **retirer** ; pas de troisième voie.
4. **Constats d'audit de #955, non corrigés** : `canManageRelance` **est** `canManageMembers` (même
   permission, la distinction « Relance » est cosmétique) · `updateGuildLifecycleConfig` n'a **aucun appelant
   UI** (candidat code mort).
5. **Rotation d'`docs/agents/activeContext.md`** : **23 blocs** pour une règle qui en prévoit **6**. À
   trancher : purge effective (les blocs sortants restent lisibles via `git log -p`) ou abandon explicite de
   la règle. Ne pas laisser dériver.

---

## 6. Ops (côté humain)

- [ ] Jouer **`20270105000000_add_member_registry_entry`** en **bêta puis prod** (additive :
      `MemberRegistryComment.profileId` devient nullable + table `MemberRegistryEntry`).
- [ ] Jouer **`20270106000000_add_presentation_internal_rules`** en **bêta puis prod** (règlement).
- [ ] **Ouvrir la permission `presentation:view` au rôle Membre** (`/dashboard/<guildId>/admin/permissions`) :
      sans elle, un membre ne voit **ni** l'onglet Présentation **ni** l'onglet Règlement (RBAC fail-closed).
- [ ] Mettre à jour la page de doc **vivante** `admin-members` dans **`/god/docs`** (`src/lib/docs-catalog.ts`
      n'est qu'une **référence figée**, sans seed).
- [ ] Contrôles à l'œil : mule **réelle** acceptée avec son **niveau**, mule inexistante **refusée**,
      recruteur trouvé au **pseudo** · fiche d'un **hors dashboard** (pas de bandeau « Zone sensible ») ·
      liste sans doublon · bouton de suppression **seulement** avec `staff:member_delete`.

## 7. Décisions ouvertes (elles bloquent un lot, elles ne se devinent pas)

| # | Question | Bloque |
|---|---|---|
| 1 | **Y** : rattrape-t-on les membres **déjà présents** (backfill) ou seulement l'ancienneté à venir ? | lot **Y-2** |
| 2 | ~~paliers sur une **page dédiée** du module ou dans un **onglet de Réglages** ?~~ **Tranché le 14/10/2026 : onglet « Rôles d'ancienneté » dans `/admin/members`** (ni page dédiée, ni Réglages — la page est **déjà gardée** et a **déjà** des onglets ⇒ aucune permission à créer) | ✅ clos |
| 3 | **Z** : la synchronisation des commandes sur Discord passe-t-elle par une **action God** explicite (recommandé) ? | lot **Z-3** |
| 4 | **`/presentation`** : redirection vers le hub, ou retrait du bloc + de l'entrée de menu ? | reste §5.2 |
| 5 | **`harebourg-solver.ts`** : brancher (quel écran ?) ou retirer ? | reste §5.3 |
| 6 | **`activeContext.md`** : purge effective des blocs, ou abandon de la règle des 6 ? | reste §5.5 |

---

## 8. Pièges mesurés — ne pas les repayer

- **`next dev` déjà lancé + `npx prisma generate`** = l'ancien client Prisma reste **en mémoire** : un
  `select` sur un champ neuf lève une erreur Prisma et la page tombe en « Section indisponible ».
  **Redémarrer `npm run dev`** après toute régénération.
- **Un seul agent par copie de travail.** Le 14/10, deux agents ont partagé l'arbre : stash, bascule de
  branche et une édition appliquée sur la **mauvaise** branche (rejouée depuis). Un chantier en cours se
  **committe** avant qu'un autre touche l'arbre, et **relire `git branch --show-current`** avant d'écrire.
- **Un test neuf doit être vert avant d'être laissé dans l'arbre** : un WIP à moitié écrit
  (`ladder-discord-presence.test.ts`, 2 parenthèses manquantes) cassait `tsc` **chez le voisin**.
- **`router.push` synchrone** juste après le reset d'un snapshot est **intercepté** par `UnsavedChangesGuard` :
  différer la navigation dans un `useEffect`.
- **Repli God « Fallback Pseudo Manuel »** (`isLadderManualFallbackEnabled`) est un réglage **plateforme**
  (`/god` → Platform Config) : s'il est actif, la vérification ladder est **court-circuitée partout**, y
  compris dans la fiche membre — l'interface l'affiche au lieu de simuler un contrôle.
- **Doc vivante ≠ doc du dépôt** : les pages de doc in-app vivent **en base** et se modifient via `/god/docs` ;
  `src/lib/docs-catalog.ts` est une référence figée (plus de seed).
- **Lettres de chantier** : `R` (durcissement réseau) et `S` (démo publique) sont **déjà prises** par la file
  d'exécution — d'où `Y` et `Z`.
- **Windows / PowerShell** : `[...]` est un **joker** (`[guildId]` ne matche rien silencieusement) → `-LiteralPath` ·
  ne **jamais** écrire un fichier avec `>` sous PS 5.1 (UTF-16).
- **Branches** : mergées puis supprimées en distante — l'arbre peut être resté sur une branche déjà livrée.

---

## 9. Journal de ce document

- **14/10/2026 (soir)** — création : absorbe le mémo volatile `src/temp/CHANTIERS-RESTANTS.md` (supprimé,
  il était gitignoré) et condense le fil de la journée (#955 → #962), les chantiers Y/Z, les restes, les
  décisions et les pièges. Mesure ajoutée à la création : `member-management-table.tsx` a **2** consommateurs
  (et non 3) et fait **886** lignes.
- **14/10/2026 (nuit)** — **chantier Y, lot Y-1 livré** (branche `feat/roles-anciennete-y1`) : plan durable créé
  (`docs/plans/PLAN-ROLES-ANCIENNETE.md` — le cadrage du §3 y est **déplacé**, ce brief n'en garde que le fil),
  **4 colonnes** de config sur `GuildConfig` + migration additive `20270107000000_add_seniority_roles_config`,
  règles pures `src/lib/seniority-roles.ts` (palier cible, diff à ajouter/retirer, périmètre fermé, annonce à
  variables en allowlist) et **26 cas** dans `tests/unit/seniority-roles.test.ts`. Décision **§7-2 close**
  (onglet dans `/admin/members`, **aucune RBAC nouvelle**) ; décision **§7-1 (backfill)** toujours ouverte avant
  **Y-2**.

