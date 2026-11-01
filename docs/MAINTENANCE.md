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
1. **Chaque nuit à 3h00 UTC, le dump** (rotation 7 quotidiens + dernier de 3 mois, plafond 4 Go) ;
   **le 1ᵉʳ janvier, avril, juillet et octobre à 5h00 UTC, la répétition de restauration** :
   ```cron
   0 5 1 1,4,7,10 * /usr/bin/flock -n /tmp/restore-drill.lock /bin/bash /home/sigiladmin/SigilOS/scripts/restore-drill.sh beta >> /home/sigiladmin/SigilOS/logs/restore-drill.log 2>&1
   ```
   Elle envoie une notification God **SYSTEM** (verte si la restauration est conforme, rouge sinon) —
   elle n'écrit **pas** dans la télémétrie `backup_db`, donc la carte « Sauvegarde » de God reste
   celle de la vraie sauvegarde.
2. Compression gzip
3. Chiffrement GPG
4. Upload vers Cloudflare R2
5. Rotation locale (**5** derniers fichiers — `BACKUP_LOCAL_KEEP`, `scripts/backup_db.sh`) et rotation R2 **bornée par le script** (7 quotidiens + dernier de 3 mois, plafond **4 Go**) : **R2 est l'archive**, pas la copie locale

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
6. **Nettoyage des notifications** — queue BullMQ `sigilos-cleanup` (`src/workers/metamob-worker.ts`, `0 4 * * *`), non bloquant : **lues > 30 j** (une passe) et **non lues > 90 j** (par lots de 500, 20 000 lignes/jour au maximum, reliquat repris le lendemain). Mesure du 15/10/2026 : la purge ne visait que les lues, or **66 lignes sur 11 722** l'étaient — la table ne décroissait donc jamais.
7. **Contrôle de la mémoire Redis** — le mot de passe est relu dans la ligne de commande du conteneur (injecté au parse du compose, donc absent de son environnement) et transmis par `REDISCLI_AUTH`, **jamais affiché**. Alerte Discord au-delà de **60 %** du plafond, et alerte explicite si `maxmemory` vaut **0** (le plafond vit dans `docker-compose.prod.yml` : `--maxmemory 512mb --maxmemory-policy noeviction --appendonly yes`, sur **les deux** Redis). Politique `noeviction` = à 100 %, Redis **refuse les écritures** : les files BullMQ s'arrêtent, d'où l'alerte précoce.

### Crons HTTP (endpoints protégés `x-cron-secret`)
Appelés depuis le crontab VPS (`crontab -l`) via
`curl -s -H "x-cron-secret: $CRON_SECRET" https://beta.sigilos.fr/api/cron/<name>` :

⚠️ **Depuis un shell SSH, `$CRON_SECRET` est vide** (mesuré le 26/10/2026) : la variable est définie
**en tête du crontab** (`CRON_SECRET=…`, § « Tâches planifiées »), pas dans l'environnement du shell.
Le header part alors **vide** et la route répond `{"error":"Unauthorized"}` — ce n'est **pas** un
problème de route.

Pour un appel **manuel**, lire le secret là où il est réellement (jamais l'afficher) :

```bash
# ✅ méthode fiable : l'environnement du conteneur applicatif (sigilos-beta / sigilos-prod)
curl -sS -H "x-cron-secret: $(docker exec sigilos-beta printenv CRON_SECRET)" \
  "https://beta.sigilos.fr/api/cron/<name>"
```

⚠️ Le fichier `~/.sigilos-cron-secret` **n'existe pas** sur ce VPS (`cat: No such file or directory`,
relevé du 26/10/2026) : les exemples plus bas qui l'utilisent ne valent que si on l'a créé
(`umask 077 && printf '%s' '<secret>' > ~/.sigilos-cron-secret`).

