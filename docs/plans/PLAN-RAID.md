---
description: Plan RAID — tout ce qui est prévu autour des raids (calendrier, clôture/no-show, strat, overlay, données) : relevé mesuré du 01/10/2026, décisions à trancher, lots
---

# ⚔️ Plan RAID — calendrier, clôture/no-show, strat, overlay, données

> **Source** : consigne volatile `src/temp/consigne-2026-09-30-raid-calendrier-mini-jeux.md` (§1→§25, **gitignorée**),
> **restructurée le 01/10/2026** : chaque lot porte BESOIN → ÉTAT MESURÉ → CHANGEMENTS numérotés (fichiers:lignes)
> → TESTS → ACCEPTATION → VIGILANCE, avec une **taille indicative** (`[S]` < 1 j, `[M]` quelques jours, `[L]` chantier).
> La consigne sera **supprimée** en fin de chantier : **ce fichier est le dossier durable de tout ce qui touche au
> RAID** ; le reste (mini-jeux, marché, succès, services, logs, ressources, missions, guides, ladder) reste dans la
> consigne puis au `docs/ROADMAP.md`.
> **Amorce d'exécution** : `docs/plans/AMORCE-RAID.md` (elle cadre la session ; **ce plan porte le contenu**).
> **L'ordre qui fait foi** est celui de la consigne, section « **Ordre de réalisation (reste)** » :
> **P0 sécu (RBAC `bounties`/`calendar`/`relance`, §23)** → **§4** miroir → **§14** no-show → §12 → §10 → §5 → §6 →
> §7 → §8 → §9 → §11 → §15 → §16 → §17 → §18 → §19 → **§20** Guides + modale raid → §21 → §22 → §23 → §2 mini-jeux.
> **Statut 01/10/2026** : **livrés** — §1 classes (PR #815), §3 rappel de clôture 24 h (PR #816), §24 Qilby (#817),
> §25 overlay raid `/travel` (#819). **Restent côté raid** : R0 (P0 sécu), R1 clôture/no-show, R2 strat + guides,
> R3 agenda miroir, R4 overlay Simulation, R5 rangs 1-5, R6 maps multi-donjons, R7 vignettes, R8/R9/R10 (déslop).

## 0. Déjà livré — ne pas refaire

| § | Livré | Ce qui est en place (détail durable) |
|---|---|---|
| **§1** | **PR #815** `9427a9f1` | Classes du calendrier : règle **unique** `resolveEffectiveClass` (`src/lib/dofus-assets.ts`, repli `UserProfile.classe`), pictos sur les **2** constructeurs d'embed (`src/server/calendar-service.ts`), fenêtre Discord « Mes personnages » (sans nouveau bouton), raccourci côté site, sélecteur « ma classe » (`updateMyRegistrationClass`). |
| **§3** | **PR #816** `92d7ccd0` | Rappel de clôture de raid **24 h** : `shouldSendRaidClosureReminder` + `sendRaidClosureReminders()` branchés **dans la tâche `raid-reminders` existante** (0 ligne de crontab en plus), ping du **seul** `creatorId`, message nettoyé à la clôture ; un raid n'est **plus** clôturé d'office avant **+48 h** (règle unique `src/lib/calendar-auto-close.ts`, **4** appels). Détails : `docs/ROADMAP.md`, bloc 01/10/2026. |
| **§24** | **PR #817** `37359644` | Qilby : map d'arène (`src/lib/qilby-map.ts`), sorts du repli DofusDB avec `effectDetails.damage`, fit auto en plein écran — **c'est la donnée de la simulation de l'overlay** ⇒ **ne pas casser** en R4. |
| **§25** | **PR #819** `7f6d3930` | **Overlay raid** : `/travel` cliquables (`parseCoordinates`), retour Willorque guidé (`linkedRouteId`, FR+EN), boutons Overlay + Guide sur `/raids`. **La base de l'overlay raid existe** : R2 la complète (strat dans la modale), elle ne la remplace pas. |

## 1. R0 — P0 SÉCURITÉ : RBAC du module calendrier (consigne §23, « critiques ») — **à faire EN PREMIER**

**Constat mesuré (consigne §23)** : parmi les écrans « critiques », **`calendar/page` est signalé « zéro auth »**, aux côtés de `bounties/page` (client sans gate + action God) et de `relance` (redirect sans contrôle de droits). L'ordre officiel de la consigne place ce **P0 sécu en premier**, **avant** le miroir (§4) et le no-show (§14).

**À faire** : garde d'accès **fail-closed** sur `src/app/dashboard/[guildId]/calendar/page.tsx` (patron des autres pages : `getUserContext` + `canViewCalendar` + module ON) **et** vérification que **chaque action serveur** du calendrier re-garde (règle AGENTS §5.1 : page **et** action). Audit si un correctif touche une action God.

**Preuve** : un membre **sans** droit calendrier reçoit le refus (capture) ; test unitaire de la garde (contexte absent ⇒ **refus**, jamais d'accès par défaut).

**⚠️ Hors raid** : `bounties` et `relance` relèvent du volet God/admin de §23 — les traiter **dans le même P0** (même PR ou PR sœur), sinon le P0 reste à moitié fait.

**Vigilance** : c'est le **premier** lot de l'ordre officiel ⇒ **aucune décision ni migration** à attendre pour le démarrer.

## 2. R1 — Clôture raid + no-show (consigne §14) — **le cœur du chantier**

**Écart mesuré le 01/10/2026 (ancres revérifiées sur `dev`)**

| Aujourd'hui | Ancre |
|---|---|
| `completeRaidEvent` = score + `presentUserIds`, XP/Kamas aux **présents seuls**, garde `canManageCalendar` **seule** | `src/server/actions/calendar-actions.ts:1146` (écrit `raidPresentUserIds` `:1182`) |
| `undoCompleteRaidEvent` = fenêtre 24 h, rembourse — mais `raidPurpleKamasCost` **jamais stocké** (repli `?? 30`) | `:1231` · `:1265` · reset `:1287` |
| Modale de clôture : **tout coché par défaut**, aucun bloc « absents », attestation **client seule** | `src/components/calendar/event-detail-modal.tsx` (bloc clôture raid) |
| Droits `RAID_OFFICER` **jamais utilisés en clôture** ; ni `creatorId` ni `raidCaptainId` vérifiés | `src/lib/permissions.ts:35-36`, `:198-203`, `:258-259` |
| **Aucun audit** de clôture (alors que bonus et marché en ont) | — |
| **Statuts de présence inexistants** : `EventParticipant` n'a que `REGISTERED/RESERVE/CONFIRMED`, et `metadata.raidPresentUserIds` n'est **pas requêtable** | `prisma/schema.prisma` (`EventParticipant`) |

**Changements (spec de la consigne §14, revérifiée le 01/10/2026)**
1. **Table `RaidPresence`** (`guildId`, `eventId`, `userId`, statut `PRESENT / PREVENU / EXCUSE / NO_SHOW`, `@@unique[eventId, userId]`, **index 90 j**) : **écriture dans `completeRaidEvent`** (`calendar-actions.ts:1146`, aujourd'hui `metadata.raidPresentUserIds` `:1182`) et **suppression dans `undoCompleteRaidEvent`** (`:1231`) — aujourd'hui ce `metadata` n'est **pas requêtable**.
2. **Modale** : bloc « Absents » **dès la décoche** + `select` de motif + **validation bloquante** + attestation **chiffrée** (« X présents débités, N no-shows ») — aujourd'hui tout est coché par défaut et l'attestation n'est **pas** vérifiée côté serveur.
3. **Droits** : brancher `RAID_OFFICER` / `canManageRaid` + `creatorId` / `raidCaptainId` (aujourd'hui `canManageCalendar` **seul**) ; **trancher** le facteur Kamas `*10` vs `*10 000` (`:1203`) **et** stocker `raidPurpleKamasCost` (`:1265`, repli `?? 30`).
4. **Colonne « registre »** après Journal (gate **staff**, **jamais** l'annuaire public) + enrichir `getGuildMembers` / `LifecycleMemberSummary` (`xp` / `kamas` existent en base mais ne sont pas sélectionnés).
5. **Correction officier** + `createAuditLog` **avant → après** (aucun audit de clôture aujourd'hui, alors que bonus et marché en ont).

**Tests attendus** : motif obligatoire (on ne valide pas sans statuer sur chacun), `undo` **restaure tout**, compteur 90 j juste, RBAC (un membre lambda est **refusé**).
**Vigilance** : **aucune sanction automatique** au départ d'un membre (mesurer d'abord — une règle « 2 no-shows / 30 j » pourra venir plus tard).

**2 arbitrages à trancher AVANT de coder**
- **Facteur Kamas Violets** : `*10` (`calendar-actions.ts:1203`) vs `*10 000` (seuil d'inscription) — incohérence signalée par la consigne ;
- **Stocker `raidPurpleKamasCost`** au moment de la clôture (sinon l'`undo` rembourse une valeur de repli).

**Risque / migration** : **1 migration additive** (table de présences) ⇒ **ARRÊT + accord explicite** (AGENTS §7.7) ; l'écrire idempotente, jamais destructive.

**DoD** : statuts privés (aucune fuite publique), `undo` = état **exactement** d'avant clôture (test sur les 4 dimensions), audit présent sur clôture **et** correction, compteur visible officier seulement, non-régression : un participant **actif** garde ses droits actuels.

## 3. R2 — Modale raid « strat » + guides internes (consigne §20, `[S/M]`)

**À faire**
1. **Bloc « strat » dans la modale raid** (`src/components/calendar/event-detail-modal.tsx`, après le bloc `raidLabel`) sur le **patron du bloc « Objectifs »** : `DialogContent sm:max-w-3xl` + `ScrollArea` + `DocContent` + `GuideTocSidebar`, **sans redirection** (on ne quitte pas le raid pour lire la strat).
2. **Slugs de guides raid** déjà présents côté données (`src/lib/raid-overlay-data.ts` : `raid-gigalodon`, `raid-sanctuaire`) — les brancher, ne pas réécrire de contenu.
3. **Bouton overlay** via `src/hooks/use-raid-overlay.ts` (`openRaidOverlay`, PiP 420×720, store dédié) — **jamais** `use-boss-overlay` (c'est l'overlay boss, autre sujet) ; le CTA existant `RaidOverlayLaunchBanner` reste la porte d'entrée.
4. **Guides internes** : `GuidesGrid` affiche des cartes **sans image ni filtre** alors que le registre (`GUIDE_REGISTRY`) porte `coverImage` / `readingTime` / `category` (vignettes déjà en place : Gigalodon `/images/guides/gigalodon/…`, Jardins `/images/guides/sanctuaire/…`) ⇒ même carte que `/guides` public + filtre catégorie/recherche.

**DoD** : la strat s'ouvre dans la modale du raid (aucune redirection), l'overlay s'ouvre en PiP depuis le raid, les cartes de guides affichent leur vignette et se filtrent, non-régression : `use-boss-overlay` et les fiches boss sont **intactes**.

## 4. Correctifs qui touchent directement le raid (R3 → R7)

### R3 — Agenda : miroir lecture seule DJ/Songes (consigne §4)
- **Principe** : la source reste le post DJ (`DjSearchPost`) / la run Songes (`DreamRun`) — **cartes et embeds Discord intouchés**. Le calendrier ne reçoit qu'une **copie miroir** `GuildEvent` : `metadata.source = { kind: 'DJ'|'SONGES', djPostId|dreamRunId }`, titre `[DJ] <donjon>` / `[Songes] <palier>`, `start/end` dérivés (`targetDate` / `scheduledAt`, durée par défaut 2 h), lien profond vers le post d'origine.
- **Sync** : post daté → crée l'Event ; date ajoutée après coup → crée ; date changée → patch `start/end` ; date retirée, post fermé ou supprimé → miroir `CANCELLED` **puis** purge ; sans date → **rien** (cohérent avec les crons H-1) ; multi 2-5 dates (`dungeonsJson`) → **1 seul** Event chapeau (min-max) détaillé en description (pas de bruit dans l'agenda).
- **Modale lecture seule** (`EventDetailReadonly`, flag `isMirrored`) pour **tout le monde**, créateur et admin compris : aucun bouton Éditer / Supprimer / Clôturer / Transférer / Inscrire, **seul** CTA « Ouvrir le post DJ/Songes ». RBAC fail-closed : même `isAdmin` ne débloque rien (toute action se fait dans le post d'origine).
- **Filtre sans surcharge** : 2 pastilles **repliées** `SONGES_RUN` / `DUNGEON_FARM` avec compteurs dans `calendar-dashboard.tsx` (au lieu de 11 pastilles), titre d'agenda unifié.
- ⚠️ **C'est le correctif le plus proche du raid après R1/R2** : il écrit dans la **table commune** `GuildEvent` (donc isolation `guildId` et nettoyage à revérifier partout).

### R4 — Overlay Simulation + anomalies sans stats (consigne §6)
- **Cause mesurée** (pas un bug d'affichage) : `Larve de Rushu` est hors des races siphonnées ⇒ pas de ligne `MonsterStat` ⇒ `getMonsterStats` **fail-closed** ⇒ « Aucune donnée » dans l'overlay et « — » sur la fiche. Fix : élargir le siphon (inclure Rushu, ou siphon par id), lectures **local-only** comme les avis, `stale` **daté**, crons `sync-dofensive-maps` + `sync-monster-stats` verts.
- **Overlay 380×680** (onglets Stats / Sorts / Simulation / Butin) : **1 toolbar unique** (Boss libre + sort PA·PO + map + zoom + Options + Légende), **map visible sans menu**, Options unifiées en 3 sections, prévisu en **rail latéral** (replié par défaut, jamais superposé en PiP), « Ordre d'apparition » **cliquable**, zoom non ronds + un seul `Fit`, déslop mesuré (rayons 3/4/6, 0 blur/shadow/italic).

### R5 — Bug des rangs G1-G10 (consigne §7)
- **Cause** : DofusDB renvoie **10 grades** pour certains monstres (1-5 réels progressifs, 6-10 aplatis, `scaleGradeRef: 5`) et nous mappons **1:1** ⇒ `G1-G10` dans l'overlay raid / boss, « Rang 1-10 » par défaut dans l'encyclopédie, `g5` faux, taux de butin hors-borne dès l'index ≥ 5.
- **Fix** : règle **pure** `normalizeMonsterGrades` (garder 1-5 via `scaleGradeRef`, dédupliquer) appliquée aux **3** producteurs, recalcul de `gradesCount` / `g5`, et **découpler** le palier de butin (`B4+idx`) de `grades.length` (le dériver de `percentByGrade` / `lootCount`).

### R6 — Maps multi-donjons (consigne §8)
- **Cause** : chaîne **mono-hit** — `getDofensiveDungeonForBoss`, `getLocalDofensiveDungeonAny` et `getDungeonMonsters` ne retiennent que le **premier** hit, puis `SpellRangeGrid` filtre sur ce seul donjon. D'où : Servitude résolue en « Fers » (Tempête invisible) et Armécréante carrément sur le mauvais donjon.
- **Fix** : résoudre **tous** les hits contenant le monstre (via `Monsters[]` + `monster.Dungeons[]`), **union** dédupliquée par id, `isBoss` = union des `PreferredMaps`, clé de cache `monstre+donjon`, filtre inchangé appliqué à l'union, garder la `Map vide 17×17` quand il n'y a rien.
- **Impact raid** : ce sont les **cartes tactiques** consultées pour préparer un raid.

### R7 — Dashboard vie : vignettes raid/event (consigne §15)
- Agenda fade (`upcoming-events-widget.tsx`) : 7 j / 6 events **sans image** alors que le référentiel `calendar-event-images.ts` + `calendar-event-theme.ts` existe ⇒ brancher `resolveEventImagePath` + picto de type.
- `RaidHeroBanner` : **texte seul** aujourd'hui ⇒ visuel.
- Activité guilde : la source actuelle ignore DJ, marché, succès ⇒ ajouter 3 requêtes (DJ `CLOSED`, marché `SOLD`, succès `VALIDATED`) + mapping (labels morts `ACHIEVEMENT/DJ_POST/STUFF` jamais émis).

## 5. Effleurent le raid (R8 → R10)

### R8 — Filtre et en-têtes du calendrier (consigne §16, partie calendrier)
- `FILTER_TYPE_KEYS` = **4** clés, et `OTHERS` est **créable** dans le formulaire mais **aucun bouton** ne le filtre (⇒ événements infiltrables) : ajouter `OTHERS` (+ replier `SONGES` / `DUNGEON`).
- En-têtes de module : `UnifiedModuleHeader imageSrc` passe par `_next/image` sur `/assets/ui/icons/*.png` (dont le calendrier, blanc invisible) ⇒ `DofusUiIcon` (`calendar` / `guild` / `player`) ou rien (`icon: LucideIcon` existe déjà).

### R9 — Responsive des rosters (consigne §22 / §23)
- « tableaux roster sans `overflow-x` » = **les rosters de raid** ⇒ conteneur `overflow-x-auto` + `min-w` cohérent (le patron existe déjà ailleurs : table du marché, `calendar min-w-840 scroll`).
- `CalendarDashboard` (grille `min-w-840`) : mobile propre — scroll horizontal assumé **ou** bascule en cartes, **à trancher par la mesure**, pas au feeling.

### R10 — Modales et boutons (consigne §23, volet modales)
- Passe de déslop **ciblée** sur les modales du raid (fiche d'événement + dialogs de clôture) : registre `globals.css` (rayons 3/4/6 px, **0** glow/gradient/blur, vert action, mono), `w-[95vw]` en mobile, jamais de `rounded-[2rem]`/`blur-xl`.

## 6. Ordre d'exécution — **celui de la consigne** (« Ordre de réalisation (reste) »), 1 lot = 1 branche = 1 PR → `dev`**

> L'ordre qui fait foi est **celui de la consigne** (elle liste aussi les lots non-raid) : **P0 sécu** → §4 → §14 →
> §12 → §10 → §5 → §6 → §7 → §8 → §9 → §11 → §15 → §16 → §17 → §18 → §19 → §20 → §21 → §22 → §23 → §2.
> Ci-dessous, **les lots raid dans cet ordre** (les lots non-raid s'intercalent — ils ne sont pas dans ce dossier).

| Lot | Chantier | Position dans l'ordre officiel | Ampleur | Migration |
|---|---|---|---|---|
| **R0** | **P0 sécu** — RBAC `calendar` (+ `bounties`, `relance`) | **1ᵉʳ** | petit | non |
| **R1** | §4 agenda : miroir lecture seule DJ/Songes | **2ᵉ** | moyen + | non |
| **R2** | §14 clôture + no-show — **le cœur** | **3ᵉ** | **M/L** | **OUI** (additive) |
| **R3** | §6 anomalies sans stats + overlay Simulation | 8ᵉ | M | non |
| **R4** | §7 rangs de monstre 1-5 | 9ᵉ | M | non |
| **R5** | §8 maps multi-donjons (générique) | 10ᵉ | M | non |
| **R6** | §15 dashboard vie (vignettes raid/agenda + activité) | 14ᵉ | S/M | non |
| **R7** | §20 guides internes + **modale raid strat** | 20ᵉ | S/M | non |
| *(R8)* | §16 volet **calendrier** (filtre `OTHERS`, en-têtes) | 15ᵉ | M (lot partagé) | non |
| *(R9)* | §22/§23 volet **rosters responsive + modales** | 23ᵉ | M/L (lot partagé) | non |

**Ce que ça change par rapport à la première version de ce plan** : **R2 (no-show) passe de « en dernier » à 3ᵉ** ⇒
les 2 arbitrages (**facteur Kamas Violets**, **stockage de `raidPurpleKamasCost`**) deviennent **urgents**, et **R7
(strat + guides) passe en fin de file** (20ᵉ). Le **P0 sécu ouvre le bal** et ne dépend d'aucune décision.

## 7. Pièges et hygiène (mesurés le 01/10/2026)

1. **La consigne a été restructurée et détaillée le 01/10/2026** (BESOIN → ÉTAT MESURÉ → CHANGEMENTS → TESTS → ACCEPTATION → VIGILANCE, tailles `[S]/[M]/[L]`) : **ses défauts précédents sont corrigés** (plus de `## 12` en double, plus de blocs « Ordre proposé » contradictoires, plus de bullets §13 recopiées), et **son « Ordre de réalisation (reste) » fait foi** — il est repris intégralement au §6 de ce plan.
2. **Les numéros de ligne de la consigne sont périmés** (±10-15 après les merges) : **re-mesurer à chaque lot** (règle AGENTS §7.1, « mesurer avant de corriger ») — les ancres de ce fichier ont été revérifiées le 01/10/2026.
3. **`git add -A` interdit dans ce dépôt** : le propriétaire y travaille **en parallèle** (incident du 01/10 : sa refonte overlay/guide a été happée par un `git add -A`, récupérée par lui, PR #820 fermée en no-op). ⇒ **stager fichier par fichier**.
4. **`src/temp/` est volatile et gitignoré** : la consigne ne sera **jamais** committée — **ce fichier** (et le `ROADMAP`) est ce qui survit.
5. **Portes d'arrêt (AGENTS §7.7)** : **R1** = migration ⇒ **ARRÊT + accord** ; **R3** = écrit dans la table **partagée** `GuildEvent` (isolation `guildId`, nettoyage à revérifier) ; **R2/R4** = touchent l'**overlay** ⇒ vérifier qu'aucune fiche boss n'est cassée ; toute **suppression de données** (miroirs `CANCELLED`, purge) ⇒ accord.


