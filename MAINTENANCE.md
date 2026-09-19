# 🛠️ Maintenance VPS — SigilOS

Documentation des procédures de maintenance infrastructure pour le VPS SigilOS.

---

## 📅 Automation Quotidienne

### Backups (3h00 UTC)
```bash
Script: /home/sigiladmin/SigilOS/scripts/backup_db.sh
Logs: /home/sigiladmin/SigilOS/logs/backup.log
```

**Actions**:
1. Backup PostgreSQL (prod + beta)
2. Compression gzip
3. Chiffrement GPG
4. Upload vers Cloudflare R2
5. Rotation locale (30 jours)

### Maintenance (4h00 UTC)
```bash
Script: /home/sigiladmin/SigilOS/scripts/maintenance.sh
Logs: /home/sigiladmin/SigilOS/logs/maintenance.log
```

**Actions**:
1. Nettoyage Docker (images + build cache)
2. APT cleanup (autoremove + autoclean)
3. Rotation logs (journalctl 7j)
4. Rotation logs application (>10MB)
5. Alerte Discord si disque >85%

### Crons HTTP (endpoints protégés `x-cron-secret`)
Appelés depuis le crontab VPS (`crontab -l`) via
`curl -s -H "x-cron-secret: $CRON_SECRET" https://beta.sigilos.fr/api/cron/<name>` :

- `/api/cron/sync-members` — rattrapage départs/bans Discord (toutes les 30 min / 1h)
- `/api/cron/avatar-resync` — **resync des hashs d'avatars Discord (#134)** : `GET /guilds/{id}/members`, mise à jour de `User.image` uniquement si le hash a changé ; `null` → avatar par défaut côté UI. Fréquence recommandée : quotidien (`0 5 * * *`).
- `/api/cron/cleanup-proofs` · `/api/cron/cleanup-logs` · `/api/cron/cleanup-inactive-posts` · `/api/cron/cleanup-inactive-service-requests` — purges (depuis **S5.6**, `cleanup-logs` purge aussi les **logs d'audit du marché**, cf. §Module « Marché »)
- `/api/cron/daily-summary` · `/api/cron/status-ping` · `/api/cron/mission-reset-notify` · `/api/cron/loan-reminders` — notifications
- `/api/cron/raid-reminders` — **rappel automatique des raids** : pour chaque raid `PUBLISHED` entré dans sa fenêtre (`GuildEvent.notifyBefore`, **60 min par défaut**), poste UN message dans le salon du raid dont le `content` ne porte que les mentions `<@id>` des **inscrits** (REGISTERED + CONFIRMED) — **jamais** les rôles de l'embed, jamais `@everyone`. Idempotent (`metadata.raidReminderSentAt`) et silencieux si un rappel manuel vient d'être envoyé. Fréquence recommandée : toutes les 10 min (`0,10,20,30,40,50 * * * *`).
- `/api/cron/ladder-sync` · `/api/cron/discord-status` — synchronisations
- `/api/cron/account-retention` — **#168 rétention/purge comptes orphelins** (RGPD) : purge `User`+`Account` sans profil ACTIVE après 90 j et grâce `scheduledDeletion` écoulée, 50 max/exécution. Fréquence recommandée : quotidien (`0 6 * * *`).
- `/api/cron/sync-dofensive-maps` — **siphon local Dofensive (fiches boss)** : `/dungeons/preview` + `/maps/{id}` → tables `DofensiveDungeon` + `DofensiveMap` (grille `Cells` 40×14, ally/enemyCells, coords). `versionHash` → update auto si changement, salles fraîches (< 24 h) sautées. Fréquence recommandée : quotidien (`30 3 * * *`).
- `/api/cron/sync-monster-stats` — **siphon local fiches monstres (DofusDB + Dofensive)** : pour chaque boss de donjon, fiche DofusDB (grades/drops/sorts) fusionnée avec les sorts de combat Dofensive (AP/portée/zone/cooldown/maxCast) → table `MonsterStat`. ⚠️ 1er run lourd (10-30 min, ~tous les boss × 6-8 requêtes) — runs suivants rapides (tout déjà frais). Fréquence recommandée : quotidien (`45 3 * * *`).
- `/api/cron/check-links` — **vérificateur de liens multi-sources (HEAD)** : flague les slugs cassés DofusDB/Dofensive/DPLN (résultat en audit God, rien stocké). Fréquence recommandée : hebdomadaire (`15 4 * * 0`).

### 🛒 Module « Marché » — cron unique des échéances

Toutes les échéances du marché passent par **une seule route** : `/api/cron/market-expire` (`GET` + `POST`, protégée par `x-cron-secret`, **fail-closed**). Une passe exécute **5 étapes dans un ordre imposé**, puis l'**entretien 1×/jour** (réconciliation Discord **puis** purge des médias — §15.1/§15.2 du plan maître) :

| # | Étape | Effet |
|---|---|---|
| 1 | `expireMarketReservationsCore` | réservations `ACTIVE` échues → `EXPIRED`, l'annonce repasse `RESERVED → ACTIVE` |
| 2 | `remindMarketReservationsEndingCore` | rappel **H-1** au vendeur **et** à l'acheteur (fenêtre stricte de 60 min) |
| 3 | `remindMarketListingsCore` | rappels **J+7 / J+15** au créateur des annonces **sans activité** (paliers `marketReminderDays`) |
| 4 | `expireMarketListingsCore` | retrait **J+20** : annonces échues **sans activité** → `WITHDRAWN` + `deletedAt` (archivage, jamais de suppression dure) |
| 5 | `expireMarketOffersCore` | offres `PENDING` hors délai → `EXPIRED` (acheteur prévenu) |
| 6 | `reconcileMarketDiscordMessagesCore` (**1×/jour**) | messages Discord divergents (`syncStatus = FAILED`/`PENDING`) réécrits, ou **recréés** si supprimés à la main (`404`) |
| 7 | `purgeMarketListingMediaCore` (**1×/jour**) | médias des annonces **terminées** depuis plus de `marketMediaRetentionDays` : fichiers du disque **puis** lignes, chaque annonce purgée auditée (`MEDIA_PURGED`) |

**Crontab VPS** — ligne à ajouter **à la main** (D33). ⚠️ **Corrigée le 14/09/2026** :
le secret doit venir d'un **fichier** (l'environnement de `cron` est minimal : `$CRON_SECRET`
y est **vide** ⇒ `401` ⇒ *aucune* télémétrie, panneau God « Inconnu ») et la sortie doit être
**redirigée** vers le log lu par le panneau (`/home/sigiladmin/SigilOS/logs/market-expire.log`) :

```bash
# 1) une seule fois : le secret de CET environnement (600, root)
umask 077 && printf '%s' '<CRON_SECRET du conteneur>' > /home/sigiladmin/.sigilos-cron-secret

# ⚠️⚠️ PIÈGE CRON — LE `%` DOIT ÊTRE ÉCRIT `\%` DANS UN FICHIER CRONTAB :
#    cron coupe la ligne au **premier `%` non échappé**, envoie tout ce qui suit en
#    **stdin** et n'exécute **pas** la commande (ici bash reçoit une quote non fermée :
#    `curl … -w "market-expire ` ⇒ erreur de syntaxe, **exit 2**, aucun log, aucune
#    télémétrie). Les 12 lignes ci-dessous utilisent donc `\%{http_code}`.
#    Constaté le 15/09/2026 : `sync-dofensive-maps`, `sync-monster-stats`, `check-links`,
#    `cleanup-inactive-service-requests`, `market-expire`, `ladder-sync` et `status-ping`
#    étaient dans ce cas ⇒ **seuls logs absents** de `$LOG_DIR` alors que tous les autres
#    étaient frais. ⇒ salles de donjon jamais siphonnées, panneau God « Inconnu ».
#    (Collé dans un **shell**, `\%` redevient `%` : les tests manuels restent valides.)

