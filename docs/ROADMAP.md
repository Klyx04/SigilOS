# 🗺️ ROADMAP — SigilOS (feuille de route unique)

> **Rôle unique.** Ce fichier porte le **backlog** ET **l'ordre**. Une ligne = un chantier.
> **Règle d'or.** 1 rang = 1 lot = 1 branche = 1 PR → `dev`. On merge avant d'ouvrir le suivant.
> **Mémoire.** 6 dernières sessions : `docs/agents/activeContext.md`.
> Historique complet (171 blocs) : `docs/agents/journal-sessions-2026.md` — **à la demande**, jamais au démarrage.
> **Tenue.** Un chantier livré quitte le tableau et rejoint le §5. Aucun récit de session ici.
> **Plus aucun fichier d'amorce** (15/11/2026) : l'ordre et l'état vivent ici ; `docs/plans/` ne porte que les références de module (décisions, mesures).
> **Dernière MàJ** : 16/11/2026 · SHA courant injecté par le hook `TaskStart`.

## 0. Reprise immédiate

- 📌 **Prod** : release du 13/11/2026 dans `main` (`c190f2c7`, PR #1366) ; déploiement humain → `./scripts/deploy-cd.sh prod`.
  **Ops de base, bêta puis prod** : `20261112170000` (variantes de route) · `20270130000000` (conditions) · `20270201000000` → script → `20270201500000` → `20270202000000` → `20270203000000` → `20270204000000` (tickets God) · `20270205000000` (changelog) · `20270206000000` (opt-out) · `20270112000000` + `20270113000000` (portées par `deploy-cd.sh`).
  **Opérations de déploiement** : rebuild `ws-beta`/`ws-prod` · redéployer le bot · couper l'intent `MessageContent` (portail Discord) · retirer cAdvisor · 4 crontabs · redéploiement bêta (Node `24.22.1`).
  **Réglages** : `PUBLIC_VISITOR_ENTRY=1` ✅ **posé le 16/11/2026** · **stuff lot D** : `siphon-item-sets?apply=1` → `siphon-item-conditions?apply=1` → `data-watch` → crontab conditions · **succès spéciaux** : `succes-speciaux siphon` puis `retirer-donjon-valide` (dry-run → `--apply`).

- **Mesuré 16/11/2026 — rétention** : `TelemetryEvent` et `ServiceActivityLog` **n'ont aucune purge** (croissance illimitée ; `TelemetryEvent` porte `userName` + UA/OS). Le reste est borné (audit 30/90 j, God 90 j, notifications 30/90 j, tickets par limites plateforme, comptes 365 j, `DiscordMemberActivity` 365 j, Docker 10 Mo×3, logs app > 10 Mo, journalctl 7 j, Redis 512 Mo). **Cadré le 16/11/2026** : 90 j pour `TelemetryEvent`, 365 j pour `ServiceActivityLog`, compteurs Stockage, branchement `cleanup-logs` + janitor — `docs/plans/PLAN-RETENTION-TELEMETRIE-JOURNAUX.md`. **Go-ahead explicite attendu** (suppression de données), lot A du §2 bis.
- **Décisions bloquantes** : `D-R1` (moteur de rôles), `D1`/`D2` (RAID), `D8` (Cloudflare).
  **`D7` tranché le 16/11/2026** : à l'ouverture, `sigilos.fr` servira **la même landing React que la bêta**
  (retrait du rewrite `maintenance.html`) ; une **nouvelle refonte de la landing** est prévue « un de ces
  quatre », **sans cadrage pour l'instant** (décision user, aucun détail).
- **Ops à confirmer** : `live-watch` · 4 crontabs (sondages/ancienneté/rappels **déjà posés** le 02/11) · redéploiement bêta (Node `24.22.1`, `docs/agents/node-runtime.md`) — détail : `docs/MAINTENANCE.md` § Tâches planifiées.
- 🗓️ **Sprint S1 — semaine du 09/11/2026** *(ordre de passage ; cocher au fur et à mesure ; bloc retiré le 16/11)*
  - [ ] **lun** — F17b ✅ 10/11 · V-H ✅ 10/11 · finitions anonymes F1→F7 ✅ 11/11 · dettes visiteur · `PUBLIC_VISITOR_ENTRY=1` ✅ 16/11
  - [ ] **mar** — F1 · F2 · F5+F6
  - [ ] **mer** — F16 hub + succès en commun ✅ 11/11 · V2a-4 reste (tour spotlight) ✅ 16/11
  - [ ] **jeu** — T-4 (O14 · O15 · G7/G8/G9) · transverses + 4 `prompt()` · V-C · V-D2 · drop `alignOrderReq`
  - [ ] **ven** — studio E2 (inspecteur quête) · V2c (Rush Live visiteurs) ✅ 11/11
  - [ ] **sam** — V2d (ladder serveur) · E3 (bloc/masse/problèmes) · V3 (God visiteurs)
  - [ ] **S2** — T-5 · T-6 · bloc B · E4/E5 studio · lot D · E4 DA Wakfu · colonne `resources` · `questDbIds`
  **Dépend de toi** : captures G7/G8/G9/O15 · nom de `33380` · 98 textes Brâkmarien · 2×100 + 30 quêtes.

## 1. P0 — Bloquants prod / ops / sécurité (ordre strict)

| Rang | ID | Chantier | État mesuré | Prochain lot | Plan | Bloqué par |
|---|---|---|---|---|---|---|
| 3 | `ouverture-prod` (#57) | **D7 tranché (16/11)** : la prod servira la landing React. **Mesuré le 16/11** : `robots.txt` (statique) et `sitemap.xml` (404 franc) sont déjà gérés par Caddy ; restent `/llms.txt` (avalé par le rewrite), le `noindex` (Caddy + `maintenance.html`), et surtout **le bloc Caddy `sigilos.fr` ne sait pas proxifier l'app** (ni `/game-data/*` worldmap, ni `/socket.io/*`) | réécrire le bloc `sigilos.fr` à partir du bloc bêta + checklist Jour J | `docs/ops/GUIDE-DEPLOIEMENT-PROD-JOUR-J.md` · `docs/plans/SEO_REPRISE.md` | — (D7 levé) |
| 4 | `actions-god-auth` (audit 13/11) | Actions God sans garde, `/api/storage` inter-guildes | ✅ **livré 13/11** — PR **#1361** (AUD-01/02/03) | — (rien) | `docs/SECURITY.md` | — |
| 4b | `durcissements-audit` (audit 13/11) | AUD-04/05/07/09/10/11 + SEC-02/03 : jeton legacy, SVG, `execFile`, limiteur, endpoint maintenance, clé stricte, kill-switch WS | ✅ **livré 13/11** — PR **#1362** | — (rien) | `docs/SECURITY.md` | — |
| 4c | `ladder-messages` (RGPD) | Métrique « caractères » → messages ; intent `MessageContent` retiré | ✅ **livré 13/11** — PR **#1363** | **ops** : couper l'intent dans le portail Discord | `docs/MAINTENANCE.md` | — |
| 4d | `monitoring-sans-cadvisor` (SEC-04) | cAdvisor montait le socket Docker ; carte God « Conteneurs » vide | ✅ **livré 13/11** — PR **#1364** | **ops** : retirer le conteneur au déploiement | `docs/MAINTENANCE.md` | — |
| 4e | `audit-passe2` (audit 13/11) | `/api/uploads`, DoS `/api/og/build`, IPv6 SSRF, chemin machine `cron-status`, rate-limit god-images | ✅ **livré 13/11** — inclus dans **#1362** | — (rien) | — | — |
| 4f | `ws-revocation-membres` (audit 13/11) | Un membre exclu/banni gardait son WebSocket de guilde | ✅ **livré 13/11** — PR **#1367** | **ops** : rebuild `ws-beta`/`ws-prod` | — | — |
| 4g | `bot-prisma-chiffrement` (audit 13/11) | Le bot utilise un `PrismaClient` brut | ✅ verrouillé 13/11 (`bot-prisma-safety`, 3 cas) | partager l'extension si le bot écrit Account/API keys | — | — |
| 5 | `migrations-ops` | 2 migrations additives + bot + crontabs non déployés | `20270112000000` (GodNotification.details), `20270113000000` (DiscordMemberActivity) | jouer bêta puis prod ; redéployer le bot ; poser les 4 crontabs | `docs/MAINTENANCE.md` | — |
| 6 | `caddy-post-503` | Pendant une maintenance, un POST reçoit du HTML au lieu d'un `503 text/plain` | cause racine du 16/10 | durcir le `Caddyfile` (POST → 503) | `docs/MAINTENANCE.md` | — |
| 7 | `csp-enforce` (F10) | CSP en Report-Only : la protection XSS ne bloque rien | `CSP_ENFORCE` présent dans `src/proxy.ts` | poser `CSP_ENFORCE=true` après 48 h de rapports | `docs/SECURITY.md` | — |
| 8 | `presentation-access` | `presentation:view` existe mais n'est pas ouverte au rôle Membre ; l'ancienne page `/presentation` rend encore le règlement | 1 occurrence dans `src/` | ouvrir la permission + trancher la page | — | **D-P1** |
### 1bis. Reste de l'audit sécurité (13/11/2026)

Reste **réel** : **TOCTOU DNS** et **Caddy POST** → corrigés localement (commits `6bbb1c1f`, `5db4598b` ; branche + PR à ouvrir) · **next-auth stable** (indisponible : `5.0.0-beta.32`) · **AUD-12** (amont) · **AUD-06/AUD-08** non décrits dans la doc (à clarifier) · ops **prod** (sauvegardes, branches, CF, token). **Soldé et vérifié le 15/11/2026** : CSP actif en bêta (`CSP_ENFORCE=true`), jeton legacy coupé au **13/12/2026** (bêta + prod), intent `MessageContent` **OFF** (bêta + prod), cAdvisor absent en bêta, migrations notifications appliquées le 15/11 à 22:20. **Suite datée** : **après le 13/12/2026**, supprimer la branche « legacy » de `src/lib/storage-utils.ts` (HMAC nu + `getLegacySecret` + `legacyTokenWarned`), la variable `STORAGE_LEGACY_TOKENS_UNTIL` (`.env.example` + bêta/prod) et réécrire `tests/unit/storage-token-legacy.test.ts` en « ancien format refusé » — le retrait avant cette date casserait les vieux liens Discord que la date protège.
## 2. P1 — Chantiers produit (ordre proposé)

| Rang | ID | Chantier | État mesuré | Prochain lot | Plan | Bloqué par |
|---|---|---|---|---|---|---|
| 9 | `rush-refonte` (T) | Rush Sylvestre : ergonomie, temps réel, éditeur God, habillage Dofus, perf | **T-1 → T-4 livrés** (T-4a le 12/11 : G8, O15, G9 tokenisée) | **G7 (hero) + composition G9** (captures) → **T-5** (O9/O10/O11/O12/O13) → **T-6** (G6, `useOptimistic`) | `docs/plans/PLAN-REFONTE-RUSH-SYLVESTRE.md` · `MODULE-RUSH-SYLVESTRE.md` | — |
| 10 | `rush-donnees` (V) | Rush Sylvestre : ressources, ids/icônes, alignement, ocre, Metamob | **V-A, V-B, V-G, V-F partiel, V-H livrés** · bloc B (route publique) 12/11 · route à 3 étages corrigée 12/11 · **25 conseils** (194 restants) | **V-C** (purge WebP, ops VPS) · **V-D2** (Tougli/Dofusyelle, ou acter 517) | `docs/plans/RUSH-DEVELOPPEMENT-SUITE.md` · `MAPPING-RUSH-SYLVESTRE.md` | — |
| 11 | `tickets-v2` (C) | Module Tickets : finir la v2 (SLA, auto-fermeture, i18n, doublons) | 5 chantiers UX livrés le 20/10 ; **commandes slash personnalisées livrées le 21/10** ; **perfectionnements UX embed, custom CSAT, variables {staff}/{moderateur} et RBAC staff commandes le 22/10** · **renommage Discord suivi par le salon (cron `sync-members`) le 25/10** · **renommage temps réel par le bot (surnom ou nom d'utilisateur) le 25/10** | C-1 → C-4 | `docs/plans/PLAN-REFONTE-TICKETS-V2.md` | — |
| 12 | `roles-multi` (Y+) | Moteur unique de rôles : ancienneté (projection) + vocal + contribution | cadré le 18/10, **aucun code** | R-1 (évaluateur + stockage) → R-2 (cron + annonces) → R-3 (onglet) | `docs/plans/PLAN-MOTEUR-ROLES-MULTI-SOURCES.md` | **D-R1** |
| 13 | `commandes-slash` (Z) | Commandes slash personnalisées (catalogue ∪ guilde, payloads dérivés) | **Z-1/Z-2 livrés le 24/10** (sync réelle rôles + salons, payloads dérivés du catalogue, scope God par guilde) · **25/10 : `/valider-recrue` fix pérenne anti-timeout** (résolution 0 ms à l'ouverture, deferred reply type 5 à la soumission) ; reste Z-3/Z-4 | Z-3 → Z-4 | `docs/plans/PLAN-COMMANDES-SLASH.md` | — |
| 14 | `roles-succes` (S) | Rôles par points de succès ladder (même moteur que Y) | migrations **accordées** le 15/10 | S-1 → S-3 | `docs/plans/PLAN-ROLES-SUCCES.md` | — |
| 15 | `activite-guilde` (N) | Activité de guilde enrichie + notifications | N-1 et N-4 livrés pour les paliers ; **4 sources restantes** (Dofus, succès, donjons/DJ, songes) | N-2 (4 sources) → N-3 → N-4 | `docs/plans/PLAN-ACTIVITE-GUILDE.md` | — |
| 16 | `raid` (G) | RAID : calendrier, clôture/no-show, strat, overlay, données | §1/§3/§24/§25 livrés ; **R1-P0 livré** (PR #1170) ; **R1 (no-show) ouvert** | R1 → R2 → … → R10 | `docs/plans/PLAN-RAID.md` | **D1 + D2** |
| 17 | `orphelins` (F) | Reprise de relai quand le créateur d'un raid/DJ/quête a disparu | né le 01/10 | F-A → F-B → F-C | — (à créer) | **D3** |
| 18 | `marche` (I) | Marché : images d'embeds, validation FR, lot multiple (5 objets), multi-embed | S7 livré ; reste le lot multiple et l'étape « Publication » | I-1 + lot multiple | — (à créer) | **D-M1** |
| 19 | `services` (J) | Services : clôture, inactivité, feedback, images, forum ; `valider-recrue` en ticket | ouvert · **25/10 — un salon par flux** (PR #1113 + branche empilée) : annonces en **forum obligatoire** (tags par catégorie), demandes en forum **ou** texte ; **anti-doublon** (édition = PATCH, jamais un 2ᵉ sujet) ; statut de publication remonté à l'écran (badge + bouton Publier) · **bouton Documentation `services` ajouté** (contenu écrit en local, à uploader) | J-1 → J-2 | — (à créer) | — |
| 20 | `succes` (K) | Succès & encyclopédie : onglet Monstres, succès imbriqués | ouvert | K-1 → K-2 | — (à créer) | — |
| 21 | `mini-jeux` (H) | Mini-jeux & salons temps réel : solidité Redis, solo, Panthéon, HUD/UX | ouvert | H-1 → H-2 | — (à créer) | — |
| 22 | `deslop` (L) | Déslop global : dashboard, admin, landing, modales, ressources, missions, ladder, worldmap | ouvert · demande du 20/10 : **aligner toutes les nouveautés** (landing incluse). **Landing (mesuré 16/11)** : 3 résidus hors maquettes — `hero.tsx:84` (`text-zinc-400`), `workflow.tsx:62` (`text-emerald-400`), `workflow.tsx:69` (`rounded-2xl` + `bg-[#0e1017]`) | L-1 → L-4 | — (à créer) | — |
| 23 | `guildes-admin` (M) | Guildes & admin : calendrier, profil, stuff, édition staff, logs | volet `membres` livré (05/10) · **inventaire des mules** et **pseudo vérifié au ladder + embed « fin d'essai »** livrés le 25/10 | M-1 reste (calendrier/profil/stuff) → M-2 → M-3 | `docs/plans/PLAN-DESLOP-ANNUAIRE.md` | — |
| 24 | `god-refonte` (O) | Refonte God « Guildes & Users » ; tickets d'exploitation : signalements fusionnés le 14/11, **G4 livré le 15/11** (panneau dédié, catégories libres, runtime, CSAT) | plan vivant ; **tickets clos** | G1 → G12 | `docs/plans/PLAN-REFONTE-GOD-GUILDES.md` · `docs/plans/PLAN-TICKETS-GOD.md` | — |
| 25 | `acquisition` (E) | SEO / contenu : autorité avant volume — **les outils publics sont déjà en ligne** (landing « Outils ouverts » : Rush Sylvestre, Encyclopédie Boss, Almanax, Carte du Monde HD) | dossier mesuré le 30/09 | E-1 → E-2 → E-3 ; **prérequis** backfill `MonsterStat` (~5 135 fiches) | `docs/plans/SEO_REPRISE.md` | **D6** |
| 26 | `demo-publique` (S) | Démo publique en lecture seule, essayable sans compte | **S-0/S-1 livrés (02/10) — chantier loin d'être fini** (16/11) | S-2a → S-2b → S-3 → S-4 → S-5 | `docs/plans/PLAN-DEMO-PUBLIQUE.md` | — |
| 27 | `salons-vocaux` (Q) | Module « salons vocaux temporaires » (cahier V2.1) | idée neuve, **à cadrer** | cadrage → lots | `docs/plans/PLAN-SALONS-VOCAUX.md` | **D4** |
| 28 | `onboarding` (ONB) | Onboarding & acquisition (prospect → guilde) | proposition du 06/09 | valider la proposition + migration | `docs/plans/PLAN-REFONTE-ONBOARDING.md` | **D5** |
| 29 | `reseau` (NET) | Durcissement réseau : Cloudflare/WAF devant `sigilos.fr` ? | à décider | décision + DPA + pages RGPD | — | **D8** |
| 30 | `observabilite` (W) | Sentry : couverture bot/workers, 25 crons, alertes | W-1/W-2 livrés le 11/10 | W-3 → W-6 | `docs/agents/journal-sessions-2026.md` (bloc 11/10) | — |
| 31 | `dofusdb-zero` (U) | Zéro dépendance DofusDB à l'exécution (5 points de contact mesurés) | cadré le 08/10 | U-1 → U-5 | `docs/agents/archive/FILE-EXECUTION-2026-10-15.md` (cadrage § U) | — |
| 32 | `solveurs` | Solveurs tactiques (Kalisthe, Minogolem, Harebourg) : données de combat, pas de décompilation | prototypes dans `src/temp/` | cadrer → POC | `docs/plans/PLAN-SOLVEURS-TACTIQUES.md` | — |
| 57 | `espace-visiteur` (PV) | Compte Discord **sans guilde** : espace perso (8 segments), progression en base, communauté par serveur, annuaire privé, God | V1a→V1i, V2a-1/2/3/5/6, V2e, V2c, V2f F8→F17b + F1→F7, hub Communauté, échanges Metamob, Ocre ISO, Oméga, deslop, **tour guidé public (profil + guide Rush, 16/11)**, **entrée guidée (attente neutre, fail-closed 5xx, cache 60 s, accueil + visite de création, onglets progressifs, 16/11)**, **accueil Rush adapté au compte (profil jamais redemandé, 16/11)**, **V3-a/V3-b/V3-c God visiteurs (liste + reset + suppression, 16/11)** — **livrés** | — (détail et suppression livrés) · **V2d abandonné** · affinage fiche soldé | `docs/plans/PLAN-ESPACE-VISITEUR.md` | — |
| 62 | `da-wakfu` | DA « Gouache Wakfu » : habillage du Rush, puis passation dashboard | **E0→E3e livrés** 05/11 : overlay · guides · 12 modales · bandeau+panneau unifiés ; panneau public aligné 07/11 · **hero plafonné** en fenêtre courte 09/11 | **E4 reporté** (chantier dédié) | skill | — |
| 63 | `profil-refonte` | Profil dashboard : déslop, un accent, 8 onglets | **P1→P4 + P3-bis livrés** 08/11 | P2-ter : 5 fichiers (palette 30, slop 65) | `docs/plans/PLAN-REFONTE-PROFIL-DASHBOARD.md` | — |
| 64 | `rush-contraintes` | Conditions de quête en **infos** (jamais blocage) : joueurs, métier, horaire, sort, note, combat, donjon au choix, monstres | **V3 livrée 12/11** — colonne `constraints` (migration `20270130000000`), Zod borné, éditeur + 3 surfaces | **backfill Tougli** (1 085 contraintes, dry-run/apply) + données éditoriales (4 donjons de Maïmane) | `docs/plans/RUSH-DEVELOPPEMENT-SUITE.md` §4 | — |
| 65 | `notifications` | Centre de notifications du compte (visiteur connecté) : réponses aux signalements, changelog, news | **N1→N4 + N2-bis livrés 15/11** (page compte, hub signalements, changelog, opt-out) | Rush v2 reporté (toasts live) | — | — |

| 61 | `souverainete-images` (SO) | Souveraineté **100 %** des visuels : aucun appel réseau pour servir une image | **S1 + S1b + S2 livrés** · 2 294 apparences (`remaining: 0`) · hybride `ASSETS_REMOTE_FETCH` (défaut `false`) | **S3** (couverture) → **S4** (cron + alerte) | `docs/plans/PLAN-SOUVERAINETE-IMAGES.md` | — |


## 2 bis. God — rétention, télémétrie, vue d'ensemble (cadré le 16/11/2026 — lots A, B et C livrés)

| Rang | ID | Chantier | État mesuré | Prochain lot | Plan |
|---|---|---|---|---|---|
| A | `retention-logs` | Purge `TelemetryEvent` **90 j** + `ServiceActivityLog` **365 j**, branchée sur `cleanup-logs` **et** le janitor ; compteurs dans God « Stockage » | **livré le 16/11/2026** : policy + core, wiring `cleanup-logs`/janitor, compteurs God « Stockage » (35 tests ciblés) | — (mesure des compteurs avant/après la 1ʳᵉ passe) | `docs/plans/PLAN-RETENTION-TELEMETRIE-JOURNAUX.md` |
| B | `god-telemetrie` | `?tab=telemetry` : filtre guilde (CUID vs snowflake), chemins complets, détails admin, filtres serveur, pagination, déslop | **livré le 16/11/2026** : portée CUID/snowflake résolue côté serveur, flux serveur filtré + paginé, chemin complet copiable, langue, **0 motif** de slop (46 mesurés) | — | `docs/plans/PLAN-GOD-TELEMETRIE-OVERVIEW.md` |
| C | `god-overview` | `?tab=overview` : retirer « Indicateurs plateforme » + « Activité de la plateforme », refonte bandeau / Worker / Broadcast / santé | **livré le 16/11/2026** : sections KPI/activité retirées, SSE supprimé, bandeau compact, cartes tokenisées, santé sans polling caché (−1 161 lignes) | — | `docs/plans/PLAN-GOD-TELEMETRIE-OVERVIEW.md` |

## 2 ter. God — guildes, annuaire visiteurs et reprise (cadré le 16/11/2026)

| Rang | ID | Chantier | État mesuré | Prochain lot | Plan |
|---|---|---|---|---|---|
| D1 | `discord-stellium` | Bouton « Discord SigilOS » en interne guilde (sidebar + page Tickets) | aucun point d'entrée ; `NEXT_PUBLIC_DISCORD_INVITE_URL` et `/discord` existent | 2 liens + test de source | amorce locale `src/temp/amorce-reprise-2026-11-16-god-chantiers.md` (non versionnée) |
| D2 | `ladder-libelles` | `#364` / `#13` : rangs explicites | `#364` = rang **Ankama** (worker) ; `#13` = rang **interne SigilOS** (`getLadderPreview`) ; libellés « Monde »/« Guilde » trompeurs | « Rang succès » / « Rang interne » | idem |
| D3 | `visiteurs-filtre-serveur` | `/visiteurs` : serveur du lecteur par défaut + dropdown pour explorer (option 2) ; consentement global | annuaire **mono-serveur** par conception (`public-directory.ts:16`) ; pas de filtre serveur | `serverId` + dropdown + colonne Serveur + doc + tests | idem |
| D4 | `god-lot4` | Lot 4 « Le God voit tout » (G7/A4/A5) | plan God vivant ; G4 livré, fiche guilde refondue | lot 4 | `docs/plans/PLAN-REFONTE-GOD-GUILDES.md` |
| D5 | `god-lot5` | Lot 5 : langage, tour de contrôle, roster, RBAC, users (G1/G2/G3/G5/G9) | roster/RBAC faits dans la fiche ; reste `/god` et `/god/users` | lot 5 | idem |
| D6 | `god-lot6` | Lot 6 : déslop God, tokens, plafond `god-deslop.test.ts` | plafond **79** (81 → 79 au lot C) ; écrans restants | lot 6 | idem |
| D7 | `owner-id-uuid` | Normaliser `GuildConfig.ownerId` en UUID interne | lecture gère snowflake **ou** UUID (`god-guild-owner.ts`) ; donnée mixte | mesure + backfill + écriture unique | amorce locale (non versionnée) |
| D8 | `ops-retention` | Première passe de rétention (lot A) | code livré (#1401), aucune passe réelle | dry-run janitor → `cleanup-logs` → compteurs | `docs/plans/PLAN-RETENTION-TELEMETRIE-JOURNAUX.md` |
| D9 | `ops-visuel` | Contrôle visuel 390/768/1024/1440 de `?tab=telemetry` et `?tab=overview` | non fait (humain) | captures + validation | `docs/ROADMAP.md` §2 bis |

**Ordre** : D1 → D2 → D3 → D4 → D5 → D6 → D7. **D8/D9** sont des vérifications humaines, à faire dès que possible.

## 3. P2 — Dette, hygiène, documentation (ordre souple)

| Rang | ID | Chantier | État mesuré | Prochain lot | Plan |
|---|---|---|---|---|---|
| 34 | `menage` (B-2/B-3 → F) | 74 fichiers morts, 16 scripts, doublons, `seed.ts` IDs réels, `refs/cline` 307 + 2 stashes | lot A (7 deps) et B-1 (24 fichiers) livrés le 19/10 | B-2/B-3 → C → D → E → F | — |
| 35 | `hygiene-logs` (F5/F6) | **155** `console.*` hors tests ; masquage des logs à vérifier | mesuré le 19/10 | remplacer par `logger`, masquer snowflakes/e-mails | `docs/RULES.md` |
| 36 | `docs-arbo` | `AUDIT-ARBO-2026-09.md` + `ARCHIVES-TEMP-2026-09.md` : historique pur | 30 Ko | conserver ou supprimer après extraction | `docs/arbo/` |
| 37 | `references` | 3 références possiblement orphelines : `FACTS_GUILDE_2026.md`, `OCR_STRATEGY_2026.md`, `REDIS-OCR-SETUP.md` | 1 à 2 citations chacune | vérifier puis fusionner/supprimer | `docs/reference/` |
| 38 | ~~`service-activity-log`~~ | **Résolu le 16/11/2026 par le lot A** (`retention-logs`) : purge à **365 j**, par guilde, branchée sur `cleanup-logs` et le janitor | ≈ 232 ko, hors top 30 | — | `docs/MAINTENANCE.md` |
| 39 | `harebourg-solver` | `harebourg-solver.ts` : brancher ou retirer ? | 1 occurrence | trancher | — |
| 40 | `admin-members-doc` | Doc vivante `admin-members` à mettre à jour | `docs-catalog.ts` figé | éditer dans `/god/docs` | — |
| 41 | `captures-a3` | 3 captures 1440 / 1024 / 390 manquantes | session navigateur connectée | les prendre | — |
| 42 | `active-context-rotation` | Purge effective des blocs ou abandon de la règle des 6 ? | 6 blocs | trancher | `docs/agents/activeContext.md` |
| 43 | `harness-maintenance` | Harnais H0-H7 livré : re-mesurer après stabilisation | cette PR | re-mesure + ajustements | `docs/agents/harnais.md` |
| 44 | ~~`god-system-polish`~~ | **Résolu le 13/11/2026** : cAdvisor supprimé (SEC-04), carte « Conteneurs » retirée ; les autres métriques God restent | — | — | — | — |
| 45 | `grafana-alerts-audit` | Règles d'alerte Grafana éventuelles dans `grafana_data` : plus exécutées | volume conservé, non audité | lister et recréer dans Sentry/webhook si nécessaire | `docs/MAINTENANCE.md` |
| 46 | `deploy-sha-normalize` | `deploy-cd.sh` refuse un SHA 8/40 alors que la CI publie 7 caractères | `5b31ad0f` refusé, `5b31ad0` accepté | normaliser le SHA à 7 dans `deploy-cd.sh` et `rollback.sh` | `docs/agents/deploy-vps.md` |
| 47 | ~~`telemetrie-retention`~~ | **Résolu le 16/11/2026 par le lot A** (`retention-logs`) : purge à **90 j**, par lot, branchée sur `cleanup-logs` et le janitor | mesuré sur le VPS le 20/10/2026 : **24 Mo**, 2ᵉ plus grosse table applicative | — | `docs/plans/PLAN-RETENTION-TELEMETRIE-JOURNAUX.md` |
| 48 | `crits-incoherents` | Effets **critiques inférieurs** aux dégâts de base publiés sur les fiches boss (ex. Phossile : base 426-480, crit 71-80) | mesuré le 20/10/2026 sur **Comte Harebourg** : base 639-810, crit **71-90** (même symptôme) ; `isCoherentCritJet` existe (lot R-4) mais le chemin Dofensive formate les crits en **chaînes** (`criticalEffects?: string[]`) **avant** le contrôle → la règle ne s'applique pas | garder `{min,max}` jusqu'après le contrôle, puis formater ; test de non-régression sur un sort réel | — (à créer) |
| 49 | `donjons-sans-donnees` | **25** donjons de la base sans entrée au catalogue local ⇒ fiche « partielle » (ni résistances, ni butin) | mesuré le 20/10/2026 : **34/151** bandeaux, **9 corrigés par alias** (#1051) ; fichier déployé **identique au dépôt** (187 entrées) ⇒ pas un fichier périmé | vérifier la couverture de `siphon-dungeon-monsters.mjs`, relancer le siphon, puis `sync-assets.sh` (bind mount) | — (à créer) |
| 50 | `simulation-refonte` | Simulation tactique (fiche boss + overlay) : doc développeur, état dans l'URL, page outil | S-1 mesuré | S-2 (doc repliable) → S-3 (`/simulateur`), après **D-SIM1** | — | — |
| 51 | `boss-fiche-locale` | Les commandes Discord `/boss` et `/monstre` interrogent encore **DofusDB de façon synchrone** alors que `getLocalMonsterFiche` existe (siphon + bestiaire local, zéro réseau) | mesuré le 20/10/2026 : la route contient encore `getMonsterStats` (×2) et `mob.grades?.[mob.grades.length - 1]` ; le test « réponse < 3 s » (écrit le 16/10, conservé hors dépôt puis consigné ici) **échouerait** tant que la bascule n'est pas faite | basculer les 2 commandes sur `getLocalMonsterFiche`, garder un repli explicite (« fiche indisponible »), activer le test | — (à créer) |
| 52 | `galerie-variantes` | **Galerie Stuff** : variantes proposées par le joueur, sans toucher au stuff Dofusbook | **livré le 26/10/2026** (`resolveVariantPreview`, tag VARIANTE) | — (rien) | — | — |
| 53 | `passifs-objets` | **Effets passifs officiels** des objets (Dofus, légendaires, bénédictions, Prysmaradites) | **livré** le 23/10/2026 : ligne native **`effectId 1175`** → `diceNum` = sort passif → `GET /spells/{id}` ; **117 sorts** dans `src/data/item-passives.json` (`scripts/siphon-item-passives.mjs`), repli inventé **supprimé**, description officielle des Prysmaradites dans la bibliothèque (12 verrous) | 38 sorts DofusDB sans description (percepteurs, 2 Dofus) : rien d'inventé, à rejouer via le siphon | — (à créer) |
| 54 | `supply-chain` | **Débloquer la porte de sécurité** : `zod` 3.25.76 → **4.6.7** (HIGH `GHSA-mrhx-c7xc-m3w5`) et `undici` 7.0.0 → **7.30.1** (HIGH `GHSA-4qv8-2p9j-2685`) | **livré** le 23/10/2026 (PR #1101) : override `undici` bumpé (transitif : discord.js, cheerio, jsdom), migration zod 3 → 4 sur **26 fichiers** (`errors` → `issues`, `required_error` → `message`, `z.record(clé, v)`, codes v4 dans `market/listing-schemas`, chemins `PropertyKey[]`, resolver du calendrier) — `security:audit` **franchie**, **5 099 ✓**, `tsc` 0, ESLint 0 | — (rien) | — | — |
| 55 | `rush-restes` | Restes du 26/10 : **T-4** G7/G8/G9/O15 (composition visuelle, à juger à l'écran) et sort de `questDbIds` (écrit, seule la puce du studio God l'affiche) | mesuré le 26/10 | juger à l'écran puis trancher | — |
| 56 | `live-discord` | Annonces de créateurs : live Twitch + nouvelle vidéo YouTube, **deux salons distincts** (Twitch / YouTube) + **deux interrupteurs** + ping par guilde, une annonce par session/vidéo (cron 5 min) | **livré** le 02/11/2026 · **scindé** le 04/11/2026 (salons et interrupteurs distincts, migration additive avec reprise du salon existant) | — (rien) | `docs/MAINTENANCE.md` | — |
| 58 | `ui-dj` | DJ/Quête : DA landing sur `DjPostCreateModal`, `DjEditModal`, `DjFiltersBar`, `DungeonFinderClient` | ~90 occurrences | même passe que #1252 + `ui-tokens-dj` | `docs/RULES.md` § UI |
| 59 | `god-rush-ux` | **Éditeur God Rush** : studio 3 panneaux (arbre / liste / inspecteur), Ctrl+K, filtres, actions de masse, DA God | **E1, E2b, E2c, E2d, E3c, E4 livrés** · coque élargie 10/11 · blocs Combat + liens + markdown 13/11 · dette DA 577 → **0** | **E5** finitions (raccourcis, virtualisation, états) | `docs/plans/REFONTE-EDITEUR-RUSH.md` | — |
| 60 | `standby-etendu` | Marché (`market-expire`), demandes de service (`cleanup-inactive-service-requests`) et sondages (`close-old-polls`) : **aucune pause** — ni bouton, ni colonne, l'expiration est subie | mesuré le 05/11/2026 (3 modèles avec `standBy` : `DjSearchPost`, `DreamRun`, `GuildEvent` ; les 3 autres n'en ont pas) | si demandé : colonne `standBy` sur 3 modèles (**migration**) + bouton + gardes de cron | `docs/MAINTENANCE.md` § Stand-by | — |
## 3 bis. File d'exécution — Rush Sylvestre + espace visiteur

> **Seul ordre pour ces deux périmètres.** Les rangs 9, 10, 55, 57 et 59 portent le **détail**
> de chaque sujet ; ils ne portent pas d'ordre. Une amorce de session ne recrée pas de file.
> **Les lignes 1-2 sont livrées** ; la file vivante commence à la ligne 3.

| # | Chantier | Rang | Taille |
|---|---|---|---|
| 1 | ~~Test flaky `lot4-slash-commands-api-keys` (timeout 5 s)~~ ✅ **livré le 12/11** | — | S |
| 2 | ~~Brouillon local du formulaire de quête (E2b-suite 2/2)~~ ✅ **livré le 12/11** | 59 | M |
| 3 | ~~Fiche visiteur — affinage (assets, hiérarchie)~~ ✅ **soldé le 15/11/2026** (validé user, rien à faire) | 57 | — |
| 4 | ~~Dette DA du studio (577 motifs → 0, E4)~~ ✅ **livré le 12/11/2026** — 572 → 0, verrou `rush-editor-ui` | 59 | M |
| 5 | ~~Restes T-4 : G8 (dépli), O15 (motion), G9 (tokens)~~ ✅ **livré le 12/11/2026 (T-4a)** — G7 (hero) et composition G9 restent (captures) | 9 · 55 | M |
| 6 | Images : purge WebP / nettoyage (V-C, ops VPS) | 10 | M |
| 7 | ~~Sélection multiple + action serveur en masse (E3c)~~ ✅ **livré le 12/11/2026** — 3 actions bornées, 200 ids, transaction | 59 | L |
| 8 | ~~Route publique d'un bloc (bloc B)~~ ✅ **livré le 12/11/2026** — `/guides/rush-sylvestre/q/[slug]`, publication studio | 10 | L |
| 9 | ~~Blocs **Combat tactique / semi-tactique** + liens nommés (favicon) + markdown couleur + modale de bloc~~ ✅ **livré le 13/11/2026** — migration `20270131000000`, `RushCombatBanner`, `GuideMilestone.links` | 59 | L |
| 9 | T-5 — overlay avancé (O9, O10, O11, O13, O12) | 9 | L |
| 10 | T-6 — perf & architecture (G6, `useOptimistic`) | 9 | M |
| 11 | Finitions du studio (raccourcis, virtualisation, états, E5) | 59 | M |
| 12 | Données Tougli / Dofusyelle (V-D2, ou acter la cible 517) | 10 | ? |
| 13 | ~~Tour guidé (reste V2a-4)~~ ✅ **livré le 16/11/2026** (profil + guide Rush, connecté/anonyme) · V3 (God visiteurs) — **V2d abandonné** · **reste** : contrôle visuel 390/768/1024/1440 (bulle + parcours anonyme/connecté) | 57 | ? |




## 4. Décisions en attente (elles bloquent un rang)

| # | Décision | Bloque |
|---|---|---|
| **D1** | Facteur Kamas Violets de la clôture : `*10` (code) vs `*10 000` (seuil) | rang 16 (RAID R2) |
| **D2** | Stocker `raidPurpleKamasCost` à la clôture (sinon `undo` rembourse `?? 30`) | rang 16 |
| **D3** | ~~Orphelins : fermer ou laisser vivre un raid sans capitaine ?~~ **Tranché le 25/10/2026** : clôture d'office à **+48 h** (après le rappel de +24 h), **traçable** (`closedBySystem`) et **rattrapable** (présents + score possibles ensuite, annulation 24 h) | — (soldé) |
| **D4** | `PLAN-SALONS-VOCAUX` : retenir et cadrer, ou archiver ? | rang 27 |
| **D5** | Onboarding 06/09 : proposition validée ? (migration à appliquer) | rang 28 |
| **D6** | Acquisition : ordre des lots + une page n'entre au sitemap que si elle porte de la donnée réelle | rang 25 |
| **D7** | ~~Landing : `maintenance.html` vs `page.tsx`~~ **Tranché le 16/11/2026** : à l'ouverture, `sigilos.fr` sert la **landing React** (même page que la bêta) ; refonte ultérieure de la landing **sans cadrage** pour l'instant | — (soldé) |
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
| `ESSAI-NOTIF-DASHBOARD` | Fin d'essai — vérification des deux chemins (essai de base posé à l'arrivée, reprogrammation via `setMemberTrialState`) · **idempotence corrigée** : verrou court 5 min + clé durable 90 j écrite **après** un envoi réussi (la clé posée avant un crash supprimait la notification pour toujours) · embed enrichi `Dashboard : 🟢 Présent` / `🔴 Pas de compte dashboard` (`buildTrialEndNotice`, règle pure) — verrou `trial-end` **14** | 16/11/2026 |
| `STATS-RESTES-404` | Stats Guilde — 4 derniers restes morts retirés (rafraîchissement `/stats`, « Stats Guilde » de la carte RBAC, libellé `GUILD_MODULE_LABELS.stats`, aperçu d'embed `stats`) · **308** `/dashboard/:guildId/stats` → accueil de la guilde · `getGuildStats` **autorise avant le cache Redis** · **404** : trois écrans chartés (public / dashboard / espace visiteur) + journal `warn` échantillonné (chemin sans query, hôte du Referer) — verrous `stats-page-removal` **15**, `not-found-log` **14**, `not-found-pages` **7** | 16/11/2026 |
| `TOUR-PUBLIC` | Tours publics — moteur unique (`TourProvider` étendu : `scope="public"`, `storageScope`, phases `rushPublic`/`visitorSpace` rejouables) · règle pure `public-tour` (tronc commun + étapes `visitor`/`anonymous` + drapeau de première arrivée) · **15 ancres** `data-tour` sur le guide Rush, **11** sur l'espace visiteur · visite du profil **une seule fois** + bouton de rejeu dans Réglages, visite du guide rejouable (barre d'outils + Options) · bulle déslopée (plus de violet/glass/font-black) — verrous `public-tour` **19** + `tour-overlay-viewport` **7** | 16/11/2026 |
| `FUSION-SIGNALEMENTS` | Signalements — fusion `SystemIssue` → `SupportTicket` (`TicketOrigin`, `publicRef` `SIG-<n>`, backfill idempotent + filet SQL, tracker membre anonymisé, visiteur connecté, onglet Signalements, refonte tokens, drop `20270202000000`) — verrous **36** | 14/11/2026 |
| `RUSH-OCRE-DONJONS` | Rush — donjons ocre « capturé / à capturer » : règle pure `ocre-dungeons` (nom de boss normalisé, `unknown` sans capture), badge + bouton dans la carte partagée, ouverture de `OcreProgressModal` (dashboard) et `RushOverlayOcreModal` (overlay), `getDungeons` par donjon · **corrections 10/11** : `Dungeon.isOcreQuest` prioritaire (Meulou sans tag), `Fait / À faire` dans la fiche détail, pont `PublicOcreDungeonBridge`, modale publique portée dans la PiP, toasts d'overlay — verrou `ocre-dungeons` **19** | 10/11/2026 |
| `OVERLAY-NOTIFS` | Overlay — un seul endroit pour les notifications : `OverlayToastProvider` monté dans le portail public (Toaster dédié sous `data-da`), `portalContainer` sur `DialogContent` pour la modale Ocre publique dans la PiP, `notifyBlockDone` (bloc validé / Dofus obtenu) — verrou `overlay-notifications` **4** | 10/11/2026 |

| `VISITEUR-NIVEAU` | Annuaire des visiteurs — filtre **métier + niveau minimum** (`?niveau=`, `level: { gte }`, bornes 1..200), 3ᵉ menu rendu **seulement** avec un métier, URL qui retire le niveau avec le métier · **UX** : option active marquée (fond `elevated`, coche, `aria-current`), menu refermé au clic — verrou `visitor-directory` **27** | 10/11/2026 |

| `VISITEUR-OMEGA` | Niveaux Dofus — le ladder renvoie le **niveau Oméga** (128), pas le total : `src/lib/dofus-level.ts` convertit avec l'XP cumulée (> 4 716 600 000), stocke **200 + Oméga** (`dofusLevel` total, plafond 400) et affiche **« Ω 128 »** partout (annuaire, fiche, bandeau, ladder, alertes, mules, guide public) ; les lignes existantes (128 + `totalXp` déjà stocké) s'affichent juste sans resynchro — verrou `dofus-level` **8** + `ladder-snapshot` **8** | 11/11/2026 |

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
| `guildes-cycle-de-vie` | Suppression d'une guilde : bouton propriétaire, purge par cron, écran honnête, propriétaire resynchronisé ; **preuve de purge 90 j + activité réelle** le 02/11 | 02/11/2026 |
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
| `OCRE-VIGNETTES` | Quête Ocre — vignettes : l'image est résolue **par nom** dans `Archimonstre` puis proxifiée (espace apparence `?sprite=1`), au lieu de l'id Metamob (347 = introuvable, 2508 = un autre monstre) et de l'URL Metamob distante que `ocreMonsterImageUrl` refuse ; chaîne de repli extraite en règle pure `ocreMonsterThumbChain` (plus de 404 `.webp` par vignette) — verrou `rush-overlay-ocre` **46** | 09/11/2026 |
| `ROLES-ESSAI` | Cycle de vie — rôles Discord **optionnels** : `+ trialRoleId` au démarrage de l'essai (fiche membre **et** `/valider-recrue`, sans changer sa modale), `+ confirmedRoleId` `− trialRoleId` à la validation, `− trialRoleId` au départ ; réglage **Paramètres ▸ Fin d'essai** (2 sélecteurs Radix) ; règle pure `filterAssignableRoles` (ni `@everyone`, ni `managed`, rien au-dessus du bot ni du staff) — verrous `assignable-roles` **7** · `trial-roles` **9** · **V2** : case « me montrer avant d'appliquer » (colonne `trialConfirmRoleChange`, migration additive `20261109000000`) + fenêtre à cases dans la fiche, garde serveur fail-closed (`rolesConfirmed`) | 09/11/2026 |
| `SENTRY-BRUIT-METAMOB` | Bruit Sentry — un **429 Metamob** (cas prévu, la file se met en pause via `retryAfterMs`) n'est plus loggué en `error` ; le calendrier et les événements **déchiffrent** la clé API avant `/v1/kralove` (elle partait chiffrée ⇒ **400**) et l'échec Krala passe en `warn` (config utilisateur / amont) — verrou `sentry-bruit-metamob` **3** | 09/11/2026 |
| `OCRE-VIGNETTES-ISO` | Quête Ocre — **une seule conversion** (`toOcrePanelData`) sur **toutes** les surfaces : la page du guide et le bandeau « par Dofus » passaient les monstres bruts, donc `imageUrl` n'existait jamais et la vignette retombait sur `.webp`/`.png` (404). Le proxy `/api/assets-dofus` **logge désormais la cause** d'un échec de téléchargement (mesure : tous les sprites renvoient le placeholder 1×1 alors que l'amont répond 200/~20 Ko) — verrous `rush-overlay-ocre` **48** · `assets-dofus-diagnostic` **2** | 09/11/2026 |
| `OCRE-CIBLES-DIAG` | Quête Ocre — le proxy images est **réparé** (le conteneur redéployé rend **5 482 o** en `image/webp`, plus aucun `[assets-dofus]` d'échec) ; `getMyOcreProgress` **nomme** les cibles sans image (log : **4** sur 337 — les Blops royaux) et le chargement d'`Archimonstre` **ne filtre plus par `type`** (la clé est le nom) — verrou `rush-overlay-ocre` **49** | 09/11/2026 |
| `SENTRY-TRI-16-11` | Tri Sentry — un log n'est plus une exception (`InvalidCheck` Auth.js en `warn`, `type` jamais minifié + cause réelle), bruit **mesuré** filtré (2J `Load failed`, 2K `removeChild`, D/2P `pg`, 2Q image externe 404, 2A refus de garde, 2D tunnel `/monitoring`), impact client par id **opaque** (`Sentry.setUser`) ; mesure : **1M est replay-only** car le filtre d'entrée « React hydration errors » jette **16 événements/14 j** — verrou `sentry-bruit-mesure` **10** | 16/11/2026 |
| `HYDRATION-PIP` | Hydratation **1M/2T** — cause mesurée (Playwright + Chrome headless) : `isDocumentPipSupported()` lu **pendant le rendu** ⇒ serveur « Mini-fenêtre flottante » vs Chrome « Fenêtre PiP détachable » + badge (React **#418**) ; capacité posée dans un `useEffect` (bannière raid + tiroir de stratégie), **vérifié après déploiement bêta** (sonde : zéro #418) — verrou `hydration-pip-capability` **3** | 16/11/2026 |



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
- `src/temp/archive/audit-2026-09/` — corpus d'audit déplacé le 19/10/2026 (non versionné).

## 7. Tenue de cette feuille

1. Un chantier livré → sa ligne **sort** et rejoint le §5 (une ligne, sans récit).
2. Un nouveau chantier → une ligne au §1/§2/§3 + un plan durable dans `docs/plans/`.
3. Aucune session ne s'écrit ici : le récit va dans `activeContext.md` (6 blocs), l'historique dans le journal.
4. Garde automatique : `docs/ROADMAP.md` doit rester **< 60 Ko** (`tests/unit/harness-config.test.ts`).
5. **Les rangs sont stables** : un chantier livré laisse un trou dans la numérotation, il n'est pas réattribué (les décisions citent les rangs).
