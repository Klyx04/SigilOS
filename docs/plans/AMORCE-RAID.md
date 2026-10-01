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
> **Arrêt uniquement** si : une **mesure** contredit le plan · une **migration** devient nécessaire (L3 en porte
> une : accord explicite) · une **interface publique Discord** change · une **suppression de données** devient
> nécessaire · ou un des 2 arbitrages de L3 n'est pas tranché.

## 0. État d'exécution (01/10/2026) — **il reste les lots L1 → L7**

| Lot | Chantier | Branche | PR | État |
|---|---|---|---|---|
| — | **§1** classes du calendrier | `fix/calendrier-classes` | **#815** | ✅ **mergé** `9427a9f1` |
| — | **§3** rappel de clôture de raid 24 h | `feat/rappel-cloture-raid` | **#816** (absorbée) | ✅ **mergé** `92d7ccd0` |
| **L1** | R2 strat + overlay + guides internes | `feat/raid-strat-overlay` | — | ⏳ à faire |
| **L2** | R3 agenda : miroir lecture seule DJ/Songes | `feat/agenda-miroir-dj-songes` | — | ⏳ à faire |
| **L3** | R1 clôture + no-show (**1 migration**) | `feat/raid-cloture-noshow` | — | ⏸️ **bloqué par 2 arbitrages** |
| **L4** | R5 rangs de monstre 1-5 (fin des `G1-G10`) | `fix/rangs-monstre-1-5` | — | ⏳ à faire |
| **L5** | R6 maps multi-donjons | `fix/maps-multi-donjons` | — | ⏳ à faire |
| **L6** | R4 overlay Simulation + anomalies sans stats | `fix/overlay-simulation-anomalies` | — | ⏳ à faire |
| **L7** | R7 vignettes raid/agenda + R8/R9/R10 (déslop ciblé) | `fix/raid-vignettes-deslop` | — | ⏳ à faire |

> 👉 **Pour reprendre : le bloc §6 suffit** (il porte l'état, l'ordre et les arbitrages, tel quel).
> Branches **à créer depuis `dev`** (état de `dev` au 01/10/2026 : `2a316143`), **une par lot**, et toujours
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
| **D7** | **Ordre des lots** : L1 → L2 → L4 → L5 → L6 → L7, avec **L3 dès que D3/D4 sont tranchés** | ⏳ à confirmer par le user |

## 3. Ordre d'exécution — **7 lots, 1 lot = 1 branche = 1 PR → `dev`**

> Règle : **on merge un lot avant d'ouvrir le suivant** (branche créée depuis `dev` **après** le merge du précédent).
> Mode « one shot » : on n'attend pas de feu vert entre les lots, **sauf** aux portes d'arrêt (§0).

### L1 — La strat entre dans la modale raid (R2) — risque faible, zéro migration
Livrer : bloc « strat » **dans** la modale du raid (patron du bloc « Objectifs », `DocContent` + sommaire, **sans redirection**), branchement des slugs de guides raid existants, bouton overlay via `use-raid-overlay` (PiP), cartes de guides internes **avec vignette + filtre**.
Preuve : capture de la modale raid **avec** la strat ouverte + l'overlay en PiP ; non-régression : `use-boss-overlay` et fiches boss **intactes**.

### L2 — L'agenda n'invente plus rien (R3) — table partagée
Livrer : **copie miroir** `GuildEvent` des posts DJ / runs Songes (`metadata.source`), sync complète (création / patch de dates / `CANCELLED` puis purge / rien sans date / 1 Event chapeau pour le multi-dates), **modale lecture seule** pour tous (aucune action), filtre d'agenda **sans surcharge** (2 pastilles repliées + compteurs).
Preuve : un post DJ daté apparaît dans l'agenda et **aucun** bouton d'action n'est cliquable (capture) ; un post fermé ⇒ miroir `CANCELLED` puis purgé ; test d'isolation `guildId`.

### L3 — La clôture devient un vrai acte (R1) — **1 migration, ARRÊT avant**
Livrer : table de **présences** (`PRESENT/PREVENU/EXCUSE/NO_SHOW`) + **motif obligatoire** (défaut « Prévenu »), clôture **bloquante** (XP/Kamas **présents seuls**), garde **capitaine / organisateur / `canManageRaid`** (`RAID_OFFICER` enfin utilisé), **`undo` qui défait tout**, **compteur 90 j officier seul**, **audit** clôture + correction, modale sans tout-coché + attestation **revérifiée serveur**, tag staff privé dans le registre.
Preuve : `undo` ramène l'état **exactement** d'avant (présences, points, Kamas, no-show) ; l'audit contient clôture **et** correction ; aucune donnée de no-show lisible côté membre.

