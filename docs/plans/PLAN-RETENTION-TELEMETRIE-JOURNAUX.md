# 🧹 Rétention — télémétrie et journal d'activité

> **Statut** : cadré le 16/11/2026, **aucun code écrit**. Suppression de données ⇒
> **go-ahead explicite de l'utilisateur avant la première ligne** (AGENTS §7).
> **Ordre** : `docs/ROADMAP.md` §2 bis, **lot A**. Mesure d'origine : `ROADMAP.md` §0 (16/11/2026).

## 1. Mesure (16/11/2026)

| Table | Écriture | Purge | Ce que ça implique |
|---|---|---|---|
| `TelemetryEvent` | `src/server/actions/telemetry-actions.ts:35` | **aucune** | croissance illimitée ; porte `userName`, `path` complet, `details` ; 6 index dont `@@index([createdAt])` |
| `ServiceActivityLog` | `src/server/guild-activity-emit.ts` | **aucune** | une ligne par action de module, par guilde ; 3 index, aucun sur `createdAt` seul |

Tout le reste est déjà borné : audit **90 j God / 30 j guilde** (`src/lib/audit-retention-policy.ts`
+ `src/server/audit-retention.ts`), notifications 30/90 j, comptes 365 j, `DiscordMemberActivity`
365 j, tickets par limites plateforme, Docker 10 Mo × 3, logs app > 10 Mo, journalctl 7 j,
Redis 512 Mo. **Ces deux tables sont les deux dernières sans purge.**

## 2. Décision user (16/11/2026)