# 2) la tâche (adapter l'URL à l'environnement : beta.sigilos.fr / sigilos.fr)
*/10 * * * * curl -s -o /dev/null -w "market-expire \%{http_code} $(date -Is)\n" \
  -H "x-cron-secret: $(cat /home/sigiladmin/.sigilos-cron-secret)" \
  https://beta.sigilos.fr/api/cron/market-expire >> /home/sigiladmin/SigilOS/logs/market-expire.log 2>&1

# 3) les DEUX siphons de données de jeu — mêmes précautions, sinon panneau God
#    « Inconnu / Aucune exécution » ET **salles de donjon manquantes** dans la
#    simulation (aucune map siphonnée). Vérifiés le 15/09/2026 : absents de la
#    crontab déployée alors que leurs URLs sont bien documentées ci-dessus.
30 3 * * * curl -s -o /dev/null -w "sync-dofensive-maps \%{http_code} $(date -Is)\n" \
  -H "x-cron-secret: $(cat /home/sigiladmin/.sigilos-cron-secret)" \
  https://beta.sigilos.fr/api/cron/sync-dofensive-maps >> /home/sigiladmin/SigilOS/logs/sync-dofensive-maps.log 2>&1
45 3 * * * curl -s -o /dev/null -w "sync-monster-stats \%{http_code} $(date -Is)\n" \
  -H "x-cron-secret: $(cat /home/sigiladmin/.sigilos-cron-secret)" \
  https://beta.sigilos.fr/api/cron/sync-monster-stats >> /home/sigiladmin/SigilOS/logs/sync-monster-stats.log 2>&1
```

**⚠️ Manques constatés le 15/09/2026 (crontab VPS réelle)** : deux tâches déclarées dans
`KNOWN_CRON_TASKS` n'avaient **aucune ligne** (donc panneau God « Inconnu » à jamais) et
`market-expire` y pointait **en dur sur `sigilos.fr`** (⇒ depuis le VPS **beta**, on expire les
annonces de **prod**) avec `> /dev/null` (⇒ **aucun log**, donc invisible dans God). À corriger :

```bash
# ⚠️ `\%` : obligatoire dans un crontab (cron coupe la ligne au premier `%` non
#    échappé ⇒ la tâche ne s'exécute pas : erreur de syntaxe bash, exit 2, aucun log).
#    Marché — la MÊME route, mais sur $APP_URL et avec log (⚠️ jamais d'URL en dur : la
#    télémétrie est écrite dans le Redis de l'environnement appelé)
*/10 * * * * curl -s -o /dev/null -w "market-expire \%{http_code} $(date -Is)\n" \
  -H "x-cron-secret: $(cat /home/sigiladmin/.sigilos-cron-secret)" \
  "$APP_URL/api/cron/market-expire" >> "$LOG_DIR/market-expire.log" 2>&1

# Ladder Dofus (worker externe, 5 profils/exécution) — toutes les 12 h
# ⚠️ à n'ajouter QUE si `DOFUS_LADDER_WORKER_URL` est configuré dans l'environnement
#    (sinon la route répond « Worker URL not configured », 500, sans télémétrie)
0 */12 * * * curl -s -o /dev/null -w "ladder-sync \%{http_code} $(date -Is)\n" \
  -H "x-cron-secret: $(cat /home/sigiladmin/.sigilos-cron-secret)" \
  "$APP_URL/api/cron/ladder-sync" >> "$LOG_DIR/ladder-sync.log" 2>&1

# Ping Statut Global (page /status) — toutes les 5 min (HEAD supporté pour UptimeRobot ;
# le core « throttle » l'envoi Discord ⇒ pas de spam)
*/5 * * * * curl -s -o /dev/null -w "status-ping \%{http_code} $(date -Is)\n" \
  -H "x-cron-secret: $(cat /home/sigiladmin/.sigilos-cron-secret)" \
  "$APP_URL/api/cron/status-ping" >> "$LOG_DIR/status-ping.log" 2>&1

# Rappel des raids — ping des INSCRITS 1 h avant le départ (toutes les 10 min ;
# un seul ping par raid, silence si un rappel manuel vient d'être envoyé)
0,10,20,30,40,50 * * * * curl -s -o /dev/null -w "raid-reminders \%{http_code} $(date -Is)\n" \
  -H "x-cron-secret: $(cat /home/sigiladmin/.sigilos-cron-secret)" \
  "$APP_URL/api/cron/raid-reminders" >> "$LOG_DIR/raid-reminders.log" 2>&1
```

> 📋 **Rappel des 23 tâches lues par God** (`KNOWN_CRON_TASKS`, `src/lib/cron-telemetry.ts`) : chacune
> n'apparaît « Succès » que si son **log** est écrit (`$LOG_DIR` **codé** dans
> `src/app/api/god/cron-status/route.ts` = `/home/sigiladmin/SigilOS/logs`) **et/ou** si le Redis de
> l'environnement reçoit `recordCronExecution`. `janitor` n'a **pas** de ligne : il est lancé par
> `maintenance.sh` (04h00), qui écrit `janitor.log`.

**Diagnostic « Inconnu / Jamais » dans God → Tâches CRON** (constat user du 14/09/2026) — dans
l'ordre :

| # | À vérifier | Attendu |
|---|---|---|
| 1 | `curl -s -o /dev/null -w '%{http_code}' -H "x-cron-secret: $(cat /home/sigiladmin/.sigilos-cron-secret)" https://beta.sigilos.fr/api/cron/market-expire` | **200** (un **401** = secret vide/erroné ⇒ le panneau affiche désormais « Refusé (401) : … ») |
| 2 | `docker exec <conteneur-beta> printenv CRON_SECRET` | même valeur que le fichier ci-dessus |
| 3 | URL de la ligne de crontab | celle de **l'environnement supervisé** (la télémétrie est écrite dans le **Redis de cet environnement**) |
| 4 | `ls -l /home/sigiladmin/SigilOS/logs/market-expire.log` | fichier existant et **daté de moins de 10 min** (repli disque du panneau : `LOG_DIR` est **codé** dans `src/app/api/god/cron-status/route.ts`) |
| 5 | `redis-cli -a <pass> keys 'cron:telemetry:*'` | la clé `cron:telemetry:market_expire` existe (TTL 7 j) — **si aucune clé n'existe pour AUCUNE tâche**, le problème est **Redis** (`NOAUTH` ⇒ `recordCronExecution` échoue silencieusement) et non le Marché |

> 💡 **Aucun développement** pour la supervision : la tâche `market_expire` est déclarée dans `KNOWN_CRON_TASKS` (`src/lib/cron-telemetry.ts`) et apparaît **automatiquement** dans **God → Tâches CRON** (`/god?tab=cron-status`) avec son état, sa durée et son récapitulatif de passe.