### L4 — Les rangs redeviennent 1-5 (R5) — petit, règle pure
Livrer : `normalizeMonsterGrades` (1-5 via `scaleGradeRef`, dédup) appliquée aux **3** producteurs, `gradesCount`/`g5` recalculés, palier de butin **découplé** de `grades.length`.
Preuve : Servitude (10 grades DofusDB) n'affiche **plus** `G6-G10` et son `g5` est juste ; non-régression : les monstres à **5** grades sont inchangés.

### L5 — Une carte, tous les donjons (R6) — petit
Livrer : résolution **union** de tous les donjons contenant le monstre (`isBoss` = union des `PreferredMaps`, cache `monstre+donjon`, `Map vide 17×17` conservée).
Preuve : Servitude affiche **Fers ∪ Tempête** ; Armécréante ne retombe plus sur le mauvais donjon.

### L6 — L'overlay Simulation cesse d'être un empilement (R4) — moyen
Livrer : **1 toolbar unique** (Boss libre + sort PA·PO + map + zoom + Options + Légende), map visible sans menu, Options en 3 sections, prévisu en **rail latéral** (repliée par défaut en PiP), « Ordre d'apparition » **cliquable**, zoom non ronds + `Fit` unique, déslop mesuré ; anomalies : élargir le siphon (Rushu) + lectures local-only avec `stale` daté.
Preuve : captures avant/après de l'overlay (PiP **et** plein écran) ; « Larve de Rushu » affiche des stats (ou un `stale` daté, jamais un vide muet).

### L7 — Ce qui reste du raid (R7 + R8 + R9 + R10) — petit, déslop ciblé
Livrer : vignettes raid/event dans l'agenda du dashboard + `RaidHeroBanner` visuel ; activité guilde enrichie (DJ fermé, marché vendu, succès validé) ; filtre du calendrier (`OTHERS` + pastilles repliées) ; responsive **des rosters** ; modales du raid au registre.
Preuve : capture agenda dashboard (vignettes) + capture mobile du roster (scroll propre, rien de coupé).

## 4. Les pièges mesurés à ne pas rejouer

1. **`git add -A` interdit dans ce dépôt.** Le propriétaire y travaille **en parallèle** : le 01/10, sa refonte overlay/guide a été happée par un `git add -A`, il a dû la récupérer, et la PR #820 a fini **fermée en no-op**. ⇒ **stager fichier par fichier**, toujours.
2. **Les numéros de ligne de la consigne sont périmés** (±10-15 après les merges d'overlay) ⇒ **re-mesurer avant de coder**. Les ancres de `PLAN-RAID.md` ont été revérifiées le 01/10/2026 : `calendar-actions.ts:1146/1182/1231/1265/1287`, `permissions.ts:35-36/198-203/258-259`.
3. **Le fichier de consigne a des défauts** : `## 12. Services…` en double, **3** blocs « Ordre proposé » contradictoires, et les **2 bullets du §13** (gate salon valider-recrue) recopiées à la fin de **~8 sections** — dont §20. Ne pas en déduire qu'une section parle d'autre chose.
4. **Deux overlays, ne pas les confondre** : `use-raid-overlay` (raid, **PiP 420×720**, store dédié) vs `use-boss-overlay` (boss, 380×680). Le raid utilise **le premier**.
5. **La clôture est un acte, pas un effet de bord** : aucune conséquence automatique au départ d'un organisateur (c'est le **chantier F** du ROADMAP, **hors** de ce plan) ⇒ ne **pas** desserrer les verrous « capitaine seul » sans test de non-régression.
6. **`src/temp/` est volatile et gitignoré** : la consigne ne sera **jamais** committée — le survivant, c'est `PLAN-RAID.md` + le `ROADMAP`.
7. **D3/D4 non tranchés ⇒ on ne code pas L3** (facteur Kamas Violets + stockage du coût) : deviner ici fabriquerait une régression comptable silencieuse.

## 5. Méthode, sécurité et vérifs (non négociable)

**MÉTHODE** — ① **mesurer la cause racine AVANT de corriger** (sonde `_probe-*.mjs`, requête SQL en lecture seule, `curl`, logs) et **écrire la mesure**, jamais « ça devait être » ; ② corriger au **bon étage** : règle pure `src/lib/**` > serveur `src/server/**` > composant, **une seule source de vérité par règle** ; ③ **tester le comportement** (`tests/unit` + non-régression des verrous existants — captaincy, RBAC, auto-clôture +48 h) ; ④ **prouver** : capture avant/après ou mesure chiffrée ; ⑤ **1 lot = 1 branche = 1 PR → `dev`** (jamais de push sur `main`/`dev`) ; ⑥ **pas de scope creep** (une idée hors lot se note en « reste » ou au ROADMAP) ; ⑦ **STOP** aux portes d'arrêt (§0).

