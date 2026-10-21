# 🗺️ ROADMAP — SigilOS (feuille de route unique)

> **Rôle unique.** Ce fichier porte le **backlog** ET **l'ordre**. Une ligne = un chantier.
> **Règle d'or.** 1 rang = 1 lot = 1 branche = 1 PR → `dev`. On merge avant d'ouvrir le suivant.
> **Mémoire.** 6 dernières sessions : `docs/agents/activeContext.md`.
> Historique complet (171 blocs) : `docs/agents/journal-sessions-2026.md` — **à la demande**, jamais au démarrage.
> **Tenue.** Un chantier livré quitte le tableau et rejoint le §5. Aucun récit de session ici.
> **Dernière MàJ** : 21/10/2026 · SHA courant injecté par le hook `TaskStart`.

## 0. Reprise immédiate

- **Prochaine étape** : rang **3** (ouverture prod) ; les rangs **1** et **2** sont livrés (§5).
- **Rush Sylvestre — coche donjon sur les 3 surfaces (21/10/2026)** : les deux sources sont mesurées et figées (Tougli **100 / 102** séries + 30 Ordres + 19 classes ; Dofusyelle **57 étapes / 21 prépa / 40 saves / 62 succès**) · **union ressources 584**, donjons 99 + 83 (67 slugs identiques) · **verrou de donjons livré de bout en bout** : règle pure, table `PlayerGuideDungeonState` (états `DONE`/`TODO`, **une coche par quête × donjon**), action serveur, **refus à la validation** (quête **et** bloc entier), et la **même coquille** dans l'overlay interne, le dashboard et le guide public (ce dernier en `localStorage`, verrou local dans ses 3 écritures). **Ops** : jouer la migration `20270115000000` en bêta puis prod (déjà appliquée en local). **Prochain lot** : `S0-6` (case « optionnel » God) → `S0-7` (décoche en cascade) → `S4-1` (vue Branches 2 étages) → `S1` (contenu). Organisation complète : `docs/plans/RUSH-DEVELOPPEMENT-SUITE.md`.
- **Décisions bloquantes** : `D-R1` (moteur de rôles), `D1`/`D2` (RAID), `D7` (landing), `D8` (Cloudflare).
- **Ops en attente** : migrations `20270112000000` + `20270113000000` · redéploiement du bot · crontabs (sondages `* * * * *`, ancienneté `30 4 * * *`, 4 rappels).
- **Mesures du 19/10** : 155 `console.*` hors tests · **0** import de `src/lib/env.ts` · **Grafana retiré** de l'exposition publique (God → Système & Infra).
- **Bêta** : déployée en `5b31ad0` (19/10/2026) — 6 conteneurs `Healthy`, pages **200**, `monitor.sigilos.fr` **inaccessible** (voulu).

## 1. P0 — Bloquants prod / ops / sécurité (ordre strict)