- `/api/cron/sync-members` — rattrapage départs/bans Discord (toutes les 30 min / 1h). La passe appelle aussi `closeOrphanContentForGuild` (lot B, 30/10/2026) : tout profil **non actif** qui porte encore du contenu ouvert voit ce contenu **fermé** — posts DJ/quêtes `CLOSED`, runs Songes `ABANDONED`, **événements du calendrier `CANCELLED`** (rappels + embed purgés, miroirs recopiés), annonces du Marché `WITHDRAWN` — puis les embeds Discord sont supprimés. Bornée (50 profils/guilde, `limit: 25` depuis la synchro), idempotente, et **indépendante de qui a archivé** : le bot ne peut pas fermer le contenu (image sans `src/`), c'est cette passe qui le fait.
- `/api/cron/avatar-resync` — **resync des hashs d'avatars Discord (#134)** : `GET /guilds/{id}/members`, mise à jour de `User.image` uniquement si le hash a changé ; `null` → avatar par défaut côté UI. Fréquence recommandée : quotidien (`0 5 * * *`).
- `/api/cron/cleanup-proofs` · `/api/cron/cleanup-logs` · `/api/cron/cleanup-inactive-posts` · `/api/cron/cleanup-inactive-service-requests` — purges (depuis **S5.6**, `cleanup-logs` purge aussi les **logs d'audit du marché**, cf. §Module « Marché »). **Rétention des logs d'audit (audit du 25/09)** : `cleanup-logs` applique **90 j** aux actions plateforme (`isGodLog: true`, sans guilde) et **30 j** aux journaux de guilde — politique unique dans `src/lib/audit-retention-policy.ts`, appliquée par le core `src/server/audit-retention.ts` (par lots de 500, par périmètre, jamais de `deleteMany` global). Le script VPS `scripts/database-janitor.ts` (04h00) consomme la même politique.
- `/api/cron/daily-summary` · `/api/cron/status-ping` · `/api/cron/mission-reset-notify` · `/api/cron/loan-reminders` — notifications
- `/api/cron/raid-reminders` — **rappels des raids, trois passes** (une seule ligne de crontab) : ① **H-24 (J-1)** : pour chaque raid `PUBLISHED` programmé au moins 48 h à l'avance (`startDate - createdAt >= 48 h`), entré dans sa fenêtre H-24 (tolérance 4 h [H-24 .. H-20]), poste UN message dans le salon du raid avec ping des seuls inscrits (REGISTERED + CONFIRMED + créateur). Idempotent (`metadata.raidReminder24hSentAt`), silencieux si rappel manuel récent. ② **H-1** : pour chaque raid `PUBLISHED` entré dans sa fenêtre (`GuildEvent.notifyBefore`, **60 min par défaut**), poste UN message dans le salon du raid dont le `content` ne porte que les mentions `<@id>` des **inscrits** (REGISTERED + CONFIRMED) — **jamais** les rôles de l'embed, jamais `@everyone`. Idempotent (`metadata.raidReminderSentAt`) et silencieux si un rappel manuel vient d'être envoyé. ③ **H+24 — rappel de clôture** : pour chaque raid terminé depuis 24 h et encore `PUBLISHED`, UN message qui ne ping que le **capitaine actuel** (`creatorId`, donc le nouveau lead après un transfert de capitanat) : « reste à clôturer : présents + score → XP/Kamas » + lien vers le raid. Idempotent (`metadata.closureReminderSentAt`). Un raid n'est **pas** clôturé d'office avant **48 h** (`src/lib/calendar-auto-close.ts`) — sinon le rappel de clôture ne partirait jamais. Fréquence recommandée : toutes les 10 min (`0,10,20,30,40,50 * * * *`).
- `/api/cron/calendar-auto-close` — **clôture d'office du calendrier + purge Discord** (depuis le 25/10/2026, une seule passe) : ① **raid** encore `PUBLISHED` **48 h** après sa fin ⇒ `COMPLETED` avec `metadata.closedBySystem` + `systemClosedAt` (et **pas** `completedAt`) — le capitaine peut encore **compléter** (présents + score) ou **annuler** pendant 24 h, le raid n'est donc jamais « terminé sans points » définitivement ; ② **autres types** : clôturés dès la fin ; ③ **miroirs DJ/Songes** : jamais clôturés ici (la copie suit son post d'origine, `syncDjMirror`/`syncSongesMirror`) ; ④ **purge** de `metadata.reminderMessages` (rappels H-24/H-1/clôture/manuel, outbox résolu par `messageKey`) **et** de l'embed de publication. Garde d'état `status: "PUBLISHED"` dans le `WHERE` (jamais deux clôtures), 200 événements max par passe, refs non supprimées conservées pour rejeu. **Les pages ne clôturent plus rien** : ouvrir le calendrier est une lecture pure. Fréquence recommandée : toutes les 10 min (`0,10,20,30,40,50 * * * *`).
- `/api/cron/event-reminders` — **rappel des events calendrier non-raid** (même contrat, fenêtre `notifyBefore`, marqueur `metadata.eventReminderSentAt` ; sans `startDate` → ignoré).
- `/api/cron/dj-reminders` — **rappel H-1 des posts DJ/Quêtes datés** (`targetDate` ; posts indéfinis ignorés ; marqueur `dungeonsJson._h1ReminderSentAt`).
- `/api/cron/songes-reminders` — **rappel H-1 des runs Songes planifiées** (`scheduledAt` ; runs indéfinies ignorées ; idempotence Redis par échéance).
- **Stand-by (30/10/2026)** — un post DJ/quête (`DjSearchPost.standBy`), une run Songes (`DreamRun.standBy`) ou un événement calendrier (`GuildEvent.standBy`) peut être **mis en pause** par son créateur (ou un administrateur, avec motif) : colonne JSONB `{ at, userId, name }`, forme et règles uniques dans `src/lib/group-standby.ts`. La pause **suspend** le rappel H-1 (`dj-reminders`, `songes-reminders`), les trois passes d'un raid (`raid-reminders` : H-24, H-1, rappel de clôture), le rappel des events non-raid (`event-reminders`), les relances d'inactivité J+7/J+15/J+20 **et** la clôture d'office (J+21 ; +48 h pour un raid, `calendar-auto-close`). Elle ne change **ni le statut ni les inscriptions** : c'est un état de pause, pas une fermeture. Un `standBy` **illisible** compte comme une pause (fail-closed : on préfère le silence à un ping qu'on croyait suspendu) ; chaque passe compte ses refus sous la raison `stand-by`. L'embed Discord porte la ligne « ⏸️ Mis en stand-by par … » et un bouton dont **seul le créateur** peut se servir (le contrôle est dans le handler : Discord ne sait pas griser un bouton par personne) ; le dashboard expose la même bascule.
- `/api/cron/ladder-sync` · `/api/cron/discord-status` — synchronisations
- `/api/cron/account-retention` — **#168 rétention/purge comptes orphelins** (RGPD) : purge `User`+`Account` sans profil ACTIVE après 90 j et grâce `scheduledDeletion` écoulée, 50 max/exécution. **Les événements de guilde survivent au compte** (décision user du 30/10/2026, option C) : le contenu encore publié est refermé (embeds + rappels), les événements ouverts sont annulés, le nom du capitaine est retiré du JSON, puis les événements sont rattachés à un **compte technique** `system-deleted-member` nommé « **Ancien membre** » (`src/server/deleted-member.ts`) — la guilde garde son historique, l'identité disparaît. Ce compte technique est **protégé** de la purge (sinon la cascade emporterait tous les événements anonymisés). **Lot 7** : la même passe purge `DiscordMemberActivity` **365 j après le départ** (`leftDiscordAt`, membres inscrits **ou non**) — une seule requête indexée, aucune ligne de crontab en plus ; un échec de cette purge rend le cron **rouge** et apparaît dans le résumé. Fréquence recommandée : quotidien (`0 6 * * *`).
- `/api/cron/sync-dofensive-maps` — **siphon local Dofensive (fiches boss)** : `/dungeons/preview` + `/maps/{id}` → tables `DofensiveDungeon` + `DofensiveMap` (grille `Cells` 40×14, ally/enemyCells, coords). `versionHash` → update auto si changement, salles fraîches (< 24 h) sautées. Fréquence recommandée : quotidien (`30 3 * * *`).
- `/api/cron/sync-monster-stats` — **siphon local fiches monstres (DofusDB + Dofensive)** : pour chaque boss de donjon, fiche DofusDB (grades/drops/sorts) fusionnée avec les sorts de combat Dofensive (AP/portée/zone/cooldown/maxCast) → table `MonsterStat`. ⚠️ 1er run lourd (10-30 min, ~tous les boss × 6-8 requêtes) — runs suivants rapides (tout déjà frais). **+ veille du bestiaire** (filigrane `id`, curseur persistant, jamais de recul) : **`MONSTER_FICHES_VEILLE_LIMIT`** fiches par nuit (défaut **300**, borné à **800**) — le plafond était `60` en dur, soit ~74 nuits pour couvrir les ~4 700 monstres (mesure du 31/10/2026). En régime établi, la passe ne coûte **qu'une requête** (rien de neuf) et ramasse automatiquement les nouveaux monstres. **+ phase 5 (11/10/2026) — succès « spéciaux »** : complète **25 challenges par run** (`Challenge.description` = la **vraie** explication DofusDB, `iconUrl` servie par le proxy, `conditions` lues) — idempotent (un challenge déjà complet est sauté **sans requête**) ⇒ coût nul en régime établi, et **aucune opération manuelle sur le VPS** (l'image de prod ne contient ni `src/` ni tsconfig : un script qui importe du TS n'y tourne pas). Fréquence recommandée : quotidien (`45 3 * * *`).
- `/api/cron/check-links` — **vérificateur de liens multi-sources (HEAD)** : flague les slugs cassés DofusDB/Dofensive/DPLN (résultat en audit God, rien stocké). Fréquence recommandée : hebdomadaire (`15 4 * * 0`).
- `/api/cron/guild-purge` — **purge réelle des guildes arrivées à échéance** (chantier `guildes-cycle-de-vie`, 01/11/2026) : supprime **définitivement** les guildes désactivées dont `scheduledDeletion` est atteinte (`deletedAt` non nul **et** date passée), via `src/server/guild-purge-core.ts` — **même** implémentation que le hard delete God : config + toutes les relations en cascade (profils, événements, tickets, marché…), `AllowedGuild`, caches, sortie du bot. 20 guildes maximum par passe, du plus ancien au plus récent ; bilan notifié à God. Une guilde **active** ne peut jamais être purgée par ce chemin. Fréquence recommandée : quotidien (`45 4 * * *`).
- `/api/cron/discord-channel-watch` — **surveillance des salons Discord** : pour chaque guilde active avec un `systemNotifyChannelId`, compare les IDs de canaux configurés dans `GuildConfig` aux canaux visibles par le bot. Si un canal configuré a disparu, envoie un embed d'alerte dans `systemNotifyChannelId` avec la liste des champs affectés et un lien vers `/admin/pilotage?tab=diagnostic`. Fréquence recommandée : quotidien (`0 7 * * *`).
- `/api/cron/siphon-item-conditions` — **conditions d'équipement** (`DofusDude` → `GameItem.conditions`, 264 objets
  conditionnés) : sans elles, aucune variante ne peut être **bloquée** sur un trophée conditionnel (`pk<2`, `PA<12`).
  `apply` = **0 par défaut** (dry-run). ⚠️ **Route, pas un script** : mesuré le 26/10/2026, `node scripts/*.mjs`
  échoue dans le conteneur (`@prisma/driver-adapter-utils` absent du build standalone). Fréquence : mensuelle.
- `/api/cron/siphon-item-sets` — **référentiel des panoplies** (`GameItemSet`, 940 lignes DofusDB / **938** écrites) : nécessaire aux **bonus de panoplie recalculés** des variantes. `apply` = **0 par défaut** (dry-run), `pages` borne la passe (19 au total) et `startSkip` reprend au `nextSkip` rendu — la passe complète peut donc être découpée derrière un proxy. **Une seule fois** après une migration/MAJ, puis à la demande. Existe aussi en local (`npm run siphon:item-sets -- --apply`) : la route sert aux **conteneurs** (l'image standalone ne porte ni `tsx` ni les alias `@/`).


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

# Sondages PROGRAMMÉS (module staff `scheduledPolls`) — CHAQUE MINUTE : le
# formulaire choisit une date, une heure ET une minute, c'est donc la cadence
# exigée par la fonctionnalité. Le core revendique chaque créneau en base
# (garde d'état dans le `WHERE`) : un double déclenchement — ou la reprise
# quotidienne dans `maintenance.sh` — ne publie jamais deux fois le même sondage.
# ⚠️ La minute manquée n'est pas perdue : l'exécution suivante rattrape tous les
#    créneaux échus (c'est ce qui rend le déclencheur « sans état »).
# ⚠️ `CRON_SECRET`, `APP_URL` et `LOG_DIR` sont définis EN TÊTE du crontab de ce VPS (relevé du
#    12/10/2026) : on utilise donc `$CRON_SECRET` (et non `$(cat ~/.sigilos-cron-secret)`, fichier
#    absent). Le log porte EXACTEMENT le
#    nom déclaré dans `KNOWN_CRON_TASKS` (`publish-scheduled-polls.log`), sinon
#    le panneau God affiche « Inconnu ».
* * * * * curl -s -o /dev/null -w "publish-scheduled-polls \%{http_code} $(date -Is)\n" -H "x-cron-secret: $CRON_SECRET" "$APP_URL/api/cron/publish-scheduled-polls" >> "$LOG_DIR/publish-scheduled-polls.log" 2>&1

# Rappels des raids (toutes les 10 min) — ① ping des INSCRITS 1 h avant le départ
# (un seul ping par raid, silence si un rappel manuel vient d'être envoyé) ;
# ② rappel de CLÔTURE au capitaine 24 h après la fin (un seul par raid)
# flock : trois passes + appels Discord dans la même exécution (jamais deux en parallèle).
0,10,20,30,40,50 * * * * /usr/bin/flock -n /tmp/raid-reminders.lock curl -s -m 60 -o /dev/null -w "raid-reminders \%{http_code} $(date -Is)\n" -H "x-cron-secret: $CRON_SECRET" "$APP_URL/api/cron/raid-reminders" >> "$LOG_DIR/raid-reminders.log" 2>&1

# Clôture d'office du calendrier (toutes les 10 min) — ① raid encore ouvert 48 h
# après la fin : clôture traçable (à compléter par le capitaine) ; ② autres types :
# dès la fin ; ③ miroirs DJ/Songes jamais clôturés ; ④ PURGE des rappels Discord +
# de l'embed dans le salon. Aucune page n'écrit de statut : cette ligne est le SEUL
# exécutant de la règle `src/lib/calendar-auto-close.ts`.
# ⚠️ `flock -n` : la passe purge des messages Discord un par un (jusqu'à 200 événements,
#    runtime plafonné à 15 min côté monitoring) — jamais deux passes concurrentes.
# ⚠️ `\%` obligatoire (cron coupe la ligne au premier `%` non échappé : exit 2, aucun log).
0,10,20,30,40,50 * * * * /usr/bin/flock -n /tmp/calendar-auto-close.lock curl -s -m 60 -o /dev/null -w "calendar-auto-close \%{http_code} $(date -Is)\n" -H "x-cron-secret: $CRON_SECRET" "$APP_URL/api/cron/calendar-auto-close" >> "$LOG_DIR/calendar-auto-close.log" 2>&1

# Rappel des events calendrier non-raid (même fenêtre `notifyBefore`, 60 min par
# défaut ; posts sans `startDate` ignorés ; un seul ping par event)
0,10,20,30,40,50 * * * * /usr/bin/flock -n /tmp/event-reminders.lock curl -s -m 60 -o /dev/null -w "event-reminders \%{http_code} $(date -Is)\n" -H "x-cron-secret: $CRON_SECRET" "$APP_URL/api/cron/event-reminders" >> "$LOG_DIR/event-reminders.log" 2>&1

# Rappel H-1 des posts DJ/Quêtes datés (`targetDate` ; posts indéfinis ignorés)
0,10,20,30,40,50 * * * * /usr/bin/flock -n /tmp/dj-reminders.lock curl -s -m 60 -o /dev/null -w "dj-reminders \%{http_code} $(date -Is)\n" -H "x-cron-secret: $CRON_SECRET" "$APP_URL/api/cron/dj-reminders" >> "$LOG_DIR/dj-reminders.log" 2>&1

# Rappel H-1 des runs Songes planifiées (`scheduledAt` ; runs indéfinies ignorées)
0,10,20,30,40,50 * * * * /usr/bin/flock -n /tmp/songes-reminders.lock curl -s -m 60 -o /dev/null -w "songes-reminders \%{http_code} $(date -Is)\n" -H "x-cron-secret: $CRON_SECRET" "$APP_URL/api/cron/songes-reminders" >> "$LOG_DIR/songes-reminders.log" 2>&1

# Rôles automatiques par ancienneté (chantier Y, lot Y-2) — UNE FOIS par jour : la passe
# réconcilie les rôles des paliers atteints (`jours → rôles`) et n'annonce que les
# franchissements POSTÉRIEURS à l'activation du module (les paliers déjà atteints sont
# posés en silence — décision user du 14/10/2026, aucun message rétroactif dans le salon).
# ⚠️ Sans état : une passe manquée n'est pas perdue, la suivante applique le même diff.
30 4 * * * curl -s -o /dev/null -w "seniority-roles \%{http_code} $(date -Is)\n" -H "x-cron-secret: $CRON_SECRET" "$APP_URL/api/cron/seniority-roles" >> "$LOG_DIR/seniority-roles.log" 2>&1

# 🔭 Veille DofusDB — UNE FOIS par semaine (dimanche 05h00 UTC : **ligne déjà en place** avant le
# 26/10/2026). Deux rôles dans la même passe :
#  ① **alerte** God, seulement en cas de nouveauté (objet/quête/donjon/condition jamais vue) ;
#  ② **entretien** systématique : veille ciblée des objets + passe ciblée des **panoplies**.
# ⚠️ Ce qui manquait n'était PAS cette ligne mais le **code** : jusqu'au 26/10/2026 l'entretien était
#    conditionné à une nouveauté, or un rééquilibrage de statistiques (mise à jour 3.7 des trophées)
#    ne change **aucun compteur** ⇒ aucun siphon. Ne pas ajouter une seconde ligne (double passe).
# ⚠️ `flock` + `-m 300` : après une longue coupure, la passe relit les panoplies des 60 derniers jours.
0 5 * * 0 /usr/bin/flock -n /tmp/data-watch.lock curl -s -m 300 -o /dev/null -w "data-watch \%{http_code} $(date -Is)\n" -H "x-cron-secret: $CRON_SECRET" "$APP_URL/api/cron/data-watch" >> "$LOG_DIR/data-watch.log" 2>&1

# 📋 Conditions d'équipement (DofusDude → `GameItem.conditions`) — UNE FOIS par mois.
# C'est ce qui permet d'afficher et de **bloquer** une variante sur un trophée conditionnel
# (« Bonus de panoplies < 2 », « PA < 12 »…).
# ⚠️ Route cron et **pas** `docker exec node scripts/…` : mesuré le 26/10/2026, le script échoue
#    DANS le conteneur (`ERR_MODULE_NOT_FOUND: @prisma/driver-adapter-utils`, dépendance
#    transitive de l'adaptateur absente du build standalone). Le cœur est le même (une source).
# ⚠️ À lancer APRÈS la veille des objets : une fiche absente est comptée `missing`, jamais créée.
5 5 1 * * curl -s -m 180 -o /dev/null -w "siphon-item-conditions \%{http_code} $(date -Is)\n" -H "x-cron-secret: $CRON_SECRET" "$APP_URL/api/cron/siphon-item-conditions?apply=1" >> "$LOG_DIR/siphon-conditions.log" 2>&1
```

### Ce qui suit le jeu tout seul — et ce qui reste humain

| Ce qui change côté jeu | Porté par | Automatique ? |
|---|---|---|
| Nouvel objet / objet retiré | `GameItem` | ✅ `data-watch` hebdo : alerte God **+** veille ciblée |
| **Stats / effets d'un objet existant** (rééquilibrage 3.7) | `GameItem.effects` **et** le payload Dofusbook du build | ✅ veille ciblée hebdo (inconditionnelle depuis le 26/10/2026) |
| **Paliers de bonus d'une panoplie** | `GameItemSet` (référentiel **à nous**) | ✅ passe ciblée `data-watch` (`updatedAt[$gt]`, filigrane Redis `game-data:watch:item-sets`) |
| Condition d'équipement (trophée conditionnel, `pk<2`…) | `GameItem.conditions` (DofusDude) | ⚠️ **script mensuel** (ligne de crontab ci-dessus) — en attendant, l'évaluateur est **fail-closed** : variante refusée, jamais un total faux |
| Type d'objet ou atome de condition inconnu | veille des conditions | ✅ **signalé** (alerte God), jamais deviné |
| Plafonds PA/PM/PO/invocations, pods, formules | `src/lib/dofus-{caps,pods,set-bonuses}.ts` + tests | 👤 humain (lot + PR), versionné et verrouillé par des tests |
| Forgémagie, potions d'élément, gemmes régénérantes | — | ❌ **hors modèle** : l'app ne simule pas la forgemagie |
| Suppression d'un objet / d'une panoplie | — | 👤 jamais automatique (décision humaine) |

> ⚠️ **Les totaux d'un build ne viennent pas de `GameItem`** : ils viennent du **payload Dofusbook**
> enregistré avec le build (c'est lui qui est recalculé quand une variante est appliquée). Notre
> référentiel sert aux **paliers de panoplie**, aux **conditions**, aux icônes et au marché. Un
> rééquilibrage arrive donc dans un build au **re-sync de ce build**, et dans nos calculs de
> panoplie à la passe `data-watch`.

> 📋 **Rappel des 33 tâches lues par God** (`KNOWN_CRON_TASKS`, `src/lib/cron-telemetry.ts`) : chacune
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
- **Guide complet d'ajout** : voir [add-cron-task.md](./agents/add-cron-task.md).

## ✅ Checklist Déploiement — Sync intelligente fiches boss (chantier 06/10, branche `feat/chantier-2026-09-07`)

1. **Migration Prisma** (beta **et** prod) : `npx prisma migrate deploy` → `20261005010000_add_dofensive_sync_tables` (tables `DofensiveDungeon`, `DofensiveMap`, `MonsterStat`).
2. **Crontab VPS** (3 lignes) — ⚠️ **forme de référence uniquement** (voir le bloc
   « Crontab VPS » du §Module « Marché » ci-dessus) : secret **par fichier** (l'env de `cron` est
   minimal, `$CRON_SECRET` y est **vide** ⇒ 401 silencieux), sortie **redirigée vers le log** lu par
   God (sinon panneau « Inconnu »), URL **`$APP_URL`** (jamais `sigilos.fr` en dur : depuis le VPS
   beta, on appellerait la prod) et **`%` échappé en `\%`** (cron coupe la ligne au premier `%` non
   échappé ⇒ la tâche ne s'exécute **jamais** : erreur de syntaxe bash, exit 2, aucun log).
   ⚠️ **En pratique (relevé dans `crontab -l` le 12/10/2026)** : `APP_URL`, `LOG_DIR` et
   **`CRON_SECRET`** sont définis **en tête du crontab**, et c'est cette variable qui alimente le
   header ; le fichier `~/.sigilos-cron-secret` **n'existe pas** sur ce VPS (`cat: No such file…`
   ⇒ `{"error":"Unauthorized"}` si l'on colle une ligne dans un shell) — remplacer donc
   `$(cat /home/sigiladmin/.sigilos-cron-secret)` par `$CRON_SECRET`, ou créer le fichier une fois
   (cf. § ci-dessus) :
   ```
   */10 * * * * curl -s -o /dev/null -w "market-expire \%{http_code} $(date -Is)\n" -H "x-cron-secret: $(cat /home/sigiladmin/.sigilos-cron-secret)" "$APP_URL/api/cron/market-expire" >> "$LOG_DIR/market-expire.log" 2>&1
   30 3 * * * curl -s -o /dev/null -w "sync-dofensive-maps \%{http_code} $(date -Is)\n" -H "x-cron-secret: $(cat /home/sigiladmin/.sigilos-cron-secret)" "$APP_URL/api/cron/sync-dofensive-maps" >> "$LOG_DIR/sync-dofensive-maps.log" 2>&1
   45 3 * * * curl -s -o /dev/null -w "sync-monster-stats \%{http_code} $(date -Is)\n" -H "x-cron-secret: $(cat /home/sigiladmin/.sigilos-cron-secret)" "$APP_URL/api/cron/sync-monster-stats" >> "$LOG_DIR/sync-monster-stats.log" 2>&1
   10 4 * * * curl -s -o /dev/null -w "sync-raid-spells \%{http_code} $(date -Is)\n" -H "x-cron-secret: $(cat /home/sigiladmin/.sigilos-cron-secret)" "$APP_URL/api/cron/sync-raid-spells" >> "$LOG_DIR/sync-raid-spells.log" 2>&1
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

> ⚠️ **INCIDENT prod + beta 06/10 — plus personne ne peut se connecter (`error=Configuration`)** :
> **Symptôme** : toute connexion Discord redirige vers `/auth/error?error=Configuration`, **sur prod ET beta en même temps, sans aucun déploiement** (les conteneurs restaient *healthy*, `GET /api/auth/csrf` = **200**, `/api/auth/providers` = **200**, et **toutes** les variables d'env présentes — `AUTH_SECRET`, `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`).
> **Cause racine mesurée** (logs) : `[auth][error] CallbackRouteError` → `unexpected "iss" (issuer) response parameter value`, `expected: "https://authjs.dev"`. **Discord renvoie désormais le paramètre `iss` (RFC 9207)** dans sa réponse OAuth ; Auth.js v5 le compare à `provider.issuer`, dont la **valeur de repli est le placeholder `https://authjs.dev`** (`@auth/core/lib/actions/callback/oauth/callback.ts:82`, commentaire amont `// TODO: review fallback issuer`) — le provider Discord **installé** ne déclare aucun `issuer` (les versions récentes l'ajoutent).
> **Piège de diagnostic** : `error=Configuration` n'est **pas** l'erreur réelle — c'est le **masque** affiché pour toute erreur serveur non « client-safe » (`@auth/core/index.js` : `const type = isClientSafeErrorType ? error.type : "Configuration"`) ⇒ **toujours lire `docker logs <app> | grep '\[auth\]'`**, jamais se fier au libellé de la page d'erreur.
> **Correctif immédiat (sans rebuild — Auth.js lit `AUTH_DISCORD_ISSUER`, cf. `@auth/core/lib/utils/env.ts:65`)** :
> ```
> # à ajouter dans .env.beta ET .env.prod
> AUTH_DISCORD_ISSUER=https://discord.com
> sudo docker compose -f docker-compose.prod.yml --env-file .env.beta up -d --force-recreate --no-deps app-beta
> ```
> **Correctif pérenne** : `issuer: "https://discord.com"` déclaré **en dur** dans `src/auth.ts` (+ documenté dans `.env.example`) et **gardé par `tests/unit/auth-discord-issuer.test.ts`** ⇒ la variable d'env ne peut plus disparaître sans casser la connexion (valeur = issuer officiel de `https://discord.com/.well-known/openid-configuration`).
> **Vigilance** : ce type de panne **échappe à la CI** (le code compile, les tests passent, les conteneurs sont `healthy`) — elle ne se voit qu'en **exerçant réellement la connexion**. Le `/api/health` actuel ne teste **pas** le login : c'est l'angle mort de la supervision (piste : smoke test de connexion ou alerte Sentry branchée sur le logger d'Auth.js).
>
> **Suite du 07/10/2026 — supervision réellement branchée, et alertes débruitées** : ① `src/instrumentation.ts` charge désormais `sentry.server.config.ts` — **sans ce fichier**, le SDK Sentry v10 n'initialise **rien** côté serveur : c'est ce qui a rendu la panne du 06/10 totalement invisible ; ② `/api/health` contrôle la **configuration d'auth** en fail-closed (`auth.status: unhealthy` dès qu'une variable manque) ; ③ **ce qui alerte où** (mesuré) — les alertes partent de l'**app Discord officielle Sentry** (« Alertes Discord ») ; le relais maison `/api/webhooks/sentry` exige `SENTRY_DISCORD_WEBHOOK_URL` **et** `SENTRY_WEBHOOK_SECRET`, et sur la bêta la première est **MANQUANTE** ⇒ le relais maison ne poste **rien** (« je ne reçois rien » peut vouloir dire « je regarde le mauvais salon ») ; ④ **le piège central** — `captureConsoleIntegration({ levels: ["error"] })` transforme **tout `console.error`** serveur en **Issue Sentry** : ne jamais journaliser un cas **normal** en `error`. Trois routes le faisaient (`/api/uploads` : 3 logs par appel dont un par requête réussie ; `/api/dofusbook/proxy` : 404 amont ; `/api/storage` : course ⇒ 500 + Issue) — elles passent par `logger` (miss en `debug`, anomalie en `warn`) ; gardes `tests/unit/uploads-route-logging.test.ts` et `tests/unit/faux-positifs-sentry.test.ts`.
>
> **Nettoyage du 07/10/2026 — sous-système « chat » mort supprimé** : le produit **n'a pas de chat** (aucune UI, aucune route POST). Il restait 5 fichiers morts (**~612 lignes**) : `src/app/api/chat/**` (presence + 2 streams SSE), `src/lib/chat-helpers.ts` (clés Redis `chat:*` **lues/écrites nulle part**) et `src/components/providers/PresenceProvider.tsx` (**importé mais jamais rendu**). La présence réellement affichée vient de `PresenceManager` (`src/lib/presence.ts`), alimenté par `getUserContext` et `<PresenceHeartbeat>` : **ne pas confondre les deux systèmes** lors d'un futur diagnostic « qui est en ligne ». Récupérable via `git log` si un chat revient un jour.
>
> **Alertes restantes après le deploy bêta (07/10 au soir) — le tri, mesuré dans Sentry** : ① les **3 Issues `[uploads] …` ont disparu** (58 → 0) : le correctif tient, c'était bien la cause ; ② **5 `logger.error` étiquetés « non-fatal »** (guide de quêtes ×4, overlay ×1) transformaient un échec **secondaire et prévu** en Issue Sentry (5 événements/24 h pour le seul `Resource checks`) ⇒ passés en **`logger.warn`** — **un cas non fatal ne part JAMAIS en `error`**, sinon l'alerte revient ; ③ `MaxListenersExceededWarning` (**113 événements/24 h**) = avertissement de **process Node**, émis par le runtime de streaming de Next sur `POST /<jeton aléatoire>/rush-sylvestre` — une URL **qui n'existe pas** (404 sur la bêta, aucun rewrite correspondant dans le `Caddyfile` : un robot tape dedans) ⇒ **filtré** dans `sentry.server.config.ts` (`ignoreErrors`, décision motivée en commentaire) et **conservé** dans `docker logs` : si notre code se mettait à fuir pour de vrai, le volume dans les logs exploserait. **Test du doute** : `sudo docker stats --no-stream sigilos-beta` — une mémoire qui grimpe en continu sans redescendre = fuite réelle, à creuser.

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

### Purge du cache d'images siphonnées (monstres ET objets — identités DofusDB)
```bash
# Pourquoi : jusqu'au 27/09/2026 le proxy `/api/assets-dofus` pouvait écrire dans le cache
# disque (`public/uploads/assets-dofus/monsters/{id}.webp`, volume `assets-*-data`) l'apparence
# d'un AUTRE monstre — l'apparence est indexée par `gfxId`, jamais par l'id (mesure : 100 % des
# 300 monstres DofusDB testés ont `gfxId != id`, 281/300 collisions avec le dump local). Le
# 2e vague, 09/10/2026 (PR #872) : les OBJETS aussi — `img/items/{n}.png` est indexé par l ICONID,
# jamais par l id de l objet (item 11107 Bois de Tremble -> iconId 38677 ; l id 3086 est un autre item).
# Dans les deux cas ces fichiers sont servis avec `Cache-Control: immutable` (1 an) : il faut les PURGER après
# le déploiement du correctif — les images se re-téléchargent À LA DEMANDE (correctes).
# ATTENTION `sh -c` est OBLIGATOIRE : sans shell, `*.webp` n est PAS developpe (un `rm -f` direct
# ne supprime rien, en silence). NE PAS toucher spells/ (icones deja resolues par iconId).
cd ~/SigilOS
sudo docker compose -f docker-compose.prod.yml --env-file .env.beta exec app-beta \
  sh -c 'rm -f public/uploads/assets-dofus/monsters/*.webp public/uploads/assets-dofus/items/*.webp'
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod exec app-prod \
  sh -c 'rm -f public/uploads/assets-dofus/monsters/*.webp public/uploads/assets-dofus/items/*.webp'

# Controle : le compteur doit tomber a 0 puis remonter au fil des visites (jamais de 404).
sudo docker compose -f docker-compose.prod.yml --env-file .env.beta exec app-beta \
  sh -c 'ls public/uploads/assets-dofus/monsters/*.webp 2>/dev/null | wc -l'

# Contrôle (l'apparence doit correspondre au gfxId de la fiche) :
# curl -s "https://api.dofusdb.fr/monsters/4834" | grep -o '"gfxId":[0-9]*'   # Predagob -> 1583
# curl -s -o /dev/null -w "%{http_code}\n" https://beta.sigilos.fr/api/assets-dofus/monsters/4834
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
- **Fréquence**: Quotidien @ 3h UTC (`scripts/backup_db.sh`, plan gratuit R2)
- **Rétention locale**: 5 derniers `.gpg` (`BACKUP_LOCAL_KEEP`)
- **Rétention R2**: 7 dumps + le dernier de chacun des 3 derniers mois, **plafond 4 Go** (`BACKUP_R2_MAX_MB`) — plan gratuit 10 Go, aucune facture
- **Vérification**: `ls -lh backups/db/` · la notification God du matin porte le poids du bucket (`r2_total_mb`)

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

> ⚠️ **AVANT la bascule sur `sigilos.fr` — retirer les 3 verrous d'indexation** (posés le
> 24/09/2026 pour la phase bêta, où `beta.sigilos.fr` est la seule propriété indexée) :
> ① `header X-Robots-Tag "noindex, nofollow"` dans le bloc `sigilos.fr` du `Caddyfile` ;
> ② `<meta name="robots" content="noindex, nofollow">` dans `public/maintenance.html` ;
> ③ le `handle /sitemap.xml` → `respond 404` du `Caddyfile` (rétablir un vrai sitemap).
> **Oubliés, ces verrous rendraient `sigilos.fr` invisible pour toujours.** Checklist complète :
> `docs/plans/SEO_REPRISE.md` § « CHECKLIST … OUVERTURE PROD » (point 1), garde de test :
> `tests/unit/seo-vitrine-prod.test.ts`.

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

## 🧩 Émojis d'application Discord — synchro manuelle (bêta / prod)

Les pictos des embeds (sections Dofus, classes, et **un par succès**) sont des **emojis d'application** :
ils appartiennent à l'**application Discord** de l'environnement, pas à une guilde — donc **une synchro
par environnement**.

| Environnement | Application Discord (id) |
|---|---|
| bêta | `1458259008355045519` |
| prod | `1547055932792508476` |

**83 emojis** (`dofus_*` = 56 sections/classes + 27 succès) sont en place sur les **deux** depuis le
**27/09/2026**. Source unique du catalogue : `src/lib/discord-emoji-catalog.ts` (JS pur) ; décision de
synchro : `src/lib/discord-app-emoji-plan.ts` (**pur**, testé) ; script : `scripts/sync-discord-app-emojis.ts`
(idempotent : ne crée que les manquants, ne supprime ni ne renomme jamais).

### Succès « spéciaux » — finir le siphon **à la demande** (12/10/2026, corrigé le 10/12/2026)

> ⚠️ **Une fois** : ce lot ajoute la colonne `DungeonAchievement.description` ⇒ jouer la migration
> (`npx prisma migrate deploy`) avant de relancer le siphon.

Le cron `sync-monster-stats` complète **25 succès « spéciaux » par passage** (`siphonSpecialAchievements`) :
la propagation complète prend donc **plusieurs nuits**. Pour tout finir d'un coup, l'outil est
**embarqué dans l'image** (bundlé au build : `npm run build:succes`) :

```bash
cd /home/sigiladmin/SigilOS
# 1) simulation — AUCUNE écriture
sudo docker compose -f docker-compose.prod.yml --env-file .env.beta exec -T app-beta \
  node scripts/succes-speciaux.js siphon
# 2) écriture
sudo docker compose -f docker-compose.prod.yml --env-file .env.beta exec -T app-beta \
  node scripts/succes-speciaux.js siphon --apply
```

Il fait **les deux passes** : la vraie description de chaque challenge (`Challenge.description`,
icône du **proxy interne**, conditions **lues** chez DofusDB) **et** l'écriture, **sur la ligne du
succès**, de la mécanique propre au donjon (`DungeonAchievement.description`) + de son icône
(`imageUrl`). Le titre affiché reste **« Spécial »** (c'est le nom du challenge partagé, unique en
base) — c'est ce qui fait disparaître « Vaincre tel boss dans son donjon en validant le challenge
dédié. » **sans** renommer la carte.

⏳ Si la sortie affiche `⏳ Budget DofusDB **partagé** épuisé` : ce n'est **pas** une panne, c'est
**notre** limiteur (30 req/min, partagé avec tous les siphons). Relancer la commande plus tard ; rien
n'est perdu (l'outil est **idempotent** : un succès déjà complet est sauté **sans requête**).

Vérification (Postgres) — il ne doit **plus rester de succès « Spécial » sans texte** :

```sql
SELECT count(*) FROM "DungeonAchievement" da JOIN "Challenge" c ON c.id = da."challengeId"
WHERE c.slug IN ('sp-cial','special') AND da.description IS NULL;
```

Un `0` = tout est passé. Le libellé de ces lignes est celui du challenge partagé : **« Spécial »**.

#### Ménage : purger les challenges orphelins (10/12/2026)

L'ANCIENNE passe créait **un challenge par boss** (`Meulou y es-tu ?`, `Econome`, …). Depuis, chaque
succès « Spécial » est rattaché au challenge **partagé** (`sp-cial`) : ces lignes ne sont plus
référencées par personne, mais l'onglet **God → Succès** liste toute la table (`getChallenges`) — d'où
un catalogue qui semble « peuplé de succès qui n'existent pas ». **Après** un siphon complet :

```bash
sudo docker compose -f docker-compose.prod.yml --env-file .env.beta exec -T app-beta \
  node scripts/succes-speciaux.js purger-challenges-speciaux          # simulation
sudo docker compose -f docker-compose.prod.yml --env-file .env.beta exec -T app-beta \
  node scripts/succes-speciaux.js purger-challenges-speciaux --apply  # supprime
```

Critère **strict** : aucun `DungeonAchievement` rattaché **et** `conditions` non nulles (les 28
challenges du seed ont `conditions: null`) ⇒ un challenge créé à la main dans God est rattaché à un
donjon, donc jamais visé. Le code ne **recrée** jamais ces lignes (la passe ne crée plus de challenge).

### Rattrapage « Donjon validé » — donjons sans aucun succès (25/10/2026)

Les **doubles boss** (« Comte et Klime », « Comte et Nileza », « Comte et Sylargh »,
« Comte et Missiz Frizz », « Harebourg et Frizz », « Abyssaux du Gouffre du Gigalodon ») et les
**boss d'anomalie** (Mureine, Jardins éternels ×3, Willorque, Exécrabe, Cire Momore…) n'ont
**aucun** succès propre : sans coche, l'écran affichait « Succès — 0/0 ». L'outil rattache le
pseudo-succès `donjon-valide` (« Donjon validé ») **uniquement** à ces donjons (aucune ligne
`DungeonAchievement`), et le rend **seulement** s'il est le seul du donjon
(`src/lib/dungeon-no-achievement.ts`).

Bundlé dans l'image (`npm run build:backfill-dungeon-completion`), **dry-run par défaut**,
**idempotent** (`upsert`) ; il **crée** le challenge s'il a été purgé :

```bash
# 1) contrôle — AUCUNE écriture (liste des donjons visés, avec le flag « sans succès »)
docker exec sigilos-beta node scripts/backfill-dungeon-completion.js
# 2) écriture
docker exec sigilos-beta node scripts/backfill-dungeon-completion.js --apply
# 3) re-contrôle : doit afficher « Donjons sans succès : 0 / N »
docker exec sigilos-beta node scripts/backfill-dungeon-completion.js
```

Idem `sigilos-prod` (noms de conteneurs mesurés le 25/10/2026 dans `docker ps`).

Mesure du 25/10/2026 en **bêta** : **13 donjons / 150** cochés, re-contrôle `0 / 150`.

⚠️ **`Cannot find module '/app/scripts/backfill-dungeon-completion.js'` = image trop ancienne**,
pas une panne : le bundle n'existe que depuis le commit `5009643d` (25/10/2026). Une image
antérieure (prod `main` = `07c0500e` du 12/10) ne l'a pas ⇒ lancer le rattrapage **après** le
déploiement du lot, jamais en copiant le fichier dans un conteneur en marche (`docker cp` =
artefact hors image, perdu au prochain redéploiement).

### Pourquoi pas `docker compose exec … tsx`
L'image de prod ne contient **ni `src/` ni `tsconfig`** (elle ne copie que `public/`, `prisma/`,
`scripts/` et les JS compilés) alors que le script importe le catalogue TypeScript ⇒
`npx -y tsx scripts/…` dans le conteneur échoue (« Cannot find module »). Deux voies fonctionnent.

### Voie A — Node ≥ 20.12 sur l'hôte (dans le dossier du dépôt)
```bash
npx -y tsx scripts/sync-discord-app-emojis.ts --env=.env.prod            # contrôle : AUCUN envoi
npx -y tsx scripts/sync-discord-app-emojis.ts --env=.env.prod --apply    # crée les manquants
```

### Voie B — VPS **sans Node** : conteneur jetable (testée le 27/09/2026)
```bash
rm -rf /tmp/emoji-sync
git clone --depth 1 --branch dev https://github.com/Klyx04/SigilOS.git /tmp/emoji-sync

sudo docker run --rm \
  -v /tmp/emoji-sync:/app -v /app/node_modules \
  -v "$HOME/SigilOS/.env.prod":/app/.env.prod:ro \
  -w /app node:22-alpine \
  npx -y tsx scripts/sync-discord-app-emojis.ts --env=.env.prod

# puis la MÊME commande avec --apply, et enfin :
rm -rf /tmp/emoji-sync
```
- `-v /app/node_modules` **masque** le `node_modules` de l'hôte : sans lui, `tsx` charge un `esbuild`
  d'une autre plateforme (« You installed esbuild for another platform ») — reproduit le 27/09.
- Le `.env.prod` est monté **en fichier, en lecture seule**, et `--env=` le lit puis le **parse comme
  Node** (guillemets retirés), contrairement à l'option `--env-file` de Docker qui les conserve.
- Le mode par défaut **n'envoie rien** : il affiche l'id de l'app et les compteurs.

### Vérifier
- **1ʳᵉ ligne = id de l'application** : comparez au tableau ci-dessus, c'est ce qui dit sur **quel**
  environnement on agit ;
- après `--apply` : « N créé(s) … 0 échec(s) », puis le contrôle doit dire « déjà présents : 83,
  à créer : 0 » ;
- portail Discord → app → onglet *Émojis* ;
- les messages **déjà envoyés** gardent leur ancien rendu : nouveau post (ou bouton « Modifier »).
- un **refusé** n'est pas une panne : c'est le garde-fou des 256 Ko (`missions/songes.png` 1,3 Mo,
  `anomalie.png` 693 Ko) — il faut réduire l'image avant de l'ajouter au catalogue.

**Une fois par environnement** : le bot a besoin de la permission **« Créer des publications »** si le
salon de notification est un **forum** (un post de forum est un thread).

> 🔭 Un onglet God « Émojis Discord » est **décidé mais non codé** (voir `docs/ROADMAP.md`) : il fera
> ces deux étapes en un clic, sur l'app de l'environnement courant.

---


## 📊 Supervision — God « Système & Infra »

- **Aucune exposition publique** : `monitor.sigilos.fr` a été retiré le 19/10/2026 et le service **Grafana supprimé** du compose de prod.
- **Prometheus reste interne** (`prometheus:9090`, non publié) : node-exporter, cAdvisor et postgres-exporter.
- **Accès** : God → **Système & Infra** (`?tab=infrastructure`) : CPU, RAM, disque, Redis, PostgreSQL (taille/connexions), conteneurs/redémarrages, sauvegarde, worker et les 8 crons les plus critiques.
- **Pas d'Alertmanager** : Prometheus ne pousse aucune alerte. L'alerte disque >85 % reste le webhook Discord (`DISCORD_ADMIN_WEBHOOK`).
- **Volume `grafana_data`** : conservé sur le VPS, plus monté. Ne le supprimer qu'après accord explicite (données de dashboards).
- **Diagnostic ponctuel** : `sudo docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f prometheus` (jamais de port public).

### État au 19/10/2026

- Bêta déployée en **`5b31ad0`** : 6 conteneurs `Healthy`, base à jour, `/`, `/guides`, `/guides/rush-sylvestre`, `/boss`, `robots.txt`, `sitemap.xml`, `/api/health` → **200**.
- `sigilos-grafana` **supprimé** ; `monitor.sigilos.fr` → **000 / TLS coupé** (voulu).
- **Limites connues** : carte « Conteneurs » vide (requête cAdvisor à corriger), pas de détail par conteneur, règles d'alerte Grafana non auditées (volume `grafana_data` conservé).
- **Prod non déployée** : `main` = `07c0500e` (12/10), `dev` = **103 commits d'avance**. Les images prod ne sont construites que depuis `main`.
- **Convention des tags** : la CI publie **7 caractères** (`5b31ad0`). Utiliser `./scripts/deploy-cd.sh beta <sha7>` ; le script ne normalise pas encore un SHA 8/40.

---
## 📞 Contacts & Alertes

**Discord Webhook**: Configuré dans `.env.prod`  
**Variable**: `DISCORD_ADMIN_WEBHOOK`  
**Alertes**: Saturation disque >85% (webhook Discord) + Sentry (erreurs). **Pas d'Alertmanager** : Prometheus n'envoie aucune alerte.

---

## 🔐 Rapports d'audit (bonne pratique)

- Les rapports d'audit de sécurité (`AUDIT_SECURITE_SIGILOS.md`, `AUDIT_INFRA_SIGILOS.md`, briefs `retour-kimik3.md` et `src/audit-*`) sont **générés en local et JAMAIS commités** (ils décrivent des vulnérabilités précises → ne pas les exposer).
- Ils sont centralisés dans `docs/audits/` et ignorés via le `.gitignore` (`docs/audits/`, `AUDIT_*.md`, `src/audit-cyber`, `src/audit-infra`).
- Après un audit : mettre à jour le **rapport interne de durcissement** (hors dépôt, jamais publié : mesures détaillées + écarts) et lancer `npm run test:run` en local pour vérifier.
- Les secrets (`.env`, `.env.prod`, `.env.beta`) ne doivent jamais être commités ni partagés dans un canal non sécurisé.

---

## ✅ Checklist Mensuelle

- [ ] Vérifier backups R2 (existence + taille)
- [ ] Analyser logs maintenance (erreurs ?)
- [ ] Vérifier croissance DB (`df -h`)
- [ ] Tester restauration backup (`bash scripts/restore-drill.sh beta` — conteneur jetable, aucun impact)
- [ ] Vérifier mises à jour système (`apt list --upgradable`)
- [ ] Vérifier God → Système & Infra (CPU, RAM, disque, Redis, DB, conteneurs, crons)
- [ ] Vérifier certificats SSL Caddy
- [ ] ⏰ Vérifier que `GHCR_TOKEN` est toujours valide (token **sans expiration** — rotation/révocation manuelle) — voir section 3b CI/CD

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
  - **Chaîne de fabrication verrouillée (F2, 20/09/2026)** : les **14 `uses:`** des deux workflows sont épinglés sur un **SHA de commit complet** (`owner/action@<sha40> # vX`), **actions first-party `actions/*` comprises** (`actions/checkout`, `actions/cache`, `actions/setup-node`), et **chaque image est poussée avec provenance + SBOM** (`--provenance=true --sbom=true`) : la référence publiée sur GHCR est donc un **index OCI** (image + attestations) — lisible par `docker buildx imagetools inspect ghcr.io/<owner>/sigilos-app-beta:<sha>` ; `docker pull` / `deploy-cd.sh` sont **inchangés** (le manifeste de la plateforme est sélectionné comme avant). Garde de non-régression : `tests/unit/workflows-actions-pinned.test.ts`.
  - **`scripts/deploy-cd.sh`** : sur le VPS, fait `pull` + `up -d --no-build` depuis GHCR → **aucun build local**, déploiement ~30s.
- **Utilisation** (sur le VPS, une fois GHCR_TOKEN défini) :
  ```bash
  export GHCR_TOKEN=<token read:packages>   # à définir une fois
  ./scripts/deploy-cd.sh beta <sha>          # déployer la version <sha> en beta
  ./scripts/deploy-cd.sh beta                # déployer latest
  ```
- ✅ **`deploy-cd.sh` DÉTECTE et corrige désormais le retard du proxy (24/09/2026)** : `caddy_config_check` compare l'empreinte (`md5sum`) du `Caddyfile` du dépôt à celle **vue par le conteneur** ; en cas d'écart, il **valide** la config (`caddy validate --config`) puis recrée `caddy` (`--force-recreate --no-deps`). Une config invalide **ne touche pas** au proxy en service (l'ancienne reste en place, message explicite).
  - **Pourquoi c'était nécessaire — cause racine mesurée** : le compose monte **un fichier** (`./Caddyfile:/etc/caddy/Caddyfile`). Quand git **remplace** ce fichier, son **inode change** ; un bind-mount de fichier ne suit pas un remplacement et le conteneur reste collé à l'**ancienne** version **jusqu'à sa recréation**. Le correctif est donc **silencieusement inerte**, parfois des semaines. **Deux incidents réels, mêmes symptômes** : 23/08/2026 (`handle /assets/*` absent → images de la vitrine cassées, cf. §3e) puis 04/09 → 24/09/2026 (`handle /robots.txt` absent → la prod a servi la vitrine **HTML** en `200 text/html` sur `/robots.txt` **et** `/sitemap.xml` pendant 20 jours, constaté au `curl` le 24/09).
  - **Contrôle complémentaire** : `seo_check` vérifie ce qui est **réellement servi** après déploiement — `robots.txt` en `text/plain` sur les deux domaines, `sitemap.xml` en `200` sur la bêta et en **`404` sur la vitrine** (hors index pendant la bêta, cf. `Caddyfile` + `docs/plans/SEO_REPRISE.md`). Garde de non-régression : `tests/unit/seo-vitrine-prod.test.ts`.
  - **Recréation manuelle** (repli, si le script ne peut pas) :
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
- ⚠️ **GHCR Token sur le VPS** : PAT GitHub **classic**, scope **`read:packages` uniquement**, **sans expiration**, nommé `sigilos-vps-AAAA-MM`. Exporté dans `~/.bashrc` (`chmod 600`) et lu par `deploy-cd.sh`. `GHCR_TOKEN_EXPIRY` reste **optionnel** : le définir affiche un compte à rebours, l'omettre affiche « expiration non renseignée » (ligne grise, pas une alerte).
- 🔑 **Token sans expiration — rotation manuelle (décision du 20/10/2026)** : le token est **en lecture seule** (télécharger des images, jamais publier ni toucher au code) ⇒ risque accepté, **à condition** de pouvoir le révoquer en un clic.
  - **Créer / régénérer** : GitHub → Settings → Developer settings → Personal access tokens → **Tokens (classic)** → cocher **uniquement `read:packages`** → **Expiration : No expiration** → nommer `sigilos-vps-AAAA-MM` (la date de création sert de repère).
  - **Poser le token sur le VPS** (remplacer la ligne, ne pas empiler) :
     ```bash
     sed -i 's|^export GHCR_TOKEN=.*|export GHCR_TOKEN=<NOUVEAU_TOKEN>|' ~/.bashrc
     sed -i '/^export GHCR_TOKEN_EXPIRY=/d' ~/.bashrc   # plus de compte à rebours
     chmod 600 ~/.bashrc && source ~/.bashrc
     ```
  - **Tester le token sans rien déployer** : `list` ne fait **pas** de `docker login` (il réutilise `/root/.docker/config.json`), donc la preuve est un `pull` :
     ```bash
     echo "$GHCR_TOKEN" | sudo docker login ghcr.io -u klyx04 --password-stdin
     sudo docker pull ghcr.io/klyx04/sigilos-app-beta:latest
     ```
  - ⚠️ **Régénérer invalide immédiatement l'ancien secret** : `/root/.docker/config.json` garde l'ancien jusqu'au `docker login` suivant. Un `list` lancé entre-temps affiche `accès refusé (token GHCR périmé ?)` — c'est le token, pas les images (mesuré le 20/10/2026).
  - **Révoquer** : supprimer l'ancienne ligne dans GitHub dès que le nouveau token est validé (un seul token vivant).

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
- **Retirer un monde pour de bon** (ex. **19 « Mappemondes »** et **29 « Ecaflip City »**, supprimés le 28/09/2026) : les **données** sont versionnées (`worlds.json` 38→36 entrées, `worldmap.json` −653 maps, liste `DOFUS_WORLDS` de `src/lib/dofus-assets.ts`, spot de récolte isolé de `harvest-resources.json`) ⇒ un `deploy-cd.sh` les propage. Les **tuiles**, non versionnées, doivent être supprimées **des deux côtés** :
  ```powershell
  # Local (déjà fait) : Remove-Item -Recurse public/game-data/tiles/w19, w29
  # VPS — alias et chemin vivent dans .env.local (VPS_SSH_ALIAS_BETA/PROD, VPS_PATH_BETA/PROD) :
  ssh $env:VPS_SSH_ALIAS_BETA "rm -rf $env:VPS_PATH_BETA/public/game-data/tiles/w19 $env:VPS_PATH_BETA/public/game-data/tiles/w29"
  ssh $env:VPS_SSH_ALIAS_BETA "ls $env:VPS_PATH_BETA/public/game-data/tiles | tr '\n' ' '"   # vérif : ni w19 ni w29
  ```
  Verrou : `tests/unit/worldmap-worlds.test.ts` échoue si un monde exclu revient — plusieurs scripts régénèrent ces fichiers depuis DofusDB (`sync-worldmap*.ts`, `sync-maps.ts`, `siphon-raids-worlds.js`, `siphon-brigandins.js`).
- **Filigrane « DofusDB » des tuiles HD** (`public/game-data/hd_maps/*.webp`, **15 356 fichiers / 2 Go**, ignorés par git) : il est incrusté par le CDN DofusDB au téléchargement et s'affiche dans « Tuile HD », le panneau d'analyse, le survol de la carte et le révélé de Sigil Guesser. `scripts/clean-hd-maps-watermark.js` le recouvre par la bande d'image juste au-dessus (fondu sur les bords intérieurs ; dimensions et qualité webp 82 inchangées ⇒ tuile toujours alignée sur la grille) :
  ```bash
  node scripts/clean-hd-maps-watermark.js        # tout le dossier (~15-45 min selon les cœurs)
  ./scripts/sync-assets.sh beta && ./scripts/sync-assets.sh prod   # ~2 Go à repousser (tuiles non versionnées)
  ```
  `scripts/sync-world-hd-maps.js` applique le **même** traitement au téléchargement : une nouvelle tuile arrive propre.
- 🔁 **Rituel — siphonner un nouveau monde / sous-monde DofusDB (à rejouer tel quel à chaque ajout)** : le filigrane est mesuré **au même endroit sur tous les mondes** (x 1 727→1 890 · y 910→943 d'une image 1910×970, soit `W−183→W−20 / H−60→H−27`) ⇒ le traitement est **générique**, mais l'ordre compte :
  1. **Données** : `npx -y tsx scripts/sync-worldmap.ts` (et/ou `sync-worldmap-deep.ts`, `sync-maps.ts`, `siphon-raids-worlds.js`, `siphon-brigandins.js`) réécrivent `worldmap.json` / `worlds.json` depuis DofusDB. ⚠️ Ces scripts **ressuscitent** les mondes exclus (**19** « Mappemondes », **29** « Ecaflip City ») : `tests/unit/worldmap-worlds.test.ts` le signale — il suffit de **rejouer la suppression** ci-dessus. Étape **prérequis** des suivantes (elles lisent `worldmap.json`).
  2. **Tuiles OG** : `node scripts/sync-world-tiles.js <worldId>` — banques `1`, `0.75`, `0.5`, `0.25`, `custom2`, `custom3` (celles qui existent sont téléchargées), conversion `.jpg` → `.webp` dans `public/game-data/tiles/w<worldId>/<banque>/`. Résumable (tuiles déjà présentes sautées).
  3. **Tuiles HD** : `node scripts/sync-world-hd-maps.js <worldId>` — télécharge `https://api.dofusdb.fr/img/maps/1/<mapId>.jpg` (1910×970) et **applique `stripWatermarkBuffer` au vol** ⇒ les nouvelles tuiles arrivent **propres**, aucune passe de nettoyage à refaire. Résumable. **C'est la voie normale pour un nouveau monde.**
  4. **Nettoyage** — seulement pour des images arrivées par un **autre** chemin (ex. `siphon-brigandins.js`, qui écrit le `.webp` sans nettoyer) : `node scripts/clean-hd-maps-watermark.js` (`--dry-run` mesure sans écrire · `--limit N` · `--skip N` · `--only <mapId>`). ⚠️ **La retouche n'est pas idempotente** (elle recopie la bande de pixels située juste au-dessus) : ne **jamais** la rejouer sur des images déjà nettoyées — cibler les nouvelles (`--only` / `--skip`) ou repartir des `.webp` re-téléchargés à l'étape 3.
  5. **Publication VPS** : `./scripts/sync-assets.sh beta` puis `… prod` (PowerShell : `.\scripts\sync-assets.ps1 beta`) ⇒ **tout** `public/game-data/` d'un coup. ⚠️ Le 2ᵉ argument du `.ps1` ne vise **que** `tiles/<wNN>` (jamais `hd_maps`). Aucun rebuild : Caddy sert le volume `ro`.
  6. **Vérif** : `curl -s -o /dev/null -w "%{http_code}\n" https://beta.sigilos.fr/game-data/tiles/w<W>/1/1.webp` → **200**, idem `…/game-data/hd_maps/<mapId>.webp`, puis comparer taille/SHA256 local ↔ distant (`Get-FileHash -Algorithm SHA256` / `sha256sum`).
  - Rappels mesurés : le `rsync` de `sync-assets` **ne supprime rien** à distance (`--delete` absent) ⇒ un monde retiré se supprime **à la main** sur le VPS (commande ci-dessus) ; `tiles/` et `hd_maps/` étant **git-ignorés**, `deploy-cd.sh` ne les propage **jamais** — seul `sync-assets` publie.
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
  GET /assets/screenshots/map-monde.png    → 200 image/png
  GET /assets/ui/logo-v2.png               → 200 image/png   (favicon + og:image)
  ```
- **Faux positif `/assets/icons/favicon.svg`** : `maintenance.html` ne le référence pas (favicon réel =
  `/assets/ui/logo-v2.png`) ; le chemin n'existe pas → le `404` est **sans impact**.
- 🔁 **RÉCIDIVE (24/09/2026) — ce n'était pas un cas isolé** : même mécanisme, autre fichier. Le
  `handle /robots.txt` ajouté au `Caddyfile` le **04/09** n'a jamais été appliqué : pendant **20 jours**,
  `https://sigilos.fr/robots.txt` **et** `/sitemap.xml` renvoyaient la vitrine en `200 text/html`
  (mesuré au `curl`), et `sigilos.fr/zzz-inexistant` répondait `200` (soft-404). ⇒ Automatisé :
  `caddy_config_check` + `seo_check` dans `scripts/deploy-cd.sh` (cf. § « CI/CD » ci-dessus).
- ⚠️ **MAJ 20/09/2026 — les figures de la landing sont des MOCKUPS** : composants React vectoriels
  `src/components/landing/registre/*-mockup.tsx` (`dashboard-mockup.tsx`, `calendar-mockup.tsx`,
  `guide-mockup.tsx`, `missions-mockup.tsx`). `src/lib/landing-figures.ts`, son test, les 4 visuels
  `public/assets/screenshots/{dashboard-guilde,calendrier-sorties,missions-guilde,guide-sylvestre}.png`
  et les outils `capture-landing-visuels.mjs` / `crop-landing-visuels.mjs` / `probe-figure-slots.mjs`
  ont été **supprimés le 20/09/2026** (motif : plus aucune capture du produit en PNG — les pseudos de
  membres y étaient visibles et une capture 4K était réduite ×5 dans son cadre). L'image de partage
  social est désormais `public/assets/landing/bg-guild.jpg` (1250×639), référencée par
  `public/maintenance.html`. Le profil Playwright (`.playwright-profile/`) se recrée avec
  `node scripts/capture-screenshots.mjs --login`. **Les avertissements ci-dessous restent valables pour
  les visuels servis par `next/image`** — et depuis le **12/10/2026** les docs des modules n'en
  portent plus aucun (les 14 captures de `public/assets/screenshots/` ont été retirées et les 13
  fichiers supprimés) : seul `map-monde.png` reste servi (embed du bot `GeoguesserManager`).
- ⚠️ **Remplacer un visuel se fait sous un NOUVEAU nom de fichier** (piège mesuré le 17/09) :
  `next/image` sert `/_next/image?url=…&w=…&q=…`, une URL **indépendante du contenu du fichier** → écraser
  une image au même nom laisse le **navigateur** afficher l'ancienne, **même après `Ctrl+Shift+R` et alors
  que le serveur sert bien la nouvelle** (fait constaté : `screenshot1.png` remplacé, la page inchangée —
  `GET /assets/screenshots/<nom>.png` renvoyait un `sha256` **identique au fichier local**, et
  `GET /_next/image?url=…&w=640&q=75` les dimensions du nouveau fichier ; l'ancienne image venait du cache
  du client). Marche à suivre : déposer le visuel sous un **nom neuf**, mettre à jour ses références
  (`git grep`), et ne réutiliser l'ancien nom que là où il sert encore. Cas réel :
  `screenshot1.png` (3280×1740) → `tableau-de-bord.png` (1913×704).
- ⚠️ **Un visuel servi par `next/image` doit faire AU MOINS 2× la largeur de son cadre** : `next/image`
  **ne remonte jamais** une image — une demande `w=1920` sur un fichier de 1080 px renvoie du 1080 px, et
  c'est le **navigateur** qui agrandit (rendu mou, perçu comme « amateur », sans que le fichier soit en
  cause). Recadrer une capture 4K ne répare rien : ça zoome sur un fragment (texte coupé en plein mot,
  bouton amputé, curseur figé). Cible : **≈ 2× la largeur d'affichage** (1100-1300 px) et **un seul sujet
  lisible** par visuel. Producteur des captures de l'application (guides) :
  `node scripts/capture-screenshots.mjs` (profil `.playwright-profile/`, `--login` une fois).
  ⚠️ Une capture par **outil système** (clic droit → « Capturer la page ») embarque le **curseur** et la
  **pastille de dev Next** (`nextjs-portal`) : Playwright ne les capture pas.
- ⏳ **Repo VPS non migré** : toujours sur `dev` (arbre sale : stashes + `public/game-data` modifié).
  Le passage à `main` et le nettoyage restent **à planifier** — avant tout switch de branche, faire
  backup + nettoyage de `public/game-data` et des stashes.


---

### 📌 Priorité recommandée (mise à jour 2026-08)
**Fait** : phase 1, 3a (rollback), 3b (CI/CD GHCR), **3c (Redis séparé — déployé beta 09/08)**.
**Reste** :
1. **Phase 2** (image de base partagée) — optionnel, le CI/CD règle déjà le build redondant sur le VPS.
2. **Vérifier `GHCR_TOKEN`** (sans expiration : le remplacer/révoquer en cas de doute) — cf. section 3b.



---

## 🌿 Guide Rush Sylvestre — rafraîchir les données d'un environnement (bêta / prod)

Le guide vit **en base** (`GuideMilestone` / `GuideSequence`), seedé depuis le **dataset versionné**
`src/data/rush-sylvestre-guide.json` (source unique, committée). Trois commandes, dans cet ordre,
**par environnement** :

| Étape | Commande | Effet |
|---|---|---|
| 1. Seed / re-seed | bouton **« Importer »** de `/god/rush-sylvestre` **ou** `node scripts/seed-rush-sylvestre-cli.mjs --apply` | crée/enrichit les blocs et quêtes **sans perte** (appariement par bloc + nom normalisé) |
| 2. Doublons (contrôle) | `node scripts/prune-rush-guide-orphans.mjs` | **ne supprime rien**, liste les quêtes absentes du dataset |
| 3. Doublons (suppression) | `node scripts/prune-rush-guide-orphans.mjs --apply` | supprime ces quêtes (les **blocs** absents sont seulement signalés) |

- **Pourquoi le prune** : un dataset qui renomme une quête laisse l'ancienne ligne **à côté** de la
  nouvelle. Mesuré le 08/10/2026 sur `rush-sylvestre` : **26 lignes fantômes** d'un import antérieur
  (quêtes reprises « à point final »), dont **13 affichant encore des tags `item` « Objet »** —
  visibles **jusque dans le guide public**.
- **Dans le conteneur** : l'image *standalone* embarque désormais le dataset **et** les deux petites
  dépendances des CLI (`dotenv`, `@prisma/adapter-pg`) — `next.config.ts`
  (`outputFileTracingIncludes`) : l'image ne copie pas `src/` (`/app/src/data` était **absent**,
  mesuré) et **le bouton d'import du guide échouait donc sur la bêta et la prod**.
- **Hors environnement** : `scripts/enrich-rush-guide-items.mjs` (trame siphonée → vrais noms + ids
  d'objets) est un outil de **session** — il lui faut la trame HTML ; on le joue là où le siphon est
  fait, **avant** de committer le dataset (il n'écrit rien en base : re-seeder ensuite).

### Rejouer le contenu **S1** (Ordres, classes, cités, variantes) après un déploiement

> **Mesuré le 27/10/2026.** Le contenu S1 n'est **pas** dans le dataset seedé : il a été produit par
> l'outil Trame (`src/temp/trame-rush/`, **hors dépôt**) puis **importé** dans God ▸ JSON, suivi de
> **3 correctifs SQL**. Les exports sont **portables** : tout se rapproche **par nom** (aucun cuid de
> donjon, aucun id de guilde), et les `questDbIds` sont des ids DofusDB (universels).

**Ordre obligatoire : le code d'abord, les données ensuite** — l'import n'écrit le tag
`choice_group` que si le serveur porte le modèle (`src/lib/rush-choice-groups.ts`).

| # | Action | Où | Attendu sur un environnement vierge |
|---|---|---|---|
| 1 | `./scripts/deploy-cd.sh <env>` | VPS | l'app tourne (bouton **`JSON`** disponible) |
| 2 | `export-god-ordres.json` | God ▸ **JSON** ▸ dry-run ▸ Appliquer | 6 blocs · **30** quêtes · 0 avertissement |
| 3 | `export-god-classes.json` | idem | 1 bloc · **19** quêtes |
| 4 | `export-god-cites.json` | idem | 6 blocs · **104** quêtes |
| 5 | `export-god-variantes.json` | idem | 0 bloc · **3** quêtes |
| 6 | SQL `01` → `02` → `03` (ci-dessous) | `docker exec -i sigilos-db-<env> sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f -'` | contrôles dans chaque fichier |

```bash
# sur le VPS, après les 5 étapes ci-dessus
for f in 01-tag-alignreq 02-tag-choice-groups 03-fix-bonta-order; do
  echo "── $f ──"
  docker exec -i sigilos-db-<env> sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f -' < ~/$f.sql
done
```

**Pièges mesurés**
- Jouer les SQL **avant** les imports ne casse rien mais **ne fait rien** (les 5 variantes et les 2 quêtes
  n'existent pas encore) — constaté en bêta le 27/10/2026.
- Les scripts de `src/temp/` ne sont **pas** dans l'image (non tracés) : d'où le SQL. Les CLI de
  `scripts/` (seed / prune) sont, elles, embarquées par `outputFileTracingIncludes`.
- Le doublon « Entraînement avec JF » n'est supprimé **que s'il ne porte aucune progression** :
  `doublon_jf = 1` en fin de `03` = un joueur l'avait cochée, on ne force pas.
- **Idempotence** : un second passage affiche `UPDATE 0` / `DELETE 0`. C'est normal, pas un échec.

**État au 27/10/2026** : bêta **rejouée** (contrôles : `100` · `55 → 3` · `66 → 2` · `0` doublon) ·
**prod à faire** avec la même séquence.

#### `01-tag-alignreq.sql` — repose le camp sur les quêtes de cité déjà présentes

```sql
BEGIN;

UPDATE "GuideSequence" s
SET "alignReq" = 'bontarien'
FROM "GuideMilestone" m, "OptimizedGuide" g
WHERE m.id = s."milestoneId"
  AND g.id = m."guideId"
  AND g.slug = 'rush-sylvestre'
  AND m.title LIKE 'Alignement Bonta (%'
  AND s."alignReq" IS NULL;

COMMIT;

-- Contrôle : 100 quêtes de cité bontariennes attendues.
SELECT count(*) AS cites_bontariennes
FROM "GuideSequence" s
JOIN "GuideMilestone" m ON m.id = s."milestoneId"
JOIN "OptimizedGuide" g ON g.id = m."guideId"
WHERE g.slug = 'rush-sylvestre' AND s."alignReq" = 'bontarien' AND s."alignOrderCode" IS NULL;
```

#### `02-tag-choice-groups.sql` — pose le groupe de choix (55 / 66)

```sql
-- 02 — étapes à choix : tag choice_group (55 = 3 variantes, 66 = 2). Idempotent.
BEGIN;

UPDATE "GuideSequence" SET "activityTags" = "activityTags" || '[{"type":"choice_group","name":"55"}]'::jsonb
WHERE "subGuideName" = 'Le magnanime' AND NOT ("activityTags" @> '[{"type":"choice_group"}]'::jsonb)
  AND "milestoneId" IN (SELECT m.id FROM "GuideMilestone" m JOIN "OptimizedGuide" g ON g.id = m."guideId" WHERE g.slug = 'rush-sylvestre');

UPDATE "GuideSequence" SET "activityTags" = "activityTags" || '[{"type":"choice_group","name":"55"}]'::jsonb
WHERE "subGuideName" = 'Les kamas résolvent tout' AND NOT ("activityTags" @> '[{"type":"choice_group"}]'::jsonb)
  AND "milestoneId" IN (SELECT m.id FROM "GuideMilestone" m JOIN "OptimizedGuide" g ON g.id = m."guideId" WHERE g.slug = 'rush-sylvestre');

UPDATE "GuideSequence" SET "activityTags" = "activityTags" || '[{"type":"choice_group","name":"55"}]'::jsonb
WHERE "subGuideName" = 'Assassinat effectué' AND NOT ("activityTags" @> '[{"type":"choice_group"}]'::jsonb)
  AND "milestoneId" IN (SELECT m.id FROM "GuideMilestone" m JOIN "OptimizedGuide" g ON g.id = m."guideId" WHERE g.slug = 'rush-sylvestre');

UPDATE "GuideSequence" SET "activityTags" = "activityTags" || '[{"type":"choice_group","name":"66"}]'::jsonb
WHERE "subGuideName" = 'Les ordres sont-ils les ordres ?' AND NOT ("activityTags" @> '[{"type":"choice_group"}]'::jsonb)
  AND "milestoneId" IN (SELECT m.id FROM "GuideMilestone" m JOIN "OptimizedGuide" g ON g.id = m."guideId" WHERE g.slug = 'rush-sylvestre');

UPDATE "GuideSequence" SET "activityTags" = "activityTags" || '[{"type":"choice_group","name":"66"}]'::jsonb
WHERE "subGuideName" = 'On m''appelle l''Escargot' AND NOT ("activityTags" @> '[{"type":"choice_group"}]'::jsonb)
  AND "milestoneId" IN (SELECT m.id FROM "GuideMilestone" m JOIN "OptimizedGuide" g ON g.id = m."guideId" WHERE g.slug = 'rush-sylvestre');

COMMIT;

-- Contrôle : 55 → 3, 66 → 2 (lecture du tag PARMI les tags, pas seulement en position 0).
SELECT (SELECT t->>'name' FROM jsonb_array_elements(s."activityTags") t WHERE t->>'type' = 'choice_group') AS groupe,
       count(*) AS sequences
FROM "GuideSequence" s
JOIN "GuideMilestone" m ON m.id = s."milestoneId"
JOIN "OptimizedGuide" g ON g.id = m."guideId"
WHERE g.slug = 'rush-sylvestre' AND s."activityTags" @> '[{"type":"choice_group"}]'::jsonb
GROUP BY 1 ORDER BY 1;
```

#### `03-fix-bonta-order.sql` — doublon, remise en place, bloc vide

```sql
BEGIN;

-- a) « Entraînement avec JF » = copie de « Entraînement avec Tarche » (DofusDB 55), nom inexistant
--    dans le jeu. Supprimé UNIQUEMENT s'il ne porte aucune progression.
WITH cible AS (
  SELECT s.id FROM "GuideSequence" s
  WHERE s."subGuideName" = 'Entraînement avec JF'
    AND s."dofusdbUrl" LIKE '%/quest/55'
    AND s."milestoneId" IN (SELECT m.id FROM "GuideMilestone" m JOIN "OptimizedGuide" g ON g.id = m."guideId" WHERE g.slug = 'rush-sylvestre')
    AND NOT EXISTS (SELECT 1 FROM "PlayerGuideProgress" p WHERE p."completedSteps" @> to_jsonb(s.id::text))
)
DELETE FROM "GuideSequence" WHERE id IN (SELECT id FROM cible);

-- b) Bandanarthrie (#65) = 1re quête de « Alignement Bonta (65 à 70) » (le bloc commence à 1).
UPDATE "GuideSequence"
SET "milestoneId" = (SELECT m.id FROM "GuideMilestone" m JOIN "OptimizedGuide" g ON g.id = m."guideId" WHERE g.slug = 'rush-sylvestre' AND m.title = 'Alignement Bonta (65 à 70)'),
    "order" = 0
WHERE "subGuideName" = 'Bandanarthrie'
  AND "milestoneId" IN (SELECT m.id FROM "GuideMilestone" m JOIN "OptimizedGuide" g ON g.id = m."guideId" WHERE g.slug = 'rush-sylvestre')
  AND EXISTS (SELECT 1 FROM "GuideMilestone" m JOIN "OptimizedGuide" g ON g.id = m."guideId" WHERE g.slug = 'rush-sylvestre' AND m.title = 'Alignement Bonta (65 à 70)');

-- c) Le subterfuge de la corne (#70) = 1re quête de « Alignement Bonta (70 à 85 + Ordre 4) ».
UPDATE "GuideSequence"
SET "milestoneId" = (SELECT m.id FROM "GuideMilestone" m JOIN "OptimizedGuide" g ON g.id = m."guideId" WHERE g.slug = 'rush-sylvestre' AND m.title = 'Alignement Bonta (70 à 85 + Ordre 4)'),
    "order" = 0
WHERE "subGuideName" = 'Le subterfuge de la corne'
  AND "milestoneId" IN (SELECT m.id FROM "GuideMilestone" m JOIN "OptimizedGuide" g ON g.id = m."guideId" WHERE g.slug = 'rush-sylvestre')
  AND EXISTS (SELECT 1 FROM "GuideMilestone" m JOIN "OptimizedGuide" g ON g.id = m."guideId" WHERE g.slug = 'rush-sylvestre' AND m.title = 'Alignement Bonta (70 à 85 + Ordre 4)');

-- d) Bloc créé par l'import, devenu vide : supprimé (jamais un bloc porteur de quêtes).
DELETE FROM "GuideMilestone"
WHERE title = 'Alignement Bontarien — palier 80'
  AND "guideId" IN (SELECT id FROM "OptimizedGuide" WHERE slug = 'rush-sylvestre')
  AND NOT EXISTS (SELECT 1 FROM "GuideSequence" s WHERE s."milestoneId" = "GuideMilestone".id);

COMMIT;

-- Contrôle : 100 cités bontariennes attendues, 0 doublon « JF ».
SELECT count(*) FILTER (WHERE s."alignReq" = 'bontarien' AND s."alignOrderCode" IS NULL) AS cites_bonta,
       count(*) FILTER (WHERE s."subGuideName" = 'Entraînement avec JF') AS doublon_jf
FROM "GuideSequence" s
JOIN "GuideMilestone" m ON m.id = s."milestoneId"
JOIN "OptimizedGuide" g ON g.id = m."guideId"
WHERE g.slug = 'rush-sylvestre';
```

> **Encodage** : les noms comportent des accents (`é`, `à`). Passe les fichiers **en flux** (`< ~/01-….sql`)
> ou colle-les depuis un client en `UTF8` (`SHOW client_encoding;`) — un pipe qui ré-encode (PowerShell →
> psql) casse les correspondances par nom (mesuré : 2 lignes sur 5 muettes).