**SÉCURITÉ** — `await auth()` / `getUserContext(guildId)` sur **chaque** action · isolation par **`guildId` interne** (jamais un snowflake du client) · RBAC **fail-closed** (page **et** action) + `isSuperAdmin()` sur tout ce qui touche au cycle de vie + **audit** · **Zod borné** sur toute entrée utilisateur **et** sur les données d'API externe · **fail-closed** si Discord/Redis échoue · `process.env.*` **sans fallback** · comparaison de secrets en `timingSafeEqual` · **`logger`, jamais `console.log`** · **rate limit** sur les mutations (`429` propre) · **garde d'état dans le `WHERE`** · **`src/proxy.ts`**, jamais `middleware.ts` · **statuts de no-show = données personnelles** : jamais publics, rien de sensible dans les logs.

**VÉRIFS par lot** — `npm run test:run` · `npx tsc --noEmit` · `npm run lint` · `git status --short` **propre** (aucun artefact : sonde, capture, dump) · `gh pr checks` jusqu'au **vert** · merge · branche supprimée (locale + distante) · `dev` repullé · `docs/ROADMAP.md` + `docs/agents/activeContext.md` mis à jour (**bloc en haut**, rotation). Si `next dev` tourne, le build est **délégué à la CI** : le dire (ne pas prétendre l'avoir joué).

## 6. Bloc à coller — **reprise : lots L1 → L7** (prompt de session)

```text
CHANTIER RAID — lis d'abord docs/plans/PLAN-RAID.md (le dossier) et docs/plans/AMORCE-RAID.md §0 (l'état),
puis exécute les lots L1 → L7 en ONE SHOT : 1 lot = 1 branche = 1 PR vers dev, branche créée depuis dev
APRÈS le merge du lot précédent. Les §1 (classes du calendrier, PR #815) et §3 (rappel de clôture 24 h,
PR #816) sont DÉJÀ LIVRÉS : ne pas les refaire.

PÉRIMÈTRE
- L1 : strat DANS la modale raid (patron du bloc Objectifs, DocContent + sommaire, sans redirection) +
  slugs de guides raid existants + bouton overlay via use-raid-overlay (PiP) + cartes de guides internes
  avec vignette et filtre.
- L2 : agenda miroir LECTURE SEULE des posts DJ / runs Songes (GuildEvent + metadata.source, sync complète,
  CANCELLED puis purge, modale sans aucune action pour personne, filtre d'agenda sans surcharge).
- L3 (APRÈS mes réponses sur D3/D4) : clôture + no-show — table de présences PRESENT/PREVENU/EXCUSE/NO_SHOW,
  motif obligatoire (défaut Prévenu), XP/Kamas présents seuls, garde capitaine/organisateur/canManageRaid
  (RAID_OFFICER enfin utilisé), undo qui défait TOUT, compteur 90 j officier seul, audit clôture + correction,
  modale sans tout-coché + attestation revérifiée côté serveur, tag staff privé dans le registre.
- L4 : rangs de monstre 1-5 (règle pure normalizeMonsterGrades via scaleGradeRef, 3 producteurs,
  gradesCount/g5 recalculés, palier de butin découplé de grades.length).
- L5 : maps multi-donjons (union de TOUS les donjons du monstre, isBoss = union des PreferredMaps,
  cache monstre+donjon, Map vide 17x17 conservée).
- L6 : overlay Simulation (1 toolbar unique, map visible, Options en 3 sections, prévisu en rail latéral
  replié par défaut en PiP, ordre d'apparition cliquable, zoom + Fit uniques, déslop) + anomalies sans stats
  (élargir le siphon, lectures local-only, stale daté).
- L7 : vignettes raid/event dans l'agenda dashboard + RaidHeroBanner visuel + activité guilde enrichie +
  filtre du calendrier (OTHERS, pastilles repliées) + responsive des rosters + modales du raid au registre.

MÉTHODE — mesure la cause racine AVANT de corriger et écris la mesure ; corrige au bon étage (règle pure
src/lib/** > src/server/** > composant, UNE source de vérité par règle) ; teste le comportement ET la
non-régression (captaincy, RBAC, auto-clôture +48 h) ; prouve par capture avant/après ou mesure chiffrée ;
1 lot = 1 branche = 1 PR vers dev (jamais de push sur main/dev) ; pas de scope creep ; STOP et demande-moi
si une mesure contredit le plan, si une migration devient nécessaire (L3 en porte une : additive,
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