**Entretien quotidien (étape 6)** — la route tourne toutes les 10 min, l'entretien ne doit donc s'exécuter **qu'une fois par jour** : le verrou est posé dans Redis (`SET market:maintenance:<AAAA-MM-JJ> 1 EX 86400 NX`, cf. `claimMarketDailyMaintenance`). Le verrou est **fail-open** : Redis indisponible → la passe tourne quand même (elle est bornée par lot et idempotente) ; c'est la seule façon de garantir que la réconciliation finisse par avoir lieu.

| Cas Discord | Comportement de la passe |
|---|---|
| Message réécrit avec succès | `syncStatus = FAILED/PENDING → OK` + audit `DISCORD_SYNC_RESTORED` |
| Message **supprimé à la main** (`404` sur l'édition) | la trace du message est vidée puis l'annonce est **republiée** (nouveau message) + audit `DISCORD_SYNC_RESTORED` (`recreated: true`) |
| Annonce archivée / retirée (`deletedAt`) | **ignorée** — un message retiré n'est jamais ressuscité |
| Échec persistant (salon supprimé, permissions, Discord KO) | reste `FAILED` + `lastError`, retenté à la passe du lendemain (aucun audit : pas de transition) |

**Purge des médias (étape 7, S5.5)** — même verrou quotidien, exécutée **après** la réconciliation (les preuves d'une annonce qu'on vient de réparer côté Discord ont encore servi) :

- la **fin de vie** est estimée sur les horodatages d'archivage (`deletedAt` / `soldAt` / `withdrawnAt`) : une annonce **active, réservée ou en brouillon** garde ses preuves, quel que soit l'âge des fichiers ;
- la coupure vient de `marketMediaRetentionDays` **de chaque guilde** (défaut 30 j, bornes 7–180) : deux guildes n'ont pas la même rétention, la passe les traite séparément ;
- **ordre sûr** : le fichier est supprimé **avant** sa ligne — purger la ligne d'abord rendrait l'orphelin indétectable (§13.4) ;
- une annonce **revenue à la vie** entre la lecture et l'écriture (reprise, restauration par un modérateur) est **sautée** : rien n'est purgé ;
- **idempotent** : une annonce dont les médias sont déjà partis n'est plus éligible (`media: { some: {} }`), elle ne consomme plus le lot ; traitement **par lots** de **100** annonces / guilde / passe ;
- **isolation des échecs** : un fichier refusé (protégé, erreur disque) est compté (`filesFailed`) et journalisé, mais la ligne est purgée quand même — l'orphelin reste à surveiller ; une annonce en erreur (`failed`) n'arrête pas la passe ;
- **Audit** : un `MEDIA_PURGED` par annonce purgée (`previousData: { media, bytes }`, `nextData: { media: 0, filesDeleted, filesMissing, filesFailed, retentionDays }`).

**Réponse JSON** : `{ reservations, reservationReminders, reminders, listings, offers, maintenance: { ran, reason }, resynced, purged }` — `resynced = null` (ou `purged = null`) signifie « entretien déjà fait aujourd'hui » ; `purged = { listings, media, bytes, filesFailed, failed }`. `reason` vaut `claimed` · `already-ran` · `redis-unavailable`.

**Relance manuelle** : un modérateur (`market:moderate`) peut rejouer la passe sur **sa** guilde sans attendre le lendemain — actions `reconcileMarketDiscordMessages(guildId, limit?)` et `purgeMarketMedia(guildId, limit?)` (`src/server/actions/market-admin-actions.ts`), même moteur, réparations et purges tracées à son nom. Elles sont consommées par l'onglet **God « Marché »** (S5.9).

**Garde-fous vérifiés :**
- **Idempotence** : chaque écriture est un `updateMany` conditionnel (statut, échéance, `reminderStage` / `deletedAt` rejoués dans le `where`) → une passe relancée dans les 10 minutes **ne fait rien** de plus ; une relance manuelle est sans effet de bord ;
- **Volume** : traitement **par lots** (200 éléments / passe pour les échéances, **25** pour la réconciliation Discord, **100** annonces / guilde pour la purge des médias, **500** lignes / guilde pour la purge des logs d'audit — cette dernière étant portée par le cron `cleanup-logs`) et **un récapitulatif par passe** (jamais une ligne par annonce) ;
- **Discord indisponible** : la base avance d'abord, Discord n'est **jamais bloquant** (échec → `syncStatus = FAILED` + `lastError`, rejouable ; succès → `syncStatus = OK` ; message retiré → `DELETED`) ;
- **Annonce vendue/réservée** : le retrait J+20 et les rappels ne visent **jamais** une annonce avec une offre ou une réservation en cours ;
- **Faible fuite d'information** : la réponse JSON ne contient que des compteurs (aucun montant, aucun pseudo, §13.7).

**Rétention (module marché)** — valeurs par guilde (`GuildConfig`), réglables depuis le dashboard :

| Donnée | Rétention | Mécanisme |
|---|---|---|
| Annonce active sans activité | retirée à **J+20** (soft-delete) | étape 4 du cron |
| Annonce `SOLD` / `WITHDRAWN` | **conservée** (historique, preuve de vente), masquée des vues | filtres par défaut |
| Offres, réservations, signalements | conservés avec l'annonce (traçabilité des litiges) | — |
| Médias (preuves) | `marketMediaRetentionDays` — **30 j** par défaut (bornes 7–180) après la fin de vie de l'annonce | purge des objets de stockage, chaque média purgé étant **audité** (`MEDIA_PURGED`) |
| Logs d'audit du marché | `marketLogRetentionDays` — **365 j** par défaut (bornes 30–730) | purge par le cron **`cleanup-logs`** (`purgeMarketAuditLogsCore`, cf. §Purge des logs d'audit), coupure **par guilde**, 500 lignes / guilde / passe |
| Compte supprimé / profil archivé | les annonces **actives** passent `WITHDRAWN` | hook de cycle de vie membre (audit à la clé) |

Le marché **n'efface jamais** une annonce : il l'**archive** (`WITHDRAWN` + `deletedAt` + `deletedReason`), puis laisse la rétention des logs faire le ménage.

**Purge des logs d'audit (S5.6)** — `purgeMarketAuditLogsCore` (`src/server/market/retention.ts`), appelée par le cron **`/api/cron/cleanup-logs`** (même famille que le nettoyage global des logs d'audit, 1×/jour), et **non bloquante** : un échec du marché n'empêche jamais le nettoyage global (et inversement), il est compté et remonté en télémétrie `cleanup_logs`.

- la **coupure vient de la rétention de chaque guilde** (`marketLogRetentionDays`, défaut 365 j, bornes 30–730) : la passe itère les `GuildConfig` et applique **sa** coupure à chaque guilde — une guilde ne purge jamais avec la rétention d'une autre ;
- **jamais d'annonce touchée** : seuls les `MarketAuditLog` sont supprimés. Le marché archive (§11.10), il n'efface pas : offres, réservations et signalements restent attachés à l'annonce ;
- **aucun audit de purge** : journaliser la purge dans le journal purgé le recréerait indéfiniment — la trace vit dans la télémétrie du cron ;
- **isolation §16.2** : chaque `where` porte l'id **interne** de guilde (`GuildConfig.id`) + la coupure + les ids lus, et l'échec d'une guilde est journalisé et ignoré, sans interrompre les autres ;
- **par lots et idempotent** : `take = 500 + 1` par guilde et par passe (`hasMore` signale le reste), relancer la passe ne fait rien de plus ; aucune ligne plus jeune que la coupure n'est jamais touchée ;
- **réponse JSON `cleanup-logs`** : `{ success, deletedCount, godNotifDeleted, marketLogsDeleted, marketLogsHasMore, message }` — `success: false` si une guilde a échoué (`marketLogsFailed > 0`), le reste de la passe restant effectué ; télémétrie `details: { deletedCount, godNotifDeleted, marketLogsDeleted, marketLogsHasMore, marketLogsFailed }`.

