# 🔭 Plan — Refonte **God « Guildes & Users »** (UI/UX produit)

> **Statut** : plan vivant, **rien n'est codé ici**. Écrit le 25/09/2026, juste après la session de correctifs
> `#739 → #744` et un retour user à chaud (« moi je peux plus là… le module est laid »).
> **Périmètre** : la console **God** (`/god`, `/god/guilds/[id]`, `/god/users`) et, par ricochet, les seuls
> endroits **clients** qui affichent l'état des modules (`/dashboard/[guildId]/admin/pilotage`, navbar).
> **Hors périmètre** : Tickets, Marché, SEO, données de jeu (chantiers séparés).

## 0. Verbatim user (source de vérité — ne pas paraphraser)

1. « le module [God → Guildes] est **laid** ; il faut revoir **toute l'UI du module guilde et ses sous-pages responsive** »
2. « **c'est quoi autonome / pré-approuvé / à surveiller / gelée-off** ? »
3. « **tour de contrôle : trop de boutons**, j'y comprends rien »
4. « à l'intérieur d'une guilde (roster) : **UI UX dégueulasse** »
5. « onglet module : il faut **afficher les icônes des modules** comme côté admin module »
6. « le blocage des modules : doit s'afficher côté pilotage **non pas "verrouillé par le staff"** mais plutôt
   **"indisponible : en maintenance par le développeur"**, ou un **message customisable visible** »
7. « les modules **semblent bien verrouillés** mais ils sont **toujours dispo en visuel dans la navbar** d'une guilde
   **et on peut aller dedans** — on doit **rien afficher** en fait, et si un malin tente par l'URL non plus,
   **rebouclage vers dashboard** »
8. « **pagination des logs** » (capture : « Page 1 / 2  ‹ › » avec 31 entrées)
9. « moi le God je comprends pas, **il y a des guildes où je n'ai pas les droits**, c'est pas normal je suis le dev du produit »
10. « les guildes **ne doivent pas savoir que le God a accès à leurs logs** — pas de trace God dans le module logs des guildes »
11. « accès & RBAC idem **on comprend rien**, ça manque d'**icônes** »

## 1. Ce qui vient d'être livré juste avant (à ne pas refaire)

| PR | Livré le 25/09 | Conséquence pour ce plan |
|---|---|---|
| **#739** | Origine d'une guilde = **source unique** (`src/lib/onboarding-gating.ts`) | Les badges `🚀 Autonome` / `🛡️ Pré-approuvée` / `🧑‍🚀 Ticket` sont **exacts** → il reste à les **expliquer** (G1) |
| **#740** | **Verrou God effectif** (permissions, pages, bot) + écriture durcie (garde d'état, Zod, rate-limit, journal God) | Le verrou marche **sauf pour le God** (`bypassModules = isGod`) → **arbitrage A1** |
| **#741** | Rétention **90 j God / 30 j guilde** + purge batchée hors server action | Compteurs et pagination des logs restent à soigner (G6) |
| **#742** | Audit/sécurité **filtré en base** + 2 index | La tour de contrôle ne doit plus afficher **deux fois le même flux** (G2) |
| **#743** | Fiche guilde **à onglets** (Modules / Logs / Accès & RBAC) | **Base à refondre** : grille modules **nue**, panneau Accès **illisible** (G3/G4/G5) |
| **#744** | Recette de carte unique (`GOD_CARD_BASE`) + kit `src/app/god/ui` | **Utiliser ce kit partout** — ne pas inventer une nouvelle carte |

## 2. Le glossaire (réponse immédiate aux questions — à porter DANS l'UI)

| Libellé affiché | Signification réelle | Où c'est décidé |
|---|---|---|
| **🚀 Autonome** | Installation **sans validation humaine** : le bot a été invité (`addedBy: SYSTEM_GATEWAY`) ou la guilde s'est déployée en 1 clic. Modération **a posteriori**. | `isSelfOnboardedGuild()` |
| **🛡️ Pré-approuvée (God)** | Le **staff** a whitelisté la guilde **avant** son déploiement (ligne `AllowedGuild` créée par un humain, tier `BETA`). | `resolveOnboardingOrigin()` |
| **🧑‍🚀 Ticket** | Guilde **validée via un ticket de support** (tier `VIP`) : accompagnement humain. | `ticket-actions.ts` |
| **⚠️ À surveiller** | Guilde **active** mais **≤ 3 profils** : installation neuve ou abandonnée. **Ce n'est pas une sanction**, c'est un radar. | `guild-table.tsx` |
| **❄️ Gelée / Off** | Accès **coupé** (`AllowedGuild.isActive === false` ou `GuildConfig.deletedAt`) : le portail ne la propose plus, les membres sont bloqués. | `toggleGuildActive` |
| **SATIN** | Badge **esthétique** de guilde (thème « satiné »), **pas un statut**. | `welcomeBadgeName` |