| Rang | ID | Chantier | État mesuré | Prochain lot | Plan | Bloqué par |
|---|---|---|---|---|---|---|
| 3 | `ouverture-prod` (#57) | `robots.txt`, `sitemap.xml` et `llms.txt` renvoient la page d'attente (HTML) ; 2 apps Discord à isoler ; hardlinks ; rewrite Caddy à retirer | mesuré le 21/09/2026 | robots/sitemap statiques + `noindex` ; checklist Jour J | `docs/ops/GUIDE-DEPLOIEMENT-PROD-JOUR-J.md` · `docs/plans/SEO_REPRISE.md` | **D7** (landing) |
| 4 | `restore-db` (F7) | La restauration n'a jamais été jouée ; le script purge à **3 j** alors que la doc dit **30 j** | `scripts/backup_db.sh` ↔ `docs/MAINTENANCE.md` | jouer un restore sur base jetable + écrire date et RTO | `docs/agents/disaster-recovery.md` | — |
| 5 | `migrations-ops` | 2 migrations additives + bot + crontabs non déployés | `20270112000000` (GodNotification.details), `20270113000000` (DiscordMemberActivity) | jouer bêta puis prod ; redéployer le bot ; poser les 4 crontabs | `docs/MAINTENANCE.md` | — |
| 6 | `caddy-post-503` | Pendant une maintenance, un POST reçoit du HTML au lieu d'un `503 text/plain` | cause racine du 16/10 | durcir le `Caddyfile` (POST → 503) | `docs/MAINTENANCE.md` | — |
| 7 | `csp-enforce` (F10) | CSP en Report-Only : la protection XSS ne bloque rien | `CSP_ENFORCE` présent dans `src/proxy.ts` | poser `CSP_ENFORCE=true` après 48 h de rapports | `docs/SECURITY.md` | — |
| 8 | `presentation-access` | `presentation:view` existe mais n'est pas ouverte au rôle Membre ; l'ancienne page `/presentation` rend encore le règlement | 1 occurrence dans `src/` | ouvrir la permission + trancher la page | — | **D-P1** |
## 2. P1 — Chantiers produit (ordre proposé)

| Rang | ID | Chantier | État mesuré | Prochain lot | Plan | Bloqué par |
|---|---|---|---|---|---|---|
| 9 | `rush-refonte` (T) | Rush Sylvestre : ergonomie, temps réel, éditeur God, habillage Dofus, perf | **T-1, T-2, T-2b, T-3 livrés** le 08/10 · **T-2c livré** le 20/10 | **T-4** (habillage Dofus) → T-5 → T-6 | `docs/plans/PLAN-REFONTE-RUSH-SYLVESTRE.md` · `docs/plans/MODULE-RUSH-SYLVESTRE.md` | — |
| 10 | `rush-donnees` (V) | Rush Sylvestre : agrégation unique des ressources, ids/icônes, alignement, ocre, Metamob | **V-A, V-B livrés** le 10/10 · **V-G livré** · **V-F partiel** · **consolidation Tougli × Dofusyelle mesurée le 21/10** (100/102, 584 ressources, 30 Ordres, 19 classes) · **donjons cochables livrés** (S0-1 → S0-5bis) dans l'overlay interne, le dashboard et le guide public | **S0-6** (case « optionnel ») → **S0-7** (décoche en cascade) → **S4-1** (vue Branches) → **S1** (contenu) → V-C → V-D → V-H | `docs/plans/RUSH-DEVELOPPEMENT-SUITE.md` · `docs/plans/MAPPING-RUSH-SYLVESTRE.md` · `docs/plans/MODULE-RUSH-SYLVESTRE.md` | — |
| 11 | `tickets-v2` (C) | Module Tickets : finir la v2 (SLA, auto-fermeture, i18n, doublons) | 5 chantiers UX livrés le 20/10 ; **commandes slash personnalisées livrées le 21/10** (onglet dédié, éditeur complet, variables, actions rôles/clôture, whitelist, sync Discord sans migration) | C-1 → C-4 | `docs/plans/PLAN-REFONTE-TICKETS-V2.md` | — |
| 12 | `roles-multi` (Y+) | Moteur unique de rôles : ancienneté (projection) + vocal + contribution | cadré le 18/10, **aucun code** | R-1 (évaluateur + stockage) → R-2 (cron + annonces) → R-3 (onglet) | `docs/plans/PLAN-MOTEUR-ROLES-MULTI-SOURCES.md` | **D-R1** |
| 13 | `commandes-slash` (Z) | Commandes slash personnalisées (catalogue ∪ guilde, payloads dérivés) | plan écrit le 14/10, **go migration attendu** | Z-1 → Z-4 | `docs/plans/PLAN-COMMANDES-SLASH.md` | go migration |
| 14 | `roles-succes` (S) | Rôles par points de succès ladder (même moteur que Y) | migrations **accordées** le 15/10 | S-1 → S-3 | `docs/plans/PLAN-ROLES-SUCCES.md` | — |
| 15 | `activite-guilde` (N) | Activité de guilde enrichie + notifications | N-1 et N-4 livrés pour les paliers ; **4 sources restantes** (Dofus, succès, donjons/DJ, songes) | N-2 (4 sources) → N-3 → N-4 | `docs/plans/PLAN-ACTIVITE-GUILDE.md` | — |
| 16 | `raid` (G) | RAID : calendrier, clôture/no-show, strat, overlay, données | R1 et §3 livrés ; **R2 → R10 ouverts** | R2 (no-show) → R3 → R4 → R5 → R6 → R7 → R8 → R9 → R10 | `docs/plans/PLAN-RAID.md` · `docs/plans/AMORCE-RAID.md` | **D1 + D2** |
| 17 | `orphelins` (F) | Reprise de relai quand le créateur d'un raid/DJ/quête a disparu | né le 01/10 | F-A → F-B → F-C | — (à créer) | **D3** |
| 18 | `marche` (I) | Marché : images d'embeds, validation FR, lot multiple (5 objets), multi-embed | S7 livré ; reste le lot multiple et l'étape « Publication » | I-1 + lot multiple | — (à créer) | **D-M1** |
| 19 | `services` (J) | Services : clôture, inactivité, feedback, images, forum ; `valider-recrue` en ticket | ouvert | J-1 → J-2 | — (à créer) | — |
| 20 | `succes` (K) | Succès & encyclopédie : onglet Monstres, succès imbriqués | ouvert | K-1 → K-2 | — (à créer) | — |
| 21 | `mini-jeux` (H) | Mini-jeux & salons temps réel : solidité Redis, solo, Panthéon, HUD/UX | ouvert | H-1 → H-2 | — (à créer) | — |
| 22 | `deslop` (L) | Déslop global : dashboard, admin, landing, modales, ressources, missions, ladder, worldmap | ouvert · demande du 20/10 : **aligner toutes les nouveautés** (landing incluse) | L-1 → L-4 | — (à créer) | — |
| 23 | `guildes-admin` (M) | Guildes & admin : calendrier, profil, stuff, édition staff, logs | volet `membres` livré (05/10) | M-1 reste (calendrier/profil/stuff) → M-2 → M-3 | `docs/plans/PLAN-DESLOP-ANNUAIRE.md` | — |
| 24 | `god-refonte` (O) | Refonte God « Guildes & Users » : 12 chantiers, 7 lots | plan vivant | G1 → G12 | `docs/plans/PLAN-REFONTE-GOD-GUILDES.md` · `docs/plans/AMORCE-REFONTE-GOD-GUILDES.md` | — |
| 25 | `acquisition` (E) | SEO / contenu : autorité avant volume | dossier mesuré le 30/09 | E-1 → E-2 → E-3 ; **prérequis** backfill `MonsterStat` (~5 135 fiches) | `docs/plans/SEO_REPRISE.md` | **D6** |
| 26 | `demo-publique` (S) | Démo publique en lecture seule, essayable sans compte | S-0/S-1 livrés (02/10) | S-2a → S-2b → S-3 → S-4 → S-5 | `docs/plans/PLAN-DEMO-PUBLIQUE.md` · `docs/plans/AMORCE-DEMO-PUBLIQUE.md` | — |
| 27 | `salons-vocaux` (Q) | Module « salons vocaux temporaires » (cahier V2.1) | idée neuve, **à cadrer** | cadrage → lots | `docs/plans/PLAN-SALONS-VOCAUX.md` | **D4** |
| 28 | `onboarding` (ONB) | Onboarding & acquisition (prospect → guilde) | proposition du 06/09 | valider la proposition + migration | `docs/plans/PLAN-REFONTE-ONBOARDING.md` | **D5** |
| 29 | `reseau` (NET) | Durcissement réseau : Cloudflare/WAF devant `sigilos.fr` ? | à décider | décision + DPA + pages RGPD | — | **D8** |
| 30 | `observabilite` (W) | Sentry : couverture bot/workers, 25 crons, alertes | W-1/W-2 livrés le 11/10 | W-3 → W-6 | `docs/agents/journal-sessions-2026.md` (bloc 11/10) | — |
| 31 | `dofusdb-zero` (U) | Zéro dépendance DofusDB à l'exécution (5 points de contact mesurés) | cadré le 08/10 | U-1 → U-5 | `docs/agents/archive/FILE-EXECUTION-2026-10-15.md` (cadrage § U) | — |
| 32 | `solveurs` | Solveurs tactiques (Kalisthe, Minogolem, Harebourg) : données de combat, pas de décompilation | prototypes dans `src/temp/` | cadrer → POC | `docs/plans/PLAN-SOLVEURS-TACTIQUES.md` | — |
## 3. P2 — Dette, hygiène, documentation (ordre souple)

| Rang | ID | Chantier | État mesuré | Prochain lot | Plan |
|---|---|---|---|---|---|
| 33 | `menage` (B-2/B-3 → F) | 74 fichiers morts, 16 scripts, doublons, `seed.ts` IDs réels, `refs/cline` 307 + 2 stashes | lot A (7 deps) et B-1 (24 fichiers) livrés le 19/10 | B-2/B-3 → C → D → E → F | — |
| 34 | `hygiene-logs` (F5/F6) | **155** `console.*` hors tests ; masquage des logs à vérifier | mesuré le 19/10 | remplacer par `logger`, masquer snowflakes/e-mails | `docs/RULES.md` |
| 35 | `docs-arbo` | `AUDIT-ARBO-2026-09.md` + `ARCHIVES-TEMP-2026-09.md` : historique pur | 30 Ko | conserver ou supprimer après extraction | `docs/arbo/` |
| 36 | `references` | 3 références possiblement orphelines : `FACTS_GUILDE_2026.md`, `OCR_STRATEGY_2026.md`, `REDIS-OCR-SETUP.md` | 1 à 2 citations chacune | vérifier puis fusionner/supprimer | `docs/reference/` |
| 37 | `service-activity-log` | Table non bornée (preuves de litige) | ≈ 232 ko, hors top 30 | borner ou assumer le coût | `docs/MAINTENANCE.md` |
| 38 | `harebourg-solver` | `harebourg-solver.ts` : brancher ou retirer ? | 1 occurrence | trancher | — |
| 39 | `admin-members-doc` | Doc vivante `admin-members` à mettre à jour | `docs-catalog.ts` figé | éditer dans `/god/docs` | — |
| 40 | `captures-a3` | 3 captures 1440 / 1024 / 390 manquantes | session navigateur connectée | les prendre | — |
| 41 | `active-context-rotation` | Purge effective des blocs ou abandon de la règle des 6 ? | 6 blocs | trancher | `docs/agents/activeContext.md` |
| 42 | `harness-maintenance` | Harnais H0-H7 livré : re-mesurer après stabilisation | cette PR | re-mesure + ajustements | `docs/agents/harnais.md` |
| 43 | `god-system-polish` | Carte Conteneurs vide alors que Prometheus est 4/4 ; pas de détail par conteneur | bêta 19/10 | corriger la requête cAdvisor + tableau (nom, CPU, RAM, redémarrages) + charge CPU/version lisibles | `docs/MAINTENANCE.md` |
| 44 | `grafana-alerts-audit` | Règles d'alerte Grafana éventuelles dans `grafana_data` : plus exécutées | volume conservé, non audité | lister et recréer dans Sentry/webhook si nécessaire | `docs/MAINTENANCE.md` |
| 45 | `deploy-sha-normalize` | `deploy-cd.sh` refuse un SHA 8/40 alors que la CI publie 7 caractères | `5b31ad0f` refusé, `5b31ad0` accepté | normaliser le SHA à 7 dans `deploy-cd.sh` et `rollback.sh` | `docs/agents/deploy-vps.md` |
| 46 | `telemetrie-retention` | `TelemetryEvent` n'a **aucune purge** : la table grossit sans fin | mesuré sur le VPS le 20/10/2026 : **24 Mo**, 2ᵉ plus grosse table applicative ; aucun `deleteMany` dans `src/` | cadrer une rétention (90-180 j) + cron de purge idempotent, testé | `docs/MAINTENANCE.md` |
| 47 | `crits-incoherents` | Effets **critiques inférieurs** aux dégâts de base publiés sur les fiches boss (ex. Phossile : base 426-480, crit 71-80) | mesuré le 20/10/2026 sur **Comte Harebourg** : base 639-810, crit **71-90** (même symptôme) ; `isCoherentCritJet` existe (lot R-4) mais le chemin Dofensive formate les crits en **chaînes** (`criticalEffects?: string[]`) **avant** le contrôle → la règle ne s'applique pas | garder `{min,max}` jusqu'après le contrôle, puis formater ; test de non-régression sur un sort réel | — (à créer) |
| 48 | `donjons-sans-donnees` | **25** donjons de la base sans entrée au catalogue local ⇒ fiche « partielle » (ni résistances, ni butin) | mesuré le 20/10/2026 : **34/151** bandeaux, **9 corrigés par alias** (#1051) ; fichier déployé **identique au dépôt** (187 entrées) ⇒ pas un fichier périmé | vérifier la couverture de `siphon-dungeon-monsters.mjs`, relancer le siphon, puis `sync-assets.sh` (bind mount) | — (à créer) |
| 49 | `simulation-refonte` | Simulation tactique (fiche boss + overlay), **fer de lance** : doc développeur affichée (« Règle du jeu 3.6 », « Motte de zoom »), légende à 6 entrées, perf non mesurée, aucun état partageable | relevé le 20/10/2026 (captures) ; **aucune mesure** de rendu ni de DOM | S-1 **mesurer** → S-2 nettoyer (doc → repliable, un seul langage visuel) → S-3 état dans l'URL + page outil `/simulateur` | — (à créer) |
| 50 | `boss-fiche-locale` | Les commandes Discord `/boss` et `/monstre` interrogent encore **DofusDB de façon synchrone** alors que `getLocalMonsterFiche` existe (siphon + bestiaire local, zéro réseau) | mesuré le 20/10/2026 : la route contient encore `getMonsterStats` (×2) et `mob.grades?.[mob.grades.length - 1]` ; le test « réponse < 3 s » (écrit le 16/10, conservé hors dépôt puis consigné ici) **échouerait** tant que la bascule n'est pas faite | basculer les 2 commandes sur `getLocalMonsterFiche`, garder un repli explicite (« fiche indisponible »), activer le test | — (à créer) |

## 4. Décisions en attente (elles bloquent un rang)

| # | Décision | Bloque |
|---|---|---|
| **D1** | Facteur Kamas Violets de la clôture : `*10` (code) vs `*10 000` (seuil) | rang 16 (RAID R2) |
| **D2** | Stocker `raidPurpleKamasCost` à la clôture (sinon `undo` rembourse `?? 30`) | rang 16 |
| **D3** | Orphelins : fermer ou laisser vivre un raid sans capitaine ? | rang 17 |
| **D4** | `PLAN-SALONS-VOCAUX` : retenir et cadrer, ou archiver ? | rang 27 |
| **D5** | Onboarding 06/09 : proposition validée ? (migration à appliquer) | rang 28 |
| **D6** | Acquisition : ordre des lots + une page n'entre au sitemap que si elle porte de la donnée réelle | rang 25 |
| **D7** | Landing : `maintenance.html` vs `page.tsx` | rang 3 |
| **D8** | Cloudflare devant `sigilos.fr` : oui (DPA + cookie `__cf_bm`) ou non (Caddy seul) ? | rang 29 |
| **D-R1** | Moteur de rôles : voie A (vocal **total** universel, recommandée) ou voie B (fenêtres + reset bot, 1 migration) ? | rang 12 |
| **D-M1** | Marché lot multiple : valeur d'`enum` (migration additive ?) + une `MarketDiscordMessage` par objet (migration ?) | rang 18 |
| **D-S1** | `ServiceActivityLog` : borner (purge) ou conserver comme preuve de litige ? | rang 37 |
| **D-P1** | `/presentation` : redirection vers le hub, ou retrait du bloc + entrée de menu ? | rang 8 |
| **D-H1** | `harebourg-solver.ts` : brancher (quel écran ?) ou retirer ? | rang 38 |
| **D-AC1** | `activeContext.md` : purge effective des blocs, ou abandon de la règle des 6 ? | rang 41 |

## 5. Registre des chantiers clos (une ligne, jamais de détail)

| ID | Chantier | Livré |
|---|---|---|
| `A` | Siphons game-data (A1 → A5) | 28/09/2026 |
| `B` | Membres `/admin/members` (B-1 → B-3) | 14/10/2026 |
| `X-1` | Sondages programmés | 13/10/2026 |
| `Y` | Rôles automatiques par ancienneté (Y-1 → Y-5) | 14/10/2026 |
| `W-1/W-2` | Observabilité Sentry (traces + runtimes) | 11/10/2026 |
| `T-1/T-2/T-2b/T-3` | Rush Sylvestre — affichage, temps réel, prérequis, studio God | 08/10/2026 |
| `V-A/V-B` | Rush Sylvestre — agrégation unique + ids/icônes | 10/10/2026 |
| `R-1 → R-4` | Raccord DofusDB (résistances, tacle/fuite, critiques, icônes) | 15/10/2026 |
| `DEMO S-0/S-1` | Démo publique — mesure + route `/demo` | 02/10/2026 |
| `M-1 membres` | Deslop de l'annuaire (volet membres) | 05/10/2026 |
| `menage A/B-1` | 7 dépendances mortes + 24 fichiers morts | 19/10/2026 |
| `supply-chain` | Garde-fou des scripts d'installation npm | 19/10/2026 |
| `codeql` | XSS overlay + SSRF `redirect: error` | 19/10/2026 |
| `env-validation` (F8) | Validation d'environnement au démarrage (`instrumentation.ts`), fail-closed en prod, avertissement CSP | 19/10/2026 |
| `monitor-private` (F9) | Grafana retiré de l'exposition publique et du compose ; Prometheus interne épinglé v3.15.0 ; accès God — **déployé bêta `5b31ad0`** | 19/10/2026 |
| `god-system` | God → Système & Infra : CPU, RAM, disque, Redis, PostgreSQL, conteneurs, crons — **déployé bêta `5b31ad0`** | 19/10/2026 |
| `harnais H0-H7` | Roadmap unique, journal archivé, zone temp unique, 4 règles, 6 skills, 3 hooks, `.clineignore`, garde | 19/10/2026 |
| `seo-extraits-serp` | Extraits SERP bornés (`src/lib/seo.ts`, 60/155) : fiches boss, hub `/almanax`, 7 guides FR + garde `seo-serp-extraits` — **mesuré** : 6 156 impr. / 109 clics, guides = 44 % des clics | 20/10/2026 |
| `T-2c` · `V-G` · alignement (lots 1-5) | Rush — prérequis par id stable, liaison Metamob dans l'overlay, modale d'alignement (camps → Ordres → tranches), route `resolveRushRoute`, présence temps réel, jumelle de branche (God), **tranches supprimées (saisie + affichage)**, **reset des quêtes d'alignement au changement de cité (cascade comprise)**, **arbre cité → Ordre** (migration additive), **verrou de palier calculé** et **jumelle d'Ordre** | 20/10/2026 |

| `rush-consolidation` | Rush — siphon exhaustif des 2 sources (Tougli API + Dofusyelle) : séries **100 / 102** (Dofusyelle = préfixe exact de 99), 30 quêtes d'Ordre (palier dérivé par position), 19 classes, 1 085 contraintes inventoriées, **584** ressources (408 communes), 99 + 83 donjons (67 slugs), 62 succès ; **verrou de donjons** (requis/optionnel, multi-donjons) en règle pure + 12 tests | 21/10/2026 |

## 6. Archives et mémoire froide

- `docs/agents/journal-sessions-2026.md` — **171 blocs de session** + ancien backlog, conservés pour la mémoire du projet ; **ne pas lire au démarrage**.
- `docs/agents/archive/FILE-EXECUTION-2026-10-15.md` — ancien ordre (étapes 1 → 64). **Les numéros d'étape sont historiques** : utiliser les IDs ci-dessus.
- `docs/agents/archive/BRIEF-REPRISE-2026-10-14.md` — fil des demandes et décisions du 14/10.
- `docs/agents/archive/session-amorce-2026-09.md` — remplacé par `AGENTS.md` + `docs/agents/harnais.md`.
- `src/temp/archive/` — corpus volatil (audits 20/09, maquettes, siphons) déplacé, **jamais versionné**.
- Volume Docker `grafana_data` conservé (non monté) — suppression seulement sur accord explicite.
- Règles d'alerte Grafana : aucune n'a été auditée ; elles ne tournent plus. Le volume les conserve peut-être.
- Prod **non déployée** : `main` = `07c0500e` (12/10), `dev` a **103 commits d'avance**. `deploy-cd.sh prod 5b31ad0` s'arrête au contrôle du tag.
- `src/temp/archive/duplicates-2026-10-19/` — 3 doublons exacts (hash identique) : `ARCHITECTURE-…SYLVERSTRE` = `AMORCE-DEMO-PUBLIQUE.md`, `MODULE-…SYLVERSTRE` = `AMORCE-DEMO-PUBLIQUE.md`, `PLAN-REFONTE-…SYLVERSTRE` = `PLAN-DESLOP-ANNUAIRE.md`.

## 7. Tenue de cette feuille

1. Un chantier livré → sa ligne **sort** et rejoint le §5 (une ligne, sans récit).
2. Un nouveau chantier → une ligne au §1/§2/§3 + un plan durable dans `docs/plans/`.
3. Aucune session ne s'écrit ici : le récit va dans `activeContext.md` (6 blocs), l'historique dans le journal.
4. Garde automatique : `docs/ROADMAP.md` doit rester **< 60 Ko** (`tests/unit/harness-config.test.ts`).
5. **Les rangs sont stables** : un chantier livré laisse un trou dans la numérotation, il n'est pas réattribué (les décisions citent les rangs).