- `TelemetryEvent` → **90 j** (assez pour les tendances du God, assez court pour les données de navigation).
- `ServiceActivityLog` → **365 j** (un an d'historique de vie de guilde).
- **Compteurs** visibles dans le panneau God « Stockage » (croissance mesurable, pas d'estimation).
- Purge branchée sur **`cleanup-logs` ET le janitor** : si `maintenance.sh` échoue, le cron applicatif
  suffit ; si le cron applicatif est en retard, la passe VPS rattrape.

## 3. Règle pure — `src/lib/telemetry-retention-policy.ts` (à créer)

Même forme que `audit-retention-policy.ts` : aucune dépendance Prisma, importable en relatif par
`scripts/database-janitor.ts` (qui n'a pas l'alias `@/`, cf. ligne 22 de ce script).

```ts
export const LOG_RETENTION_DAYS = { TELEMETRY: 90, SERVICE_ACTIVITY: 365 } as const;
export const LOG_PURGE_BATCH_SIZE = 500;
export const LOG_PURGE_MAX_BATCHES = 10; // borne une passe de cron

export function logPurgeCutoff(now: Date, days: number): Date; // now − days × MS_PER_DAY
export function buildTelemetryPurgeWhere(cutoff: Date): { createdAt: { lt: Date } };
export function buildServiceActivityPurgeWhere(cutoff: Date): { createdAt: { lt: Date } };
```

Fichier **dédié** (et non extension d'`audit-retention-policy`) : autre table, autre décision,
autre durée de vie ; un sujet = un fichier.

## 4. Core serveur — `src/server/log-retention.ts` (à créer)

**Aucun `"use server"`** : même raisonnement que `src/server/audit-retention.ts` (un export
appelable par le client sans garde est une porte de suppression). Chaque appelant garde ses droits :
`verifyCronSecret` (route) ou script VPS.

- `purgeTelemetryEventsCore()` : `findMany` des `id` échus (`createdAt: { lt: cutoff }`, ordre
  croissant, `take: LOG_PURGE_BATCH_SIZE + 1`), puis `deleteMany` avec **la condition d'état rejouée**
  (`createdAt` + `id in`). Boucle bornée à `LOG_PURGE_MAX_BATCHES`. Retourne
  `{ scanned, deleted, hasMore }`.
- `purgeServiceActivityCore()` : boucle sur les `GuildConfig.id` **internes** (jamais un snowflake),
  un lot par guilde ; l'index `[guildId, module, createdAt]` sert le préfixe `guildId` + la borne
  `createdAt`. Budget global de lots pour ne pas tenir le cron. **Aucune migration.**
- Journalisation : **compteurs seulement**, jamais `path`, `userName`, `guildId` lisible ni `details`.

## 5. Branchements

### 5.1 `src/app/api/cron/cleanup-logs/route.ts`

Après la purge d'audit et du marché : appeler les deux cores, chacun isolé par `try/catch`
(un échec ne casse pas les autres purges). Étendre le `summary` de `recordCronExecution`
(`X événements télémétrie (> 90 j) + Y lignes d'activité (> 365 j)`). Réponse `429`/auth inchangées.

### 5.2 `scripts/database-janitor.ts` (04h00 sur le VPS)

Importer les constantes et les `build…Where` en relatif ; boucler par lots de
`LOG_PURGE_BATCH_SIZE` (même budget). Conserver le `DRY_RUN` existant ; première exécution en
dry-run, puis passe réelle avec compteurs. Le janitor ne doit jamais journaliser de PII.

### 5.3 God « Stockage »

- `src/server/actions/storage-actions.ts:787` `getGuildLogsStats()` (déjà super-admin) → ajouter
  un bloc `retention` : `telemetry { rows, oldest }`, `serviceActivity { rows, oldest }`,
  plus la politique (`90 j` / `365 j`). `count()` + `aggregate _min.createdAt` uniquement —
  **pas de SQL brut**, pas de taille de relation inventée.
- `src/components/admin/storage-overview-panel.tsx`, onglet `logs` : deux tuiles « Télémétrie
  (90 j) » / « Journal d'activité (365 j) » avec lignes, plus ancienne ligne, « purge au prochain
  cron ». Lecture seule, aucun bouton de suppression manuelle.

## 6. Tests (à écrire avant de quitter l'arbre)

1. `tests/unit/log-retention-policy.test.ts` — seuils 90/365, cutoff exact à la milliseconde,
   lot positif, aucune date codée en dur.
2. `tests/unit/log-retention.test.ts` — verrous de source : `createdAt` **dans le `deleteMany`**,
   jamais de `deleteMany({})`, budget de lots, boucle par `GuildConfig.id` pour l'activité,
   aucun `userName`/`path` dans les logs.
3. `tests/unit/cleanup-logs.test.ts` — nouveau cas : les deux cores sont appelés et comptés dans
   le résumé ; un échec de l'un n'empêche pas les autres.
4. `tests/unit/janitor-logs-retention.test.ts` — le script importe la politique, applique les deux
   cutoffs et n'écrit pas de PII (verrou de source).
5. Compteurs Stockage : test du formatage pur (lignes + « jamais purgé » / date) si un helper est
   extrait ; sinon verrou de source sur l'action gardée.

## 7. Critères d'acceptation

- [ ] Après **deux passes consécutives**, `count({ createdAt: { lt: cutoff } }) === 0` pour les deux tables.
- [ ] La 2ᵉ passe ne supprime rien (idempotence) et le résumé cron le montre.
- [ ] Aucune ligne `TelemetryEvent` > 90 j, aucune `ServiceActivityLog` > 365 j.
- [ ] `cleanup-logs` fonctionne même si la purge d'audit ou du marché échoue (isolation).
- [ ] `npm run test:run` vert, `npx tsc --noEmit` 0, `npm run lint` 0 erreur, `git status` propre.

## 8. Risques / ops

- **Perte définitive** au-delà du seuil. Si les tendances > 90 j doivent être conservées, exporter
  (`exportTelemetryDataAction`) **avant** la première passe — décision humaine, pas un repli du code.
- Les anciennes lignes `TelemetryEvent` portent encore un `userAgent` (empreinte) : la purge les
  élimine ; d'ici là, l'écran de télémétrie ne doit plus l'afficher (lot B).
- Durée de passe bornée par les lots ; si `hasMore` reste vrai plusieurs jours, augmenter le budget
  **avec une mesure**, pas au hasard.
- Déploiement : image applicative pour `cleanup-logs` ; `git pull` sur le VPS pour le script janitor.
- Hors scope : `AuditLog`, marché, notifications, tickets (déjà bornés).

## 9. Découpage

1. `policy + core + tests` → commit.
2. `wiring cleanup-logs + janitor + tests` → commit.
3. `compteurs Stockage + test` → commit.
4. **Une PR → `dev`**, vérifs vertes, puis mesure humaine des compteurs avant/après.