→ **G1** : ces définitions doivent vivre dans l'UI (légende dépliable + `title` sur chaque badge), pas dans un doc.

## 3. Arbitrages à trancher AVANT de coder

| # | Question | Défaut proposé |
|---|---|---|
| **A1** | Le **verrou de module s'applique-t-il au God** lui-même ? Aujourd'hui non (`bypassModules = isGod`, décision §9 « seul le God contourne »). L'utilisateur veut « on doit rien afficher » — donc **oui**. | **Oui** : verrou = invisible pour **tout le monde** ; le God pilote depuis `/god` uniquement. Garde-fou : `admin` reste **jamais** verrouillable (sinon plus de panneau de config). |
| **A2** | Le **message « en maintenance »** : global (plateforme) ou par guilde ? Qui le rédige ? | **Global** (God) + **note par guilde** possible ; stocké sans migration si possible (`PlatformConfig`), sinon migration additive. |
| **A3** | Le **toggle guilde** (module OFF par l'admin) écrit-il aussi « en maintenance » ? | Non : côté client on distingue **« Désactivé par ta guilde »** (toggle) et **« Indisponible — maintenance »** (verrou God). |
| **A4** | Les actions du God sur un membre (ban, purge depuis la fiche guilde) : **visibles** dans le journal de la guilde ? | **Non** (verbatim 10) : toute action d'un God part dans le **journal God** (`isGodLog: true`, sans `guildId`). |
| **A5** | Le God voit-il **toutes** les guildes sans condition (verbatim 9) ? | **Oui** : `isSuperAdmin()` ⇒ lecture **toujours** accordée (le « pas la permission » actuel est un défaut). |
| **A6** | La tour de contrôle : combien d'actions visibles ? | **1 action primaire par bloc** + un menu « ⋯ » pour le reste ; les actions destructrices passent en **zone danger** confirmée. |


## 4. Chantiers (1 chantier = 1 branche = 1 PR → `dev`)

### G1 — Langage : arrêter le jargon (verbatim 2)
- **Douleur** : « c'est quoi autonome / pré-approuvé / à surveiller / gelée-off ». Aucun de ces mots n'est expliqué
  dans l'écran ; pire, « À surveiller » ressemble à une sanction alors que c'est un **radar** (≤ 3 profils).
- **Correctif** : ① renommer là où c'est ambigu (« Pré-approuvée (God) » = ✓, « À surveiller » → « Peu de membres —
  à vérifier ») ; ② un `title` sur **chaque** badge (le glossaire §2 mot pour mot) ; ③ une **légende dépliable**
  en haut du tableau (bouton « ⓘ Comprendre les statuts ») qui réutilise le §2 ; ④ dans la fiche guilde, un
  **bandeau d'origine** qui dit la phrase complète (« Installée en autonomie le 24/09 — aucune approbation requise »).
- **Fichiers** : `god/components/guild-table.tsx`, `god/page.tsx`, `god/guilds/[id]/page.tsx`.

### G7 — « Je suis le dev, je vois tout » (le plus urgent — verbatim 9)
- **Douleur mesurée** : sur `/god/guilds/[id]` onglet **Logs**, le God lit « *ACCÈS : ce compte n'a pas la permission
  de lire le journal de cette guilde* » (capture **Kamas NOT Found**) alors que l'en-tête affiche « **INSPECTION GOD MODE** ».
- **Cause racine** : le panneau Logs (`god/guilds/[id]/page.tsx`, `GodGuildLogsSection`) gate sur
  `getUserContext(discordGuildId).canViewAuditLogs` — et **un `null` (appel en erreur) affiche le même message
  qu'un vrai refus**. Pour un God, la règle de lecture ne doit **jamais** dépendre d'un contexte de guilde.
- **Correctif** : dans `/god/**`, lire = `isSuperAdmin()` (ou `canAccessBrick` pour un sous-god), point.
  Distinguer dans l'UI « erreur de chargement » et « accès refusé » (jamais le même texte).
