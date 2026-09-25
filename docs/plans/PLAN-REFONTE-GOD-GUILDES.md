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
12. « **idem pour les logs** » (2ᵉ passe du 25/09 au soir, capture de `/god?tab=security` : journal
    `GOD_MODULE_LOCK` / `GOD_DASHBOARD_ACCESS`, **831** entrées).
13. « “*Le Lifecycle Server est désormais intégré à l'onglet Guildes via LifecyclePanel pour plus de clarté.*”
    **c quoi ?** »
14. « **Comptes (Plateforme) ✓ Aucune** … **Soft-delete — suppression définitive exécutée par le Janitor au-delà du
    délai de rétention** → **c quoi ce truc c utile ca marche ? c dla merde non** »
15. « **mutualiser, refonte etc** » — les **deux** écrans de logs (`/god?tab=security` et `/god/logs`).

## 1. Ce qui vient d'être livré juste avant (à ne pas refaire)

| PR | Livré le 25/09 | Conséquence pour ce plan |
|---|---|---|
| **#739** | Origine d'une guilde = **source unique** (`src/lib/onboarding-gating.ts`) | Les badges `🚀 Autonome` / `🛡️ Pré-approuvée` / `🧑‍🚀 Ticket` sont **exacts** → il reste à les **expliquer** (G1) |
| **#740** | **Verrou God effectif** (permissions, pages, bot) + écriture durcie (garde d'état, Zod, rate-limit, journal God) | Le God garde l'accès **par design** (`bypassModules = isGod`) : **A1 tranché** ⇒ ce n'est **pas** un trou à boucher, le verrou est **côté guilde** ; ce qui manque (carte **grisée**, message, verrou **plateforme**) → **G8 + G12** |
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
| **Soft-delete** | La donnée **reste en base**, marquée supprimée (`deletedAt`, `scheduledDeletion`) jusqu'à la purge. Ce n'est **pas** une suppression. | colonnes `deletedAt` / `scheduledDeletion` |
| **Janitor** | Script VPS `scripts/database-janitor.ts` lancé par `scripts/maintenance.sh` (~04h00, `--execute` **dans le conteneur app**) : orphelins `User` > 7 j sans profil, `AuditLog` (30 j guilde / 90 j God), `GuildConfig` + `UserProfile` dont `scheduledDeletion` est échue. **Il ne purge jamais un `User`.** | `scripts/database-janitor.ts` |
| **Journal plateforme** | Onglet « Journal d'audit » de `/god/logs` : table `AuditLog` globale (avec les lignes `isGodLog`, sans guilde). | `getGlobalAuditLogs` |
| **Journal de sécurité** | **Extrait du même flux** (`/god?tab=security`, `category: "security"`, 200 max) — ce n'est pas un autre journal. | `audit-feed-panel.tsx` |
| **Accès refusés** | Onglet de `/god/logs` : table `AccessAttempt` (clic « Se connecter » **sans** guilde gérée). Écrite, affichée, purgée à 90 j par le Janitor. | `getRecentAccessAttempts` |
| **Comptes (Plateforme)** | Carte listant les `User` avec `deletionRequestedAt`/`scheduledDeletion` non nuls. **Aucun code n'écrit ces colonnes** → voir **D2** (§4bis). | `deletion-pending-panel.tsx` |

→ **G1** : ces définitions doivent vivre dans l'UI (légende dépliable + `title` sur chaque badge), pas dans un doc.

## 3. Arbitrages — **TRANCHÉS le 25/09/2026** (réponses user ; verbatim pour A1/A2/A8)

> Les 11 décisions ci-dessous sont **fermes** : une PR qui les contredit est refusée. Les mentions
> « **à faire** » / « **tu gères** » signalent les cas où le user a renvoyé la décision au défaut proposé.
> ⚠️ **A1 est la décision la plus mal comprise** : relire sa formulation avant de toucher à `bypassModules`.