### 📡 Télémétrie et Monitoring GOD (`/god?tab=cron-status`)
Chaque tâche CRON enregistre automatiquement son état, sa durée et son résumé dans **Redis** via `recordCronExecution` (`src/lib/cron-telemetry.ts`).
- **TTL automatique** : 7 jours (auto-nettoyage, pas d'accumulation de fichiers de log).
- **Historisation** : les 10 dernières exécutions sont conservées.
- **Guide complet d'ajout** : voir [.agents/workflows/add-cron-task.md](.agents/workflows/add-cron-task.md).

## ✅ Checklist Déploiement — Sync intelligente fiches boss (chantier 06/10, branche `feat/chantier-2026-09-07`)

1. **Migration Prisma** (beta **et** prod) : `npx prisma migrate deploy` → `20261005010000_add_dofensive_sync_tables` (tables `DofensiveDungeon`, `DofensiveMap`, `MonsterStat`).
2. **Crontab VPS** (3 lignes) — ⚠️ **forme de référence uniquement** (voir le bloc
   « Crontab VPS » du §Module « Marché » ci-dessus) : secret **par fichier** (l'env de `cron` est
   minimal, `$CRON_SECRET` y est **vide** ⇒ 401 silencieux), sortie **redirigée vers le log** lu par
   God (sinon panneau « Inconnu »), URL **`$APP_URL`** (jamais `sigilos.fr` en dur : depuis le VPS
   beta, on appellerait la prod) et **`%` échappé en `\%`** (cron coupe la ligne au premier `%` non
   échappé ⇒ la tâche ne s'exécute **jamais** : erreur de syntaxe bash, exit 2, aucun log) :
   ```
   */10 * * * * curl -s -o /dev/null -w "market-expire \%{http_code} $(date -Is)\n" -H "x-cron-secret: $(cat /home/sigiladmin/.sigilos-cron-secret)" "$APP_URL/api/cron/market-expire" >> "$LOG_DIR/market-expire.log" 2>&1
   30 3 * * * curl -s -o /dev/null -w "sync-dofensive-maps \%{http_code} $(date -Is)\n" -H "x-cron-secret: $(cat /home/sigiladmin/.sigilos-cron-secret)" "$APP_URL/api/cron/sync-dofensive-maps" >> "$LOG_DIR/sync-dofensive-maps.log" 2>&1
   45 3 * * * curl -s -o /dev/null -w "sync-monster-stats \%{http_code} $(date -Is)\n" -H "x-cron-secret: $(cat /home/sigiladmin/.sigilos-cron-secret)" "$APP_URL/api/cron/sync-monster-stats" >> "$LOG_DIR/sync-monster-stats.log" 2>&1
   0 */12 * * * curl -s -o /dev/null -w "ladder-sync \%{http_code} $(date -Is)\n" -H "x-cron-secret: $(cat /home/sigiladmin/.sigilos-cron-secret)" "$APP_URL/api/cron/ladder-sync" >> "$LOG_DIR/ladder-sync.log" 2>&1
   */5 * * * * curl -s -o /dev/null -w "status-ping \%{http_code} $(date -Is)\n" -H "x-cron-secret: $(cat /home/sigiladmin/.sigilos-cron-secret)" "$APP_URL/api/cron/status-ping" >> "$LOG_DIR/status-ping.log" 2>&1
   15 4 * * 0 curl -s -o /dev/null -w "check-links \%{http_code} $(date -Is)\n" -H "x-cron-secret: $(cat /home/sigiladmin/.sigilos-cron-secret)" "$APP_URL/api/cron/check-links" >> "$LOG_DIR/check-links.log" 2>&1
   ```
3. **Pré-chauffage optionnel (recommandé)** — lance manuellement les 2 syncs une fois (le 1er run de `sync-monster-stats` est lourd : 10-30 min, à faire de nuit) :
   ```
   curl -s -H "x-cron-secret: $(cat /home/sigiladmin/.sigilos-cron-secret)" "$APP_URL/api/cron/sync-dofensive-maps"
   curl -s -H "x-cron-secret: $(cat /home/sigiladmin/.sigilos-cron-secret)" "$APP_URL/api/cron/sync-monster-stats"
   ```
4. **Sans pré-chauffage, pas de panne** : les actions sont « local-first » — données absentes/périmées (> 24 h) → fetch live Dofensive/DofusDB depuis le VPS + auto-persistance (self-healing). Les joueurs ne contactent jamais les API externes directement.
5. **Audit** : chaque run écrit un log God (`createSystemAuditLog`, `actorName: "Système (Cron)"`) visible dans `/god` → Audit Logs.

> ⚠️ **INCIDENT beta 05/10 — P3018 sur `20261005010000_add_dofensive_sync_tables` (COLONNE interGuild absente)** : la 1re version de la migration incluait par erreur des `DROP COLUMN` inter-guild (drift DB locale — migration `20260819000000_add_inter_guild` appliquée en local mais absente du dossier). Migration **corrigée** (suppression des 2 blocs `ALTER TABLE`). **Récupération beta** (les tables existent déjà via le `db push` du déploiement) :
> ```
> cd ~/SigilOS && git pull   # récupérer la migration corrigée
> sudo docker compose -f docker-compose.prod.yml --env-file .env.beta exec app-beta npx --yes prisma migrate resolve --applied 20261005010000_add_dofensive_sync_tables
> sudo docker compose -f docker-compose.prod.yml --env-file .env.beta exec app-beta npx --yes prisma migrate status
> ```
> Puis relancer `./scripts/deploy-cd.sh beta`. Ne JAMAIS générer de migration via `prisma migrate diff --from-config-datasource` (drift local) : utiliser `--from-migrations`.

> ⚠️ **INCIDENT beta 09/09 — P3018 sur `20261103000000_add_service_request_reminder_fields` (`lastReminderAt` already exists)** : colonne créée hors migrations sur beta (db push/ALTER manuel). Vérifié que les 2 colonnes existent (`information_schema`), puis `migrate resolve --applied` (avec `prisma@7.9.1` épinglé — SANS version, npx propose la v8 RC !) et re-deploy vert. **Règle** : nouvelles migrations `ADD COLUMN IF NOT EXISTS` (PR #614) pour blinder le futur deploy prod.
> ⚠️ **Prod 09/09 — bot crash-loop 141k restarts `TokenInvalid`** : token partagé beta+prod (bagarre de sessions gateway) + `DATABASE_URL` au vieux mdp (spéciaux non encodés). Fix = **1 appli Discord par env** (`SigilOS Prod` : token+AppID+secret+clé Ed25519 dédiés, intents Members+MessageContent, invite bitmask `6356836904068`) + **`POSTGRES_PASSWORD` alphanumérique** (généré, `ALTER USER`, `.env.prod`, recreate). Diag type : `docker inspect` (restarts/OOM/exit) + `docker logs` + comparaison md5 URL vs `POSTGRES_PASSWORD` + test login `psql`.

---



## ✅ Checklist Déploiement — chantier session 05/09 (à faire au prochain deploy beta + prod)


> Tout le code est sur `feat/chantier-2026-09-04` (PR #505) — merger sur `dev` puis déployer.

1. **Migration Prisma** (beta **et** prod) : `npx prisma migrate deploy` (toutes les migrations en attente — ⚠️ `20261217000000_drop_landing_screen` **supprime** la table `LandingScreen` de #140, décommissionné le 17/09/2026).
2. **Crontab VPS** : ajouter le cron `account-retention` (`0 6 * * *`) et **synchroniser `CRON_SECRET`** en haut du crontab avec la valeur des `.env` :
   - `source` la valeur : `NEW=$(grep '^CRON_SECRET=' .env.beta | sed "s/^CRON_SECRET=//; s/^'//; s/'$//")`
   - `(crontab -l | sed "s|^CRON_SECRET=.*|CRON_SECRET='${NEW}'|") | crontab -`
3. **Secrets à vérifier/renseigner** :
   - `CRON_SECRET` (beta : `.env.beta` · prod : `.env.prod`) — même valeur que le crontab.
   - `REDIS_PASSWORD_BETA` (beta) et `REDIS_PASSWORD` (prod) : **⚠️ non définis → `sigilos-redis-beta` boucle de restart (NOAUTH)** → mettre le même mot de passe dans `.env.beta` que celui attendu par l'app/worker, puis `docker compose -f docker-compose.prod.yml up -d --force-recreate redis-beta app-beta worker-beta`.
4. **Vérifications post-deploy (beta)** :
   - `curl ... /api/cron/cleanup-logs` → **200** (le gate `isSuperAdmin` a été retiré — bug cron 500 « Unauthorized » corrigé).
   - `curl ... /api/cron/daily-summary` → `{"success":true,...}` (ou `skipped:true` si déjà envoyé le jour même).
   - `curl ... /api/cron/account-retention` → `{"success":true,"summary":{...}}`.
   - `/god/landing` : **point de vérification supprimé** — l'interface (#140) a été retirée le 17/09/2026, la landing sert des visuels statiques.
5. **Rappel règle d'écriture d'images** : `processAndSaveImage` refuse tout chemin hors `process.cwd()` (CodeQL js/path-injection #75/#76, fail-closed).

---

## 🔍 Monitoring

### Check Hardening
```bash
cd ~/SigilOS
./scripts/check-hardening.sh
```

**Vérifie**:
- Cron jobs configurés
- Espace disque
- Containers status
- SSH config
- Firewall UFW
- Fail2Ban
- Auto-updates
- Docker cleanup potentiel

### Logs Importants
```bash
# Backup execution
tail -f ~/SigilOS/logs/backup.log

# Maintenance execution
tail -f ~/SigilOS/logs/maintenance.log

# Application logs
sudo docker logs sigilos-prod --tail 100 -f
sudo docker logs sigilos-beta --tail 100 -f
```

---

## 🚨 Procédures d'Urgence

### Restauration Backup
```bash
# 1. Télécharger depuis R2
aws s3 cp s3://sigilos-backups/sigilos_YYYY-MM-DD_HH-MM-SS.sql.gz.gpg .

# 2. Déchiffrer
gpg --decrypt sigilos_*.sql.gz.gpg | gunzip > restore.sql

# 3. Restaurer
sudo docker exec -i sigilos-db-prod psql -U sigilos -d sigilos < restore.sql
```

### Rollback Déploiement
```bash
# ⏪ Méthode rapide (version "Ctrl+Z") — images taggées par SHA
./scripts/rollback.sh list beta        # trouver le SHA disponible
./scripts/rollback.sh beta <sha>       # revenir en beta

# 🐢 Méthode lente (ancienne) — re-build depuis un ancien commit
cd ~/SigilOS
git log --oneline -5  # Trouver le commit précédent
git reset --hard <commit-hash>
./scripts/deploy.sh beta  # ou prod
```
> ⚠️ NB : si la BDD a été migrée, un rollback de **code** ne restaure **pas** la BDD.
> Voir « Restauration Backup » pour revenir sur les données.

### Saturation Disque
```bash
# Nettoyage manuel immédiat
sudo docker image prune -a --force
sudo docker builder prune -a --force
sudo docker system prune -a --force
journalctl --vacuum-time=1d

# Vérifier gain
df -h
```

---

## 📊 Métriques Clés

### Stockage
- **Cible**: <50% utilisé
- **Alerte**: >85% (Discord webhook)
- **Action**: Cleanup manuel si alerte

### Containers
- **Attendu**: 11 containers UP
- **Critique**: app-prod, app-beta, db-prod, db-beta, caddy, redis

### Backups
- **Fréquence**: Quotidien @ 3h UTC
- **Rétention**: 30 jours local, illimité R2
- **Vérification**: `ls -lh backups/db/`

---

## 🔄 Mise à Jour Code (deploy.sh v2 — 2026-08)

### Beta
```bash
ssh vps
cd ~/SigilOS
git pull origin dev
./scripts/deploy.sh beta
```

### Production
```bash
# Local
git checkout main
git merge dev
git push origin main

# VPS
ssh vps
cd ~/SigilOS
git pull origin main
./scripts/deploy.sh prod
```

> ✅ **Rien ne change** dans la façon de déployer — les commandes sont identiques.
> La sortie est désormais **beaucoup plus claire** : build silencieux (fini les 263s de logs), résumé par étape, vérif de santé auto.

### Comportement du script v2 (changements 2026-08)

| Avant | Après | Bénéfice |
|-------|-------|----------|
| Build Docker verboose (84/84 étapes) | Build silencieux (`build -q`), erreurs seulement | Sortie lisible |
| `prisma db push` en PROD | `migrate deploy` **seul** en prod (db push reste beta) | Sécurité BDD |
| Seed `game-data.json` à chaque déploiement | Seed **conditionnel** (hash) | Moins d'indisponibilité |
| Page maintenance pouvait disparaître trop tôt | Caddy recréé qu'à la fin | Maintenance servie pendant tout |
| `up` sans attendre la santé | `up --wait` (healthchecks) | Fini les 502 |
| Rien après déploiement | Vérif santé auto `/api/health` | Contrôle immédiat |

### Seeding conditionnel (détail)
- Le seed ne tourne **que si** `prisma/seed-data/game-data.json` a changé depuis le dernier déploiement.
- Le hash est stocké dans `.deploy-seed-hash.<beta|prod>`.
- **Forcer** le seed : `SEED_ALWAYS=1 ./scripts/deploy.sh beta`
- **Première exécution** après ce changement : le seed tournera une fois (pas de hash en mémoire) — normal.

### Healthchecks ajoutés
`docker-compose.prod.yml` définit des healthchecks (ancres `x-healthchecks`) sur tous les services applicatifs :
- `app-prod/beta` → `curl http://localhost:3000/api/health`
- `worker-prod/beta` → `pgrep worker.js`
- `ws-prod/beta` → `pgrep ws-server.js`
- `db-prod/beta` → `pg_isready`
- `discord-bot-prod/beta` → `pgrep discord`

⚠️ **Premier déploiement après ce changement** : Caddy sera recréé (nouveau compose). Vérifier que la beta est saine avec le script automatique en fin de déploiement, ou `curl https://beta.sigilos.fr/api/health`.

---

## 📞 Contacts & Alertes

**Discord Webhook**: Configuré dans `.env.prod`  
**Variable**: `DISCORD_ADMIN_WEBHOOK`  
**Alertes**: Saturation disque >85%

---

## 🔐 Rapports d'audit (bonne pratique)

- Les rapports d'audit de sécurité (`AUDIT_SECURITE_SIGILOS.md`, `AUDIT_INFRA_SIGILOS.md`, briefs `retour-kimik3.md` et `src/audit-*`) sont **générés en local et JAMAIS commités** (ils décrivent des vulnérabilités précises → ne pas les exposer).
- Ils sont centralisés dans `docs/audits/` et ignorés via le `.gitignore` (`docs/audits/`, `AUDIT_*.md`, `src/audit-cyber`, `src/audit-infra`).
- Après un audit : mettre à jour `docs/SECURITY_HARDENING_PLAN.md` (état + chantiers) et lancer `npm run test:run` en local pour vérifier.
- Les secrets (`.env`, `.env.prod`, `.env.beta`) ne doivent jamais être commités ni partagés dans un canal non sécurisé.

---

## ✅ Checklist Mensuelle

- [ ] Vérifier backups R2 (existence + taille)
- [ ] Analyser logs maintenance (erreurs ?)
- [ ] Vérifier croissance DB (`df -h`)
- [ ] Tester restauration backup (dry-run)
- [ ] Vérifier mises à jour système (`apt list --upgradable`)
- [ ] Review Grafana dashboards
- [ ] Vérifier certificats SSL Caddy
- [ ] ⏰ Vérifier expiration GHCR_TOKEN (renouveler si < 2 semaines) — voir section 3b CI/CD

---

## 🗺️ Plan d'Industrialisation (phases 2 & 3 — à faire plus tard)

> **État actuel** : phase 1 ✅ fait (2026-08) — déploiement plus clair, plus sûr (voir section « Mise à Jour Code »).
> Les phases 2 et 3 sont des **améliorations de confort/vitesse/sécurité**, **pas des corrections de bugs**. À implémenter quand on aura le temps.

### 📐 Phase 2 — Accélérer les builds (~3-4 min gagnées par déploiement)

**Problème** : le build `npm run build` (194s) tourne **3× en parallèle** (app-beta, worker-beta, ws-beta partagent le même Dockerfile) → gaspillage de CPU/RAM/temps.

**Solution prévue** :
- Créer une **image de base partagée** (`Dockerfile.base` : `npm ci` + `prisma generate`, taggée `sigilos-base:latest`).
- Les 3 services partent de cette base → le build n'est fait **qu'une seule fois**.
- Déplacer `build:seeds`, `build:siphon`, etc. **avant** le `COPY . .` pour profiter du cache Docker.
- (Optionnel) Docker build cache distant (BuildKit `cache-to` S3/GCS).

**Impact pour l'utilisateur** : aucun — toujours `./scripts/deploy.sh beta` / `prod`, juste plus rapide.

---

### 🏭 Phase 3 — Industrialisation complète

#### 3a. Rollback en 1 commande ✅ fait (2026-08)
- **Problème** : pas de bouton "annuler" si un déploiement casse la prod (il fallait retaper l'ancien code, rebuild).
- **Solution implémentée** :
  - `deploy.sh` v2 **tagge automatiquement** les images avec le SHA git court (`sigilos-app-beta:<sha>`, etc.) après chaque build, et **garde les 5 dernières** versions.
  - Nouveau script **`scripts/rollback.sh`** pour revenir en arrière.
- **Utilisation** :
  ```bash
  # Voir les versions disponibles
  ./scripts/rollback.sh list beta   # ou prod

  # Revenir à une version précise (le "Ctrl+Z" du déploiement)
  ./scripts/rollback.sh beta <sha>  # ou prod

  # Note : si la BDD a été migrée, un rollback de code ne restaure PAS la BDD
  # (voir procédure Restauration Backup + migrations en double).
  ```
- ⚠️ **Prérequis** : le premier `./scripts/deploy.sh` post-refactor doit tourner pour que les images soient taggées.

#### 3b. CI/CD GitHub Actions ✅ fait (2026-08)
- **Problème** : le build lourd tournait sur le VPS (~4 min à CPU/RAM à fond).
- **Solution implémentée** :
  - **`.github/workflows/deploy.yml`** : sur `push` vers `dev` (beta) ou `main` (prod), GitHub **build** les 4 images (app, worker, ws, discord-bot) et les **pousse vers GHCR** (GitHub Container Registry), taggées par SHA + `latest`.
  - **`scripts/deploy-cd.sh`** : sur le VPS, fait `pull` + `up -d --no-build` depuis GHCR → **aucun build local**, déploiement ~30s.
- **Utilisation** (sur le VPS, une fois GHCR_TOKEN défini) :
  ```bash
  export GHCR_TOKEN=<token read:packages>   # à définir une fois
  ./scripts/deploy-cd.sh beta <sha>          # déployer la version <sha> en beta
  ./scripts/deploy-cd.sh beta                # déployer latest
  ```
- ⚠️ **`deploy-cd.sh` ne recrée PAS le conteneur Caddy** : après toute modification du `Caddyfile` (ex : rate-limit/429, ajout de site), recréer Caddy manuellement :
  ```bash
  sudo docker compose -f docker-compose.prod.yml --env-file .env.beta up -d --force-recreate --no-deps caddy   # beta
  sudo docker compose -f docker-compose.prod.yml --env-file .env.prod  up -d --force-recreate --no-deps caddy   # prod
  ```
- ⏱️ **Étape 4/5 muette puis `P1002` (incident beta 19/09/2026 — RÉSOLU, 2 sujets distincts)** — `Application des migrations Prisma...` sans la moindre sortie, puis `Timed out trying to acquire a postgres advisory lock (SELECT pg_advisory_lock(72707369))`.
  - **① La panne : le schema-engine de Prisma 7 part en boucle CPU à 100 %** sur `prisma/migrations/20260919130000_add_dungeon_slug/migration.sql` **écrit avec des instructions sur plusieurs lignes**. Constat : **aucune** instruction exécutée (la colonne `Dungeon.slug` n'existait même pas) mais le **verrou advisory conservé** → `migrate deploy` paraît figé (réflexe Ctrl+C), et la tentative suivante meurt en `P1002` après 10 s. **Preuve** : schema-engine mesuré à 98 % CPU ; le fichier d'origine (multi-lignes) bloque, **le même SQL en « une instruction par ligne » passe** (`nullable=NO`, index unique créé, les 5 instructions exécutées, slugs vérifiés) ⇒ c'est la **mise en forme du fichier**, pas le SQL (les 27 `replace()` imbriqués n'étaient pas le déclencheur : `translate()` fait la même chose en un appel). ⇒ fichier réécrit (**une instruction par ligne, commentaires ASCII**) + **garde de non-régression** (`tests/unit/boss-slug.test.ts` : toute ligne de code se termine par `;`).
  - **② Le confort : plus aucune étape muette** — le CLI Prisma n'étant pas dans l'image runner, `npx --yes prisma@7.10.0` le **retéléchargeait à CHAQUE déploiement** (1 à 3 min) et sa sortie partait dans un fichier temporaire (donc invisible). Désormais le `Dockerfile` embarque le CLI (stage `prisma-cli` → `/opt/prisma-cli`) et `scripts/deploy-cd.sh` affiche la sortie en direct + borne le temps.
  - **Débloquer une migration interrompue (à retenir)** :
    ```bash
    # 1) tuer le process Prisma bloqué (il garde le verrou) + libérer la base
    sudo docker compose -f docker-compose.prod.yml --env-file .env.beta restart app-beta
    sudo docker compose -f docker-compose.prod.yml --env-file .env.beta exec -T db-beta \
      sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select pg_terminate_backend(pid) from pg_stat_activity where datname=current_database() and pid <> pg_backend_pid();"'
    # 2) effacer l'enregistrement « failed » puis relancer
    sudo docker compose -f docker-compose.prod.yml --env-file .env.beta exec -T app-beta \
      sh -c 'npx --yes prisma@7.10.0 migrate resolve --rolled-back <migration>'
    ./scripts/deploy-cd.sh beta
    ```
    Si le SQL est trivial et idempotent, l'application manuelle (`psql -f -` puis `migrate resolve --applied <migration>`) reste valide.
  - **Filet + visibilité** : `scripts/deploy-cd.sh` affiche la sortie **en direct** (helper `compose_exec_streamed` : `exec -T` + `</dev/null`) et borne chaque étape par un **timeout** (code `124` + message clair au lieu d'une attente infinie). **Repli automatique sur `npx`** si `/opt/prisma-cli` manque → le déploiement ne peut jamais casser à cause de cette optimisation.
  - **Réglages** : `PRISMA_PIN` (défaut `7.10.0` — doit rester aligné sur `prisma` de `package.json` **et** sur `ARG PRISMA_VERSION` du `Dockerfile`) · `PRISMA_TIMEOUT` (défaut `900` s) → ex. `PRISMA_TIMEOUT=1800 ./scripts/deploy-cd.sh prod <sha>`.
  - **Diagnostic d'un `migrate deploy` long (2ᵉ session SSH)** :
    ```bash
    sudo docker compose -f docker-compose.prod.yml --env-file .env.beta logs -f --tail 50 app-beta
    # La migration tourne-t-elle vraiment ? (verrou / requête en cours)
    sudo docker compose -f docker-compose.prod.yml --env-file .env.beta exec db-beta \
      sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select pid,state,wait_event_type,left(query,80) from pg_stat_activity where datname=current_database();"'
    # Où en est Prisma ?
    sudo docker compose -f docker-compose.prod.yml --env-file .env.beta exec db-beta \
      sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select migration_name,finished_at from \"_prisma_migrations\" order by started_at desc limit 3;"'
    ```
    ⚠️ **Ne JAMAIS Ctrl+C en pleine migration** : une migration à moitié appliquée exige `migrate resolve --rolled-back <migration>` avant de relancer.
- **Note** : le workflow GHCR ne remplace PAS `verify.yml` (qui reste le garde-fou lint/test/audit). Les deux coexistent : `verify` valide, `deploy.yml` build/push.
- ⚠️ **Prérequis secrets GitHub** : `BETA_PASSWORD` (settings > secrets). `NEXT_PUBLIC_APP_URL` est défini automatiquement selon la branche.
- ⚠️ **GHCR Token sur le VPS** : générer un PAT GitHub avec scope `read:packages`, et l'exporter (ou le mettre dans le `.bashrc`/cron).
- ⏰ **⚠️ EXPIRATION DU GHCR_TOKEN (IMPORTANT)** : le PAT GitHub créé avec « Expiration: 90 days » **expire ≈ 90 jours après sa création** (créé le 03/08/2026 → **expire ≈ début novembre 2026**). Quand il expire, `deploy-cd.sh` échoue sur le `docker pull` → déploiement CD bloqué.
  
  **Renouvellement (LE minimum, ~2 min)** :
  1. GitHub → avatar → Settings → Developer settings → Personal access tokens → **Tokens (classic)**
     → **Generate new token (classic)** → Note `sigilos-vps`, expiration 90 jours, cocher **uniquement `read:packages`** → Generate.
     📝 **Note la date « Expires on »** affichée (ex: `Sun, Nov 1 2026`).
  2. Sur le VPS, coller 2 lignes (remplacer par le nouveau token + la date notée) :
     ```bash
     echo 'export GHCR_TOKEN=<NOUVEAU_TOKEN>' >> ~/.bashrc && source ~/.bashrc
     echo 'export GHCR_TOKEN_EXPIRY=<AAAA-MM-JJ>' >> ~/.bashrc && source ~/.bashrc
     # exemple : export GHCR_TOKEN_EXPIRY=2026-11-01
     ```
  → C'est tout. Le script affichera le nouveau compte à rebours.
  ⚠️ Alternative **zéro renouvellement** : à la prochaine création, choisir un **fine-grained token sans expiration** (Repository access > SigilOS, permission **Packages: Read**) → plus jamais besoin de renouveler.

#### 3c. Séparer le Redis beta/prod (chantier I-07) — ✅ FAIT + DÉPLOYÉ (09/08)
- **Problème** : la beta et la prod partageaient le **même Redis** → risque de collision de jobs BullMQ/queues.
- **Solution** : un Redis dédié par environnement (`redis-beta` sur beta-net, `redis` prod restreint à prod-net).
- **Impact** : aucun pour l'utilisateur, plus sûr. Déployé beta (containers redis-beta + beta relancés).

#### 3d. Assets monde (tuiles/maps) — servis en STATIQUE par Caddy (10/08)
- **Problème** : Next.js en mode `standalone` ne sert pas de façon fiable le dossier `public/game-data` bind-mounté → les tuiles renvoyaient **404** (alors qu'elles étaient bien sur le VPS, visibles dans le conteneur).
- **Solution** : servir `/game-data/*` **directement par Caddy**, avant le proxy vers Next :
  - `Caddyfile` → `handle /game-data/*` (root `/srv/game-data` + `uri strip_prefix /game-data` + `file_server`) dans le bloc `beta.sigilos.fr`.
  - `docker-compose.prod.yml` → volume `./public/game-data:/srv/game-data:ro` sur le service `caddy`.
- **Procédure de mise à jour des tuiles d'un monde** :
  ```bash
  # 1. Générer/convertir les tuiles localement (ex : scripts/sync-world38-tiles.js)
  # 2. Envoyer sur le VPS (tuiles hors git → rsync OBLIGATOIRE) :
  ./scripts/sync-assets.sh beta          # ou prod
  # 3. PAS de rebuild app nécessaire (volume ro suit le host). Recréer Caddy SEULEMENT si le Caddyfile/compose a changé :
  sudo docker compose -f docker-compose.prod.yml --env-file .env.beta up -d --force-recreate --no-deps caddy
  # 4. Vérif :
  curl -s -o /dev/null -w "%{http_code}\n" https://beta.sigilos.fr/game-data/tiles/w38/1/204.webp   # → 200
  ```
- ⚠️ Les tuiles (`public/game-data/tiles/...`) sont **ignorées par git** → un `git pull`/`deploy-cd.sh` ne les mettra **jamais** à jour. C'est `sync-assets.sh` qui les synchronise (volume bind-mount `ro`, lu directement par Caddy).
- ✅ **Revalidation cache `/game-data/*` (26/08)** : `/game-data/*` était servi **sans `Cache-Control`** → le navigateur appliquait un cache heuristique et pouvait resservir un `worldmap.json`/`worlds.json` **périmé** après un déploiement (ex : mondes 37/40 absents du sélecteur alors que les données étaient bien sur le VPS). Fix : `handle /game-data/*` + `header Cache-Control "no-cache, must-revalidate"` (revalidation ETag/Last-Modified → 304 si inchangé, 200 si nouveau). Côté app, `src/components/worldmap/map-viewer.tsx` force aussi `{ cache: 'no-cache' }` sur les `fetch` de `worldmap.json`/`worlds.json`. ⚠️ Après un changement `Caddyfile` : `docker exec sigilos-gateway caddy validate --config /etc/caddy/Caddyfile && docker exec sigilos-gateway caddy reload` (bind-mount → **pas de rebuild**).
- ⏳ **Prod (main)** : ajouter le même `handle /game-data/*` dans le bloc `sigilos.fr` quand le site sera lancé.
#### 3e. Vitrine prod — assets `/assets/*` servis par Caddy (23/08)

- **Symptôme** : sur `sigilos.fr`, les `/assets/*` (fond `bg-guild`, screenshots, logo, icônes)
  renvoyaient du **HTML** (`maintenance.html`) au lieu des **images** → favicon / og:image / screenshots cassés.
- **Cause racine** : `Caddyfile` et `docker-compose.prod.yml` **périmés sur le VPS** (arbre `dev` local
  resté sale) → il manquait `handle /assets/*` (Caddy) et le mount `./public:/srv/static:ro`
  (service `caddy`), pourtant présents dans `origin/main`.
- **Fix appliqué (chirurgical, sans changement de branche)** :
  `git restore --source=origin/main -- Caddyfile docker-compose.prod.yml` puis recréation du conteneur :
  `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --force-recreate --no-deps caddy`
  → conteneur `sigilos-gateway` recréé.
  ⚠️ **Ne pas** faire `git checkout -- .` / `git pull` / `checkout dev` maintenant : ça écraserait les
  fichiers restaurés ou re-conflicterait (`public/game-data`).
- **Vérifications passées** :
  ```
  GET /                                    → 200 text/html   (vitrine maintenance)
  GET /assets/screenshots/screenshot1.png  → 200 image/png
  GET /assets/ui/logo-v2.png               → 200 image/png   (favicon + og:image)
  ```
- **Faux positif `/assets/icons/favicon.svg`** : `maintenance.html` ne le référence pas (favicon réel =
  `/assets/ui/logo-v2.png`) ; le chemin n'existe pas → le `404` est **sans impact**.
- ⚠️ **Remplacer un visuel de la landing se fait sous un NOUVEAU nom de fichier** (piège mesuré le 17/09) :
  `next/image` sert `/_next/image?url=…&w=…&q=…`, une URL **indépendante du contenu du fichier** → écraser
  une image au même nom laisse le **navigateur** afficher l'ancienne, **même après `Ctrl+Shift+R` et alors
  que le serveur sert bien la nouvelle** (fait constaté : `screenshot1.png` remplacé, landing inchangée —
  `GET /assets/screenshots/<nom>.png` renvoyait un `sha256` **identique au fichier local**, et
  `GET /_next/image?url=…&w=640&q=75` les dimensions du nouveau fichier ; l'ancienne image venait du cache
  du client). Marche à suivre : déposer le visuel sous un **nom neuf** (+ `git checkout` de l'ancien s'il
  sert ailleurs, ex. `docs-catalog.ts`), puis mettre à jour `src/lib/landing-figures.ts` — `imageUrl`, et
  `width`/`height` sur les **dimensions réelles** (le garde-fou `tests/unit/landing-figures.test.ts` lit
  l'en-tête PNG et échoue sinon). Cas réel : `screenshot1.png` (3280×1740) → `tableau-de-bord.png` (1913×704).
- ⚠️ **Une figure de la landing doit faire AU MOINS 2× la largeur de son slot** (mesuré le 17/09/2026) :
  les 4 figures s'affichent sur **619-718 px CSS** (`src/temp/refonte_landing/probe-figure-slots.mjs`),
  donc sur un écran 2× le navigateur a besoin de **1238-1436 px**. Or `next/image` **ne remonte jamais**
  une image — `GET /_next/image?url=…dashboard-guilde.png&w=1920` renvoie **1080×540**, la taille du
  fichier — donc c'est le **navigateur** qui agrandit : hero **×1,15**, guide **×1,39** → rendu mou même
  sur un fichier impeccable. Et **recadrer une capture 4K ne répare rien** : ça zoome sur un fragment
  (texte coupé en plein mot, bouton amputé, curseur figé dans l'image — constaté les 17/09 sur
  `guide-sylvestre.png` et `calendrier-sorties.png`). Producteur correct :
  `scripts/capture-landing-visuels.mjs` — viewport = largeur du slot, `deviceScaleFactor: 2`, cadrage sur
  une ancre `data-tour` (`tour-provider.tsx` pour la liste), chrome `fixed`/`sticky` masqué — puis recopier
  les dimensions imprimées dans `landing-figures.ts`. Garde :
  `node src/temp/refonte_landing/probe-figure-slots.mjs` doit afficher « OK (aucun agrandissement) » pour
  les 4 figures en DPR 2. ⚠️ Une capture par **outil système** (clic droit → « Capturer la page ») embarque
  en plus le **curseur** et la **pastille de dev Next** (`nextjs-portal`) : Playwright ne les capture pas.
  ⚠️ **Et un visuel de la landing se cadre sur un SUJET, pas sur un écran entier** (mesuré le 17/09) : les
  figures s'affichent sur **640-707 px** de large (`hero.tsx`, `guide.tsx`), donc une capture **3280 px**
  subit une réduction **×5** et un texte de 13 px dans l'interface tombe à **2,5 px** à l'écran →
  vignette illisible et perçue comme floue (« ça fait amateur »), sans que la qualité du fichier soit en
  cause. Cible : **≈ 2× la largeur d'affichage** (1100-1300 px) et **un seul sujet lisible** par visuel
  (un panneau, une semaine, une carte) — jamais la colonne de navigation + l'en-tête de page + les
  marges. Recadrage reproductible et borné : `node src/temp/refonte_landing/crop-landing-visuels.mjs`
  (les captures d'origine restent en place : elles servent `docs-catalog.ts`).
- ⏳ **Repo VPS non migré** : toujours sur `dev` (arbre sale : stashes + `public/game-data` modifié).
  Le passage à `main` et le nettoyage restent **à planifier** — avant tout switch de branche, faire
  backup + nettoyage de `public/game-data` et des stashes.


---

### 📌 Priorité recommandée (mise à jour 2026-08)
**Fait** : phase 1, 3a (rollback), 3b (CI/CD GHCR), **3c (Redis séparé — déployé beta 09/08)**.
**Reste** :
1. **Phase 2** (image de base partagée) — optionnel, le CI/CD règle déjà le build redondant sur le VPS.
2. **Renouveler GHCR_TOKEN** (expire ≈ début nov 2026) — cf. section 3b.


