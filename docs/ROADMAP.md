# 🗺️ ROADMAP — SigilOS (feuille de route unique)

> **Rôle unique.** Ce fichier porte le **backlog** ET **l'ordre**. Une ligne = un chantier.
> **Règle d'or.** 1 rang = 1 lot = 1 branche = 1 PR → `dev`. On merge avant d'ouvrir le suivant.
> **Mémoire.** 6 dernières sessions : `docs/agents/activeContext.md`.
> Historique complet (171 blocs) : `docs/agents/journal-sessions-2026.md` — **à la demande**, jamais au démarrage.
> **Tenue.** Un chantier livré quitte le tableau et rejoint le §5. Aucun récit de session ici.
> **Plus aucun fichier d'amorce** (15/11/2026) : l'ordre et l'état vivent ici ; `docs/plans/` ne porte que les références de module (décisions, mesures).
> **Dernière MàJ** : 22/11/2026 · SHA courant injecté par le hook `TaskStart`.

## 0. Reprise immédiate

- 🎯 **Rush (mesuré 22/11)** : 536 séquences · 527 `pos_tags` (0 sans monde) · 527 prérequis (0 orphelin) · 518/536 cartographiables · 3 succès 3/3 · bêta 8d7528ff, dev 03aabc19.
- 📌 **Gestes Rush** : état et prochain geste **uniques** dans `RUSH-DEVELOPPEMENT-SUITE.md` « ⚡ Restes — fiche unique » ; visuels 390/768/1024/1440 ; doc/prod (`main` = `c190f2c7`).
- ⚡ **Perf web (21/11)** : guide **2,5→3,1–3,3 req/s**, accueil **21,9**, CSS **34,5→69** ; **P0 (#1476)** → **B-3** (profil 3 champs, TTL stats 3 min, `proxy-image` async) livrés ; **bêta à redéployer**. P2/P3 : `docs/plans/PERF-WEB.md`.
- 🔐 **Sécurité (21/11)** : **#1485/#1486/#1487 mergés** (CSP prod sans wildcard, base dev loopback, guards hors `use server`, Caddy sans `.env.prod`, **`game-data` RW** car l'app écrit) → **redéployer la bêta** (2 bots, Caddy, 1 upload God, 1 cron).
- 🧭 **Bloc vs quête (20/11/2026)** : valider un **bloc** ne consulte plus le verrou donjon/prérequis (confort) ; la validation **quête par quête** le garde, fail-closed. Le toast affiche le message serveur exact.
- 📌 **Prod** : `main` = release du 13/11/2026 (`c190f2c7`) ; **aucune date** (décision user). **Migrations** jouées au deploy ; **ops** (ws, bot, intent, cAdvisor, crontabs, Node `24.22.1`) et **réglages** : `docs/MAINTENANCE.md`.

- **Rétention** : lot A **livré** (bêta purgée le 17/11) ; **reste prod** (§2 bis D8) — détail : `docs/plans/PLAN-RETENTION-TELEMETRIE-JOURNAUX.md`.
- **Décisions bloquantes** : `D-R1`, `D1`/`D2`, `D8`, **`D-GUARD`** (`requireGuildOwner` doit-il vérifier `isGuildAllowed` ?). `D7` **tranché** : `sigilos.fr` servira la landing React de la bêta ; refonte non cadrée.
- **Ops à confirmer** : `live-watch` · 4 crontabs · redéploiement bêta (Node `24.22.1`) — détail : `docs/MAINTENANCE.md`.
- **Dépend de toi** : captures G7/G8/G9/O15 · nom de `33380` · 98 textes Brâkmarien · 2×100 + 30 quêtes.

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
| 4h | `durcissements-21-11` | CSP prod sans wildcard, base dev loopback, guards hors `use server`, secrets Caddy | **#1485/#1486/#1487 mergés** : guards déplacés, Caddy sans `.env.prod`, `game-data` **RW assumé** (l'app écrit), icônes `achievements` **non restaurées** au deploy (21/11) | **redéployer la bêta** + smoke test | `PERF-WEB.md` §2 · `docs/agents/deploy-vps.md` | — |
| 5 | `migrations-ops` | 2 migrations additives + bot + crontabs non déployés | `20270112000000` (GodNotification.details), `20270113000000` (DiscordMemberActivity) | jouer bêta puis prod ; redéployer le bot ; poser les 4 crontabs | `docs/MAINTENANCE.md` | — |
| 6 | `caddy-post-503` | Pendant une maintenance, un POST reçoit du HTML au lieu d'un `503 text/plain` | cause racine du 16/10 | durcir le `Caddyfile` (POST → 503) | `docs/MAINTENANCE.md` | — |
| 7 | `csp-enforce` (F10) | CSP en Report-Only : la protection XSS ne bloque rien | `CSP_ENFORCE` présent dans `src/proxy.ts` | poser `CSP_ENFORCE=true` après 48 h de rapports | `docs/SECURITY.md` | — |
| 8 | `presentation-access` | `presentation:view` existe mais n'est pas ouverte au rôle Membre ; l'ancienne page `/presentation` rend encore le règlement | 1 occurrence dans `src/` | ouvrir la permission + trancher la page | — | **D-P1** |
### 1bis. Reste de l'audit sécurité (13/11/2026)

Reste **réel** : **TOCTOU DNS** et **Caddy POST** → corrigés localement (commits `6bbb1c1f`, `5db4598b` ; branche + PR à ouvrir) · **next-auth stable** (indisponible : `5.0.0-beta.32`) · **AUD-12** (amont) · **AUD-06/AUD-08** non décrits dans la doc (à clarifier) · ops **prod** (sauvegardes, branches, CF, token). **Soldé et vérifié le 15/11/2026** : CSP actif en bêta (`CSP_ENFORCE=true`), jeton legacy coupé au **13/12/2026** (bêta + prod), intent `MessageContent` **OFF** (bêta + prod), cAdvisor absent en bêta, migrations notifications appliquées le 15/11 à 22:20. **Suite datée** : **après le 13/12/2026**, supprimer la branche « legacy » de `src/lib/storage-utils.ts` (HMAC nu + `getLegacySecret` + `legacyTokenWarned`), la variable `STORAGE_LEGACY_TOKENS_UNTIL` (`.env.example` + bêta/prod) et réécrire `tests/unit/storage-token-legacy.test.ts` en « ancien format refusé » — le retrait avant cette date casserait les vieux liens Discord que la date protège.
## 2. P1 — Chantiers produit (ordre proposé)

| Rang | ID | Chantier | État mesuré | Prochain lot | Plan | Bloqué par |
|---|---|---|---|---|---|---|
| 9 | `rush-refonte` (T) | Rush Sylvestre : ergonomie, temps réel, éditeur God, habillage Dofus, perf | **T-1 → T-4 livrés** · G8/O15/G9 tokenisée · O10/O12/G2/T1/T5 livrés (mesuré 22/11) | **Fiche unique** : `RUSH-DEVELOPPEMENT-SUITE.md` « Restes » — O13 **carte : bon monde + accès visiteur livrés 22/11** · overlay étroit · T-6 · **livre 22/11** : copie PiP, menu carte, details de quete, **`mapId` God réellement prioritaire** · O6 / descriptions de blocs / studio sans prompt() livres 22/11 · **bandeaux Combat de séquence** (`sequence_banner`) + **Dofus obtenu partagé** livres 22/11 | `docs/plans/RUSH-DEVELOPPEMENT-SUITE.md` | captures G7/G9 · overlay étroit |
| 10 | `rush-donnees` (V) | Rush Sylvestre : ressources, ids/icônes, alignement, ocre, Metamob | **V-A/V-B/V-G/V-F partiel/V-H livrés** · conseils **49** · **V-D2 mesuré 22/11** (1 id absent + 1 id invalide ×60) | **V-D2 livre 22/11** (borne Int32) · **Temple Céleste (monde 41) intégré 22/11** (3 cartes + tuiles + `DOFUS_WORLDS` + audit) · **positions sous-mondes** : `(0,0)` autorisé + `fix-rush-pos-worlds` (514 proposées, 4 appliquées en local) · **Fiche unique** : V-C (ops VPS) | `docs/plans/RUSH-DEVELOPPEMENT-SUITE.md` | V-C : ops |
| 10b | `rush-guide` | Rush : prérequis, succès, ordre, overlay | **#1431-#1473** · guide **536** · **T-2c clos par mesure (0 orphelin / 527)** · 3 succès **3/3** | **Fiche unique** : itérations 5/6 (non définies) · compteur « 448 » (**en-tête PiP**) · overlay étroit | `docs/plans/RUSH-DEVELOPPEMENT-SUITE.md` | itérations : définition |
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
| 66 | `perf-web` | Performance web | **P0 (#1476)** · **P1-1 (#1479)** · **P1-2 (#1482)** · **B-1/B-2 (#1483/#1484)** · **B-3** (ce lot) | **P2** cadrage → **P3** CDN (§3.6, **D8**) | `docs/plans/PERF-WEB.md` | — |

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
| D1 | `discord-stellium` | Bouton « Discord SigilOS » en interne guilde (sidebar + page Tickets) | **livré le 16/11/2026** : mesure API Discord (`uX7G6SUDgN` → guilde SigilOS ; `/discord` → STELLIUM, nom interne), 2 liens via `NEXT_PUBLIC_DISCORD_INVITE_URL` (`src/lib/discord-invite.ts`), rangée sidebar en `flex-wrap` (232 px), cible 44 px sur Tickets, verrou 3 tests | — | amorce locale `src/temp/amorce-reprise-2026-11-16-god-chantiers.md` (non versionnée) |
| D2 | `ladder-libelles` | `#364` / `#13` : rangs explicites | **livré le 16/11/2026** : « Rang succès » (Ankama) / « Rang interne » (SigilOS), ordinal déterministe U+202F (`364ᵉ`, `1ᵉʳ`, `—`), info-bulles, carte en `flex-wrap` (390 px), verrou 3 tests | — | idem |
| D3 | `visiteurs-filtre-serveur` | `/visiteurs` : serveur du lecteur par défaut + dropdown pour explorer (option 2) ; consentement global | **livré le 16/11/2026** : `serverId` borné 1..9999 + `all`, défaut lecteur, consentement `showOnDirectory` global (liste **et** fiche), menu serveur `ALL_DOFUS_SERVER_ENTRIES`, colonne Serveur (sous le pseudo en mobile), i18n FR/EN, plan D-V18 révisé, 81 ciblés | — | idem |
| D4 | `god-lot4` | Lot 4 « Le God voit tout » (G7/A4/A5) | **livré le 25/09/2026** (#752) : `createAuditLog` route les actions God vers le journal plateforme (`isGodActorWithoutGuildAuthority`), fiche guilde lue par `isSuperAdmin`, « erreur de chargement » ≠ « accès refusé » ; verrou `god-sees-everything` (9 tests) | — | `docs/plans/PLAN-REFONTE-GOD-GUILDES.md` |
| D5 | `god-lot5` | Lot 5 : langage, tour de contrôle, roster, RBAC, users (G1/G2/G3/G5/G9) | **livré le 17/11/2026** : **G1** glossaire unique (`src/lib/god-status-glossary.ts`), légende « Comprendre les statuts », infobulle sur chaque badge, libellés humains (« Peu de membres — à vérifier », « Validées par le staff ») ; **G2** action primaire « Autoriser une guilde », connexions non autorisées dans `⋯`, sections vides masquées, compteurs radar accessibles ; G3/G5 déjà couverts par la fiche guilde ; **G9** = `?tab=tickets`, aucune route `/god/users` ; verrous `god-status-glossary` (7) + `god-tour-controle` (4) | — (soldé) | `docs/plans/PLAN-REFONTE-GOD-GUILDES.md` |
| D6 | `god-lot6` | Lot 6 : déslop God, tokens, plafond `god-deslop.test.ts` | **livré le 17/11/2026** : **zéro** palette en dur (`zinc/emerald/amber/rose/white/black…`), **zéro** forme hors DA (`font-black`, `rounded-2xl/3xl`, `backdrop-blur`, `tracking-widest`, `shadow-lg/xl/2xl`, rayon > 12 px) sur les 78 fichiers God ; `user-list.tsx` orphelin + `forceDeleteUser` supprimés ; garde réécrite (palette, formes, kit) et plafond **79 → 78** ; 39 fichiers tokenisés | — (soldé) | `docs/plans/PLAN-REFONTE-GOD-GUILDES.md` |
| D7 | `owner-id-uuid` | Normaliser `GuildConfig.ownerId` vers l'identifiant interne `User.id` (CUID) | **livré le 17/11/2026** : mesure locale 7 guildes → 3 snowflakes (3/3 résolubles), 3 nulles, 1 interne ; `resolveGuildOwnerWriteId` branche l'onboarding, les deux self-heals (dashboard et RGPD) écrivent l'identifiant interne, le transfert reste interne ; script `scripts/backfill-guild-owner-id.ts` (dry-run par défaut, compteurs seuls) ; verrou `guild-owner-normalization` (13 tests). **Bêta faite le 17/11/2026** : 3/3 normalisées, contrôle idempotent à 0 | **reste prod** : déployer, puis dry-run + `--execute` | `docs/MAINTENANCE.md` § Backfill ownerId |
| D8 | `ops-retention` | Première passe de rétention (lot A) | **bêta faite le 17/11/2026** : 15 296 événements `TelemetryEvent` > 90 j purgés en 4 passes (5 000 + 5 000 + 5 000 + 296), 11 journaux d'audit > 30 j et 2 sessions God > 90 j ; `ServiceActivityLog` 0 ; contrôle final à 0 ; **reste prod** | dry-run → exécution → compteurs (prod) | `docs/plans/PLAN-RETENTION-TELEMETRIE-JOURNAUX.md` |
| D9 | `ops-visuel` | Contrôle visuel 390/768/1024/1440 de `?tab=telemetry` et `?tab=overview` | non fait (humain) | captures + validation | `docs/ROADMAP.md` §2 bis |

**Ordre** : **D1 → D7 livrés** (D1–D3 le 16/11/2026, D4 le 25/09/2026, D5–D7 le 17/11/2026) ; reste **D8/D9**, vérifications humaines à faire dès que possible.

**Visiteurs** : **V4 → V9 livrés côté code** ; les migrations V4 (`PublicBountyCompletion`, `UserBountyCompletion`, `characterSlot`) bêta à jour ; prod à vérifier.

## 2 quater. Visiteurs — avis, personnages et personnalisation (V4→V9, livrés les 16-17/11/2026)

| Rang | ID | Chantier | État mesuré | Prochain lot | Plan |
|---|---|---|---|---|---|
| V4 | `avis-recherche` | Avis de recherche cochables (visiteur + interne), **par personnage**, et filtres communs « fait / cherchent encore » | **livré le 16/11/2026** : deux migrations **additives** (`PublicBountyCompletion`, `UserBountyCompletion`, `characterSlot` sur les coches), `togglePublicBounty` / `toggleUserBounty`, fiche interne `BountyFicheView` partagée, section Avis dans `/visiteurs?vue=succes`, carte « Avis de recherche » dans Mes Succès | — | `docs/plans/PLAN-ESPACE-VISITEUR.md` |
| V5 | `visiteur-page-perso` | Page perso et fiche lecture seule personnalisées | **livré le 16/11/2026** : hero classe/serveur/guilde, compteurs réels (succès et avis distincts, tous personnages), visibilité, raccourcis ; **V5 bis** fiche `/visiteurs/[id]` : listes de succès et d'avis plafonnées, mules, activités, Rush si `showRushProgress`, Metamob vérifié ; clé et `userId` jamais exposés | — | idem |
| V6 | `visiteur-filtres-hover` | Survol et sélection des filtres `/visiteurs` | **livré le 16/11/2026** : `hover:bg-surface` invisible sur `.reg-panel` corrigé en `elevated/60`, ring actif, focus visible | — | idem |
| V7 | `ocre-parite-visiteur` | Carte « Quête de l'Éternelle Moisson » du visiteur alignée sur l'interne (possession et synchro) | **livré le 16/11/2026** : `owned` normalisé (`normalizeQuestMonster`), comptage commun (`isOcreMonsterNeeded`), `OCRE_TOTAL_STEPS = 34`, « Forcer la synchro » avec `skipCache`/`revalidate: 0`, relecture du patch sans cache + `revalidateTag` par pseudo ; verrou `ocre-possession-parity` | — | `docs/plans/PLAN-ESPACE-VISITEUR.md` |
| V8 | `visiteur-fiche-filtres` | Filtres des listes de la fiche visiteur (succès, avis, métiers) | **livré le 16/11/2026** : `visitor-profile-filters` (recherche accent-insensible, personnage, donjon/zone, niveau minimum), `VisitorProfileLists` paginé par 24 avec « Voir plus », plafonds 200/120, i18n FR/EN ; verrou `visiteur-profile-filters`. **Complété le 17/11/2026 (#1417)** : tableaux denses succès/avis, tri donjon/zone/nom/points/niveau, combobox donjon/zone recherchable, **filtre donjon obligatoire** (sinon « N donjons » + consigne, plus de mur), image du donjon, icônes/assets des cartes de synthèse, favicon Metamob + % Ocre du lecteur | — | `docs/plans/PLAN-ESPACE-VISITEUR.md` |
| V9 | `succes-communs-filtre` | Hub `/visiteurs?vue=succes` : avis et donjons dans **une seule** zone maître-détail | **livré le 17/11/2026** (#1417) : filtre d'URL `?liste=avis` (avis prioritaire sur un ancien lien mixte), plus d'avis empilés sous les donjons, recherche `q` partagée, verrou `visitors-hub` | — | `docs/plans/PLAN-ESPACE-VISITEUR.md` |

## 2 quinquies. Fiches publiques — retours du 16/11/2026

| Rang | ID | Chantier | État mesuré | Prochain lot | Plan |
|---|---|---|---|---|---|
| B1 | `boss-fiche-simu-responsive` | Fiche boss : simulation vide + responsive des fiches avis/boss | **livré le 16/11/2026** : `knownSpellIdsForMerge` (garde vide ⇒ sorts Dofensive conservés), vues Succès empilées avant `2xl`, verrou `boss-simulation-spells`. **Complété le 17/11/2026 (#1415)** : `SpellRangeGrid` à seuil **conteneur** (`@container` + `@5xl` = 64 rem) au lieu de la fenêtre (`2xl`), prop `embedded` (plus de seconde carte sur la fiche avis/monstre) | — | `docs/CONTEXT.md` |

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
| 43 | `harness-maintenance` | Harnais H0-H7 + **adaptateur OpenCode** + **lots 2-3** + **décision lot 4** (source `.cline/skills` conservée, migration conditionnée) | 22/11/2026 | 3 lots produit à mesurer (scorecard §14) ; migration si conditions | `docs/agents/harnais.md` §12-14 |
| 44 | ~~`god-system-polish`~~ | **Résolu le 13/11/2026** : cAdvisor supprimé (SEC-04), carte « Conteneurs » retirée ; les autres métriques God restent | — | — | — | — |
| 45 | `grafana-alerts-audit` | Règles d'alerte Grafana éventuelles dans `grafana_data` : plus exécutées | volume conservé, non audité | lister et recréer dans Sentry/webhook si nécessaire | `docs/MAINTENANCE.md` |
| 46 | `deploy-sha-normalize` | `deploy-cd.sh` refuse un SHA 8/40 alors que la CI publie 7 caractères | `5b31ad0f` refusé, `5b31ad0` accepté | normaliser le SHA à 7 dans `deploy-cd.sh` et `rollback.sh` | `docs/agents/deploy-vps.md` |
| 47 | ~~`telemetrie-retention`~~ | **Résolu le 16/11/2026 par le lot A** (`retention-logs`) : purge à **90 j**, par lot, branchée sur `cleanup-logs` et le janitor | mesuré sur le VPS le 20/10/2026 : **24 Mo**, 2ᵉ plus grosse table applicative | — | `docs/plans/PLAN-RETENTION-TELEMETRIE-JOURNAUX.md` |
| 48 | `crits-incoherents` | Effets **critiques inférieurs** aux dégâts de base publiés sur les fiches boss (ex. Phossile : base 426-480, crit 71-80) | mesuré le 20/10/2026 sur **Comte Harebourg** : base 639-810, crit **71-90** (même symptôme) ; `isCoherentCritJet` existe (lot R-4) mais le chemin Dofensive formate les crits en **chaînes** (`criticalEffects?: string[]`) **avant** le contrôle → la règle ne s'applique pas | garder `{min,max}` jusqu'après le contrôle, puis formater ; test de non-régression sur un sort réel | — (à créer) |
| 49 | `donjons-sans-donnees` | **25** donjons de la base sans entrée au catalogue local ⇒ fiche « partielle » (ni résistances, ni butin) | mesuré le 20/10/2026 : **34/151** bandeaux, **9 corrigés par alias** (#1051) ; fichier déployé **identique au dépôt** (187 entrées) ⇒ pas un fichier périmé | vérifier la couverture de `siphon-dungeon-monsters.mjs`, relancer le siphon, puis `sync-assets.sh` (bind mount) | — (à créer) |
| 50 | `simulation-refonte` | Simulation tactique (fiche boss + overlay) : doc développeur, état dans l'URL, page outil | S-1 mesuré | S-2 (doc repliable) → S-3 (`/simulateur`), après **D-SIM1** | — | — |
| 51 | `boss-fiche-locale` | Les commandes Discord `/boss` et `/monstre` interrogent encore **DofusDB de façon synchrone** alors que `getLocalMonsterFiche` existe (siphon + bestiaire local, zéro réseau) | mesuré le 20/10/2026 : la route contient encore `getMonsterStats` (×2) et `mob.grades?.[mob.grades.length - 1]` ; le test « réponse < 3 s » (écrit le 16/10, conservé hors dépôt puis consigné ici) **échouerait** tant que la bascule n'est pas faite | basculer les 2 commandes sur `getLocalMonsterFiche`, garder un repli explicite (« fiche indisponible »), activer le test | — (à créer) |
| 52 | `galerie-variantes` | **Galerie Stuff** : variantes proposées par le joueur, sans toucher au stuff Dofusbook | **livré le 26/10/2026** (`resolveVariantPreview`, tag VARIANTE) | — (rien) | — | — |
| 53 | `passifs-objets` | **Effets passifs officiels** des objets | **livré** 23/10/2026 — **117 sorts** dans `src/data/item-passives.json`, repli inventé supprimé | 38 sorts sans description : à rejouer via le siphon | — | — |
| 54 | `supply-chain` | Débloquer la porte de sécurité (`zod` 4.6.7, `undici` 7.30.1) | **livré** 23/10/2026 (PR #1101) : migration zod 3 → 4 sur 26 fichiers, `security:audit` franchie | — (rien) | — | — |
| 55 | `rush-restes` | **Absorbé le 22/11/2026** dans la fiche unique : G7/G9 = captures, `questDbIds` = décision d'affichage | mesuré | voir fiche unique | `docs/plans/RUSH-DEVELOPPEMENT-SUITE.md` | — |
| 56 | `live-discord` | Annonces de créateurs : live Twitch + nouvelle vidéo YouTube, **deux salons distincts** (Twitch / YouTube) + **deux interrupteurs** + ping par guilde, une annonce par session/vidéo (cron 5 min) | **livré** le 02/11/2026 · **scindé** le 04/11/2026 (salons et interrupteurs distincts, migration additive avec reprise du salon existant) | — (rien) | `docs/MAINTENANCE.md` | — |
| 58 | `ui-dj` | DJ/Quête : DA landing sur `DjPostCreateModal`, `DjEditModal`, `DjFiltersBar`, `DungeonFinderClient` | ~90 occurrences | même passe que #1252 + `ui-tokens-dj` | `docs/RULES.md` § UI |
| 59 | `god-rush-ux` | **Éditeur God Rush** : studio 3 panneaux (arbre / liste / inspecteur), Ctrl+K, filtres, actions de masse, DA God | **E1, E2b, E2c, E2d, E3c, E4 livrés** · coque élargie 10/11 · blocs Combat + liens + markdown 13/11 · dette DA 577 → **0** | **E5** finitions — voir fiche unique Rush | `docs/plans/REFONTE-EDITEUR-RUSH.md` | — |
| 60 | `standby-etendu` | Marché (`market-expire`), demandes de service (`cleanup-inactive-service-requests`) et sondages (`close-old-polls`) : **aucune pause** — ni bouton, ni colonne, l'expiration est subie | mesuré le 05/11/2026 (3 modèles avec `standBy` : `DjSearchPost`, `DreamRun`, `GuildEvent` ; les 3 autres n'en ont pas) | si demandé : colonne `standBy` sur 3 modèles (**migration**) + bouton + gardes de cron | `docs/MAINTENANCE.md` § Stand-by | — |
## 3 bis. File d'exécution — Rush Sylvestre + espace visiteur

> **Seul ordre pour ces deux périmètres.** Le **détail des restes** vit dans **une seule** section :
> `docs/plans/RUSH-DEVELOPPEMENT-SUITE.md` « Restes — fiche unique » (22/11/2026). Les rangs
> 9/10/10b/55/59 n'en portent plus le détail. Une amorce de session ne recrée pas de file.

| # | Chantier | Rang | Taille |
|---|---|---|---|
| 1 | ~~Test flaky `lot4-slash-commands-api-keys` (timeout 5 s)~~ ✅ **livré le 12/11** | — | S |
| 2 | ~~Brouillon local du formulaire de quête (E2b-suite 2/2)~~ ✅ **livré le 12/11** | 59 | M |
| 3 | ~~Fiche visiteur — affinage (assets, hiérarchie)~~ ✅ **soldé le 15/11/2026** (validé user, rien à faire) | 57 | — |
| 4 | ~~Dette DA du studio (577 motifs → 0, E4)~~ ✅ **livré le 12/11/2026** — 572 → 0, verrou `rush-editor-ui` | 59 | M |
| 5 | **Restes Rush** — état, priorités et prochain geste **uniques** : `RUSH-DEVELOPPEMENT-SUITE.md` « Restes — fiche unique » (22/11/2026) | 9 · 10 · 10b · 55 · 59 | — |
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
| `OPS-RUNBOOK` · `RUSH-REVALIDATIONS` · `RUSH-UI-LIVE` | Ops VPS · 20 actions revalidées · UI (icônes, blocs ouverts, projection, temps réel, bloc sans verrou) — verrous **10 + 5 + 7** | 20/11/2026 |
| `MISSIONS-SONDAGES` | Visuels (Songes/Anomalies/familles), « Sans ping » publie l'annonce, embeds supprimés à la clôture, modale 3xl, éditeur UI (tokens/responsive/a11y) — verrous 18/6/4/9 | 17/11/2026 |
| `ESSAI-NOTIF-DASHBOARD` | Fin d'essai — deux chemins couverts, idempotence corrigée (clé durable 90 j écrite après un envoi réussi), embed « Dashboard présent / pas de compte » (`buildTrialEndNotice`) — verrou `trial-end` **14** | 16/11/2026 |
| `STATS-RESTES-404` | Stats Guilde — 4 derniers restes morts retirés (rafraîchissement `/stats`, « Stats Guilde » de la carte RBAC, libellé `GUILD_MODULE_LABELS.stats`, aperçu d'embed `stats`) · **308** `/dashboard/:guildId/stats` → accueil de la guilde · `getGuildStats` **autorise avant le cache Redis** · **404** : trois écrans chartés (public / dashboard / espace visiteur) + journal `warn` échantillonné (chemin sans query, hôte du Referer) — verrous `stats-page-removal` **15**, `not-found-log` **14**, `not-found-pages` **7** | 16/11/2026 |
| `TOUR-PUBLIC` | Tours publics — moteur unique (`TourProvider` étendu : `scope="public"`, `storageScope`, phases `rushPublic`/`visitorSpace` rejouables) · règle pure `public-tour` (tronc commun + étapes `visitor`/`anonymous` + drapeau de première arrivée) · **15 ancres** `data-tour` sur le guide Rush, **11** sur l'espace visiteur · visite du profil **une seule fois** + bouton de rejeu dans Réglages, visite du guide rejouable (barre d'outils + Options) · bulle déslopée (plus de violet/glass/font-black) — verrous `public-tour` **19** + `tour-overlay-viewport` **7** | 16/11/2026 |
| `FUSION-SIGNALEMENTS` | Signalements — fusion `SystemIssue` → `SupportTicket` (`TicketOrigin`, `publicRef` `SIG-<n>`, backfill idempotent + filet SQL, tracker membre anonymisé, visiteur connecté, onglet Signalements, refonte tokens, drop `20270202000000`) — verrous **36** | 14/11/2026 |
| `RUSH-OCRE-DONJONS` | Rush — donjons ocre « capturé / à capturer » : règle pure `ocre-dungeons` (nom de boss normalisé, `unknown` sans capture), badge + bouton dans la carte partagée, ouverture de `OcreProgressModal` (dashboard) et `RushOverlayOcreModal` (overlay), `getDungeons` par donjon · **corrections 10/11** : `Dungeon.isOcreQuest` prioritaire (Meulou sans tag), `Fait / À faire` dans la fiche détail, pont `PublicOcreDungeonBridge`, modale publique portée dans la PiP, toasts d'overlay — verrou `ocre-dungeons` **19** | 10/11/2026 |
| `OVERLAY-NOTIFS` | Overlay — un seul endroit pour les notifications : `OverlayToastProvider` monté dans le portail public (Toaster dédié sous `data-da`), `portalContainer` sur `DialogContent` pour la modale Ocre publique dans la PiP, `notifyBlockDone` (bloc validé / Dofus obtenu) — verrou `overlay-notifications` **4** | 10/11/2026 |
| `RUSH-PREREQ-JUMP` | Overlay — saut vers un prérequis : cible par `milestoneId` + `seqId` (fail-closed), changement de bloc, focus dans le document PiP, toast « Revenir » (10 s), action de toast aux tokens DA — verrou `rush-overlay-jump` **7** | 22/11/2026 |

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
| `ROLES-ESSAI` | Cycle de vie — rôles Discord **optionnels** (essai, confirmé, retrait), réglage **Paramètres ▸ Fin d'essai**, règle pure `filterAssignableRoles` ; **V2** case « me montrer avant d'appliquer » (colonne `trialConfirmRoleChange`, migration additive) + garde fail-closed — verrous `assignable-roles` **7** · `trial-roles` **9** | 09/11/2026 |
| `SENTRY-BRUIT-METAMOB` | Bruit Sentry — un **429 Metamob** (cas prévu, la file se met en pause via `retryAfterMs`) n'est plus loggué en `error` ; le calendrier et les événements **déchiffrent** la clé API avant `/v1/kralove` (elle partait chiffrée ⇒ **400**) et l'échec Krala passe en `warn` (config utilisateur / amont) — verrou `sentry-bruit-metamob` **3** | 09/11/2026 |
| `OCRE-VIGNETTES-ISO` | Quête Ocre — **une seule conversion** (`toOcrePanelData`) sur **toutes** les surfaces : la page du guide et le bandeau « par Dofus » passaient les monstres bruts, donc `imageUrl` n'existait jamais et la vignette retombait sur `.webp`/`.png` (404). Le proxy `/api/assets-dofus` **logge désormais la cause** d'un échec de téléchargement (mesure : tous les sprites renvoient le placeholder 1×1 alors que l'amont répond 200/~20 Ko) — verrous `rush-overlay-ocre` **48** · `assets-dofus-diagnostic` **2** | 09/11/2026 |
| `RUSH-TOUGLI-ENRICHI` | Rush — **Touglie enrichi Dofusyelle** (`enrichFromYelle`), archivage `archive-rush-guide.mjs` ; importé en local, archive **108/492**, VPS à faire | 17/11/2026 |
| `OCRE-CIBLES-DIAG` | Quête Ocre — le proxy images est **réparé** (le conteneur redéployé rend **5 482 o** en `image/webp`, plus aucun `[assets-dofus]` d'échec) ; `getMyOcreProgress` **nomme** les cibles sans image (log : **4** sur 337 — les Blops royaux) et le chargement d'`Archimonstre` **ne filtre plus par `type`** (la clé est le nom) — verrou `rush-overlay-ocre` **49** | 09/11/2026 |
| `SENTRY-TRI-16-11` | Tri Sentry — un log n'est plus une exception (`InvalidCheck` Auth.js en `warn`, `type` jamais minifié + cause réelle), bruit **mesuré** filtré (2J `Load failed`, 2K `removeChild`, D/2P `pg`, 2Q image externe 404, 2A refus de garde, 2D tunnel `/monitoring`), impact client par id **opaque** (`Sentry.setUser`) ; mesure : **1M est replay-only** car le filtre d'entrée « React hydration errors » jette **16 événements/14 j** — verrou `sentry-bruit-mesure` **10** | 16/11/2026 |
| `HYDRATION-PIP` | Hydratation **1M/2T** — cause mesurée (Playwright + Chrome headless) : `isDocumentPipSupported()` lu **pendant le rendu** ⇒ serveur « Mini-fenêtre flottante » vs Chrome « Fenêtre PiP détachable » + badge (React **#418**) ; capacité posée dans un `useEffect` (bannière raid + tiroir de stratégie), **vérifié après déploiement bêta** (sonde : zéro #418) — verrou `hydration-pip-capability` **3** | 16/11/2026 |
| `SUCCES-CANONIQUE` | Coches unifiées sur `UserDungeonProgress` + backfill idempotent — verrou `boss-achievement-check` **17** | 19/11/2026 |
| `RUSH-BLOC-I` | Succès de donjon : `+` requis/résolu, modale pleine + mini PiP, guest lecture seule — verrous `rush-dungeon-achievements` **39** | 19/11/2026 |
| `RUSH-DONJONS-ALIAS` | Donjons — 3 alias mesurés, plafond d'import 12 → 40, `dungeonIds` complétés (4 quêtes, **21 ids**) — verrou `rush-dungeon-names` **11** | 19/11/2026 |
| `RUSH-BLOC-J` | « Progression Donjons » : vue par donjon × étape (occurrences), filtres état/étape/repères, agrégat membres / visiteurs consentants, entrée dashboard + public + overlay — verrous `rush-dungeons-overview` **16** | 19/11/2026 |



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
