# 🔭 God — télémétrie lisible + vue d'ensemble allégée

> **Statut** : cadré le 16/11/2026, **aucun code écrit**. **Ordre** : `docs/ROADMAP.md` §2 bis,
> lots B (`god-telemetrie`) puis C (`god-overview`). Mesures faites dans l'arbre, pas à l'écran.

## 1. Mesures (16/11/2026)

### 1.1 Le filtre par guilde ne peut pas fonctionner

- Le sélecteur expose **l'id interne** : `availableGuilds = guildConfigs.map(g => ({ id: g.id, … }))`
  (`src/server/actions/telemetry-actions.ts:393`) et l'option vaut `g.id` (`telemetry-dashboard.tsx:164-166`).
- Les événements enregistrent **le segment d'URL** : `guildId: params.guildId`
  (`src/components/telemetry/telemetry-tracker.tsx:26,47`). L'URL observée est
  `/dashboard/<snowflake>/admin…` : c'est un **snowflake Discord**, pas le CUID interne.
- La lecture filtre pourtant `{ guildId: filterGuildId }` (`telemetry-actions.ts:66`) ⇒ **0 ligne**
  dès qu'une guilde est choisie. Le mapping d'affichage, lui, gère les deux espaces
  (`telemetry-actions.ts:159-163`), d'où l'illusion que « seule la recherche marche ».

### 1.2 Le chemin est complet en base, tronqué à l'écran

- `truncate max-w-[320px]` sur le chemin (`telemetry-dashboard.tsx:344,348-349`) et
  `truncate max-w-[250px]` sur le nom (l. 314). La valeur stockée est **le chemin réel**, pas un motif.
- Aucun lien vers la page, aucun bouton de copie, aucune mise en évidence des pages **admin**.

### 1.3 Détails manquants ou périmés

- L'écran affiche `details.userAgent` (`telemetry-dashboard.tsx:362-365`) alors que le tracker ne
  l'envoie **plus** (zéro empreinte : `telemetry-tracker.tsx:5-6,44`) : seules les vieilles lignes en
  ont, donc un champ qui ne décrit plus le présent (et une empreinte qui n'a plus à être montrée).
- Pas de surface (Admin / Membre / God / Public), pas de filtre par type, pas de pagination :
  le flux est plafonné à 100 événements (`telemetry-actions.ts:118-120`) et filtré **côté client**
  (`telemetry-dashboard.tsx:128-137`).
- `details.language` est envoyé mais jamais affiché.

### 1.4 La vue d'ensemble est lente, mesures à l'appui

- `getPlatformActivityStats()` charge **tous les `User`** et **tous les `AuditLog`** des 30 derniers
  jours en mémoire, puis boucle en JS (`super-admin-actions.ts:1003-1046`). C'est la section
  « Activité de la plateforme » — supprimable sans perte d'information unique.
- `getPlatformStats()` = **10 `count()`** (`super-admin-actions.ts:578-614`), repoussés toutes les
  **5 s** par onglet God ouvert via le flux SSE (`src/app/api/god/stats/stream/route.ts:15,34`) :
  **172 800 requêtes de comptage par jour et par onglet** laissé ouvert.
- Slop mesuré (motifs `font-black`, `uppercase`, `rounded-[2.5rem]`, `rounded-3xl`, `animate-pulse`,
  `backdrop-blur`, palettes `zinc/emerald/teal/indigo/rose/violet/amber`, `shadow-2xl`, `italic`) :
  `page.tsx` **56**, `announcement-panel.tsx` **102**, `worker-tester.tsx` **40**,
  `system-health-dashboard.tsx` **3**, `telemetry-dashboard.tsx` **72**, `overview-tabs.tsx` **1**.

## 2. Décisions user (verbatim, 16/11/2026)

- Chemin **complet**, non raccourci, avec plus de détails sur **qui va où**, surtout côté **admin**.
- Les **filtres par guilde doivent marcher** (« rien ne marche là dedans »).
- Virer **« Indicateurs plateforme »** et **« Activité de la plateforme »** (inutile, mange les perfs).
- Revoir le **bandeau Dashboard**, **Worker Sync & Diagnostic** et **Broadcast Discord**.
- **Toute la page** en UI/UX, pas un correctif ponctuel.

## 3. Lot B — écran `?tab=telemetry`

### B1 — Filtre guilde (règle pure + test, fail-closed)

`src/lib/telemetry/guild-scope.ts` (à créer) :

```ts
export type TelemetryGuildScope =
  | { kind: "all" }
  | { kind: "none"; ids: string[] }   // sélection inconnue ⇒ aucun résultat
  | { kind: "guild"; ids: string[] }; // [id interne, snowflake] dédupliqués

export function resolveTelemetryGuildScope(
  selectedId: string | null,
  guilds: ReadonlyArray<{ id: string; discordGuildId: string | null }>,
): TelemetryGuildScope;
```

- Le serveur **résout** l'id sélectionné dans `GuildConfig` (jamais un `where` sur une valeur brute
  du client) et filtre `{ guildId: { in: ids } }`.
