# 🗺️ ROADMAP — SigilOS (feuille de route unique)

> **Rôle unique.** Ce fichier porte le **backlog** ET **l'ordre**. Une ligne = un chantier.
> **Règle d'or.** 1 rang = 1 lot = 1 branche = 1 PR → `dev`. On merge avant d'ouvrir le suivant.
> **Mémoire.** 6 dernières sessions : `docs/agents/activeContext.md`.
> Historique complet (171 blocs) : `docs/agents/journal-sessions-2026.md` — **à la demande**, jamais au démarrage.
> **Tenue.** Un chantier livré quitte le tableau et rejoint le §5. Aucun récit de session ici.
> **Dernière MàJ** : 09/11/2026 · SHA courant injecté par le hook `TaskStart`.

## 0. Reprise immédiate

- ⏳ **En attente de prod (26/10/2026)** — la **bêta** tourne `dev` `2a06ef26` (**287 migrations**, `sigilos-beta`) ; la
  **prod** reste sur `main` `66040052` (**267 migrations** ⇒ **20 en attente**). Lots non déployés : calendrier/membres/
  blacklist/succès (25/10) **puis stuff & variantes** (panoplies recalculées, pods, plafonds, veille auto-entretenue).
  Bascule : PR `dev` → `main` → CI verte → `./scripts/deploy-cd.sh prod` → **puis, dans cet ordre** :
  ① `backfill-dungeon-completion` (`docs/MAINTENANCE.md` § Rattrapage) ; ② `siphon-item-sets?apply=1` — **en premier**,
  le référentiel prod est **vide** et sans lui les variantes à panoplie sont refusées (fail-closed) ; ③
  `siphon-item-conditions?apply=1` (264) ; ④ un `data-watch` manuel (pose le filigrane des panoplies) ; ⑤ les lignes de
  crontab prod (`docs/MAINTENANCE.md` § Tâches planifiées — **une seule** `data-watch`, elle existe déjà sur le VPS).
  ⚠️ La crontab du VPS vise `beta.sigilos.fr` (`APP_URL`). Détail ordonné : `docs/plans/AMORCE-STUFF-VARIANTES-RESTE.md` §1.

- **Décisions bloquantes** : `D-R1` (moteur de rôles), `D1`/`D2` (RAID), `D7` (landing), `D8` (Cloudflare).
- **Ops en attente** : migrations `20270112000000` + `20270113000000` et bot **portés par `deploy-cd.sh`** (étape 4 — les jouer avant si le code dépend du schéma) · crontabs sondages/ancienneté/4 rappels **déjà posés** (02/11) · `live-watch` à vérifier · **redéploiement bêta** (image Node `24.22.1` + migration renumérotée, voir `docs/agents/node-runtime.md`).
- 🗓️ **Sprint S1 — semaine du 09/11/2026** *(ordre de passage ; cocher au fur et à mesure ; bloc retiré le 16/11)*
  - [ ] **lun** — F17b · V-H · finitions anonymes (F3/F4/F7) · dettes visiteur · `PUBLIC_VISITOR_ENTRY=1`
  - [ ] **mar** — F1 · F2 · F5+F6
  - [ ] **mer** — F16 (= V2b) · V2a-4 reste (tour spotlight)
  - [ ] **jeu** — T-4 (O14 · O15 · G7/G8/G9) · transverses + 4 `prompt()` · V-C · V-D2 · drop `alignOrderReq`
  - [ ] **ven** — studio E2 (inspecteur quête) · V2c (Rush Live visiteurs)
  - [ ] **sam** — V2d (ladder serveur) · E3 (bloc/masse/problèmes) · V3 (God visiteurs)
  - [ ] **S2** — T-5 · T-6 · bloc B · E4/E5 studio · lot D · E4 DA Wakfu · colonne `resources` · `questDbIds`
  **Dépend de toi** : captures G7/G8/G9/O15 · nom de `33380` · 98 textes Brâkmarien · 2×100 + 30 quêtes.

## 1. P0 — Bloquants prod / ops / sécurité (ordre strict)