- **Recette** : un God ouvre **n'importe quelle** fiche guilde → 3 onglets lisibles, **aucun** message d'accès.

### G8 — Verrou **invisible partout** + « indisponible : maintenance » (verbatims 6 & 7)
- **Mesure à refaire en début de chantier (2 min, avant tout correctif)** : verrouiller un module depuis
  `/god/guilds/[id]`, puis ① navbar **avec un compte membre** (le God contourne **par design** → dépend de **A1**) ;
  ② `curl` de l'URL du module verrouillé (attendu : **rebouclage** vers `/dashboard/[guildId]`) ; ③ commande bot liée
  (ex. `/songes`) → refus.
- ⚠️ **Ce qui est déjà vrai — ne pas « re-corriger »** : la navbar lit `getGuildModules` (**lock-aware**, donc masquée),
  et les pages testent `!isSuperAdmin && !isModuleEnabled(...)` (donc refusées). Le **seul trou connu** est le
  **bypass God** (`bypassModules = isGod` dans `getUserContext`) → c'est exactement **A1**.
- **Correctif** : appliquer A1 (fin du bypass God), ramener toutes les gardes de page à **une source unique**
  (`resolveEffectiveModules` de `src/lib/module-lock.ts`), et **masquer** (jamais un lien mort).
- **Côté client** : « **Verrouillé par le staff** » → « **Indisponible — maintenance** » + **message customisable**
  (A2/A3). Fichiers : `admin/modules/_components/modules-client.tsx`, `admin/pilotage/page.tsx`,
  `src/lib/module-lock.ts` (exposer la *raison* du verdict : toggle vs verrou), message en base.

### G4 — Onglet Modules côté God : les **mêmes cartes** que l'admin (verbatim 5)
- **Douleur** : la grille God affiche `missions / Inactif (guilde)` + un cadenas — **nue** : pas d'icône de module,
  pas de description, pas de chips `Pages` / `RBAC` (le client, lui, a de vraies cartes — cf. capture pilotage).
- **Correctif** : rendre la grille God avec **le composant de carte module du client** (icônes du registre,
  description, chips `Pages`/`RBAC`), plus l'état effectif (toggle × verrou) et le compteur de verrous (déjà fait).
  Source des icônes : registre des modules + `god/components/module-icons-manager.tsx` / `public/assets/nav/*`.
- **Recette** : grille God et grille client se lisent **pareil** (mêmes icônes, mêmes libellés).


### G3 — Fiche guilde : refonte UI/UX du roster (verbatims 1 & 4)
- **Douleur** (captures) : colonnes vides (`ANKAMA ID` = « AJOUTER ID », `SUPPRESSION` = `-`), avatar/pseudo désalignés,
  actions cachées dans `⋯`, filtres tronqués (`TOUS LES RÔL`, `TOUTES ÉPOQ`), `TOUS` redondant avec
  `ACTIFS/ARCHIVÉS/BANNIS/EXCLUS`, et un pavé « NOTE : en tant que Super-Admin… » qui vole la vedette.
- **Correctif** : ne garder que les **colonnes utiles**, avatar + pseudo + `@handle` sur 2 lignes, actions **visibles**,
  état vide explicite, tri par colonne, **responsive mobile** (tableau → cartes), et un **bandeau d'état**
  (origine, membres, gel, verrous) au lieu du pavé.
- **Vigilance** : `src/components/admin/member-management-table.tsx` est **partagé God/client** → mesurer l'impact
  côté client avant de réécrire (ou extraire un composant God dédié).

### G5 — Accès & RBAC : libellés humains + icônes (verbatim 11)
- **Douleur** (capture) : la matrice affiche des **slugs bruts** (`system:god`, `staff:content`, `game:raid_officer`…)
  sur une seule ligne illisible, sans icône, sans regroupement, sans distinction sensible/non sensible.
- **Correctif** : consommer le **catalogue existant** `src/lib/permissions.ts` (`label`, `description`, `sensitive`,
  `module`) — il est déjà **traduit** ; badges par domaine (Système / Staff / Communauté / Jeu / Marché), icône par
  domaine, compteur de permissions sensibles, recherche par rôle.
- **Recette** : plus **aucun** slug brut à l'écran ; un libellé + une description par permission.