- `none` ⇒ l'action renvoie un résultat vide **sans requête** (fail-closed).
- L'option garde `value = g.id` ; le libellé affiche `name` + snowflake court. « Toutes les guildes »
  reste la valeur par défaut.

### B2 — Chemin complet et cliquable

- Retirer `truncate`/`max-w` du chemin : `break-all`, `font-mono`, retour à la ligne autorisé.
- Lien si le chemin commence par `/` et n'est ni `/api` ni une route God ; sinon texte + copie.
- `title` complet, bouton « Copier » accessible (`aria-label`), badge de surface.

### B3 — Détails, filtres et pagination

- `classifyTelemetrySurface(path)` pure (`src/lib/telemetry/surface.ts`, à créer) :
  `ADMIN` (`/dashboard/:id/admin…`), `MEMBER` (`/dashboard/:id…`), `GOD` (`/god…`), `PUBLIC`.
- Filtres : **guilde** (B1), **surface**, **type** (`PAGE_VIEW`/`INTERACTION`), **recherche**
  (membre, chemin complet, `elementId`, guilde). Les filtres passent **côté serveur**.
- Nouvelle action `getTelemetryLiveEvents({ guildId, surface, eventType, query, cursor, limit })` :
  super-admin, Zod borné (`limit ≤ 200`), pagination par cursor. Le flux ne recharge plus la grappe
  d'agrégats à chaque frappe ; le direct et l'agrégat sont séparés.
- Chaque ligne : chemin complet, guilde, surface, type, `elementId`, date + heure exactes,
  membre, langue. Pour l'admin : tableau « pages admin les plus visitées (7 j) » (groupBy `path`,
  normalisation par `normalizePathPattern`, compteur + membres distincts).

### B4 — Déslop et correction d'affichage

- `telemetry-dashboard.tsx` : tokens uniquement, rayons ≤ 12 px, plus de `font-black`/uppercase,
  palettes en dur, `animate-pulse`, `rounded-2xl/3xl` ; recherche, onglets et état vide tokenisés.
- **Supprimer l'affichage `userAgent`** (périmé + empreinte) et montrer `details.language` avec
  garde `typeof details === "object"`.
- Le flux devient lisible à 390 px : le chemin occupe sa propre ligne, actions repliées.

### B5 — Perf de l'écran

- Un seul chargement d'agrégats ; le rafraîchissement ne touche que le flux (action B3).
- Vérifier le coût de la requête horaire 24 h (`telemetry-actions.ts:276-279`) : elle charge toutes
  les lignes de la fenêtre. Si la mesure le justifie, borner par lot ou espacer le rafraîchissement.
- Preuve : nombre de lignes lues et durée de l'action avant/après, consignés dans la PR.

## 4. Lot C — vue d'ensemble `?tab=overview`

### C1 — Retirer les deux sections et le code mort associé

- `OverviewTabs` (`overview-tabs.tsx`) : supprimer les sections « Indicateurs plateforme » (l. 26-32)
  et « Activité de la plateforme » (l. 34-45), leurs props `stats`/`chart`, les titres et les
  `Suspense` correspondants dans `page.tsx` (l. 238-260).
- Supprimer `LiveStatsServer`/`ActivityChartServer` (`page.tsx:433-447`),
  `src/app/god/components/live-stats.tsx`, `src/app/god/activity-chart.tsx`,
  `getPlatformStats` et `getPlatformActivityStats` (`super-admin-actions.ts:578-633` et `1003-1055`),
  le flux `src/app/api/god/stats/stream/route.ts`, `src/lib/god-live-stats.ts` et son test
  `tests/unit/god-live-stats.test.ts`.
- Vérifié : ces exports n'ont **aucun autre consommateur** (grep 16/11) ; la suppression du test suit
  celle du module, ce n'est pas un verdissement (le sujet n'existe plus).
- `SystemHealthDashboard` reste : c'est la seule information de santé, et elle évite deux lectures
  massives.

### C2 — Bandeau Dashboard