| Rang | ID | Chantier | État mesuré | Prochain lot | Plan | Bloqué par |
|---|---|---|---|---|---|---|
| 3 | `ouverture-prod` (#57) | `robots.txt`, `sitemap.xml` et `llms.txt` renvoient la page d'attente (HTML) ; 2 apps Discord à isoler ; hardlinks ; rewrite Caddy à retirer | mesuré le 21/09/2026 | robots/sitemap statiques + `noindex` ; checklist Jour J | `docs/ops/GUIDE-DEPLOIEMENT-PROD-JOUR-J.md` · `docs/plans/SEO_REPRISE.md` | **D7** (landing) |
| 5 | `migrations-ops` | 2 migrations additives + bot + crontabs non déployés | `20270112000000` (GodNotification.details), `20270113000000` (DiscordMemberActivity) | jouer bêta puis prod ; redéployer le bot ; poser les 4 crontabs | `docs/MAINTENANCE.md` | — |
| 6 | `caddy-post-503` | Pendant une maintenance, un POST reçoit du HTML au lieu d'un `503 text/plain` | cause racine du 16/10 | durcir le `Caddyfile` (POST → 503) | `docs/MAINTENANCE.md` | — |
| 7 | `csp-enforce` (F10) | CSP en Report-Only : la protection XSS ne bloque rien | `CSP_ENFORCE` présent dans `src/proxy.ts` | poser `CSP_ENFORCE=true` après 48 h de rapports | `docs/SECURITY.md` | — |
| 8 | `presentation-access` | `presentation:view` existe mais n'est pas ouverte au rôle Membre ; l'ancienne page `/presentation` rend encore le règlement | 1 occurrence dans `src/` | ouvrir la permission + trancher la page | — | **D-P1** |
## 2. P1 — Chantiers produit (ordre proposé)

| Rang | ID | Chantier | État mesuré | Prochain lot | Plan | Bloqué par |
|---|---|---|---|---|---|---|
| 9 | `rush-refonte` (T) | Rush Sylvestre : ergonomie, temps réel, éditeur God, habillage Dofus, perf | **T-1, T-2, T-2b, T-3 livrés** le 08/10 · **T-2c livré** le 20/10 · **T-4 partiel** le 26/10 (**O14** contraste des **24** accents Dofus + **T2** état accessible du **bandeau réel**, verrou T2 repointé le 27/10 après suppression du composant mort) · **T-4 : DA « Carnet » livrée** le 02/11 (matières, en-tête, chapitre, cartes, fiches, bandeaux, footer, portails, filtre Toutes/En cours/Verrouillées, ressources à prévoir, badges bornés ; verrou `rush-da-grimoire` **23**) · **coches de ressources dans la fiche** (valider = tout cocher, invalider = tout décocher ; `rush-quest-resource-checks` **7** + `rush-resource-checks` **19**) · **`L3` livré le 02/11/2026** (modale d'accueil en DA Carnet, `hasNoClassDeclared` branché) | **T-4** reste G8/G9/G7 (+ accents Dofus) → **T-5** → **T-6** | `docs/plans/PLAN-REFONTE-RUSH-SYLVESTRE.md` · `docs/plans/MODULE-RUSH-SYLVESTRE.md` | — |
| 10 | `rush-donnees` (V) | Rush Sylvestre : agrégation unique des ressources, ids/icônes, alignement, ocre, Metamob | **V-A, V-B livrés** le 10/10 · **V-G livré** · **V-F partiel** · **consolidation Tougli × Dofusyelle mesurée le 21/10** (100/102, 584 ressources, 30 Ordres, 19 classes) · **donjons cochables livrés** (S0-1 → S0-5bis, **S0-6**, **S0-7**) · **S4-1 livré** le 23/10/2026 (vue Branches 2 étages, `src/lib/rush-branches.ts`) · **outil Trame hors dépôt livré** le 26/10 · **S4-2 + S4-4 livrés** le 26/10 (route éditable sur une séquence **existante**, import **dry-run**, identité de quête assistée + `questDbIds` persistés) · **S5-1 partiel livré** le 27/10 (`alignOrderReq` ni lu ni écrit ; colonne conservée — drop = migration) · **S1 avancé le 27/10** (PR #1139) : cités **100/102 + 3 variantes**, **30** quêtes d'Ordre (**6 × 5/5**), **19** classes + filtre de classe, modèle **étape à choix** (`choice_group`) · **bloc B : fondation en base seulement** (`publicSlug` + `isPublished`), **aucune route** · **`G0` livré le 02/11/2026** (masse par bloc, classe fermée, aperçu, Branches à 3 étages) · **`L1` livré le 02/11/2026** (camp/name, palier calculé, reset par cité, compteur hors Ordres) · **`L2` livré le 02/11/2026** (route cité→Ordre→classe interne + overlay, chaîne des rangs `previousOrderRank`, changement d'Ordre) · **`L3` livré le 02/11/2026** (modale d'accueil en DA Carnet, `hasNoClassDeclared` branché) · **25 conseils écrits le 04/11/2026** (contraintes Tougli, rattachement `questDbIds` ; 194 restants)  · **V-D1 livré le 04/11/2026** (ressources : 390 → **485** ids, 81 séquences, 252 tags ; reste V-D2) | **split multi-quêtes livré le 05/11** · **V-H** (ocre) → V-C → **bloc B** (route par quête) | `docs/plans/RUSH-DEVELOPPEMENT-SUITE.md` · `docs/plans/MAPPING-RUSH-SYLVESTRE.md` · `docs/plans/MODULE-RUSH-SYLVESTRE.md` | — |
| 11 | `tickets-v2` (C) | Module Tickets : finir la v2 (SLA, auto-fermeture, i18n, doublons) | 5 chantiers UX livrés le 20/10 ; **commandes slash personnalisées livrées le 21/10** ; **perfectionnements UX embed, custom CSAT, variables {staff}/{moderateur} et RBAC staff commandes le 22/10** · **renommage Discord suivi par le salon (cron `sync-members`) le 25/10** · **renommage temps réel par le bot (surnom ou nom d'utilisateur) le 25/10** | C-1 → C-4 | `docs/plans/PLAN-REFONTE-TICKETS-V2.md` | — |
| 12 | `roles-multi` (Y+) | Moteur unique de rôles : ancienneté (projection) + vocal + contribution | cadré le 18/10, **aucun code** | R-1 (évaluateur + stockage) → R-2 (cron + annonces) → R-3 (onglet) | `docs/plans/PLAN-MOTEUR-ROLES-MULTI-SOURCES.md` | **D-R1** |
| 13 | `commandes-slash` (Z) | Commandes slash personnalisées (catalogue ∪ guilde, payloads dérivés) | **Z-1/Z-2 livrés le 24/10** (sync réelle rôles + salons, payloads dérivés du catalogue, scope God par guilde) · **25/10 : `/valider-recrue` fix pérenne anti-timeout** (résolution 0 ms à l'ouverture, deferred reply type 5 à la soumission) ; reste Z-3/Z-4 | Z-3 → Z-4 | `docs/plans/PLAN-COMMANDES-SLASH.md` | — |
| 14 | `roles-succes` (S) | Rôles par points de succès ladder (même moteur que Y) | migrations **accordées** le 15/10 | S-1 → S-3 | `docs/plans/PLAN-ROLES-SUCCES.md` | — |
| 15 | `activite-guilde` (N) | Activité de guilde enrichie + notifications | N-1 et N-4 livrés pour les paliers ; **4 sources restantes** (Dofus, succès, donjons/DJ, songes) | N-2 (4 sources) → N-3 → N-4 | `docs/plans/PLAN-ACTIVITE-GUILDE.md` | — |
| 16 | `raid` (G) | RAID : calendrier, clôture/no-show, strat, overlay, données | §1/§3/§24/§25 livrés, R0 (calendrier) gardé ; **R1-P0 livré le 30/10** (PR #1170) ; **R1 (no-show) ouvert** — audit B1→B13 mesuré | R1 (no-show, **migration**) → R2 → … → R10 | `docs/plans/PLAN-RAID.md` · `docs/plans/AMORCE-RAID.md` | **D1 + D2** |
| 17 | `orphelins` (F) | Reprise de relai quand le créateur d'un raid/DJ/quête a disparu | né le 01/10 | F-A → F-B → F-C | — (à créer) | **D3** |
| 18 | `marche` (I) | Marché : images d'embeds, validation FR, lot multiple (5 objets), multi-embed | S7 livré ; reste le lot multiple et l'étape « Publication » | I-1 + lot multiple | — (à créer) | **D-M1** |
| 19 | `services` (J) | Services : clôture, inactivité, feedback, images, forum ; `valider-recrue` en ticket | ouvert · **25/10 — un salon par flux** (PR #1113 + branche empilée) : annonces en **forum obligatoire** (tags par catégorie), demandes en forum **ou** texte ; **anti-doublon** (édition = PATCH, jamais un 2ᵉ sujet) ; statut de publication remonté à l'écran (badge + bouton Publier) · **bouton Documentation `services` ajouté** (contenu écrit en local, à uploader) | J-1 → J-2 | — (à créer) | — |
| 20 | `succes` (K) | Succès & encyclopédie : onglet Monstres, succès imbriqués | ouvert | K-1 → K-2 | — (à créer) | — |
| 21 | `mini-jeux` (H) | Mini-jeux & salons temps réel : solidité Redis, solo, Panthéon, HUD/UX | ouvert | H-1 → H-2 | — (à créer) | — |
| 22 | `deslop` (L) | Déslop global : dashboard, admin, landing, modales, ressources, missions, ladder, worldmap | ouvert · demande du 20/10 : **aligner toutes les nouveautés** (landing incluse) | L-1 → L-4 | — (à créer) | — |
| 23 | `guildes-admin` (M) | Guildes & admin : calendrier, profil, stuff, édition staff, logs | volet `membres` livré (05/10) · **inventaire des mules** et **pseudo vérifié au ladder + embed « fin d'essai »** livrés le 25/10 | M-1 reste (calendrier/profil/stuff) → M-2 → M-3 | `docs/plans/PLAN-DESLOP-ANNUAIRE.md` | — |
| 24 | `god-refonte` (O) | Refonte God « Guildes & Users » : 12 chantiers, 7 lots ; **+ tickets d'exploitation** (un seul endroit `?tab=tickets`, retours visiteurs identifiables, `ticket-bot` à revoir) | plan vivant ; **tickets : brief du 08/11, rien de codé** | G1 → G12 ; **tickets : G1 → G4** | `docs/plans/PLAN-REFONTE-GOD-GUILDES.md` · `docs/plans/PLAN-TICKETS-GOD.md` | — |
| 25 | `acquisition` (E) | SEO / contenu : autorité avant volume | dossier mesuré le 30/09 | E-1 → E-2 → E-3 ; **prérequis** backfill `MonsterStat` (~5 135 fiches) | `docs/plans/SEO_REPRISE.md` | **D6** |
| 26 | `demo-publique` (S) | Démo publique en lecture seule, essayable sans compte | S-0/S-1 livrés (02/10) | S-2a → S-2b → S-3 → S-4 → S-5 | `docs/plans/PLAN-DEMO-PUBLIQUE.md` · `docs/plans/AMORCE-DEMO-PUBLIQUE.md` | — |
| 27 | `salons-vocaux` (Q) | Module « salons vocaux temporaires » (cahier V2.1) | idée neuve, **à cadrer** | cadrage → lots | `docs/plans/PLAN-SALONS-VOCAUX.md` | **D4** |
| 28 | `onboarding` (ONB) | Onboarding & acquisition (prospect → guilde) | proposition du 06/09 | valider la proposition + migration | `docs/plans/PLAN-REFONTE-ONBOARDING.md` | **D5** |
| 29 | `reseau` (NET) | Durcissement réseau : Cloudflare/WAF devant `sigilos.fr` ? | à décider | décision + DPA + pages RGPD | — | **D8** |
| 30 | `observabilite` (W) | Sentry : couverture bot/workers, 25 crons, alertes | W-1/W-2 livrés le 11/10 | W-3 → W-6 | `docs/agents/journal-sessions-2026.md` (bloc 11/10) | — |
| 31 | `dofusdb-zero` (U) | Zéro dépendance DofusDB à l'exécution (5 points de contact mesurés) | cadré le 08/10 | U-1 → U-5 | `docs/agents/archive/FILE-EXECUTION-2026-10-15.md` (cadrage § U) | — |
| 32 | `solveurs` | Solveurs tactiques (Kalisthe, Minogolem, Harebourg) : données de combat, pas de décompilation | prototypes dans `src/temp/` | cadrer → POC | `docs/plans/PLAN-SOLVEURS-TACTIQUES.md` | — |
| 57 | `espace-visiteur` (PV) | Compte Discord **sans guilde** : espace perso `/espace-visiteur/<segment>` (6 segments), progression de rush en base, **Progression Communautaire** par serveur, **Succès Donjons** entre visiteurs, **annuaire privé** par serveur, modération God | V1a→V1c, coque/assets/succès, V2e annuaire, V1e ladder, V1d progression, V2a-1/3/5 surface publique, V2a-4 alignement + mules + accueil, V2a-6 CTA, V2a-2 communautaire (D-V21), **V2f** (F8-F15, F17a livrés) — 06-08/11 · **Ocre public ISO** (panneau partagé, options ISO, lecture 400) 09/11 ; **D-V1→D-V21** | **V2f** (F1-F7, F16, F17b) → V2a-4 reste (tour) → V2b → V2c → V2d → V3 | `docs/plans/PLAN-ESPACE-VISITEUR.md` | — (prochain : **F17b**) |
| 58 | `da-wakfu` | DA « Gouache Wakfu » : habillage du Rush, puis passation dashboard | **E0→E3e livrés** 05/11 : overlay · guides · 12 modales · bandeau+panneau unifiés ; panneau public aligné 07/11 · **hero plafonné** en fenêtre courte 09/11 | **E4 reporté** (chantier dédié) | skill | — |
| 59 | `profil-refonte` | Profil dashboard : déslop, un accent, 8 onglets | **P1→P4 + P3-bis livrés** 08/11 | P2-ter : 5 fichiers (palette 30, slop 65) | `docs/plans/PLAN-REFONTE-PROFIL-DASHBOARD.md` | — |


## 3. P2 — Dette, hygiène, documentation (ordre souple)

| Rang | ID | Chantier | État mesuré | Prochain lot | Plan |
|---|---|---|---|---|---|
| 34 | `menage` (B-2/B-3 → F) | 74 fichiers morts, 16 scripts, doublons, `seed.ts` IDs réels, `refs/cline` 307 + 2 stashes | lot A (7 deps) et B-1 (24 fichiers) livrés le 19/10 | B-2/B-3 → C → D → E → F | — |
| 35 | `hygiene-logs` (F5/F6) | **155** `console.*` hors tests ; masquage des logs à vérifier | mesuré le 19/10 | remplacer par `logger`, masquer snowflakes/e-mails | `docs/RULES.md` |
| 36 | `docs-arbo` | `AUDIT-ARBO-2026-09.md` + `ARCHIVES-TEMP-2026-09.md` : historique pur | 30 Ko | conserver ou supprimer après extraction | `docs/arbo/` |
| 37 | `references` | 3 références possiblement orphelines : `FACTS_GUILDE_2026.md`, `OCR_STRATEGY_2026.md`, `REDIS-OCR-SETUP.md` | 1 à 2 citations chacune | vérifier puis fusionner/supprimer | `docs/reference/` |
| 38 | `service-activity-log` | Table non bornée (preuves de litige) | ≈ 232 ko, hors top 30 | borner ou assumer le coût | `docs/MAINTENANCE.md` |
| 39 | `harebourg-solver` | `harebourg-solver.ts` : brancher ou retirer ? | 1 occurrence | trancher | — |
| 40 | `admin-members-doc` | Doc vivante `admin-members` à mettre à jour | `docs-catalog.ts` figé | éditer dans `/god/docs` | — |
| 41 | `captures-a3` | 3 captures 1440 / 1024 / 390 manquantes | session navigateur connectée | les prendre | — |
| 42 | `active-context-rotation` | Purge effective des blocs ou abandon de la règle des 6 ? | 6 blocs | trancher | `docs/agents/activeContext.md` |
| 43 | `harness-maintenance` | Harnais H0-H7 livré : re-mesurer après stabilisation | cette PR | re-mesure + ajustements | `docs/agents/harnais.md` |
| 44 | `god-system-polish` | Carte Conteneurs vide alors que Prometheus est 4/4 ; pas de détail par conteneur | bêta 19/10 | corriger la requête cAdvisor + tableau (nom, CPU, RAM, redémarrages) + charge CPU/version lisibles | `docs/MAINTENANCE.md` |
| 45 | `grafana-alerts-audit` | Règles d'alerte Grafana éventuelles dans `grafana_data` : plus exécutées | volume conservé, non audité | lister et recréer dans Sentry/webhook si nécessaire | `docs/MAINTENANCE.md` |
| 46 | `deploy-sha-normalize` | `deploy-cd.sh` refuse un SHA 8/40 alors que la CI publie 7 caractères | `5b31ad0f` refusé, `5b31ad0` accepté | normaliser le SHA à 7 dans `deploy-cd.sh` et `rollback.sh` | `docs/agents/deploy-vps.md` |
| 47 | `telemetrie-retention` | `TelemetryEvent` n'a **aucune purge** : la table grossit sans fin | mesuré sur le VPS le 20/10/2026 : **24 Mo**, 2ᵉ plus grosse table applicative ; aucun `deleteMany` dans `src/` | cadrer une rétention (90-180 j) + cron de purge idempotent, testé | `docs/MAINTENANCE.md` |
| 48 | `crits-incoherents` | Effets **critiques inférieurs** aux dégâts de base publiés sur les fiches boss (ex. Phossile : base 426-480, crit 71-80) | mesuré le 20/10/2026 sur **Comte Harebourg** : base 639-810, crit **71-90** (même symptôme) ; `isCoherentCritJet` existe (lot R-4) mais le chemin Dofensive formate les crits en **chaînes** (`criticalEffects?: string[]`) **avant** le contrôle → la règle ne s'applique pas | garder `{min,max}` jusqu'après le contrôle, puis formater ; test de non-régression sur un sort réel | — (à créer) |
| 49 | `donjons-sans-donnees` | **25** donjons de la base sans entrée au catalogue local ⇒ fiche « partielle » (ni résistances, ni butin) | mesuré le 20/10/2026 : **34/151** bandeaux, **9 corrigés par alias** (#1051) ; fichier déployé **identique au dépôt** (187 entrées) ⇒ pas un fichier périmé | vérifier la couverture de `siphon-dungeon-monsters.mjs`, relancer le siphon, puis `sync-assets.sh` (bind mount) | — (à créer) |
| 50 | `simulation-refonte` | Simulation tactique (fiche boss + overlay), **fer de lance** : doc développeur affichée (« Règle du jeu 3.6 », « Motte de zoom »), légende à 6 entrées, perf non mesurée, aucun état partageable | relevé le 20/10/2026 (captures) ; **23/10/2026** : glyphes & pièges détectés, sorts à charge signalés, barre de zoom déslopée ; **peinture réparée puis rendue visible** (trou noir sur fond noir, cases hors sol, cloisonnement par carte — `src/lib/sim-paint.ts` + surlignage pointillé, 10 verrous ; suite **5 096 ✓**) | S-1 **mesurer** → S-2 nettoyer (doc → repliable, un seul langage visuel) → S-3 état dans l'URL + page outil `/simulateur` ; **reste** : écart de dégâts (**D-SIM1**), chiffrage réel des charges (table officielle), glyphes au sol (dégâts par tour). **Abandonné le 23/10/2026** : état de simulation dans l'URL (« osef ») | — (à créer) |
| 51 | `boss-fiche-locale` | Les commandes Discord `/boss` et `/monstre` interrogent encore **DofusDB de façon synchrone** alors que `getLocalMonsterFiche` existe (siphon + bestiaire local, zéro réseau) | mesuré le 20/10/2026 : la route contient encore `getMonsterStats` (×2) et `mob.grades?.[mob.grades.length - 1]` ; le test « réponse < 3 s » (écrit le 16/10, conservé hors dépôt puis consigné ici) **échouerait** tant que la bascule n'est pas faite | basculer les 2 commandes sur `getLocalMonsterFiche`, garder un repli explicite (« fiche indisponible »), activer le test | — (à créer) |
| 52 | `galerie-variantes` | **Galerie Stuff** : variantes proposées par le joueur (trophée/dofus/objet remplacé), affichées sans toucher au stuff Dofusbook | **livré** le 23/10/2026 : `dofusBookLinks[].variants` (JSON, **aucune migration**), bascule **Stuff ⇄ Variante** sur la miniature et la modale, stats/dégâts recalculés (`applyVariantsToBuild`), action `saveBuildVariant` (auteur seul, rate limit) — 11 verrous · **complément** : **persistance** (auto-enregistrement 800 ms + brouillon local `src/lib/dofus-variant-storage.ts`, 6 verrous), **toggle dans le voile de la carte** (visible par tous), **icône locale** de l'objet varié · **complément du 25/10/2026** : la variante s'affiche **au clic** sur la miniature du profil et la carte de la galerie (grille d'icônes remplacée + récapitulatif des objets échangés, stats de la carte incluses) et le stuff d'un **autre membre** passe en **lecture seule** (ni éditeur de slot, ni brouillon local, ni « Réinitialiser ») — verrou `galerie-variantes-affichage` **13** · **fluidité du scroll (04/11/2026)** : `backdrop-blur` retiré (barre sticky, hero, cartes), halos `blur(100px)` remplacés par des dégradés, `content-visibility` sur les grilles (galerie, annuaire, marché, donjons) | **image OG + embed Discord : afficher la variante avec un tag explicite** (décidé le 23/10/2026) — **livré** le 26/10/2026 (`resolveVariantPreview` : une seule règle ; tag `VARIANTE` sur l'image, `· 🟡 Variante` + liste des objets remplacés dans l'embed, stats **effectives**) · **règles de combinaison souveraines** : bonus de panoplie **recalculés** quand une variante change une pièce — **livré** le 26/10/2026 (`GameItemSet`, 938 panoplies siphonnées, verrou `dofus-set-bonuses` **24**) · **Pods + veille + finitions** — **livrés** le 26/10/2026 (lots B/C/E) · **tuile God de la veille** — **livrée** le 26/10/2026 (`getItemConditionsWatch` + bandeau du Tableau God) | — (à créer) |
| 53 | `passifs-objets` | **Effets passifs officiels** des objets (Dofus, légendaires, bénédictions, Prysmaradites) | **livré** le 23/10/2026 : ligne native **`effectId 1175`** → `diceNum` = sort passif → `GET /spells/{id}` ; **117 sorts** dans `src/data/item-passives.json` (`scripts/siphon-item-passives.mjs`), repli inventé **supprimé**, description officielle des Prysmaradites dans la bibliothèque (12 verrous) | 38 sorts DofusDB sans description (percepteurs, 2 Dofus) : rien d'inventé, à rejouer via le siphon | — (à créer) |
| 54 | `supply-chain` | **Débloquer la porte de sécurité** : `zod` 3.25.76 → **4.6.7** (HIGH `GHSA-mrhx-c7xc-m3w5`) et `undici` 7.0.0 → **7.30.1** (HIGH `GHSA-4qv8-2p9j-2685`) | **livré** le 23/10/2026 (PR #1101) : override `undici` bumpé (transitif : discord.js, cheerio, jsdom), migration zod 3 → 4 sur **26 fichiers** (`errors` → `issues`, `required_error` → `message`, `z.record(clé, v)`, codes v4 dans `market/listing-schemas`, chemins `PropertyKey[]`, resolver du calendrier) — `security:audit` **franchie**, **5 099 ✓**, `tsc` 0, ESLint 0 | — (rien) | — | — |
| 55 | `rush-restes` | Restes du 26/10 : **T-4** G7/G8/G9/O15 (composition visuelle, à juger à l'écran) et sort de `questDbIds` (écrit, seule la puce du studio God l'affiche) | mesuré le 26/10 | juger à l'écran puis trancher | — |
| 56 | `live-discord` | Annonces de créateurs : live Twitch + nouvelle vidéo YouTube, **deux salons distincts** (Twitch / YouTube) + **deux interrupteurs** + ping par guilde, une annonce par session/vidéo (cron 5 min) | **livré** le 02/11/2026 · **scindé** le 04/11/2026 (salons et interrupteurs distincts, migration additive avec reprise du salon existant) | — (rien) | `docs/MAINTENANCE.md` | — |
| 58 | `ui-dj` | DJ/Quête : DA landing sur `DjPostCreateModal`, `DjEditModal`, `DjFiltersBar`, `DungeonFinderClient` | ~90 occurrences | même passe que #1252 + `ui-tokens-dj` | `docs/RULES.md` § UI |
| 59 | `god-rush-ux` | **Éditeur God Rush** : studio 3 panneaux (arbre / liste / inspecteur), Ctrl+K, filtres, inspecteur de quête, actions de masse, DA God | **E1 livré le 05/11/2026** : studio hors de `src/app/god/**`, 3 panneaux, arbre + recherche + filtres, `Ctrl+K`, garde de saisie, inspecteur (formulaires montés tels quels), responsive 1024/768 ; **644** occurrences DA restantes (674 avant) | **E2** (inspecteur quête) → E3 → E4 → E5 | `docs/plans/REFONTE-EDITEUR-RUSH.md` | — |
| 60 | `standby-etendu` | Marché (`market-expire`), demandes de service (`cleanup-inactive-service-requests`) et sondages (`close-old-polls`) : **aucune pause** — ni bouton, ni colonne, l'expiration est subie | mesuré le 05/11/2026 (3 modèles avec `standBy` : `DjSearchPost`, `DreamRun`, `GuildEvent` ; les 3 autres n'en ont pas) | si demandé : colonne `standBy` sur 3 modèles (**migration**) + bouton + gardes de cron | `docs/MAINTENANCE.md` § Stand-by | — |


## 4. Décisions en attente (elles bloquent un rang)

| # | Décision | Bloque |
|---|---|---|
| **D1** | Facteur Kamas Violets de la clôture : `*10` (code) vs `*10 000` (seuil) | rang 16 (RAID R2) |
| **D2** | Stocker `raidPurpleKamasCost` à la clôture (sinon `undo` rembourse `?? 30`) | rang 16 |
| **D3** | ~~Orphelins : fermer ou laisser vivre un raid sans capitaine ?~~ **Tranché le 25/10/2026** : clôture d'office à **+48 h** (après le rappel de +24 h), **traçable** (`closedBySystem`) et **rattrapable** (présents + score possibles ensuite, annulation 24 h) | — (soldé) |
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
| **D-SIM1** | **Écart de dégâts en simulation** : Intelligence 1991 (jeu) vs 1323 (calcul) — ratio 1,39 = exactement 1242/893. Trancher : (a) fournir le **payload Dofusbook brut** de la fiche concernée, ou (b) autoriser un dump temporaire des stats passées à `computeSpellDamage`. Sans mesure, aucun chiffre ne bouge : la géométrie d'`Attirance` est déjà prouvée par test, mais la référence de poussée (« vers le centre de la zone » vs « vers le lanceur ») reste à confirmer pour Glacier | rendu fidèle de la simulation (rang 49) |
| **D-G1** | Guide Rush — **onglet de suivi entre membres** (présence, donjons validés, métiers) : quel périmètre et quelle surface (guide interne / overlay) ? | aucun — idée notée le 22/10/2026, remplace le badge « qui peut aider » retiré |

## 5. Registre des chantiers clos (une ligne, jamais de détail)

| ID | Chantier | Livré |
|---|---|---|
| `HEADBAR-EVENEMENTS` | Barre du haut : **visuel réel** des événements (donjon, titan, Kralamoure) dans le bouton et la liste, cluster de droite **sans contour imbriqué ni séparateur**, nom/rôle du profil tronqués — branche `feat/headbar-evenements-assets` | 04/11/2026 |
| `DJ-DA-LANDING` | Module DJ/Quête : **DA landing** appliquée (tokens seuls, un accent d'état), croix du tiroir qui ne recouvre plus « Ouvert », transfert de lead en `Select` maison, actions uniformisées, `SupportOrb` **sous** les modales — branche `feat/dj-da-landing` | 04/11/2026 |
| `STATS-MORTE` | Page morte « Stats Guilde » supprimée (**15 fichiers**) ; **`getGuildStats`/`QuickStatsRow` conservés** (accueil) · **2a** : clé `stats` retirée du registre/RBAC · **2b** : colonne `GuildModules.stats` **supprimée** (migration `20270125000300`), `RETIRED_MODULE_KEYS`, libellé legacy et asset retirés — branches `chore/remove-stats-page` / `chore/stats-phase2b` | 04/11/2026 |
| `AVATARS-DISCORD` | Avatars : `avatar-sync` n'écrit plus `null` (avatar Discord **officiel** `embed/avatars/{n}.png`), URL d'embed du cycle de vie réparée (elle concaténait une URL comme un hash), règle pure `resolveDiscordAvatarUrl` + verrous — branche `fix/avatars-discord-default` | 04/11/2026 |
| `RUSH-NOTES` | Notes Rush : siphon Tougli (**73 notes · 74 quêtes contraintes**) + analyse Dofusyelle, règle `rush-notes` (rattachement par nom, **10 tests**), **22 conseils** écrits ; notes de donjon laissées au rapport (mesure négative « Ali 57 ») — branche `feat/rush-notes` | 03/11/2026 |
| `RUSH-TEXTES` | Conseils du guide : **37 séquences « &n » corrigées** (règle `resolveQuestRefs`, **74** champs dataset + base, garde d'écriture), **Dofusyelle siphonné** (pas d'API) et **5 conseils corrélés** ; **aucune migration** — branche `fix/rush-textes` | 03/11/2026 |
| `RUSH-L1` | Alignement : source **`camp`/`name`** (67 lignes relisibles), palier **calculé** (`alignmentCountForCamp`, hors Ordres), reset **par cité** (`alignmentResetSeeds`) — branche `feat/rush-alignment-l1` | 02/11/2026 |
| `RUSH-G0` | Outillage God de la route : route du bloc, classe en liste fermée (19 ids), aperçu `resolveRushRoute`, Branches à 3 étages — branche `feat/rush-route-tooling` | 02/11/2026 |
| `RUSH-S1-CONTENU` | Contenu S1 : import outillé (liens sûrs), **30 Ordres** (6 × 5/5), **19 classes** + filtre, cités **100/100 + 102 + 3 variantes**, étape à choix (`choice_group`) — PR #1139 | 27/10/2026 |
| `RUSH-S5-1` | `DofusProgressStrip` **supprimé** (0 import), `alignOrderReq` **ni lu ni écrit** (colonne conservée), un **rang ≠ une cité** (route fail-closed) — branche `fix/rush-code-mort-legacy` | 27/10/2026 |
| `RUSH-L3` | Modale d'accueil en **DA « Carnet »**, **3 étapes** (page « membres » retirée), **bloc « Métiers requis » supprimé**, classe manquante **dite et cliquable** (défaut 7), actions dans le contenu + fermeture (croix/Échap/fond) — PR #1228 / #1229 / #1230 | 02/11/2026 |
| `RUSH-L2` | Route **cité → Ordre → classe** (dashboard + overlay autonome), **chaîne des rangs** (`previousOrderRank`), **changement d'Ordre** (5 quêtes décochées, `resetRushOrderProgress`) — branche `feat/rush-route-l2` | 02/11/2026 |
| `RUSH-DA` | DA « Carnet de campagne » de l'overlay (matières, en-tête serif, chapitre, cartes, fiche, filtre Toutes/En cours/Verrouillées) + coches de ressources dans la fiche (valider coche tout, invalider décoche) — branche `feat/rush-da-carnet` | 02/11/2026 |
| `BOSS-BUTIN` | Fiches boss : butin le plus complet (`pickBestMonsterStatRow`), garde d'écriture, succès « Spécial » résolus, lot B (quêtes, Titan, raid, bloc de stats unique) — PR #1167/#1168 | 30/10/2026 |
| `RUSH-CONSTRUCTION` | Rush : drapeaux « En construction » **membres** vs **public** (`isPublicUnderConstruction`) + fondation du bloc B (`publicSlug`, `isPublished`) — PR #1152 | 29/10/2026 |
| `guildes-cycle-de-vie` | Suppression d'une guilde : bouton propriétaire, purge par cron, écran honnête, propriétaire resynchronisé ; **preuve de purge 90 j + activité réelle** le 02/11 ; décisions : `docs/plans/AMORCE-GUILDES-CYCLE-DE-VIE.md` | 02/11/2026 |
| `limite-guildes` (LG) | Plafond de **2 guildes par utilisateur** : règle pure, migration, gardes G1→G6, écran + bandeau du portail, tiroir « Mes guildes », annonce du bot ; ordre autorisation → plafond → whitelist | 06/11/2026 |
| `G-STAND`/`G-ORPH` | Stand-by des groupes **+ contenu fantôme** (fermeture auto, reprise de lead, anonymisation à la purge) | 30/10/2026 |
| `RUSH-S1` | Siphon Tougli + trame Rush (outil hors dépôt : 530 quêtes, 99 donjons, export God) | 26/10/2026 |
| `RUSH-UI/S4` | Modale par Dofus + déslop du bandeau, identité de quête assistée, import dry-run, contraste des 24 accents | 26/10/2026 |

| `A` | Siphons game-data (A1 → A5) | 28/09/2026 |
| `B` | Membres `/admin/members` (B-1 → B-3) | 14/10/2026 |
| `X-1` | Sondages programmés | 13/10/2026 |
| `Y` | Rôles automatiques par ancienneté (Y-1 → Y-5) | 14/10/2026 |
| `W-1/W-2` | Observabilité Sentry (traces + runtimes) | 11/10/2026 |
| `T-1/T-2/T-2b/T-3` | Rush Sylvestre — affichage, temps réel, prérequis, studio God | 08/10/2026 |
| `V-A/V-B` | Rush Sylvestre — agrégation unique + ids/icônes | 10/10/2026 |
| `R-1 → R-4` | Raccord DofusDB (résistances, tacle/fuite, critiques, icônes) | 15/10/2026 |
| `STATS-1` | Socle de lecture des stats + 4 bugs d'exploitation (montures 5401, panoplies 9 406 PV, placeholder vert, inventaire siphon, statut PARTIAL, sorts communs officiels) — `fix/socle-stats-siphons`, **0 migration** | 26/10/2026 |
| `STATS-2` | Encyclopédie + Marché branchés sur le socle (`nativeEffects` résolus transmis par `/api/dofusdb/search`, `% Do Sorts/Armes/Mêlée` avec asset, `isStatBearingNativeEffect` écarte les métadonnées à valeur) **+ carte de build : les codes Dofusbook non-stat (`at` = attitude, `sp`) sortent de la liste chiffrée** — **0 migration** | 26/10/2026 |
| `DOFUSBOOK-2` | Stats Dofusbook : initiative et socles secondaires (détail dans `journal-sessions-2026.md`) | 25/10/2026 |
| `CAL-1` | Calendrier : statut décidé à un seul endroit + messages Discord | 25/10/2026 |
| `SLASH-1` | Commandes slash alignées sur Discord (2 PR) | 24/10/2026 |
| `DEMO S-0/S-1` | Démo publique — mesure + route `/demo` | 02/10/2026 |
| `M-1 membres` | Deslop de l'annuaire (volet membres) | 05/10/2026 |
| `menage A/B-1` | 7 dépendances mortes + 24 fichiers morts | 19/10/2026 |
| `supply-chain` | Garde-fou des scripts d'installation npm | 19/10/2026 |
| `codeql` | XSS overlay + SSRF `redirect: error` | 19/10/2026 |
| `env-validation` (F8) | Validation d'environnement au démarrage (`instrumentation.ts`), fail-closed en prod, avertissement CSP | 19/10/2026 |
| `monitor-private` (F9) | Grafana retiré de l'exposition publique et du compose ; Prometheus interne épinglé v3.15.0 ; accès God — **déployé bêta `5b31ad0`** | 19/10/2026 |
| `node-runtime` | Runtime Node **épinglé** : `22.23.4` (correctif du 21/10) **puis `24.22.1` LTS active** le même jour — `.nvmrc` = source unique, `engines.node`, les 3 `FROM node:` des images, CI sur `.nvmrc`, verrou `node-runtime-pin`, procédure `docs/agents/node-runtime.md` + règle + skill · **CI verte sur Node 24** (suite + build) | 22/10/2026 |
| `god-system` | God → Système & Infra : CPU, RAM, disque, Redis, PostgreSQL, conteneurs, crons — **déployé bêta `5b31ad0`** | 19/10/2026 |
| `harnais H0-H7` | Roadmap unique, journal archivé, zone temp unique, 4 règles, 6 skills, 3 hooks, `.clineignore`, garde | 19/10/2026 |
| `seo-extraits-serp` | Extraits SERP bornés (`src/lib/seo.ts`, 60/155) : fiches boss, hub `/almanax`, 7 guides FR + garde `seo-serp-extraits` — **mesuré** : 6 156 impr. / 109 clics, guides = 44 % des clics | 20/10/2026 |
| `T-2c` · `V-G` · alignement (lots 1-5) | Rush — prérequis par id stable, liaison Metamob dans l'overlay, modale d'alignement (camps → Ordres → tranches), route `resolveRushRoute`, présence temps réel, jumelle de branche (God), **tranches supprimées (saisie + affichage)**, **reset des quêtes d'alignement au changement de cité (cascade comprise)**, **arbre cité → Ordre** (migration additive), **verrou de palier calculé** et **jumelle d'Ordre** | 20/10/2026 |
| `backup-fiabilite` | Sauvegarde R2 : preuve avant « réussi » (`pipefail`, marqueur `pg_dumpall`, `head-object`), rotation bornée (7 j + 3 mois + plafond 4 Go), restore honnête (`ON_ERROR_STOP`, `--from beta`) — branchée sur le plan **gratuit** | 29/10/2026 |


| `rush-consolidation` | Rush — siphon exhaustif des 2 sources (Tougli API + Dofusyelle) : séries **100 / 102** (Dofusyelle = préfixe exact de 99), 30 quêtes d'Ordre (palier dérivé par position), 19 classes, 1 085 contraintes inventoriées, **584** ressources (408 communes), 99 + 83 donjons (67 slugs), 62 succès ; **verrou de donjons** (requis/optionnel, multi-donjons) en règle pure + 12 tests | 21/10/2026 |
| `restore-db` (F7) | Restauration **prouvee** : banc d'essai jetable (compteurs source/copie), dumps portables `--if-exists`, GPG loopback, retention bornee -- 8 tables verifiees le 29/10 | 29/10/2026 |
| `ELEVAGE-ICONES` | Élevage — 228 icônes de montures **locales** (siphonnées) : plus de carré noir sur `/elevage` ; garde `elevage-mount-data` | 29/10/2026 |
| `DJ-CAP` | DJ/Quêtes — file d'attente sur groupe complet + décision **atomique** (sérialisable + rejeu, fin du 5/4) | 30/10/2026 |
| `DASH-IMG` | Présentation — images **contrôlées** : éditeur (URL/base64/collage) + règlement sans image côté serveur | 30/10/2026 |
| `rush-ressources` | Rush — ressources par quête : 81 séquences, 252 tags, 390 → 485 (`mergeItemTags`, script dry-run/`--sql`) | 04/11/2026 |
| `songes-cloture` | Songes — clôture : `abandonDreamRun` (garde d'état + purge du post Discord), calendrier J+7/15/20/21 réparé (activité réelle, `updatedAt` figé, `IN_PROGRESS` inclus), rattrapage des embeds orphelins, refus par cause + garde avant la modale | 05/11/2026 |
| `RUSH-MOVE` | Rush — déplacement de quête : action `moveRushSequence` (Zod borné 60/min, bloc cible relu dans le **même** guide, séparateur et bloc Conseil refusés, no-op si même bloc) qui n'écrit **que** `milestoneId` + `order` ; règle pure `nextSequenceOrder`, studio rebranché — verrou `rush-move-sequence` **10** | 05/11/2026 |
| `RUSH-NOTES-25` | Conseils — cibles calculées sur **deux jeux** (dataset + base, `NoteTarget.questIds`, `scripts/correlate-rush-notes.ts`) : **25 notes** écrites (19 Brâkmarien, 6 Bontarien), **2ᵉ passage = 0** ; reste **194** (98 Brâkmarien sans source) | 04/11/2026 |
| `BOSS-DOUBLE` | Succès — les doubles boss redeviennent cochables (`visibleDungeonAchievements`, rendu seulement s'il est le **seul** succès du donjon) + rattrapage idempotent `backfill-dungeon-completion` — verrous `dungeon-completion` **7** · `succes-ui-deslop` **4** | 25/10/2026 |
| `DOFUS-CAPS` | Builds — plafonds **12 PA / 6 PM / 6 PO / 6 invocations** (`src/lib/dofus-caps.ts`) appliqués à l'affichage, point excédentaire **dit** ; refus de variante motivé (`explainVariantRefusal`, 3 causes) — verrou `dofus-caps` **6** | 26/10/2026 |
| `DOFUSBOOK-FORCE` | Dofusbook — `force` de bout en bout (worker sans cache, TTL 60 s, `changed` renvoyé, stats `ii`/`ic` comptées) puis relais **redéployé** (`175b2e54`, en-tête `X-SigilOS-Cache`) — verrou `dofusbook-sync-force` **7** | 25-26/10/2026 |
| `DONJON-ETAT` | Rush — coche donjon de bout en bout : table `PlayerGuideDungeonState` (**une coche par quête × donjon**, migration `20270115000000`), refus à la validation (quête **et** bloc), décocher un donjon **dévalide** la quête | 21/10/2026 |
| `RUSH-OVERLAY-DONJON` | Overlay — verrou de donjons requis (`missingRequiredDungeons` + vignettes, clic ciblé), Toaster **dédié** dans le portail PiP, carte donjon refaite — verrou `rush-overlay-dungeon-gate` **12** | 22/10/2026 |
| `ROLES-ESSAI` | Cycle de vie — rôles Discord **optionnels** : `+ trialRoleId` au démarrage de l'essai (fiche membre **et** `/valider-recrue`, sans changer sa modale), `+ confirmedRoleId` `− trialRoleId` à la validation, `− trialRoleId` au départ ; réglage **Paramètres ▸ Fin d'essai** (2 sélecteurs Radix) ; règle pure `filterAssignableRoles` (ni `@everyone`, ni `managed`, rien au-dessus du bot ni du staff) — verrous `assignable-roles` **7** · `trial-roles` **5** | 09/11/2026 |

| `harnais-discord` | Harnais — règle scopée `.clinerules/06-discord.md`, skill `discord-api`, §0 de `docs/agents/discord-module.md` : « une donnée absente n'est pas une impossibilité » | 24/10/2026 |
| `PROD-MIGRATIONS` | Prod — ordre des migrations réparé (`add_component_stats` altérait une table créée un mois plus tard) : **32 migrations** appliquées, 6 conteneurs `Healthy` en Node 24.22.1, `api/health` 200 | 22/10/2026 |


## 6. Archives et mémoire froide

- `docs/agents/journal-sessions-2026.md` — **171 blocs de session** + ancien backlog, conservés pour la mémoire du projet ; **ne pas lire au démarrage**.
- `docs/agents/archive/FILE-EXECUTION-2026-10-15.md` — ancien ordre (étapes 1 → 64). **Les numéros d'étape sont historiques** : utiliser les IDs ci-dessus.
- `docs/agents/archive/BRIEF-REPRISE-2026-10-14.md` — fil des demandes et décisions du 14/10.
- `docs/agents/archive/session-amorce-2026-09.md` — remplacé par `AGENTS.md` + `docs/agents/harnais.md`.
- `src/temp/archive/` — corpus volatil (audits 20/09, maquettes, siphons) déplacé, **jamais versionné**.
- Volume Docker `grafana_data` conservé (non monté) — suppression seulement sur accord explicite.
- Règles d'alerte Grafana : aucune n'a été auditée ; elles ne tournent plus. Le volume les conserve peut-être.
- Prod **non déployée** : `main` = `07c0500e` (12/10), `dev` a **100+ commits d'avance** (dont les 4 lots du 25/10). Procédure de bascule et rattrapages : §0 « ⏳ En attente de prod ».
- `src/temp/archive/duplicates-2026-10-19/` — 3 doublons exacts (hash identique) : `ARCHITECTURE-…SYLVERSTRE` = `AMORCE-DEMO-PUBLIQUE.md`, `MODULE-…SYLVERSTRE` = `AMORCE-DEMO-PUBLIQUE.md`, `PLAN-REFONTE-…SYLVERSTRE` = `PLAN-DESLOP-ANNUAIRE.md`.

## 7. Tenue de cette feuille

1. Un chantier livré → sa ligne **sort** et rejoint le §5 (une ligne, sans récit).
2. Un nouveau chantier → une ligne au §1/§2/§3 + un plan durable dans `docs/plans/`.
3. Aucune session ne s'écrit ici : le récit va dans `activeContext.md` (6 blocs), l'historique dans le journal.
4. Garde automatique : `docs/ROADMAP.md` doit rester **< 60 Ko** (`tests/unit/harness-config.test.ts`).
5. **Les rangs sont stables** : un chantier livré laisse un trou dans la numérotation, il n'est pas réattribué (les décisions citent les rangs).
