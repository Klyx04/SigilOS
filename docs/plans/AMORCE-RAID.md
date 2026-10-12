---
description: Amorce de session — exécuter les chantiers RAID du plan `docs/plans/PLAN-RAID.md` (7 lots, 1 lot = 1 branche = 1 PR vers dev)
---

# 🧭 Amorce — Chantiers RAID (**lot par lot**)

> **Plan de référence (source de vérité)** : `docs/plans/PLAN-RAID.md` (relevé mesuré du 01/10/2026, ancres
> revérifiées, lots L1→L7, pièges). **Cette amorce ne le remplace pas** : elle **cadre la session** et fixe
> l'**ordre d'exécution**.
> **Décisions** : ✅ **acquises** — §1 classes du calendrier (**PR #815**) et §3 rappel de clôture 24 h
> (**PR #816**) sont **livrés : ne pas refaire**. ⏸️ **2 arbitrages bloquent le lot L3** (facteur Kamas Violets
> `*10` vs `*10 000` ; stockage de `raidPurpleKamasCost`) ⇒ **les poser AVANT d'écrire la première ligne de L3**.
> **Mode demandé** : « *one shot* » ⇒ enchaîner les lots **sans redemander la suite**, **1 lot = 1 branche = 1 PR → `dev`**.
> **Arrêt uniquement** si : une **mesure** contredit le plan · une **migration** devient nécessaire (L2 en porte
> une : accord explicite) · une **interface publique Discord** change · une **suppression de données** devient
> nécessaire · ou un des 2 arbitrages de L2 n'est pas tranché.

## 0. État d'exécution (01/10/2026) — **il reste les lots L0 → L7**, dans **l'ordre officiel de la consigne**

| Lot | Chantier | Position officielle | Branche | PR | État |
|---|---|---|---|---|---|
| — | **§1** classes du calendrier | livré | `fix/calendrier-classes` | **#815** | ✅ mergé `9427a9f1` |
| — | **§3** rappel de clôture de raid 24 h | livré | `feat/rappel-cloture-raid` | **#816** | ✅ mergé `92d7ccd0` |
| — | **§24** Qilby (map/sorts/fit) · **§25** overlay raid `/travel` | livré | `feat/qilby-arena-dashboard` · `feat/raid-overlay-travel-chips` | **#817** · **#819** | ✅ mergés |
| **L0** | **R0** — P0 sécu : RBAC `calendar` (+ `bounties`, `relance`) | **1ᵉʳ** | `fix/rbac-calendar-bounties-relance` | — | ⏳ à faire (**aucune décision**) |
| **L1** | **R1** — §4 agenda : miroir lecture seule DJ/Songes | **2ᵉ** | `feat/agenda-miroir-dj-songes` | — | ⏳ à faire |
| **L2** | **R2** — §14 clôture + no-show (**1 migration**) | **3ᵉ** | `feat/raid-cloture-noshow` | — | ⏸️ **bloqué par 2 arbitrages** |
| **L3** | **R3** — §6 anomalies sans stats + overlay Simulation | 8ᵉ | `fix/overlay-simulation-anomalies` | — | ⏳ à faire |
| **L4** | **R4** — §7 rangs de monstre 1-5 (fin des `G1-G10`) | 9ᵉ | `fix/rangs-monstre-1-5` | — | ⏳ à faire |
| **L5** | **R5** — §8 maps multi-donjons (générique encyclopédie) | 10ᵉ | `fix/maps-multi-donjons` | — | ⏳ à faire |
| **L6** | **R6** — §15 dashboard vie (vignettes raid/agenda) | 14ᵉ | `fix/dashboard-vie-vignettes` | — | ⏳ à faire |
| **L7** | **R7** — §20 guides internes + **modale raid strat** | 20ᵉ | `feat/raid-strat-guides` | — | ⏳ à faire |
| *(partagés)* | §16 volet **calendrier** (15ᵉ) · §22/§23 volet **rosters + modales** (23ᵉ) | — | — | — | ⏳ dans leurs lots |

> 👉 **Pour reprendre : le bloc §6 suffit** (il porte l'état, l'ordre et les arbitrages, tel quel).
> Branches **à créer depuis `dev`** (état de `dev` au 01/10/2026 : `b986b97d`), **une par lot**, et toujours
> **après** le merge du lot précédent (`git fetch origin dev && git merge origin/dev` avant d'ouvrir la PR).

## 1. Brief

| Bloc | Contenu |
|---|---|
| **But** | Des raids **fiables et lisibles de bout en bout** : on prépare (strat + overlay + cartes), on joue, on **clôture proprement** (présents / no-show, Kamas, audit) — sans casser l'existant. |
| **Constats (mesurés le 01/10/2026, ancres dans le plan)** | ① la clôture n'a **que** `canManageCalendar`, **aucun** statut de présence, **aucun** audit, un `undo` partiel, et `raidPurpleKamasCost` **jamais stocké** ; ② la modale raid n'a **aucune strat** alors que les slugs de guides existent ; ③ l'agenda n'affiche **pas** les posts DJ/Songes ; ④ les rangs de boss s'affichent en `G1-G10` (**faux**) ; ⑤ une carte multi-donjons est résolue sur **un seul** donjon ; ⑥ des anomalies n'ont **aucune** stat (cause = siphon, **pas** l'affichage). |
| **DoD global** | Les DoD par lot (§1→§4 du plan) + recette : clôture ⇒ **statuts privés + audit + `undo` exact** ; strat **dans** la modale du raid (aucune redirection) ; miroirs DJ/Songes **lecture seule** (aucune action débloquée, même pour un admin) ; rangs **1-5** ; cartes = **union** des donjons ; overlay = **1 toolbar**. |
| **Hors périmètre** | Mini-jeux (consigne §2/§5), marché, succès imbriqués, services, logs, ressources, missions, ladder/planning, guides généraux ⇒ **chantiers séparés**. **Aucune refonte de l'overlay boss** (`use-boss-overlay` reste intact). |
| **Entrées** | `docs/plans/PLAN-RAID.md` (ce dossier) · consigne volatile `src/temp/consigne-2026-09-30-raid-calendrier-mini-jeux.md` (§14, §20, §4, §6, §7, §8, §15, §16, §22, §23) · `docs/ROADMAP.md` (bloc 01/10 + § F) · `docs/agents/activeContext.md`. |
| **Risque** | **L3 = 1 migration additive** ⇒ ARRÊT + accord · **L2 = table partagée `GuildEvent`** (isolation `guildId` + nettoyage des miroirs) · **L1/L6 = overlay** ⇒ ne casser aucune fiche boss · statuts de no-show = **données personnelles** ⇒ jamais de badge public, rien de sensible dans les logs. |
| **Docs concernées** | `docs/ROADMAP.md` · `docs/agents/activeContext.md` · `docs/plans/PLAN-RAID.md` + cette amorce · `docs/MAINTENANCE.md` **seulement** si un cron change (aucun prévu). |

## 2. Les décisions (rappel — **ne pas réinterpréter**)

| # | Décision | État |
|---|---|---|
| **D1** | **§1 classes du calendrier** : règle **unique** `resolveEffectiveClass` (choisie → profil), pictos sur les **2** embeds, « Mes personnages » Discord + site, sélecteur « ma classe » | ✅ **livré** (#815) — ne pas refaire |
| **D2** | **§3 rappel de clôture 24 h** : dans la tâche `raid-reminders` **existante** (0 crontab en plus), ping du **seul** `creatorId`, raid clôturé d'office seulement à **+48 h** | ✅ **livré** (#816) — ne pas refaire |
| **D3** | **Facteur Kamas Violets de la clôture** : `*10` (code actuel) vs `*10 000` (seuil d'inscription) | ⏸️ **à trancher** — bloque L3 |
| **D4** | **Stocker `raidPurpleKamasCost`** au moment de la clôture (sinon `undo` rembourse une valeur de repli) | ⏸️ **à trancher** — bloque L3 |
| **D5** | **Pas de badge no-show public** : statuts privés + compteur **officier seul**, jamais de stigmatisation (référence Raid Helper) | ✅ acté (consigne §14, « cible validée ») |
| **D6** | **Miroirs DJ/Songes = lecture seule** pour **tout le monde**, admin compris (seul CTA « Ouvrir le post d'origine ») | ✅ acté (consigne §4, « principe validé ») |
| **D7** | **Ordre des lots** : c'est **celui de la consigne** (« Ordre de réalisation (reste) ») — **L0 sécu → L1 (§4 miroir) → L2 (§14 no-show) → L3 (§6 overlay) → L4 (§7 rangs) → L5 (§8 maps) → L6 (§15) → L7 (§20 strat)**, les lots non-raid s'intercalant | ✅ **acté** (écrit dans la consigne, il fait foi) |

## 3. Ordre d'exécution — **8 lots (L0 → L7), 1 lot = 1 branche = 1 PR → `dev`**

> Règle : **on merge un lot avant d'ouvrir le suivant** (branche créée depuis `dev` **après** le merge du précédent).
> Mode « one shot » : on n'attend pas de feu vert entre les lots, **sauf** aux portes d'arrêt (§0).

### L0 — Le P0 sécu d'abord : le calendrier n'est plus ouvert à tout le monde (R0 · §23) — aucune décision
Livrer : garde **fail-closed** sur la page calendrier (`getUserContext` + `canViewCalendar` + module ON) **et** re-vérification que **chaque action serveur** du calendrier re-garde ; **même P0** pour `bounties` et `relance` (§23 « critiques »).
Preuve : un membre **sans** droit calendrier est **refusé** (capture) ; test unitaire de la garde (contexte absent ⇒ refus, jamais d'accès par défaut).

### L1 — L'agenda n'invente plus rien (R1 · §4) — table partagée
Livrer : **copie miroir** `GuildEvent` des posts DJ / runs Songes (`metadata.source`), règle **pure** dans `src/lib/`, appels **explicites** après `createDjPost` / `createDjPosts` / `updateDjPost` / `createDreamRun` / `updateDreamRun` (+ clôture / suppression) avec **garde `WHERE` + idempotence `metadata`**, `guildId` serveur, Zod borné, rate-limit Redis, fail-closed — **jamais** de trigger Prisma ni de logique client ; multi 2-5 dates ⇒ **1 Event chapeau** ; **modale lecture seule** (`EventDetailReadonly`) pour **tous**, admin compris ; filtre d'agenda **sans surcharge** (2 pastilles repliées + compteurs).
Preuve : un post DJ daté apparaît et **aucun** bouton d'action n'est cliquable (capture) ; post fermé ⇒ miroir `CANCELLED` puis purgé ; double appel ⇒ **1** event ; test d'isolation `guildId`.
⚠️ **Vigilance** : courses DJ ↔ calendrier (garde `WHERE`) ; catégories **QUETE / DEFI / TITAN** sans équivalent natif ⇒ **à trancher** (repli `DUNGEON_FARM` + label).

### L2 — La clôture devient un vrai acte (R2 · §14) — **1 migration, ARRÊT avant**
Livrer : table **`RaidPresence`** (`@@unique[eventId,userId]`, index 90 j) **écrite** dans `completeRaidEvent` et **supprimée** dans `undo` ; modale (bloc Absents **dès la décoche**, `select` de motif, **validation bloquante**, attestation **chiffrée** « X présents débités, N no-shows ») ; droits **`RAID_OFFICER` / `canManageRaid`** + `creatorId` / `raidCaptainId` ; colonne **registre** (staff seul) ; correction officier + `createAuditLog` **avant → après**.
Preuve : `undo` ramène l'état **exactement** d'avant (présences, points, Kamas, no-show) ; l'audit contient clôture **et** correction ; un membre lambda est **refusé** ; aucune donnée de no-show lisible côté membre.
⏸️ **Bloqué par D3 / D4** (facteur Kamas Violets · stockage de `raidPurpleKamasCost`) — et c'est le **3ᵉ** lot de l'ordre officiel.

### L3 — L'overlay Simulation cesse d'être un empilement (R3 · §6) — moyen
Livrer : **1 toolbar unique** (Boss libre + sort PA·PO + map **visible** + zoom + Options + Légende), Options en **3 sections** (Board / Placement / Butin), prévisu en **rail latéral** (replié par défaut, jamais superposé en PiP), « Ordre d'apparition » **cliquable** (`handleCellClick`), zoom + `Fit` uniques, déslop (rayons 3/4/6, 0 blur/shadow/italic) ; anomalies : élargir le siphon (**Rushu** ou siphon par id) + lectures **local-only** avec `stale` **daté** + état vide explicite.
Preuve : captures avant/après (PiP **et** plein écran) ; « Larve de Rushu » affiche des stats (ou un `stale` daté, **jamais** un vide muet) ; test de non-duplication des contrôles.
⚠️ **Vigilance** : ne **pas** casser la donnée Qilby (§24 — `qilby-map.ts`, `effectDetails.damage`) ; les Lots 2/3/6 (TTL, local-only strict, fraîcheur) doivent passer **avant** de couper le live.

### L4 — Les rangs redeviennent 1-5 (R4 · §7) — règle pure
Livrer : `normalizeMonsterGrades` (garder 1-5 via `scaleGradeRef`, dédup) sur les **3** producteurs (`monster-stats-core:586`, `bounty-grades:62`, `dungeon-monsters-siphon:291`), `gradesCount` / `g5` recalculés, palier de butin (`B4+idx`) **dérivé** de `percentByGrade` / `lootCount` — jamais de `grades.length`.
Preuve : Servitude (10 grades DofusDB) ⇒ **5** grades + taux 1-5 ; UI butin `B4..B8` ; non-régression : les monstres à **5** grades sont inchangés.
⚠️ **Vigilance** : `SpellGrades` (niveau de sort par grade) n'a **pas** d'équivalent DofusDB — cas type **Ancrépulsion** à valider en jeu.

### L5 — Une carte, tous les donjons (R5 · §8) — petit
Livrer : résolution **union** de **tous** les hits (`Monsters[]` + `monster.Dungeons[]`) dans `getDofensiveDungeonForBoss`, `resolveDofensiveDungeonDirect`, `getLocalDofensiveDungeonAny`, `getDungeonMonsters` ; `isBoss` = **union** des `PreferredMaps` ; cache `monstre+donjon` ; filtre de `SpellRangeGrid` **inchangé** sur l'union ; `Map vide 17×17` conservée.
Preuve : Servitude ⇒ **Fers ∪ Tempête** ; Armécréante idem ; un monstre mono-donjon est **inchangé**.
⚠️ **Vigilance** : `syncDofensiveMaps` doit renseigner `isBoss` au siphon (aujourd'hui faux implicite).

### L6 — Ce qui reste du raid (R6 · §15 + R8/R9) — petit
Livrer : vignettes raid/event dans l'agenda du dashboard (`resolveEventImagePath` + picto de type) + `RaidHeroBanner` visuel ; activité guilde enrichie (3 requêtes DJ `CLOSED`, marché `SOLD`, succès `VALIDATED` + mapping `UnifiedLog`) ; volet **calendrier** de §16 (`OTHERS` + replis dans le filtre) ; responsive **des rosters** et modales du raid au registre (§22/§23 — **lots partagés**, à traiter dans leurs lots).
Preuve : capture de l'agenda (vignettes) + capture mobile du roster (scroll propre, rien de coupé).

### L7 — La strat entre dans la modale raid (R7 · §20) — **dernier lot raid (20ᵉ)**
Livrer : bloc « strat » **dans** la modale du raid (`DialogContent sm:max-w-3xl` + `ScrollArea` + `DocContent` + sommaire, **sans redirection**) ; cartes de **guides internes** avec image + filtre (registre `coverImage` / `readingTime` / `category`) ; bouton `use-raid-overlay` (PiP 420×720).
Preuve : la modale raid ouvre la strat **sans changer de page** (capture) ; non-régression : `use-boss-overlay` et fiches boss **intactes**.

## 4. Les pièges mesurés à ne pas rejouer

1. **`git add -A` interdit dans ce dépôt.** Le propriétaire y travaille **en parallèle** : le 01/10, sa refonte overlay/guide a été happée par un `git add -A`, il a dû la récupérer, et la PR #820 a fini **fermée en no-op**. ⇒ **stager fichier par fichier**, toujours.
2. **Les numéros de ligne de la consigne sont périmés** (±10-15 après les merges d'overlay) ⇒ **re-mesurer avant de coder**. Les ancres de `PLAN-RAID.md` ont été revérifiées le 01/10/2026 : `calendar-actions.ts:1146/1182/1231/1265/1287`, `permissions.ts:35-36/198-203/258-259`.
3. **La consigne a été restructurée le 01/10/2026** (BESOIN → MESURÉ → CHANGEMENTS → TESTS → ACCEPTATION → VIGILANCE, tailles `[S]/[M]/[L]`) : ses défauts précédents sont **corrigés** (plus de `## 12` en double, plus de blocs « Ordre proposé » contradictoires, plus de bullets recopiées) et **son « Ordre de réalisation (reste) » fait foi** — il est repris au §0 et au §3 de cette amorce.
4. **Deux overlays, ne pas les confondre** : `use-raid-overlay` (raid, **PiP 420×720**, store dédié) vs `use-boss-overlay` (boss, 380×680). Le raid utilise **le premier**.
5. **La clôture est un acte, pas un effet de bord** : aucune conséquence automatique au départ d'un organisateur (c'est le **chantier F** du ROADMAP, **hors** de ce plan) ⇒ ne **pas** desserrer les verrous « capitaine seul » sans test de non-régression.
6. **`src/temp/` est volatile et gitignoré** : la consigne ne sera **jamais** committée — le survivant, c'est `PLAN-RAID.md` + le `ROADMAP`.
7. **D3/D4 non tranchés ⇒ on ne code pas L2 (§14, no-show)** (facteur Kamas Violets + stockage du coût) : deviner fabriquerait une régression comptable silencieuse — et comme c'est le **3ᵉ** lot de l'ordre officiel, **les poser tôt débloque toute la file**.

## 5. Méthode, sécurité et vérifs (non négociable)

**MÉTHODE** — ① **mesurer la cause racine AVANT de corriger** (sonde `_probe-*.mjs`, requête SQL en lecture seule, `curl`, logs) et **écrire la mesure**, jamais « ça devait être » ; ② corriger au **bon étage** : règle pure `src/lib/**` > serveur `src/server/**` > composant, **une seule source de vérité par règle** ; ③ **tester le comportement** (`tests/unit` + non-régression des verrous existants — captaincy, RBAC, auto-clôture +48 h) ; ④ **prouver** : capture avant/après ou mesure chiffrée ; ⑤ **1 lot = 1 branche = 1 PR → `dev`** (jamais de push sur `main`/`dev`) ; ⑥ **pas de scope creep** (une idée hors lot se note en « reste » ou au ROADMAP) ; ⑦ **STOP** aux portes d'arrêt (§0).

**SÉCURITÉ** — `await auth()` / `getUserContext(guildId)` sur **chaque** action · isolation par **`guildId` interne** (jamais un snowflake du client) · RBAC **fail-closed** (page **et** action) + `isSuperAdmin()` sur tout ce qui touche au cycle de vie + **audit** · **Zod borné** sur toute entrée utilisateur **et** sur les données d'API externe · **fail-closed** si Discord/Redis échoue · `process.env.*` **sans fallback** · comparaison de secrets en `timingSafeEqual` · **`logger`, jamais `console.log`** · **rate limit** sur les mutations (`429` propre) · **garde d'état dans le `WHERE`** · **`src/proxy.ts`**, jamais `middleware.ts` · **statuts de no-show = données personnelles** : jamais publics, rien de sensible dans les logs.

**VÉRIFS par lot** — `npm run test:run` · `npx tsc --noEmit` · `npm run lint` · `git status --short` **propre** (aucun artefact : sonde, capture, dump) · `gh pr checks` jusqu'au **vert** · merge · branche supprimée (locale + distante) · `dev` repullé · `docs/ROADMAP.md` + `docs/agents/activeContext.md` mis à jour (**bloc en haut**, rotation). Si `next dev` tourne, le build est **délégué à la CI** : le dire (ne pas prétendre l'avoir joué).

## 6. Bloc à coller — **reprise : lots L0 → L7** (prompt de session)

```text
CHANTIER RAID — lis d'abord docs/plans/PLAN-RAID.md (le dossier) et docs/plans/AMORCE-RAID.md §0 (l'état),
puis exécute les lots L0 → L7 dans **l'ORDRE DE LA CONSIGNE** (« Ordre de réalisation (reste) »), en ONE SHOT :
1 lot = 1 branche = 1 PR vers dev, branche créée depuis dev APRÈS le merge du lot précédent. DÉJÀ LIVRÉS (ne pas
refaire) : §1 classes (PR #815), §3 rappel de clôture 24 h (PR #816), §24 Qilby (PR #817), §25 overlay raid (#819).

PÉRIMÈTRE (dans cet ordre)
- L0 (1er) : P0 sécu — garde fail-closed sur la page calendrier (getUserContext + canViewCalendar + module ON)
  + re-garde de CHAQUE action serveur du calendrier ; même P0 pour bounties et relance. Aucune décision requise.
- L1 (2e) : agenda miroir LECTURE SEULE des posts DJ / runs Songes — règle pure dans src/lib, appels explicites
  après createDjPost / createDjPosts / updateDjPost / createDreamRun / updateDreamRun, garde WHERE + idempotence
  metadata, guildId serveur, Zod borné, rate-limit Redis, fail-closed, JAMAIS de trigger Prisma ni de logique
  client ; 1 Event chapeau pour le multi-dates ; EventDetailReadonly pour TOUS ; filtre d'agenda sans surcharge.
- L2 (3e, APRÈS mes réponses sur D3/D4) : clôture + no-show — table RaidPresence (unique eventId+userId, index
  90 j) écrite dans completeRaidEvent et supprimée dans undo ; modale (bloc Absents dès la décoche, select de
  motif, validation bloquante, attestation chiffrée) ; droits RAID_OFFICER/canManageRaid + creatorId/raidCaptainId ;
  compteur 90 j officier seul ; colonne registre (staff) ; correction officier + createAuditLog avant -> apres.
- L3 (8e) : overlay Simulation (1 toolbar unique, Options en 3 sections Board/Placement/Butin, prévisu en rail
  latéral, ordre d'apparition cliquable, zoom + Fit uniques, déslop) + anomalies sans stats (siphon élargi,
  local-only, stale daté) — SANS casser la donnée Qilby.
- L4 (9e) : rangs 1-5 — règle pure normalizeMonsterGrades (scaleGradeRef, dédup) sur les 3 producteurs,
  gradesCount/g5 recalculés, palier de butin dérivé de percentByGrade/lootCount.
- L5 (10e) : maps multi-donjons — union de TOUS les hits, isBoss = union des PreferredMaps, cache
  monstre+donjon, Map vide 17x17 conservée.
- L6 (14e) : vignettes raid/event dans l'agenda dashboard + RaidHeroBanner + activité guilde enrichie +
  volet calendrier de §16 (OTHERS) + responsive des rosters / modales du raid (lots partagés §22/§23).
- L7 (20e) : strat DANS la modale raid (DialogContent sm:max-w-3xl + ScrollArea + DocContent + sommaire)
  + guides internes avec image et filtre + bouton use-raid-overlay (PiP 420x720).

MÉTHODE — mesure la cause racine AVANT de corriger et écris la mesure ; corrige au bon étage (règle pure
src/lib/** > src/server/** > composant, UNE source de vérité par règle) ; teste le comportement ET la
non-régression (captaincy, RBAC, auto-clôture +48 h) ; prouve par capture avant/après ou mesure chiffrée ;
1 lot = 1 branche = 1 PR vers dev (jamais de push sur main/dev) ; pas de scope creep ; STOP et demande-moi
si une mesure contredit le plan, si une migration devient nécessaire (L2 en porte une : additive,
idempotente, accord AVANT), si une interface publique Discord change, ou si une suppression de données
devient nécessaire.

SÉCURITÉ (non négociable) — auth sur CHAQUE action (auth()/getUserContext(guildId)) ; isolation par guildId
INTERNE (jamais un snowflake venant du client) ; RBAC + isSuperAdmin() fail-closed (page ET action) + audit ;
Zod borné sur toute entrée utilisateur ET sur les données d'API externe ; fail-closed si Discord/Redis
échoue ; secrets process.env sans fallback ; timingSafeEqual ; logger (jamais console.log) ; rate limit sur
les mutations (429 propre) ; garde d'état DANS le WHERE ; src/proxy.ts (jamais middleware.ts) ; aucune
donnée de no-show publique et rien de sensible dans les logs.

CONTRAINTES DE TRAVAIL — je travaille dans le MÊME arbre de travail : NE JAMAIS `git add -A` (stage fichier
par fichier), ne jamais toucher à mes fichiers en cours, et me signaler toute modification que tu n'as pas
faite. Re-mesure les numéros de ligne cités (ils dérivent à chaque merge).

VÉRIFS par lot — npm run test:run ; npx tsc --noEmit ; npm run lint ; git status --short propre (aucun
artefact de la tâche) ; gh pr checks jusqu'au vert ; merge ; branche supprimée ; dev repullé ;
docs/ROADMAP.md + docs/agents/activeContext.md mis à jour (bloc en haut, rotation). Si next dev tourne, le
build est délégué à la CI : dis-le (ne prétends pas l'avoir joué).

LIVRABLE — commits en français (feat|fix|refactor(raid): …) ; les PR mergées et CI verte ; rapport final
≤ 15 lignes : fait / reste / ops côté user ; la consigne volatile
src/temp/consigne-2026-09-30-raid-calendrier-mini-jeux.md se nettoie section par section AU FUR ET À MESURE
des merges (§14, §20, §4, §6, §7, §8, §15, §16, §22, §23).
```