- L'en-tête `Command Center` (`page.tsx:213-236`) devient un bandeau compact en français :
  « Pilotage », phrase courte, horodatage de dernière lecture, lien « Journaux ». Plus de
  `text-7xl`, d'icône bleue, de `font-black`/uppercase ni de spinner `animate-pulse` du fallback.
- Cible : **0 motif** de slop sur la zone overview ; le fichier porte d'autres onglets (OCR, mini-jeux),
  donc le plafond **global** de `god-deslop.test.ts` est abaissé au **résidu mesuré**, pas à 0.

### C3 — Communication et outils

- `AnnouncementPanel` (`announcement-panel.tsx`, **102 motifs**) : deux cartes distinctes
  « Bandeau du dashboard » et « Broadcast Discord », tokens du kit God, `rounded-xl`, statut
  lisible, boutons et libellés métier **inchangés**. 0 motif.
- `WorkerTester` (**40 motifs**) : carte compacte « Synchronisation & diagnostic », tokens, 0 motif.
- Aucune server action modifiée : habillage et structure seulement (RULES § UI).

### C4 — Santé des services

- `SystemHealthDashboard` (412 l., polling 30 s, 3 motifs) : tokeniser les 3 restes, rendre la
  grille lisible à 390 px, et **mettre le polling en pause quand l'onglet est masqué**
  (`document.visibilityState`) pour ne pas interroger l'infra en arrière-plan.

### C5 — Nouvelle composition (desktop)

1. Bandeau compact.
2. Santé des services, pleine largeur.
3. Deux colonnes : Annonces + Broadcast Discord (gauche), Synchronisation & diagnostic (droite).
4. Aucun KPI plateforme, aucun graphe d'activité, aucun flux temps réel.

À 390 px : une colonne, bandeau non collant, cartes sans largeur fixe (`w-[min(…,calc(100vw-2rem))]`).

## 5. Tests et preuves

1. `tests/unit/telemetry-guild-scope.test.ts` — CUID + snowflake, sélection inconnue ⇒ `none`
   (aucune requête), « toutes » ⇒ `all`, doublons dédupliqués.
2. `tests/unit/telemetry-surface.test.ts` — `/dashboard/:id/admin/...` ⇒ ADMIN, `/dashboard/:id/...`
   ⇒ MEMBER, `/god...` ⇒ GOD, reste ⇒ PUBLIC ; `:id` CUID **et** snowflake.
3. `tests/unit/god-overview.test.ts` (verrou de source) — `page.tsx`/`overview-tabs.tsx` n'importent
   plus `LiveStats`, `ActivityChart`, `getPlatformStats`, `getPlatformActivityStats` ; le flux SSE
   n'existe plus ; `SystemHealthDashboard` reste monté.
4. `tests/unit/god-deslop.test.ts` — `announcement-panel` (102 → 0), `worker-tester` (40 → 0),
   `telemetry-dashboard` (72 → 0) ; pour `page.tsx`, cible **0 sur la zone overview** et plafond
   global abaissé au **résidu mesuré** (les autres onglets gardent leurs motifs).
5. Preuve de perf : nombre de lignes lues par l'overview (avant : tous les `User` + tous les
   `AuditLog` 30 j ; après : 0 pour ces deux lectures) + mesure de durée de la page, consignée en PR.
6. Contrôle visuel **humain** 390 / 768 / 1024 / 1440 des deux onglets.

## 6. Critères d'acceptation

- [ ] Sélectionner une guilde dans `?tab=telemetry` retourne **ses** événements (snowflake et CUID).
- [ ] Le chemin affiché est complet, copiable, cliquable quand il est interne.
- [ ] Les filtres surface/type/recherche fonctionnent sans recharger les agrégats.
- [ ] « Indicateurs plateforme » et « Activité de la plateforme » ne sont plus rendus ni importés.
- [ ] Plus aucune requête SSE toutes les 5 s depuis l'overview.
- [ ] 0 motif de slop sur les fichiers touchés ; `test:run`, `tsc`, `lint` verts ; `git status` propre.
- [ ] Aucune server action métier modifiée par le lot C (diff limité à l'UI et aux imports).

## 7. Découpage

1. **Lot B** : B1 + tests, B2/B3 + action live, B4/B5 + déslop → branche `feat/god-telemetrie`.
2. **Lot C** : C1 (suppression), C2-C4 (refonte), C5 (composition) → branche `feat/god-overview`.
3. Chaque lot : une PR → `dev`, vérifs vertes, contrôle visuel humain avant merge.