| # | Décision |
|---|---|
| **A1** | **Le verrou n'est PAS une question de God : c'est le module, pour CETTE guilde, qui devient indisponible.** Verbatim : « *je ne veux pas verrouiller tel module au God, je veux que le verrou d'un module pour une guilde grise le module* » dans `/dashboard/[guildId]/admin/pilotage`, « *qu'il ne soit juste pas dispo à l'activation pour une guilde et si il était déjà actif cela doit le désactiver* », « *cacher le module en navbar* », « *et bien sûr tout vérifié côté serveur sécu* ». ⇒ **5 obligations** : ① la carte est **grisée** (pilotage **et** `/admin/modules`) ; ② toggle **inerte** + **refus serveur** dans `updateGuildModules` ; ③ module **déjà actif** ⇒ **OFF effectif** (toggle **conservé** en BDD : au délock, l'état revient **sans perte**) ; ④ **absent de la navbar** + URL directe **rebouchée** vers le dashboard ; ⑤ garde **serveur** partout (page, navbar, action, **bot**), fail-closed. `admin` reste **jamais** verrouillable. **⚠️ Ne PAS en déduire qu'on verrouille le God : `bypassModules = isGod` reste en place** (le God garde l'accès technique ; c'est le module **pour la guilde** qui est éteint). |
| **A2** | **Message « indisponible » affiché SUR LA CARTE du module** (texte libre du God) **+ une nouvelle vue God « Modules »** (→ **G12**) listant **tous** les modules/features, où le God peut **désactiver globalement pour toutes les guildes** et **écrire un message perso sur la carte** d'un module. Verbatim : « *le message "indisponible" maintenance ce que je voulais dire c'est de pouvoir afficher un message sur la carte d'un module indisponible pour les guildes* » … « *une nouvelle vue coté GOD ou tous les modules/features sont dispo que je puisse les désactiver de façon globale pour toutes les guildes et y ajouter un message sur une carte module : maintenance etc, un message perso* ». |
| **A3** | **Rejoint A2** : trois niveaux **distincts**, jamais confondus, et le mot « staff » **disparaît** de l'interface — ① **verrou plateforme** (le God, toutes les guildes) → « **Indisponible — maintenance** » + message perso ; ② **verrou de guilde** (le God, cette guilde ; existant `GuildModules.disabledByGod`) → même libellé, message possible ; ③ **toggle de la guilde** (son propre choix) → « **Désactivé par ta guilde** ». |
| **A4** | **« À faire »** (défaut appliqué) : tes actions sur un membre (ban, purge, déblocage…) ne laissent **aucune** trace dans le journal de la guilde — tout part en **journal God** (`isGodLog: true`, sans `guildId`) — **+ un test unitaire** qui le verrouille (non-régression du verbatim 10). |
| **A5** | **« À faire »** (défaut appliqué) : le God lit **toujours** (`isSuperAdmin()` ⇒ lecture accordée, verbatim 9) ; « **erreur de chargement** » et « **accès refusé** » ne s'affichent **jamais** avec le même texte. |
| **A6** | **« Tu gères »** : **1 action primaire par bloc** sur la tour de contrôle, le reste dans un `⋯` ; tout destructif en **zone danger** confirmée. |
| **A7** | **« Tu gères »** ⇒ **supprimer la carte « Comptes (Plateforme) »** (dette **D2** : aucun code n'écrit ses colonnes, donc « ✓ Aucune / La plateforme est propre » est un **faux positif**, et la légende attribue au *Janitor* une purge qui appartient au cron `account-retention`). Si un jour un membre peut **demander** la suppression de son compte, l'action **et** le panneau se codent dans le **même chantier**. |
| **A8** | Verbatim : « **il faut des choses simples et fonctionnelles, marre des doublons partout** » ⇒ **supprimer** le placeholder `LifecycleServer` et les composants orphelins `LifecyclePanel`, `GhostRadarPanel`, `JanitorButton` (dette **D1**) ; **garder** les actions serveur utiles (`god-lifecycle-actions.ts` : geler/dégeler vit dans `guild-table.tsx`) ; **une seule** porte pour le cycle de vie et les logs → `/god/logs` (**G11**). |
| **A9** | **« Tu gères »** ⇒ **une seule source de trace** : `GodSessionLog` (la session) **reste**, `AuditLog.GOD_DASHBOARD_ACCESS` n'ajoute **plus une ligne par visite** (compteur **agrégé** par jour). Règle : *une visite n'est pas un événement de sécurité*. |
| **A10** | **« Tu gères »** ⇒ `GodAccessLog` (55 lignes écrites par `god-delegate-actions.ts`, **jamais lues**) est **exposé** dans `/god/logs` (onglet « Accès délégués ») : c'est de la vraie sécurité (qui a donné/retiré quel accès, à qui). |
| **A11** | Défaut appliqué ⇒ onglet « **Journal de guilde** » dans `/god/logs` : **lecture seule**, filtrable par guilde, **sans aucune** action God à l'intérieur (A4). |


## 4. Chantiers (1 chantier = 1 branche = 1 PR → `dev`)

> ⚠️ **Tous les chantiers ci-dessous obéissent aux directives de design du §8** (anti-slop, alignement sur le
> standard existant, logique d'**interface d'admin**). Un chantier « fonctionnel » qui ignore le §8 est refusé en revue.

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

### G8 — Verrou de module : **OFF effectif côté guilde, invisible partout** (A1, verbatims 6 & 7)
- **Ce que le user veut** (verbatim A1, c'est la demande exacte) : poser le verrou depuis la console God ⇒
  ① la carte du module est **grisée** dans `/dashboard/[guildId]/admin/pilotage` (onglet Modules) **et**
  `/admin/modules` ; ② il n'est **pas activable** (toggle **inerte** + **refus serveur**) ; ③ s'il était **déjà
  actif**, il devient **OFF effectif** (le toggle de la guilde est **conservé** en BDD → au délock, l'état revient
  **sans perte**) ; ④ il **disparaît de la navbar** et l'**URL directe reboucle** vers le dashboard ; ⑤ **tout est
  vérifié côté serveur** (page, navbar, action, **bot**), fail-closed.
- ⚠️ **Ce qui N'EST PAS demandé** : verrouiller l'accès **du God**. `bypassModules = isGod`
  (`src/server/actions/user-actions.ts`) **reste en place** — c'est le module **pour la guilde** qui est éteint, pas
  l'accès du God. « Corriger » ce bypass serait une **régression** de la demande.
- **Ce qui est déjà vrai (ne pas refaire)** : lecture appliquée par `applyGodLocks` (`src/lib/module-lock.ts`) ;
  `getGuildModules` l'applique et la navbar est **lock-aware** ; `updateGuildModules` **refuse** le toggle d'un module
  verrouillé ; `admin` non verrouillable ; `setModuleGodLock` durci (Zod, rate-limit, garde d'état, `GOD_MODULE_LOCK`).
- **Reste à faire** : ① **une seule** résolution effective — `src/lib/module-lock.ts` expose
  `resolveModuleState(...) → { enabled, lockedBy: "platform" | "guild" | null, notice }` et **tous** les consommateurs
  l'utilisent (page, navbar, action, `getUserContext`, bot) ; ② **griser la carte** (aujourd'hui seul le toggle est
  désactivé) ; ③ remplacer « Verrouillé par le staff » par « **Indisponible — maintenance** » + **message perso** (A2) ;
  ④ test unitaire du scénario complet : *module actif + verrou ⇒ lecture OFF, `isModuleEnabled` false, toggle refusé,
  navbar masquée, bot refusé*.
- **Fichiers** : `src/lib/module-lock.ts` · `src/server/actions/module-actions.ts` (`getGuildModules`,
  `updateGuildModules`, `getModuleGodLocks`) · `src/server/actions/user-actions.ts` (`getUserContext`) ·
  `src/components/layout/app-sidebar.tsx` · `src/app/dashboard/[guildId]/admin/modules/_components/modules-client.tsx` ·
  `src/app/dashboard/[guildId]/admin/pilotage/page.tsx` · `services/discord-bot/index.ts` (`internalCheckPermission`).

### G12 — Vue God « Modules » : verrou **global plateforme** + message perso (A2/A3)
- **Ce que le user veut** : **un seul écran God** qui liste **tous** les modules/features, où il peut
  **désactiver globalement pour toutes les guildes** et **écrire un message perso** affiché sur la carte du module
  côté guilde (« Maintenance en cours — de retour vendredi »).
- **Stockage** : `PlatformConfig` est **déjà** la maison des kill-switch God (`maintenanceMode`, `maintenanceMessage`,
  `autoOnboardingEnabled`, `rbacUsersMappingEnabled`, `forceDarkMode`) ⇒ **migration additive** :
  `disabledModules String[] @default([])`, `moduleNotices Json?` (message par clé), `disabledModulesUpdatedAt/By`
  (traçabilité, comme les autres toggles). **Pas** de nouvelle table.
- **Règles** : `admin` **jamais** verrouillable globalement (sinon plus aucun panneau de config dans aucune guilde) ;
  Zod **borné** (message ≤ 280 caractères, clés **issues du registre** `DEFAULT_MODULES`) ; **garde d'état** dans le
  `WHERE` ; **rate limit** ; `createGodAuditLog` (`GOD_MODULE_LOCK`, périmètre **plateforme**) ; action
  **super-admin only** ; `invalidateModuleCache` (ou TTL 30 s assumé et **documenté**) après écriture.
- **Où** : **nouvelle entrée de nav** God « Modules » (brique `modules`, `subGodAccess: false`) — voisine de l'entrée
  existante « Icônes Modules » (`god-nav-config.ts:94`) ; la vue par guilde reste dans la fiche guilde (`G4`).
- **Recette** : God ⇒ verrou global sur `songes` + message ⇒ **toutes** les guildes perdent la carte (grisée +
  message), la navbar, l'URL, la commande bot ; **aucune** guilde ne garde l'accès ; au déverrouillage, l'état
  antérieur revient **intact**.

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

### G11 — Sécurité & Logs : **une seule porte**, un journal lisible (verbatims 12 & 15)
- **Douleur mesurée** : deux entrées de nav pour **un seul** flux (`god-nav-config.ts:65` « Sécurité & Logs » →
  `/god?tab=security` **et** `:66` « Audit Logs » → `/god/logs`), et `AuditLog` **1032** lignes en dev dont
  **748** `GOD_DASHBOARD_ACCESS` (**72 %**) → l'écran affiche un mur de lignes de navigation et « Page 1 / 17 ».
- **Correctif** : ① **une** entrée de nav (« Sécurité & Logs » → `/god/logs`), `?tab=security` renvoyant un
  `redirect()` (les liens existants ne cassent pas) ; ② cinq onglets : **Journal plateforme** · **Journal de
  guilde** · **Accès refusés** · **Marché** · **Comptes & cycle de vie** (A7/A8) ; ③ **presets de période**
  (24 h / 7 j / 30 j / 90 j), recherche et filtre acteur **en base**, compteur **par famille** ; ④
  `GOD_DASHBOARD_ACCESS` **agrégé** (A9) au lieu d'une ligne par visite ; ⑤ l'onglet Sécurité cesse d'être un
  écran **hybride** (aujourd'hui : un extrait du journal + un placeholder mort + une carte morte).
- **Contraintes** : `god-bricks.ts:30-31` — les deux briques (`security`, `logs`) sont `subGodAccess: false` et le
  **restent** ; `TAB_TO_BRICK` (`page.tsx:146`) ; les filtres restent **en base** (jamais un filtre client sur
  200 lignes).
- **Recette** : une seule entrée de nav ; plus aucun écran affichant des centaines de lignes de navigation ; la
  pagination est **numérotée** (G6) ; « qui a verrouillé ce module et quand » se trouve en **2 clics**.

## 4bis. Dette mesurée le 25/09 au soir — l'onglet **Sécurité** (`/god?tab=security`)

> Mesures faites en **lecture seule** sur la base locale (`docker exec sigilos-db psql`). L'équivalent doit être
> joué sur la bêta avant correctif. Ce sont les réponses **vérifiées** aux verbatims 13, 14 et 15 — pas des
> suppositions : chaque ligne cite le fichier ou la requête qui la prouve.

| # | Défaut mesuré | Preuve | Sort |
|---|---|---|---|
| **D1** | L'onglet Sécurité affiche « *Le Lifecycle Server est désormais intégré à l'onglet Guildes via LifecyclePanel pour plus de clarté.* » — un **placeholder de refactor jamais terminé**, et **faux** : le composant n'est monté nulle part. Le cycle de vie (guildes/profils soft-deleted, fantômes, bannis, suspects) n'est donc **plus accessible** dans la console. | `page.tsx:573-579` (`LifecycleServer`), monté en `page.tsx:311-316` ; `git grep LifecyclePanel` ⇒ **aucun import** hors de sa propre définition (`components/lifecycle-panel.tsx`, ~800 lignes) ; `GhostRadarPanel` et `JanitorButton` sont **importés mais jamais rendus** (`page.tsx:37,40`). | **A8** → suppression du placeholder et des composants orphelins (ou résurrection explicite, **décidée**) ; les actions serveur utiles (`god-lifecycle-actions.ts`) restent. |
| **D2** | Carte **« Comptes (Plateforme) »** : « ✓ Aucune / La plateforme est propre » s'affiche **par construction** — c'est un **faux positif** de sécurité, pas un résultat. La légende est **inexacte** : elle attribue la suppression définitive au *Janitor*, qui ne touche **jamais** un `User` (il ne purge que les orphelins > 7 j, `GuildConfig` et `UserProfile`). | `deletion-pending-panel.tsx:1-118` + `super-admin-actions.ts:1146` ; **aucune écriture** de `User.deletionRequestedAt` dans tout `src/` (3 occurrences : 1 migration + le schema + la lecture) ; mesures locales : `User` en attente **0**, `GuildConfig` soft-delete **0**, `UserProfile` soft-delete **0** ; la vraie purge des comptes = `/api/cron/account-retention` → `purgeOrphanAccountsCore` (90 j, `profiles: none ACTIVE`, gardes super-admin + `guildEvents`). | **A7** → suppression maintenant ; le jour où un membre peut **demander** la suppression de son compte, l'action et le panneau se codent **ensemble**. |
| **D3** | **Mutualisation absente** : `/god?tab=security` (`GlobalLogsServer`, 200 lignes, `category: "security"`) et `/god/logs` (`LogViewer`, 50/page) affichent **le même `AuditLog`** ; la navigation du God est journalisée **deux fois** et **noye** le journal (sur la capture bêta : 831 entrées, majoritairement des visites). | `page.tsx:296-324` vs `logs/page.tsx` ; `god-nav-config.ts:65-66` ; mesures locales : `AuditLog` **1032** (dont **867** `isGodLog`), `GOD_DASHBOARD_ACCESS` **748**, `GodSessionLog` **490**, `AccessAttempt` **1**, `GodAccessLog` **55** (écrit, **jamais** exposé), `GodNotification` **78**. | **G11** (+ **A9**) : un seul écran, accès God agrégé, `GodAccessLog` soit exposé soit arrêté. |

## 5. Ordre d'exécution — **one shot, lot par lot, 1 lot = 1 PR vers `dev`** (décidé le 25/09)

> Les 11 arbitrages sont **tranchés** (§3) et le user demande d'**exécuter tout**, sans redemander la suite
> (arrêt uniquement si une **mesure** contredit ce plan, cf. §7). Un lot n'attend pas le suivant pour être mergé.

| Lot | Contenu | Chantiers | Pourquoi ce rang |
|---|---|---|---|
| **0** | **Le mort d'abord** : suppression du placeholder `LifecycleServer`, des composants orphelins `LifecyclePanel` / `GhostRadarPanel` / `JanitorButton`, de la carte « Comptes (Plateforme) » et des imports non utilisés | A7 · A8 | Zéro risque ; supprime un **faux positif de sécurité** et un cul-de-sac. L'onglet Sécurité devient **honnête** avant d'être joli |
| **1** | **Le verrou de module côté guilde** : résolution unique (`resolveModuleState`), carte **grisée**, toggle inerte + **refus serveur**, navbar, URL rebouchée, bot, tests | **G8** (A1) | C'est **la** demande fonctionnelle ; le lot 2 (le message) s'y branche |
| **2** | **Vue God « Modules »** : migration additive (`PlatformConfig.disabledModules` + `moduleNotices`), écran God, action durcie, **message perso** affiché sur la carte côté guilde | **G12** (A2/A3) · G4 | Livrer le **contenu** avant la **forme** ; techniquement dépend du lot 1 |
| **3** | **Les logs : une seule porte** : `/god/logs` unifié (5 onglets), `?tab=security` **redirigé**, accès God **agrégé**, onglet « Accès délégués », « Journal de guilde », pagination numérotée | **G11** (A9/A10/A11) · G6 | Supprime le doublon de nav et le bruit **mesuré** (72 % du journal = des visites) |
| **4** | **Le God voit tout** : lecture toujours accordée, « erreur de chargement » ≠ « accès refusé », **aucune** trace God dans le journal de guilde (+ test) | G7 · A4 · A5 | Correctifs ciblés, une fois les écrans stabilisés |
| **5** | **Langage, tour de contrôle, roster, RBAC, users** : glossaire dans l'UI, 1 action primaire par bloc, colonnes utiles, libellés de permissions | G1 · G2 · G3 · G5 · G9 | La refonte visuelle, sur une base fonctionnelle saine |
| **6** | **Déslop par lots** : jetons sémantiques, kit God, plafond de `tests/unit/god-deslop.test.ts` qui **baisse** | G10 | Jamais un « big bang » : écran par écran, en accompagnement des lots 3 → 5 |

**Preuve exigée pour chaque lot** : mesure avant/après (capture 1440 / 1024 / 390 pour une UI, compteur chiffré pour une
donnée) · `npm run test:run` · `npx tsc --noEmit` · `npm run lint` · `git status --short` propre · `gh pr checks` vert.

## 6. Recette globale (DoD de la refonte)

- [ ] Un God ouvre n'importe quelle guilde : **aucun** message d'accès, 3 onglets lisibles, **0 slug brut**.
- [ ] Verrou posé (**A1**) ⇒ carte du module **grisée** dans `/admin/pilotage` **et** `/admin/modules`, toggle **inerte**
      avec **refus serveur**, module **déjà actif** ⇒ **OFF effectif** (et **retour intact** au déverrouillage),
      module **absent** de la navbar, **URL rebouchée** vers le dashboard, **commande bot refusée** — et **aucune**
      mention « staff » nulle part.
- [ ] Le God (**A2**) peut **désactiver globalement** un module pour **toutes** les guildes depuis sa vue « Modules » et
      poser un **message perso** qui s'affiche **sur la carte** du module côté guilde.
- [ ] Aucune action God visible dans le journal de la guilde (verbatim 10) — vérifier **après** une action God sur un membre.
- [ ] Chaque badge de statut a un `title` + une légende accessible (verbatim 2).
- [ ] **Une seule** entrée de nav pour les logs (`/god/logs`), `?tab=security` redirigé, **aucun** placeholder ni
      carte alimentée par une colonne que personne n'écrit (verbatims 13/14, D1/D2).
- [ ] Le journal n'affiche **plus** une ligne par visite du God (A9) et chaque ligne affichée veut dire quelque chose.

## 8. Directives de design — **IMPÉRATIF** (anti-slop, alignement, interface d'admin)

> Verbatim user, 25/09 : « **aucun AI slop**, on s'aligne avec les standards actuels (landing etc.) »
> puis « je rappelle que **c'est une interface admin de gestion** ».

### 8.1 Le standard auquel on s'aligne (il existe — ne rien inventer)

| Source | Ce qu'on y prend |
|---|---|
| **Couche `.reg-*` / `.registre`** de la landing (`src/app/globals.css`, **129 règles**) | La direction retenue le 16/09 (« **montrer davantage SigilOS, montrer moins la landing** », PR #683, branche `feat/refonte-landing-anti-slop`). **Interdiction d'ouvrir une 2ᵉ direction visuelle.** |
| **Jetons sémantiques** (`bg-card`, `text-muted-foreground`, `border-border`, `bg-info/15 text-info`, `bg-warning/10`) | L'admin **client** les consomme déjà (`admin/pilotage`, modules) ; le **God** ne les consomme pas (palettes `zinc-*`/`violet-*` en dur + allowlist ESLint) → **c'est exactement l'écart à combler**. |
| **Kit God existant** `src/app/god/ui/*` (`GodCard`, `GodPanel`, `GodSectionHeader`, `GodBadge`, `GodStatCard`, `GodEmptyState`, `GodLoadingSkeleton`) | La base : on l'**étend** (`GodTable`, `GodToolbar`, `GodPagination`, `GodTabs`, `GodTooltip`) au lieu de réinventer un composant par écran. |
| **Assets** `public/assets/nav/*` (icônes de modules déjà utilisées par la navbar), `public/assets/landing/*` | Icônes des modules (verbatim 5) — **les mêmes** que côté client. |

### 8.2 Interdits = ce que le user appelle « AI slop »

| Motif banni | Remplacement |
|---|---|
| Dégradés **violet/glow** décoratifs (signature actuelle du God : `from-violet-500 to-violet-700`, halos `blur-2xl`) | `bg-card` + **un seul** accent par écran (couleur de marque ou statut) |
| `backdrop-blur-xl` sur **chaque** carte | Réservé aux surfaces flottantes (modale, popover, barre collante) |
| **Emojis dans les libellés structurants** (« 🔒 Verrouillé », « 🚀 Autonome », « 👑 VIP ») | Icône **lucide** + texte ; emoji toléré **uniquement** dans les notifications Discord |
| Vocabulaire marketing dans un écran interne (« Premium guild management », « Inspection God Mode ») | Libellé **fonctionnel** (« Fiche guilde », « Modules ») |
| Animation décorative (`animate-pulse` partout, `framer-motion` sur du contenu statique) | Aucune — au plus une transition ≤ 150 ms sur un **changement d'état** |
| Rayons et espacements improvisés (`rounded-2xl`/`rounded-3xl`/`p-5`/`p-8` au hasard) | **3 rayons max** (carte / contrôle / pastille) et une échelle d'espacement unique (4/8/12/16/24) |
| 6 à 8 tailles de police différentes | Échelle fermée (12 / 13 / 14 / 16 / 20 / 24) |
| Faux compteurs, faux pourcentages, fausses barres de progression décoratives | Un chiffre = **une requête mesurée** (sinon il n'est pas affiché) |
| Pavé d'avertissement orange qui crie (« NOTE : en tant que Super-Admin… », « ⚠️ Ce serveur n'est pas dans la whitelist ») | Information **discrète** (`bg-info/10`, `text-muted-foreground`) ou tooltip |
| Tableau à colonnes vides / cellules `-` / `AJOUTER ID` | Colonne **supprimée** si elle n'a rien à dire |

### 8.3 C'est une **interface d'administration** — règles de densité et d'efficacité

- **La donnée d'abord** : tableaux alignés, chiffres en `tabular-nums`, colonnes **triables**, pagination **numérotée**
  (pas « Page 1 / 2 »), densité constante d'un écran à l'autre.
- **Une action primaire par bloc** (le reste en `⋯`) ; toute action destructrice = **zone danger** + confirmation explicite.
- **4 états obligatoires par bloc** : vide (message + action), chargement (`GodLoadingSkeleton`), erreur (avec cause),
  refus (avec la raison). Jamais d'écran muet, jamais un message d'erreur qui ressemble à un refus de droits.
- **Responsive à 4 paliers** : 1440 (dense), 1280 (référence), 1024 (sidebar repliée), 768/390 (**tableau → cartes**).
  Aucun `overflow-x` horizontal : on repense la ligne, on ne scrolle pas.
- **FR partout** : libellés, dates (`jj/mm/aaaa` ou relatif), unités, messages d'erreur. Aucun slug technique
  (`system:god`, `MODULE_GOD_LOCK`) visible par un humain.
- **Accessibilité minimale** : `title`/`aria-label` sur les icônes seules, focus visible, contrastes ≥ 4.5:1 sur le texte.

### 8.4 Gardes mesurables (pour que ça ne re-dérive pas)

- `tests/unit/god-deslop.test.ts` (existant) : le **plafond** d'écrans God « en dur » doit **baisser** à chaque PR ;
  on y ajoute une garde « aucun emoji dans un libellé de `src/app/god/**` » et « aucune nouvelle couleur en dur hors jetons ».
- **Aucune** nouvelle entrée dans l'`allowFiles` de `sigil/no-hardcoded-colors` (une exemption sans raison = dette) ;
  objectif final : **retirer le God de l'allowlist**.
- **Recette visuelle obligatoire** : 3 captures **1440 / 1024 / 390** (avant/après) par écran refondu — zone volatile
  `temp/` (jamais versionnée, cf. `docs/agents/zone-volatile.md`), et vérification que rien ne casse en mobile.

- [ ] `npm run test:run` + `npx tsc --noEmit` + `npm run lint` verts, `git status --short` propre, plafond déslop ↓.

## 7. Protocole de reprise (pour la prochaine session)

```bash
git fetch origin dev && git switch dev && git pull            # dev contient #739 → #744
npm run test:run && npx tsc --noEmit                          # état de départ attendu : vert
```
**À lire** : ce fichier + `docs/plans/AMORCE-REFONTE-GOD-GUILDES.md` + `docs/agents/activeContext.md` (bloc
« Session 25/09/2026 (God, refonte) ») + le verbatim §0.
**Arbitrages** : **A1-A11 tranchés** le 25/09 (§3) — **aucune** décision à redemander. Attention particulière à
**A1** : le verrou est **côté guilde**, `bypassModules = isGod` **reste**.
**À ne pas relire** : les 3 audits de `temp/` (arbitrés), le mémo externe (corrigé le 25/09).
**Pièges connus** : `src/app/god/**` est allowlisté dans `sigil/no-hardcoded-colors` (le déslop ne casse pas le lint,
il n'est donc **pas** détecté) · `moduleCache` (30 s) et le cache Redis du contexte (`user:ctx:*`) peuvent masquer un
changement de verrou pendant ≤ 60 s · `next dev` qui tourne ⇒ `npm run build` délégué à la CI.
