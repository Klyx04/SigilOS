---
description: Amorce de session — exécuter la refonte God « Guildes & Users » (11 arbitrages tranchés, 7 lots, 1 lot = 1 PR vers dev)
---

# 🧭 Amorce — Refonte God « Guildes & Users » (**one shot, lot par lot**)

> **Plan de référence (source de vérité)** : `docs/plans/PLAN-REFONTE-GOD-GUILDES.md` (verbatim, glossaire, arbitrages,
> chantiers G1→G12, dette mesurée D1/D2/D3, directives anti-slop §8). **Cette amorce ne le remplace pas** : elle
> **cadre la session** et fixe l'**ordre d'exécution**.
> **Décisions** : **A1-A11 tranchés** le 25/09/2026 (réponses user) — **aucune** question à reposer.
> **Mode demandé** : « *one shot* » ⇒ enchaîner les lots **sans redemander la suite**, **1 lot = 1 branche = 1 PR → `dev`**.
> Arrêt **uniquement** si une **mesure** contredit le plan (alors : s'arrêter et le dire, cf. §5).

## 0. État d'exécution (25/09/2026, soir) — **il reste les lots 5 → 6**

> 🟢 **Lots 0 · 1 · 2 · 3 · 4 livrés, mergés dans `dev`, CI verte** (le détail mesuré est dans
> `docs/agents/activeContext.md`, bloc « Session 25/09/2026 (God, refonte — exécution) »).
> 👉 **Pour reprendre : le bloc §6 suffit** (il porte l'état + les 2 lots restants, tel quel).
>
> | Lot | Branche | PR | Écarts au plan (à connaître avant de coder le lot 4) |
> |---|---|---|---|
> | **0** — le mort d'abord | `feat/god-lot0-mort` | **#747** | conforme au plan ; plafond du test de déslop **90 → 85** |
> | **1** — le verrou atteint la carte de la guilde | `feat/god-lot1-verrou` | **#748** | Core **`src/server/platform-module-state.ts`** (lecture **tolérante** `PlatformConfig.disabledModules`/`moduleNotices`, cache 30 s) au lieu d'un cache local à `module-actions` ; **`getGuildModuleConfig`** (toggles **bruts** + états effectifs issus d'**une** lecture) ; **`isModuleLocked`** (garde de page « verrou », distincte du toggle) ; **2 correctifs mesurés** : le mini-jeu était gardé par le module `worldmap`, et 8 pages ne laissaient pas entrer le God |
> | **2** — vue God « Modules » + verrou plateforme | `feat/god-lot2-modules` | **#749** | Les 2 actions vivent dans **`src/server/actions/module-actions.ts`** (pas de `god-module-actions.ts`) ; la vue est un **onglet** `/god?tab=modules` (pas de route `/god/modules`) ; message borné à **200** (`MODULE_NOTICE_MAX_LENGTH`, Zod **refuse** au-delà) ; plafond déslop **85 → 86** (1 surface God neuve) ; migration appliquée en local par SQL + `migrate resolve` (historique local déjà dérivé ⇒ `migrate dev` inutilisable) |
> | **3** — les logs, une seule porte | `feat/god-logs-unifies` | — | Règles **pures** dans **`src/lib/audit-log-view.ts`** (période, pagination, jours UTC) ; kit **`GodPagination`** ; le journal de guilde est **refusé aux sous-gods** (`isAdmin` exigé dans `getGlobalAuditLogs` dès qu'un `guildConfigId` est fourni) ; `GodAccessLog` exposé **sans relation Prisma** (donc **aucune migration**) ; plafond déslop **86 → 85** (2 orphelins mesurés supprimés, `user-list.tsx` **conservé** car cité par le lot 5) |
> | **4** — le God voit tout | `fix/god-lecture-god` | — | La fiche guilde lit par `isSuperAdmin()` ; la **pagination** du mode God passe par `/api/god/audit-logs` (`AuditLogsClient` → `godGuildConfigId`) ; le routage God/guildes est posé **dans `createAuditLog`** (pas par écran) — un super-admin *admin de la guilde* garde le journal de guilde, un appel **sans session** (bot/cron) n'est jamais routé vers le journal God |

>
> **Leçons mesurées à ne pas rejouer** :
> 1. **Créer la branche de chaque lot depuis `dev` APRÈS le merge du précédent** (`git fetch origin dev && git merge origin/dev` avant d'ouvrir la PR) : le lot 2, branché avant le merge du lot 1, embarquait la PR #748.
> 2. **Conflit de docs à chaque merge** (les 7 lots touchent le **même** bloc de session) ⇒ résoudre en gardant la version **superset** (celle de la branche), jamais en recopiant à la main.
> 3. **`gh pr create --body "…"` casse sous PowerShell** (le backtick est un caractère d'échappement) ⇒ écrire le corps dans un fichier **hors dépôt** + `--body-file`.
> 4. **Le payload d'écriture des modules = les toggles BRUTS** : envoyer l'état *effectif* fait échouer l'enregistrement de **tous** les autres modules (bug mesuré, corrigé au lot 1).
> 5. **Ne jamais confondre** `isModuleEnabled` (**toggle ∪ verrou**, sémantique de navigation) et `isModuleLocked` (**verrou seul**, garde d'URL).
> 6. **Sonde sur la base réelle** : vitest **n'expose pas** `DATABASE_URL` ⇒ l'exporter dans la commande (jamais dans un fichier du dépôt) ; remettre un champ `Json?` à `NULL` via Prisma exige `Prisma.DbNull`.
> 7. **CI `Verify & Build` ≈ 8-9 min par lot** : poller `gh pr checks <n>` jusqu'au vert avant de merger (le build est **délégué à la CI** si `next dev` tourne — le dire, ne pas prétendre l'avoir joué).

## 1. Brief

| Champ | Valeur |
|---|---|
| **Type** | ♻️ refonte UI/UX + ✨ features (vue God Modules, message de maintenance) + 🐞 correctifs (G7, A4/A5) |
| **Périmètre** | console **God** (`/god/**`) **et** les surfaces **clientes** qui consomment les modules : `/dashboard/[guildId]/admin/pilotage`, `/dashboard/[guildId]/admin/modules`, la **navbar** (`src/components/layout/app-sidebar.tsx`), le **bot** (`internalCheckPermission`) |
| **Objectif** | Rendre la console God **crédible et utilisable** : le verrou d'un module **éteint réellement le module pour la guilde** (carte grisée, navbar, URL, bot), le God peut **couper un module pour toute la plateforme** avec un **message perso**, **un seul écran de logs** au lieu de deux, et **zéro doublon mort** |
| **Constats** | ① 11 arbitrages tranchés (§2) · ② 3 dettes **mesurées** (D1/D2/D3, §4bis du plan) · ③ le journal God est noyé à **72 %** par des lignes de visite |
| **DoD** | §6 du plan (recette globale) — en particulier : verrou ⇒ carte **grisée** + toggle **inerte** + **refus serveur** + navbar masquée + URL rebouchée + bot refusé ; God ⇒ **verrou global** + **message perso** sur la carte ; **une seule** entrée de nav pour les logs |
| **Hors périmètre** | Tickets, Marché, SEO, données de jeu (chantiers séparés) · refonte visuelle des écrans **non listés** dans les lots · toute réécriture du **toggle de guilde** (il est conservé tel quel) |
| **Entrées** | Captures du 25/09 (`/god?tab=security`, `/god/logs`) · mesures SQL locales (§4bis) · ce fichier + le plan |
| **Risque** | **1 migration additive** (lot 2 : `PlatformConfig`) · écritures God (Zod + rate-limit + garde d'état + `createGodAuditLog`) · le verrou est un **mécanisme de sécurité** ⇒ fail-closed partout |
| **Docs concernées** | `docs/ROADMAP.md` · `docs/agents/activeContext.md` · `docs/plans/PLAN-REFONTE-GOD-GUILDES.md` · `docs/MAINTENANCE.md` si un libellé de cron/rétention change |

## 2. Les 11 décisions (rappel — **ne pas réinterpréter**, surtout A1)

| # | Décision (résumé exécutable) |
|---|---|
| **A1** | **Le verrou est côté GUILDE, pas côté God.** Verrou posé ⇒ carte **grisée** (pilotage + modules), toggle **inerte** + **refus serveur**, module déjà actif ⇒ **OFF effectif** (toggle **conservé** en BDD), **absent de la navbar**, URL **rebouchée**, **bot refusé**. ⚠️ `bypassModules = isGod` **reste** : ne pas « corriger » ce bypass |
| **A2** | **Message « indisponible » affiché sur la carte du module** (texte libre du God) **+ nouvelle vue God « Modules »** listant tous les modules/features, avec **désactivation globale** (toutes guildes) et **message perso** |
| **A3** | Trois niveaux **distincts**, jamais confondus, mot « staff » **banni** : ① verrou plateforme → « Indisponible — maintenance » ; ② verrou de guilde → idem ; ③ toggle de la guilde → « Désactivé par ta guilde » |
| **A4** | Les actions God **ne laissent aucune trace** dans le journal de la guilde (`isGodLog: true`, sans `guildId`) **+ test** de non-régression |
| **A5** | Le God lit **toujours** (`isSuperAdmin()` ⇒ lecture accordée) ; « erreur de chargement » ≠ « accès refusé » |
| **A6** | **1 action primaire par bloc** sur la tour de contrôle, le reste en `⋯`, destructif en **zone danger** |
| **A7** | **Supprimer** la carte « Comptes (Plateforme) » (faux positif mesuré : aucun écrivain) |
| **A8** | **« Des choses simples, marre des doublons »** ⇒ supprimer `LifecycleServer`, `LifecyclePanel`, `GhostRadarPanel`, `JanitorButton` |
| **A9** | **Une seule trace** : `GodSessionLog` reste, `GOD_DASHBOARD_ACCESS` ne crée **plus** une ligne par visite (compteur agrégé) |
| **A10** | **Exposer** `GodAccessLog` dans `/god/logs` (onglet « Accès délégués ») : écrit, jamais lu aujourd'hui |
| **A11** | Onglet « **Journal de guilde** » dans `/god/logs` : **lecture seule**, filtrable par guilde, **aucune** action God dedans |

## 3. Ordre d'exécution — **7 lots, 1 lot = 1 branche = 1 PR → `dev`**

> Règle : **on merge un lot avant d'ouvrir le suivant** (mais on n'attend pas de feu vert : le user a demandé le
> one shot). **Lots 0-2 livrés** (#747 `feat/god-lot0-mort`, #748 `feat/god-lot1-verrou`, #749 `feat/god-lot2-modules`).
> Branches utilisées pour la reprise : `feat/god-logs-unifies`, `fix/god-lecture-god`, `refactor/god-ux-produit`,
> `refactor/god-deslop`.

### Lot 0 — **Le mort d'abord** (A7 · A8) — zéro risque — ✅ **livré** (PR #747)
- **Supprimer** (après `git grep -n "<nom-de-fichier>"` obligatoire) :
  `src/app/god/components/lifecycle-panel.tsx` · `src/app/god/components/ghost-radar-panel.tsx` ·
  `src/app/god/janitor-button.tsx` · `src/components/admin/deletion-pending-panel.tsx` ·
  l'action `getPendingDeletionUsers()` (`src/server/actions/super-admin-actions.ts:1146`).
- **`src/app/god/page.tsx`** : retirer `LifecycleServer` (`:573`), les imports `JanitorButton` (`:37`),
  `GhostRadarPanel` (`:40`), `DeletionPendingPanel` (`:49`) ; le bloc `tab === "security"` (`:296-324`) ne garde que
  `GlobalLogsServer` (le journal de sécurité **filtré en base**) — l'unification complète arrive au **lot 3**.
- **Doc** : `docs/MAINTENANCE.md` si le Janitor est cité comme purge des comptes (il ne l'est pas) ; rien d'autre.
- **Preuve** : capture de `/god?tab=security` **sans** les deux cartes mortes · `npm run test:run` vert ·
  `tests/unit/god-deslop.test.ts` (le plafond **baisse** : 4 fichiers en moins).

### Lot 1 — **G8 : le verrou éteint vraiment le module pour la guilde** (A1) — ✅ **livré** (PR #748)
- **`src/lib/module-lock.ts`** (règle pure, une seule source) : `resolveModuleState(modules, { guildLocks,
  platformLocks, platformNotices }) → { enabled, lockedBy: "platform" | "guild" | null, notice: string | null }` ;
  conserver `applyGodLocks`/`normalizeGodLocks` (compat + tests existants). `admin` **jamais** verrouillable.
- **`src/server/actions/module-actions.ts`** : `getGuildModules` applique **guilde ∪ plateforme** (lecture unique du
  `PlatformConfig` via un cache `platformLocksCache`, TTL **30 s**, aligné sur `moduleCache`) ;
  `updateGuildModules` refuse aussi un module verrouillé **côté plateforme** (message sans le mot « staff »).
- **`src/server/actions/user-actions.ts`** : `bypassModules = isGod` **CONSERVÉ** (A1) ; le reste consomme la
  résolution unique.
- **`src/app/dashboard/[guildId]/admin/modules/_components/modules-client.tsx`** : carte **grisée** (style désactivé),
  toggle **inerte**, badge « **Indisponible — maintenance** » + **message perso** (le texte vient du lot 2, prévoir la
  prop maintenant) ; le texte « Verrouillé par le staff » **disparaît**.
- **`src/components/layout/app-sidebar.tsx`** : vérifier que le masquage vient de `getGuildModules` (donc du verrou
  global **et** de guilde) — **aucun** lien mort.
- **`services/discord-bot/index.ts`** (`internalCheckPermission`) : consomme la même résolution (guilde ∪ plateforme).
- **URL directe** : la page du module doit **reboucler** vers `/dashboard/[guildId]` (vérifier chaque page gardée par
  `!isSuperAdmin && !isModuleEnabled(...)` — la liste est dérivée du registre des modules).
- **Tests** (`tests/unit/module-lock.test.ts`) : *module actif + verrou ⇒ `enabled: false`, `lockedBy` correct* ;
  *verrou plateforme ∪ verrou guilde* ; *`admin` jamais verrouillable* ; *`updateGuildModules` refuse*.
- **Preuve** : capture **avant/après** (1440 + 390) de `/admin/pilotage?tab=modules` avec un module verrouillé +
  module actif ⇒ OFF ; `isModuleEnabled` false mesuré.

### Lot 2 — **G12 : vue God « Modules » + verrou global + message perso** (A2/A3) — **1 migration additive** — ✅ **livré** (PR #749)
- **Schéma** : `PlatformConfig` → `disabledModules String[] @default([])`, `moduleNotices Json?`,
  `disabledModulesUpdatedAt DateTime?`, `disabledModulesUpdatedBy String?`. Migration **additive** avec
  `ADD COLUMN IF NOT EXISTS` (règle de la PR #614) ; `npx prisma generate` ; même esprit que
  `docs/agents/prisma-schema-change.md` (jamais de `db push`).
- **`src/lib/module-lock.ts`** : `PLATFORM_LOCKABLE_MODULES` (**dérivée** du registre, `admin` exclu) +
  `normalizePlatformLocks` + `normalizePlatformNotices` (message borné, clés valides uniquement).
- **Serveur** : `src/server/actions/god-module-actions.ts` (**nouveau**, `"use server"`) :
  `getPlatformModuleState()` (super-admin, lecture) et `setPlatformModuleLock({ moduleKey, disabled, notice })`
  — **super-admin only**, **Zod borné** (notice ≤ 280, `moduleKey` du registre), **rate limit**, **garde d'état**
  dans le `WHERE`, `createGodAuditLog({ action: "GOD_MODULE_LOCK", ... })`, invalidation du cache plateforme.
- **UI God** : `src/app/god/modules/page.tsx` + `_components/god-modules-panel.tsx` **avec le kit `src/app/god/ui`**
  (`GodCard`/`GodPanel`/`GodBadge`/`GodEmptyState`/`GodLoadingSkeleton`) — **pas** de nouvelle recette visuelle ;
  une carte par module : état (actif / verrouillé plateforme / verrouillé par N guildes), action **1 primaire**
  (verrou global) + champ **message**, et compteur de guildes affectées.
- **Nav** : `god-nav-config.ts` (`{ id: "modules", name: "Modules", group: "supervision", scope: "all", brickId:
  "modules" }`) + `god-bricks.ts` (`{ id: "modules", label: "Modules & maintenance", group: "supervision",
  subGodAccess: false }`) + `TAB_TO_BRICK` si la vue passe par un onglet de `/god`.
- **Preuve** : capture **avant/après** guilde (carte grisée + message affiché) · `EXPLAIN`/compteur : **0** guilde
  avec accès ; au déverrouillage, l'état antérieur revient **intact** (vérifier en base que le toggle guilde n'a
  **pas** été écrasé).

### Lot 3 — **G11 : les logs, une seule porte** (A9 · A10 · A11 · G6) — ✅ **livré** (`feat/god-logs-unifies`)
- **Nav** : supprimer l'entrée `security` de `god-nav-config.ts` (garder **une** entrée « Sécurité & Logs » →
  `/god/logs`) ; `?tab=security` fait un `redirect("/god/logs?tab=...")` (**les liens existants ne cassent pas**).
- **`src/app/god/logs/logs-tabs.tsx` → 5 onglets** : **Journal plateforme** · **Journal de guilde** (A11, lecture
  seule, filtre guilde) · **Accès refusés** (`AccessAttempt`, existant) · **Audit du Marché** (existant) ·
  **Accès délégués** (A10, nouveau — lecture `GodAccessLog`, actuellement écrite et **jamais lue**).
- **A9** : localiser l'écriture `GOD_DASHBOARD_ACCESS` et **arrêter** la ligne par visite (la session `GodSessionLog`
  reste la source) ; afficher un **compteur** d'accès God agrégé par jour. Mesurer **avant/après** : nombre de lignes
  par jour (`AuditLog` filtré sur cette action) — attendu : **−72 %**.
- **G6** : pagination **numérotée** + « par page », presets de période (24 h / 7 j / 30 j / 90 j), filtres **en base**,
  regroupement par jour, compteur par famille.
- **Briques** : `god-bricks.ts` (`security` **fusionnée** dans `logs`, les deux restent `subGodAccess: false`) ;
  `TAB_TO_BRICK` si besoin.
- **Preuve** : avant/après du volume affiché et du nombre de lignes de journal/jour ; une seule entrée de nav.

### Lot 4 — **Le God voit tout** (G7 · A4 · A5) — ✅ **livré** (`fix/god-lecture-god`)
- `src/app/god/guilds/[id]/page.tsx` + `god-guild-tabs.tsx` : la lecture s'appuie sur `isSuperAdmin()`
  (**jamais** sur `getUserContext(...).canViewAuditLogs`) ; **« erreur de chargement »** et **« accès refusé »** sont
  deux messages **distincts**.
- **A4** : test unitaire qui vérifie qu'une action God sur un membre **ne crée pas** de ligne dans le journal de la
  guilde (`isGodLog: true`, sans `guildId`).
- **Preuve** : capture d'une fiche guilde par un God — **2 onglets lisibles, zéro message d'accès**.

### Lot 5 — **Langage, tour de contrôle, roster, RBAC, users** (G1 · G2 · G3 · G5 · G9) — ⏭️ **à faire** (bloc §6)
- Glossaire **dans l'UI** (légende dépliable + `title` sur chaque badge) · tour de contrôle **1 action primaire par
  bloc** · roster : **colonnes utiles**, actions visibles, tableau → cartes en mobile · RBAC : **libellés humains**
  depuis `src/lib/permissions.ts` (**plus aucun slug brut**) · `/god/users` même langage.
- **Preuve** : captures 1440 / 1024 / 390 **avant/après** par écran.

### Lot 6 — **Déslop God par lots** (G10) — ⏭️ **à faire** (bloc §6)
- Jetons sémantiques (`bg-card`, `text-muted-foreground`, `border-border`…), kit `src/app/god/ui` **étendu**
  (`GodTable`, `GodToolbar`, `GodPagination`, `GodTabs`) — **jamais** une nouvelle recette.
- Bannir : dégradés violet/glow, `backdrop-blur-xl` généralisé, emojis dans les libellés, `animate-pulse` décoratif,
  rayons/tailles improvisés. Le plafond de `tests/unit/god-deslop.test.ts` **baisse à chaque PR** ;
  objectif final : **retirer le God de l'allowlist** de `sigil/no-hardcoded-colors`.

## 4. Les 6 pièges mesurés à ne pas rejouer

1. **`bypassModules = isGod` n'est pas un bug** (A1) : le God garde l'accès. Le verrou est **côté guilde**.
2. **Ne pas écrire `modules.x = false` en BDD** : le toggle de la guilde doit être **conservé** (le verrou s'applique
   à la **lecture**). L'écrire = perte silencieuse de la configuration au déverrouillage.
3. **Cache** : `moduleCache` (mémoire, **30 s**) et le cache Redis du contexte (`user:ctx:*`, jusqu'à **60 s**) peuvent
   masquer un changement de verrou pendant ≤ 1 min — le **documenter** et invalider ce qui peut l'être.
4. **`?tab=security`** : ne pas supprimer la route sans **redirection** (des liens existent, dont le menu God).
5. **`next dev` qui tourne** ⇒ `npm run build` est **délégué à la CI** : le dire dans le rapport, ne pas prétendre
   l'avoir joué.
6. **Windows/PowerShell** : `[...]` est un joker (`-LiteralPath` obligatoire), `git grep -n "<fichier>"` **avant**
   toute suppression/renommage, jamais d'écriture de fichier avec `>` (UTF-16 corrompu — utiliser l'éditeur).

## 5. Méthode, sécurité et vérifs (non négociable)

- **Mesurer avant de corriger** (sonde `_probe-*.mjs` en zone volatile, requête SQL **en lecture seule**, `curl`),
  écrire la **mesure**, jamais « ça devait être ». Corriger au bon étage : **règle pure `src/lib/**` > serveur
  `src/server/**` > composant**, **une seule source** par règle.
- **Sécurité** : auth sur chaque action (`auth()`/`isSuperAdmin()`) · isolation par `guildId` **interne** · RBAC
  **fail-closed** page **et** action · **Zod borné** · **rate limit** (429) · **garde d'état dans le `WHERE`** ·
  `logger` (jamais `console.log`) · `src/proxy.ts` (jamais `middleware.ts`) · **1 migration additive et idempotente**
  (lot 2) · **aucun** secret en dur.
- **Arrêt immédiat + question** si : une mesure contredit le plan, une migration s'avère **non additive**, une
  interface **publique** Discord change, ou une **suppression de données** devient nécessaire.
- **Fin de chaque lot** : `npm run test:run` · `npx tsc --noEmit` · `npm run lint` · `git status --short` **propre**
  (aucun artefact : sonde, capture, `temp/` reste **gitignoré**) · `gh pr checks` **vert** · merge · branche
  supprimée · `dev` repullé · `docs/ROADMAP.md` + `docs/agents/activeContext.md` mis à jour · rapport **≤ 15 lignes**.

## 6. Bloc à coller — **reprise : lots 3 → 6** (prompt de session)

> Copier **tel quel** dans un nouveau chat. `AGENTS.md` est chargé automatiquement ; ce bloc **porte l'état réel**
> (lots 0-4 déjà livrés) et **le chantier des 2 lots restants** — aucune question à poser.

```
CONTEXTE — projet SigilOS (Next 16 App Router, React 19, Prisma 7/PostgreSQL, Redis, bot Discord, BullMQ).
Lis d'abord : docs/plans/AMORCE-REFONTE-GOD-GUILDES.md (**§0 = état d'exécution**, §2 = arbitrages, §3 = ordre des lots) et
docs/plans/PLAN-REFONTE-GOD-GUILDES.md (plan vivant : verbatim user, arbitrages, chantiers G1→G12, dette mesurée
D1/D2/D3, directives anti-slop §8). Compléments : docs/ROADMAP.md, docs/agents/activeContext.md (en-tête + bloc
« Session 25/09/2026 (God, refonte — exécution) »), docs/RULES.md (§ Security), docs/SECURITY.md,
docs/agents/{git-push,prisma-schema-change}.md. Vérifie le code : la doc peut être en retard d'une PR.

ÉTAT — les lots 0, 1 et 2 sont **LIVRÉS et mergés dans dev** (PR #747 / #748 / #749, CI verte) : plus aucun doublon
mort dans l'onglet Sécurité ; le verrou d'un module éteint **vraiment** le module pour la guilde (carte grisée, toggle
inerte + refus serveur, navbar, URL rebouchée, bot refusé) ; le God peut couper un module pour **toutes** les guildes
avec un message perso (onglet /god?tab=modules, colonnes additives PlatformConfig.disabledModules/moduleNotices).
⚠️ Ne pas rejouer A1 : `bypassModules = isGod` RESTE (ce n'est pas un bug). Le mot « staff » est banni de l'interface.
Le reste = les lots 3 → 6 ci-dessous. Les écarts réels au plan et les leçons mesurées sont en tête de l'amorce (§0).

CHANTIER — exécute les **2 lots restants**, dans l'ordre, en ONE SHOT : 1 lot = 1 branche = 1 PR vers dev, branche
créée depuis `dev` **après** le merge du lot précédent. Applique littéralement les arbitrages A1-A11 (§2/§3 du plan).
- ✅ LOT 3 — G11 « les logs, une seule porte » (A9 · A10 · A11 · G6) : **LIVRÉ** (`feat/god-logs-unifies`) — entrée de
  nav `security` supprimée (redirection vers `/god/logs`), 5 onglets (dont « Journal de guilde » en lecture seule et
  « Accès délégués » = `GodAccessLog`), ligne `GOD_DASHBOARD_ACCESS` par visite **arrêtée** (compteur agrégé par jour
  issu de `GodSessionLog`), pagination numérotée + presets de période + filtres en base + regroupement par jour.
- ✅ LOT 4 — G7 « le God voit tout » (A4 · A5) : **LIVRÉ** (`fix/god-lecture-god`) — la fiche guilde lit le journal par
  `isSuperAdmin()` (`getGlobalAuditLogs({ guildConfigId, scope: "guild" })`, pagination `/api/god/audit-logs`) ;
  « erreur de chargement » ≠ « accès refusé » (le refus n'est jamais montré à un God) ; `createAuditLog` route **en un
  seul endroit** : super-admin sans autorité dans la guilde ⇒ journal God (`isGodLog: true`, sans `guildId`), jamais le
  journal de la guilde (bot/cron inchangés).
- LOT 5 — G1 · G2 · G3 · G5 · G9 : glossaire **dans l'UI** (légende dépliable + `title` sur chaque badge) ; tour de
  contrôle « **1 action primaire par bloc** », le reste en `⋯`, destructif en zone danger ; roster lisible (colonnes
  utiles, actions visibles, tableau → **cartes en mobile**) ; RBAC avec les **libellés humains** de
  `src/lib/permissions.ts` (plus aucun slug brut) ; `/god/users` aligné sur le même langage.
- LOT 6 — G10 déslop God **par lots** : jetons sémantiques (`bg-card`, `text-muted-foreground`, `border-border`…), kit
  `src/app/god/ui` **étendu** (`GodTable`, `GodToolbar`, `GodPagination`, `GodTabs`) — **jamais** une nouvelle recette ;
  bannir dégradés violet/glow, `backdrop-blur-xl` généralisé, emojis dans les libellés, `animate-pulse` décoratif ; le
  plafond de `tests/unit/god-deslop.test.ts` **BAISSE** à chaque PR — objectif final : **retirer le God de l'allowlist**
  `sigil/no-hardcoded-colors`.

MÉTHODE — 1) mesure la cause racine AVANT de corriger (sonde _probe-*.mjs, requête SQL en lecture seule, curl, logs)
et écris la mesure ; 2) corrige au bon étage : règle pure src/lib/** > serveur src/server/** > composant, UNE seule
source de vérité par règle ; 3) test unitaire du comportement + non-régression des tests existants ; 4) preuve :
capture avant/après (1440/1024/390) ou mesure chiffrée ; 5) 1 lot = 1 branche = 1 PR vers dev (jamais de push sur
main/dev) ; 6) pas de scope creep (note les idées en « reste ») ; 7) STOP et demande-moi si une mesure contredit le
plan, si une migration n'est pas additive, si une interface publique Discord change, ou si une suppression de données
devient nécessaire.

SÉCURITÉ (non négociable) — auth sur CHAQUE action (auth()/isSuperAdmin()) · isolation par guildId INTERNE (jamais un
snowflake venant du client) · RBAC + isSuperAdmin() fail-closed (page ET action) + audit · Zod borné sur toute entrée
utilisateur ET sur les données d'API externe · fail-closed si Discord/Redis échoue · secrets process.env sans fallback
· comparaison timingSafeEqual · logger (jamais console.log) · rate limit sur les mutations (429 propre) · garde d'état
DANS le WHERE · src/proxy.ts (jamais middleware.ts) · **aucune migration dans ces 4 lots** (les colonnes du lot 2 sont
déjà en base ; si un besoin apparaît : additive et idempotente, et STOP avant) · aucun secret en dur.

VÉRIFS par lot — npm run test:run · npx tsc --noEmit · npm run lint · git status --short propre (aucun artefact de la
tâche : sonde, capture, dump) · gh pr checks jusqu'au vert · merge · branche supprimée · dev repullé ·
docs/ROADMAP.md + docs/agents/activeContext.md mis à jour. Si `next dev` tourne, le build est délégué à la CI : dis-le
(ne prétends pas l'avoir joué).

LIVRABLE — commits en français (feat/fix/refactor(god): …) · les 4 PR mergées et CI verte · rapport final ≤ 15 lignes :
fait / reste / ops côté user.
```