### G6 — Logs : pagination et lisibilité (verbatim 8)
- **Douleur** (capture) : « Page 1 / 2  ‹ › » (flèches de 12 px) pour 31 entrées, filtres collés
  (`Toutes les actions` / `Mot-clé…` / `Acteur…`), dates `jj/mm/aaaa` non alignées, timeline plate.
- **Correctif** : pagination **numérotée** (1 2 3 … + « par page »), filtres qui passent **en colonne** sur mobile,
  période en **presets** (24 h / 7 j / 30 j / personnalisé), regroupement **par jour**, **compteur par type d'action**.
  Le composant est déjà partagé entre le client et la fiche God (#743) : un seul lot de corrections.

### G2 — Tour de contrôle `/god` : moins de boutons (verbatim 3)
- **Douleur** : en-tête surchargé (« CONNEXIONS NON AUTORISÉES » + « WHITELIST NEW GUILD »), filtres, 5 compteurs
  radar, actions partout — et un doublon du flux de logs (corrigé en #742, l'écran reste dense).
- **Correctif** : **1 action primaire par bloc**, le reste dans un `⋯` ; hiérarchie visuelle claire ; les compteurs
  restent des **filtres cliquables** mais avec **libellé + légende** (G1) ; on masque une section vide au lieu de
  l'afficher vide.

### G9 — `/god/users` : même traitement
- `god/user-list.tsx` : même langage visuel que Guildes (cartes, badges, pagination), **aucun slug brut**, et
  vérification qu'un God ne peut **jamais** tomber sur un refus de lecture (G7).

### G10 — Responsive + états vides + déslop du périmètre God
- Cible : `src/app/god/**` — 86 fichiers encore en palettes zinc/violet (**allowlist** de `sigil/no-hardcoded-colors`).
- Méthode : écran par écran, avec le **kit existant** (`GodCard`, `GodPanel`, `GodSectionHeader`, `GodBadge`,
  `GodEmptyState`, `GodLoadingSkeleton`, `GodStatCard`) — **jamais** une nouvelle recette.
- La garde `tests/unit/god-deslop.test.ts` empêche toute régression sur les surfaces refondues et **plafonne** le
  reste : ce plafond doit **descendre** à chaque PR.

## 5. Ordre conseillé (dépendances)

1. **A1/A5 tranchés** (décisions, pas de code) → sinon G8 repart en arrière.
2. **G7** (bug bloquant pour toi, 1 fichier) → **G8** (verrou visible/rebouclage + message maintenance) → **G4** (cartes modules).
3. **G1** (langage/légende) → **G2** (tour de contrôle) → **G6** (logs) → **G3** (roster) → **G5** (RBAC) → **G9** (users).
4. **G10** (déslop/responsive) se fait **par lots**, en même temps que chaque écran touché — jamais un « big bang ».

## 6. Recette globale (DoD de la refonte)

- [ ] Un God ouvre n'importe quelle guilde : **aucun** message d'accès, 3 onglets lisibles, **0 slug brut**.
- [ ] Verrou posé ⇒ module **absent** de la navbar, **URL rebouchée** vers le dashboard, **commande bot refusée**,
      **message « maintenance »** visible côté guilde (et **aucune** mention « staff »).
- [ ] Aucune action God visible dans le journal de la guilde (verbatim 10) — vérifier **après** une action God sur un membre.
- [ ] Chaque badge de statut a un `title` + une légende accessible (verbatim 2).
- [ ] `npm run test:run` + `npx tsc --noEmit` + `npm run lint` verts, `git status --short` propre, plafond déslop ↓.

## 7. Protocole de reprise (pour la prochaine session)

```bash
git fetch origin dev && git switch dev && git pull            # dev contient #739 → #744
npm run test:run && npx tsc --noEmit                          # état de départ attendu : vert
```
**À lire** : ce fichier + `docs/agents/activeContext.md` (bloc « Session 25/09/2026 (God, refonte) ») + le verbatim §0.
**À ne pas relire** : les 3 audits de `temp/` (arbitrés), le mémo externe (corrigé le 25/09).
**Pièges connus** : `src/app/god/**` est allowlisté dans `sigil/no-hardcoded-colors` (le déslop ne casse pas le lint,
il n'est donc **pas** détecté) · `moduleCache` (30 s) et le cache Redis du contexte (`user:ctx:*`) peuvent masquer un
changement de verrou pendant ≤ 60 s · `next dev` qui tourne ⇒ `npm run build` délégué à la CI.
