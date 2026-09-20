# Audit de l'arborescence — état au 19/09/2026

Objectif : un dépôt **compréhensible de A à Z**, sans artefact généré, sans doublon, exploitable par
quelqu'un qui n'a pas suivi les 40 derniers chantiers.

> Périmètre : **fichiers suivis par git** — **4 164 après assainissement** (4 213 à l'audit initial).
> Méthode : `git ls-files`, `git ls-files -i -c --exclude-standard` (suivi **et** ignoré),
> `git check-ignore -v`, mesures disque. **Les chiffres de §1 datent de l'audit initial** (avant L1→L5) :
> l'état courant est décrit ci-dessous.

---

## 0. État de reprise — mis à jour le 19/09/2026 (pour reprendre l'assainissement)

> **Branche** : `refactor/nettoyage-src-temp` → **PR #688** (OPEN, MERGEABLE, 8 commits, 94 fichiers,
> +854 / −47 003). **Rien n'est encore mergé dans `dev`** : tout ce qui suit est porté par cette PR.
>
> ⚠️ **MAJ 20/09/2026 — ce qui suit est HISTORIQUE** : la PR #688 est **fusionnée** (squash `e82920eba`),
> suivie de la purge des **empreintes machine** (PR #689 → `ee93c0649`) et de la **réécriture de
> l'historique** (2 497 chemins purgés, identités anonymisées). Les 4 visuels de la landing
> (`dashboard-guilde`, `calendrier-sorties`, `missions-guilde`, `guide-sylvestre`), `src/lib/landing-figures.ts`,
> son test et les scripts `capture-landing-visuels.mjs` / `crop-landing-visuels.mjs` / `probe-figure-slots.mjs`
> ont été **supprimés** : les figures de la landing sont des **mockups vectoriels**
> (`src/components/landing/registre/*-mockup.tsx`). Le profil Playwright se recrée avec
> `node scripts/capture-screenshots.mjs --login`.

### ✅ Fait

| Lot | Contenu | Preuve / récupération |
|---|---|---|
| **L1/L2** | 13 fichiers **générés** + **données d'exécution** détrackés : `dist/*.js`, `prisma/seed.js`, `seed_simple.js`, `scripts/database-janitor.js`, `siphon-guide-images.js`, `seed-v3-compiled.js`, `services/discord-bot/dist/index.js`, cache `.wrangler/`, 3 `.py` d'agent, `private_uploads/**`, `backups/**` — + règles `.gitignore` | `git ls-files -i -c --exclude-standard` → **0** (hors `public/game-data`) |
| **L3** | `.playwright-profile/` supprimé (**87,5 Mo**) | se recrée : `node scripts/capture-landing-visuels.mjs --login` |
| **L4** | Racine **8 → 6 `.md`** : `WORKFLOW.md` (doublon de `docs/RULES.md §Git Workflow`, 0 citation) et `USER_ACTIONS_REQUIRED.md` (0 citation) supprimés ; `docs/MAINTENANCE.md` **conservé** (cité 20× dont dans du code) | `git log -- <fichier>` |
| **L5** | `scripts/` **93 → 76** : 19 one-shot jamais cités retirés. **Pièges conservés** : `bounties.json` (importé par `src/lib/bounty-ignore.ts`), `capture-landing-visuels.mjs` (`docs/MAINTENANCE.md` + code), `siphon-guide-images.ts` (`npm run build:siphon`), `seed-dofus-quests.ts` (chargeur de 30 JSON maintenus) | `git show <sha>:scripts/<nom>` |
| — | `src/temp` : **583 → 50 fichiers**, **148 références** nettoyées dans 28 fichiers, 8 outils Rush supprimés, 4 outils promus dans `scripts/` | `docs/arbo/ARCHIVES-TEMP-2026-09.md` |
| — | `src/scripts/` vidé (ses 2 outils sont dans `scripts/`) | — |
| — | Branches : **34 → 3** (`dev`, `main`, `feat/inter-guilde`) + 28 branches GitHub supprimées | `_menage-2026-09-19/branches-supprimees-2026-09-19.txt` (nom + SHA) |
| — | `.next/` supprimé (**43,6 Go**) · `docs/` 15 → 13 | se reconstruit |

**Vérifications** : `tsc --noEmit` **0 erreur** · `eslint .` **0 erreur** · `npm run test:run` **1722 tests / 161 fichiers** · `node scripts/scan-mojibake-all.mjs` → **0 fichier**.

### ✅ Fait le 20/09/2026 — ménage profond de l'arborescence (cette passe)

| Lot | Contenu | Preuve / récupération |
|---|---|---|
| **D1** | **`.antigravity` supprimé** (58 Ko de contexte d'assistant figé depuis le 31/08, alors que `PROMPT_START.md` disait de ne plus s'y référer) + les 2 liens de `RULES.md` recâblés sur `docs/CONTEXT.md` | `git show 2bd21ccba:.antigravity` |
| **D2** | **12 reliques sorties de `src/`** (notes, dumps, specs livrées, log de déploiement) — aucune n'était citée par du code | archive `A:\SigilOS--menage-2026-09-20\lot1-src-reliques\` |
| **D3** | **4 fichiers-junk supprimés** : `.agents/workflow-images-buggés.md` (112 o), `src/components/worldmap/compile_errors.txt` (log `tsc`), `prisma/migrations/20260723134500…/verify.sql` (sortie d'outil UTF-16, jamais du SQL), `.vscode/settings.json` (`{}`) | `git show 2bd21ccba:<chemin>` |
| **D4** | **Toute la documentation regroupée dans `docs/`** (arbo unique) : 33 déplacements en `git mv` + tri en `agents/ ops/ plans/ reference/ arbo/` + nouvel index `docs/README.md` | `git log --follow -- docs/...` |
| **D5** | **175 références réécrites** dans 38 fichiers (code, tests, scripts, CI, docs) — par script Node (jamais PowerShell, règle d'encodage du projet) | `git grep -n "docs/docs/"` et `git grep -n "\.agents/"` → **0** |
| **D6** | **U+FFFD (décodage lossy) réparés** : 2 emojis de job dans `verify.yml`, `docs/RULES.md`, le libellé **visible** « Sexe Féminin » (`gallery-filters.tsx`), le titre d'embed Discord (`poll-actions.ts`) | scan U+FFFD → **0** fichier |
| **D7** | **Pointeurs morts corrigés** : 6 renvois vers un dossier `archive/` **inexistant** (`PROMPT_START`, `CONTEXT`, `ROADMAP`), hint de la route `seed-v3` (script supprimé → `npm run seed:game-data`), script one-shot cité par `ROADMAP` | `git grep -n "archive/"` |
| **D8** | **`_menage-2026-09-13/17/19` archivés hors dépôt** (manifeste inclus) | `A:\SigilOS--menage-2026-09-20\lot2-menage\` (+ `INVENTAIRE.txt`) |
| **D9** | Configs nettoyées : `.gitignore` (règle `/backups/` **dupliquée** retirée), `tsconfig.json` (exclusion `.agents` morte), `verify.yml` (`!.agent/**` = typo, `!.antigravity` = fichier supprimé) | `git diff` |

> **Cible atteinte** : la racine ne contient plus qu'**un seul `.md`** (`README.md`) et la documentation vit
> dans `docs/` (index : `docs/README.md` ; arborescence détaillée : `docs/arbo/CARTE-DU-PROJET.md` §2bis).


### 🧪 Preuve chiffrée avant de sortir `public/uploads/{guides,docs,guilds}` (20/09/2026)

Base locale (`sigilos-db`, Postgres) interrogée **en lecture seule** : on cherche les valeurs `%/uploads/%`
sur **toutes** les colonnes texte, puis on ventile par sous-dossier
(script du ménage : `A:\SigilOS--menage-2026-09-20\lot3-outils\where-uploads-point.sql`).

| Préfixe écrit en base | Lignes | Fichiers visés |
|---|---|---|
| `/uploads/assets-dofus/…` | **21 857** (`GameItem.iconUrl` 21 748 · `MarketListing.itemIconUrl` 15 · `MarketListingComponent.iconUrl` 3 · `Bounty.imageUrl` 91) | le **cache** `public/uploads/assets-dofus/` → **volume prod, intouchable** |
| `/uploads/guides/…` | 2 (`GuideMilestone.imageUrl`) | 2 fichiers qui **n'existent que dans `private_uploads/guides/`** (déjà migrés) |
| `/uploads/docs/…` | 2 (`ChangelogEntry.content`) | 2 fichiers qui **n'existent que dans `private_uploads/docs/`** (déjà migrés) |
| `/uploads/guilds/…` | **0** | — |
| `/uploads/proofs/…` | **0** | — |
| `/api/storage/…` (nouveau système) | 6 | `private_uploads/` |

**Conclusion** : **aucune** des 636 images suivies dans `public/uploads/{guides,docs,guilds}` n'était
référencée par la base ; les URL `/uploads/…` qu'elle contient encore pointent en réalité vers
`private_uploads/` (fichiers **absents** de `public/uploads/`, vérifié par `Test-Path` = faux), servis par
le rewrite Caddy `/uploads/<scope>/…` → `/api/storage/<scope>/…`. Elles ont donc été **archivées puis
retirées du dépôt** (`A:\SigilOS--menage-2026-09-20\lot5-old-uploads\`).

> Contrôle final : `git ls-files -i -c --exclude-standard` → **vide** (plus aucun fichier à la fois suivi et ignoré).

### ✅ Fait le 20/09/2026 (suite) — retours utilisateur : lots D10 → D16

| Lot | Contenu | Preuve |
|---|---|---|
| **D10** | **636 fichiers de l'ancien upload sortis** (`public/uploads/{guides,docs,guilds}`) après vérification en base (preuve ci-dessus) | `A:\SigilOS--menage-2026-09-20\lot5-old-uploads\` |
| **D11** | **`.gitignore` resserré** : `/public/game-data/*` → seulement `tiles/ hd_maps/ items/ defis/ titans/`. Les **474 fichiers curés (20,85 Mo)** sont désormais **versionnés sans ambiguïté** ; 2 fichiers curés invisibles redeviennent committables (`dungeons/gardiens-des-anomalies.webp`, `ignored-bounties.json`) | `git ls-files -i -c --exclude-standard` = **vide** |
| **D12** | **`src/temp/` vidé et supprimé** (chantier 136 Ko + `debug.md` + kit `refonte_landing/` 47 fichiers archivés). La **règle** de la zone devient `docs/agents/zone-volatile.md` (versionnée) et les « demandes ouvertes » n'ont plus qu'une source : `docs/ROADMAP.md` (~12 documents réécrits) | `A:\SigilOS--menage-2026-09-20\lot4-src-temp\` |
| **D13** | **`prometheus.yml` unifié** : doublon `prometheus/` supprimé, `docker-compose.yml:192` pointe sur `monitoring/prometheus/prometheus.yml` (dev **et** prod) | `git diff docker-compose.yml` |
| **D14** | **Rotation d'`activeContext.md`** : 38 blocs / 111 Ko → **6 sessions / 29 Ko**, règle de rotation écrite en tête, 26 blocs archivés | `A:\SigilOS--menage-2026-09-20\lot6-activeContext\` |
| **D15** | **690 Mo récupérés sur le poste** : `.next/` (609 Mo) et `tsconfig.tsbuildinfo` supprimés (régénérés au build), `backups/` (18,2 Mo) archivé hors dépôt | `Test-Path` = faux |
| **D16** | **`.git` mesuré : 3,33 Go** ; simulation de `_git-purge.ps1` jouée → **9 refs `refs/cline/checkpoints/**` + ~42 000 blobs inatteignables ≈ 2,3 Go récupérables**. `-Apply` exige un arbre **propre** → à lancer **après le commit** (le script sauvegarde `.git` avant d'agir) | sortie de la simulation |

| **D17** | **`README.md` devenu une vitrine publique** (0 détail technique : produit, 4 captures réelles, liens site/bêta, licence) — le contenu technique a été repris dans **`docs/DEVELOPPEMENT.md`** (prérequis, rôle des 3 `.env`, démarrage, commandes npm, hook pre-commit, déploiement, dépannage) | `git diff README.md docs/DEVELOPPEMENT.md` |
| **D18** | **`tailwind.config.ts` supprimé** : mort depuis Tailwind v4 (*CSS-first* — jamais lu, ni par `postcss.config.mjs`, ni par un `@config`) ; la seule animation utilisée (`animate-pulse-slow`) est définie dans `src/app/globals.css` | `git show 2bd21ccba:tailwind.config.ts` |
| **D19** | **3 fichiers `.env` clarifiés et documentés** : `.env.example` (modèle versionné), `.env` (config locale de l'app), `.env.local` (**config locale d'exploitation** : `VPS_*`, `MAINTENANCE_MODE` — lu par `scripts/sync-assets.*`, `check-dofusbook-relay.mjs`, `backfill-changelog-en.mjs`) + suppression du **doublon** `DOFUSBOOK_CF_WORKER_URL` (même valeur dans `.env`, mais `.env.local` gagnait en silence) | `docs/DEVELOPPEMENT.md` §2 |

| **D20** | **Alignement DevSecOps + docs de sécurité** (audit vérifié via l'API GitHub le 20/09/2026) : `docs/SECURITY.md` restructuré aux standards (canal de **signalement privé GitHub** — activé sur le dépôt, périmètre, référentiels OWASP ASVS / OpenSSF Scorecard / GitHub / NIST, tableau **« ce qui est activé »**, tableau **« écarts connus »** honnête) · table de rotation des secrets corrigée (les noms étaient faux : `NEXTAUTH_SECRET` n'existe pas, c'est `AUTH_SECRET`) · en-têtes HTTP documentés exactement · `X-XSS-Protection: 1; mode=block` **retiré** (en-tête obsolète/non standard pouvant introduire des XSS — MDN) · **`dorny/paths-filter` épinglée par SHA** (dernière action tierce non épinglée) · `docs/RULES.md` : nouvelle section **« Sécurité de la chaîne d'outils (dépôt, CI/CD, dépendances) »** · **`.github/CODEOWNERS`** créé (surface sensible) | `gh api repos/Klyx04/SigilOS{,/rulesets}`, `git diff` |

### ⏳ Reste à faire (ordre conseillé)

| # | Sujet | Méthode |
|---|---|---|
| **1** | **`.git` = 3,31 GiB** (~2,3 Go récupérables : refs de checkpoints) | `powershell -NoProfile -ExecutionPolicy Bypass -File A:\SigilOS--menage-2026-09-20\lot2-menage\_menage-2026-09-13\_git-purge.ps1` (**simulation** par défaut) → `-Apply` **après sauvegarde complète de `.git`**. ⚠️ **irréversible** (le kit de ménage a été archivé hors dépôt le 20/09) |
| **2** | ~~`public/uploads/{guides,docs,guilds}` : 636 fichiers suivis = ancien système d'upload~~ | ✅ **fait le 20/09 (D10)** — vérifié en base : **0 référence** (kit : `lot3-outils/where-uploads-point.sql`) |
| **3** | ~~`public/game-data` : 474 fichiers suivis alors que `.gitignore` les ignore~~ | ✅ **fait le 20/09 (D11)** — **versionnés** (assets curés, 20,85 Mo) ; la règle ne couvre plus que le généré |
| **4** | ~~`activeContext.md` : journal qui grossit sans fin~~ | ✅ **fait le 20/09 (D14)** — rotation à **6 sessions**, 111 Ko → 29 Ko, règle écrite en tête |
| **5** | ~~Deux `prometheus.yml` identiques (dev + prod)~~ | ✅ **fait le 20/09 (D13)** — un seul fichier (`monitoring/prometheus/`), les 2 compose pointent dessus |
| **6** | ~~`src/temp/refonte_landing/` (47 fichiers)~~ | ✅ **fait le 20/09 (D12)** — tout `src/temp/` archivé hors dépôt ; la règle de la zone vit dans `docs/agents/zone-volatile.md` |
| **7** | `scratch/_tunnel.log` | Verrouillé par un tunnel `ssh` → `Remove-Item -LiteralPath 'A:\SigilOS\scratch' -Recurse -Force` après fermeture |
| **8** | **Merger la PR #688** | Après relecture (volume supprimé important, risque faible : docs, détrackages, outils) |

### 📌 Fichiers de référence produits
- `docs/arbo/CARTE-DU-PROJET.md` — la carte du projet + méthode « ce fichier sert-il encore ? » (§0).
- `docs/arbo/ARCHIVES-TEMP-2026-09.md` — où est passé `src/temp`, et comment lire une référence devenue un nom nu.
- `docs/agents/zone-volatile.md` — la règle de la zone volatile (promue depuis `src/temp/README.md` le 20/09).
- `_menage-2026-09-19/` — manifeste des branches supprimées, scripts de ménage, `lot*-` archivés.
  **Archivé hors dépôt le 20/09/2026** → `A:\SigilOS--menage-2026-09-20\lot2-menage\_menage-2026-09-19\`.

---

## 1. Vue d'ensemble

| Dossier | Fichiers suivis | Poids disque | Verdict |
|---|---|---|---|
| `public/` | 2 303 | 2,4 Go | ✅ légitime (assets + `game-data` servis à l'exécution) |
| `src/` | 1 246 | 18,6 Mo | ✅ légitime |
| `prisma/` | 304 | 2,4 Mo | ⚠️ 2 fichiers **compilés** suivis (`seed.js`, `seed_simple.js`) |
| `tests/` | 162 | 1,3 Mo | ✅ |
| `scripts/` | 84 | 0,7 Mo | ⚠️ mélange **one-shot livrés** / **outils vivants** |
| racine | 34 | — | ⚠️ 8 `.md` + 2 artefacts (`dist/`) |
| `docs/agents/` | 13 | 0,2 Mo | ⚠️ 12 `.md` de workflow (dont `docs/agents/activeContext.md` = journal de session) |
| `docs/` | 12 | 0,4 Mo | ✅ (les 6 fichiers d'`docs/audits/` restent **non suivis**, conformément à `AGENTS.md` §3) |
| `services/` | 7 | 117 Mo (dont `node_modules` du bot) | ⚠️ `dist/index.js` compilé suivi |
| `cloudflare-workers/` | 7 | 0,3 Mo | ⚠️ 1 fichier de **cache** wrangler suivi |
| `private_uploads/` | 5 | 1,1 Mo | 🔴 **données d'exécution** suivies |
| `dist/` | 2 | 0,7 Mo | 🔴 artefacts régénérés par Docker |
| `backups/` | 2 | 18,2 Mo | 🔴 artefacts locaux suivis |
| `.gemini/` | 3 | 0 Mo | 🔴 brouillons d'agent (`scratch/*.py`) suivis |
| `.github/` `.husky/` `monitoring/` `prometheus/` | 3 / 1 / 1 / 1 | — | ✅ |

---

## 2. Problèmes trouvés

### 🔴 P1 — Artefacts générés suivis par git

| Fichier suivi | Généré par | Déjà ignoré ? |
|---|---|---|
| `dist/worker.js`, `dist/ws-server.js` | `npm run build:worker` / `build:ws` (**aussi rejoués par le `Dockerfile`**) | ❌ non |
| `services/discord-bot/dist/index.js` | build du bot (rejoué au déploiement) | ❌ non |
| `prisma/seed.js`, `prisma/seed_simple.js` | `npm run build:seeds` | ❌ non |
| `scripts/database-janitor.js` | `npm run build:maintenance` | ❌ non |
| `scripts/siphon-guide-images.js` | `npm run build:siphon` | ❌ non |
| `cloudflare-workers/dofus-ladder-proxy/.wrangler/cache/cf.json` | wrangler (cache local) | ❌ non |

**Incohérence à corriger** : `.gitignore` ignore déjà `prisma/seed-docs.js` et `prisma/seed-data/*.js`,
donc leurs jumeaux ci-dessus devraient l'être aussi.
**Correctif** : `git rm --cached` (le fichier reste sur disque) + règles `.gitignore`. Coût : un rebuild.

### 🔴 P1 — Données d'exécution suivies

- `private_uploads/guilds/cmmpogjp80001bgogcqgg8six/*.webp` (3) → **guilde de développement locale**.
- `private_uploads/docs/*.webp` (2).
- `backups/game-data-backup-2026-02-20.json`, `backups/exemples/exemple-suivi-quetes.png` (le dossier est
  déjà ignoré, ces 2 fichiers datent d'avant la règle — même schéma que la PR #638 pour `guide_backup.sql`).

### 🟠 P2 — `.playwright-profile/` : **87,5 Mo / 915 fichiers** à la racine

Profil navigateur Playwright (ignoré par git ✅). Se recrée avec
`node scripts/capture-landing-visuels.mjs --login` (une seule connexion Discord partagée avec
`capture-screenshots.mjs`). Candidat à la poubelle ; à garder seulement si on relance des captures bientôt.

### 🟠 P2 — Racine : 8 fichiers `.md`

| Fichier | Rôle réel | Proposition |
|---|---|---|
| `README.md` | vitrine + démarrage | **garder** |
| `docs/CONTEXT.md` | point d'entrée technique (condensé) | **garder** |
| `docs/RULES.md` | conventions + règles de sécurité non négociables | **garder** |
| `docs/SECURITY.md` | politique de sécurité (convention GitHub) | **garder** |
| `docs/agents/PROMPT_START.md` | ~~amorce de session (lu par les agents)~~ | ✅ **supprimé le 20/09/2026** — remplacé par **`AGENTS.md`** (racine, lu automatiquement), qui le remplace sans le dupliquer |
| `WORKFLOW.md` | process git | **fusionner dans `docs/RULES.md`** (2 Ko) |
| `docs/MAINTENANCE.md` | exploitation/ops (50 Ko) | **déplacer dans `docs/`** |
| `USER_ACTIONS_REQUIRED.md` | actions attendues du propriétaire | **vérifier la fraîcheur** puis archiver si périmé |

### 🟠 P2 — `scripts/` : 84 fichiers, on ne sait pas lesquels sont vivants

Critère proposé : un script est **vivant** s'il est cité par `package.json`, `docs/`, `docs/MAINTENANCE.md`,
le code ou une procédure d'ops. Sinon c'est un **one-shot déjà livré** (seed/siphon/backfill d'un chantier
terminé) → archive externe.

### 🟡 P3 — Divers

- `_menage-2026-09-13/`, `_menage-2026-09-17/`, `_menage-2026-09-19/` — rapports de ménage : **archivés hors dépôt
  le 20/09/2026** (`A:\SigilOS--menage-2026-09-20\lot2-menage\`) — la racine est propre.
- `scratch/` — 2 fichiers verrouillés par un tunnel `ssh` en cours (`_tunnel.log`).
- `tsconfig.tsbuildinfo` — présent sur disque, **non suivi** ✅ (déjà dans `.gitignore`).

---

## 3. Plan de nettoyage proposé (par lots, du plus sûr au plus sensible)

| Lot | Contenu | Risque | Vérification | État |
|---|---|---|---|---|
| **L1** | Détracker les artefacts générés (P1) + règles `.gitignore` | faible | `npm run build` repasse, Dockerfile inchangé | ✅ **fait le 19/09** (8 fichiers + règles) |
| **L2** | Détracker les données d'exécution (`private_uploads`, `backups`) | faible | aucun code ne lit ces chemins en dur | ✅ **fait le 19/09** (7 fichiers) |
| **L3** | `.playwright-profile/` supprimé (87,5 Mo) | nul | se recrée via `--login` | ⏳ à faire |
| **L4** | Racine : fusionner `WORKFLOW.md` → `docs/RULES.md`, déplacer `docs/MAINTENANCE.md` → `docs/`, archiver `USER_ACTIONS_REQUIRED.md` si périmé | faible | corriger les liens citants | ✅ **fait le 19/09** — `WORKFLOW.md` (doublon exact de `docs/RULES.md §Git Workflow`, 0 citation) **supprimé**, `USER_ACTIONS_REQUIRED.md` (0 citation) **supprimé** ; `docs/MAINTENANCE.md` **reste à la racine** (20 citations dont du code) |
| **L5** | `scripts/` : tri one-shot vs vivants, archive des one-shot | moyen | vérifier les citations avant chaque suppression | ⏳ à faire |
| **L6** | `src/temp` : sort du kit de mesure `refonte_landing/` (le versionner dans `scripts/` ou l'archiver) | faible | sa propre règle dit « ne pas supprimer » → décision explicite | ⏳ décision |
| **L7** | `.git` : 3,43 Go dont ≈ 2,3 Go récupérables (refs de checkpoints) — outil `_git-purge.ps1` prêt | **irréversible** | sauvegarde complète de `.git` obligatoire, hors chantier actif | ⏳ à faire |

**Bilan racine après L1/L2/L4** : 6 `.md` (README, CONTEXT, RULES, SECURITY, PROMPT_START, MAINTENANCE)
au lieu de 8, plus aucun fichier généré ni donnée d'exécution suivi par git.

---

## 4. Journal des suppressions — 19/09/2026 (tout est archivé ou dans git)

| Élément retiré | Motif | Récupération |
|---|---|---|
| `WORKFLOW.md` | Doublon exact de `docs/RULES.md §Git Workflow`, **0 citation** | `git log -- WORKFLOW.md` |
| `USER_ACTIONS_REQUIRED.md` | Checklist de mise en prod one-shot, **0 citation** | `git log` |
| 13 fichiers générés / données d'exécution | Détrackés (restent sur disque) | rien à faire |
| `.playwright-profile/` (**87,5 Mo**) | Profil navigateur de test | se recrée : `node scripts/capture-landing-visuels.mjs --login` |
| `docs/game-data-workflow.md` | Obsolète — remplacé par `prisma/seed-data/README.md` | archive `lot5-arbo/` |
| `docs/guide-sigil-draw.md` | Spécification du mini-jeu **livré** | archive `lot5-arbo/` |
| `prisma/seeds/game-data.json` | **Doublon mort** — le fichier vivant est `prisma/seed-data/game-data.json` (utilisé par `deploy.sh`) | archive `lot5-arbo/` |
| `prisma/clear.ts`, `clear-dj-posts.sql`, `add-new-creators.ts`, `seed-example.md`, `seed-data-examples.sql` | Outils one-shot, **0 citation** | archive `lot5-arbo/` |
| `src/temp/**` (583 → 50 fichiers) | Zone volatile : 148 références nettoyées, 8 outils one-shot supprimés | `A:\SigilOS--temp-archive-2026-09-19\lot4-src-temp-avant-vidage\` |
| Branches git : 24 locales + 28 distantes | Toutes vérifiées `PR MERGED` + contenu présent dans `dev` | `_menage-2026-09-19/branches-supprimees-2026-09-19.txt` (nom + SHA) |
| `.next/` (**43,6 Go**) | Cache de build | se reconstruit |
| `scripts/` : **19 outils one-shot** jamais cités (5 backfills bosses, 12 seeds de modules livrés, 2 doublons) | Leur travail est terminé (données en BDD + `prisma/seed-data/`) | `git show <sha>:scripts/<nom>` (supprimés du disque **et** de git) |

### Conservés volontairement (vérifiés comme vivants)
- `docs/reference/OCR_STRATEGY_2026.md` + `docs/reference/REDIS-OCR-SETUP.md` → l'OCR **existe** (`src/lib/llm-ocr.ts`, ~570 lignes,
  via LLM vision) ;
- `docs/plans/PLAN-REFONTE-ONBOARDING.md` → référence active du chantier onboarding en cours ;
- `docs/MAINTENANCE.md` → cité 20× dont dans du code (`src/app/api/cron/avatar-resync/route.ts`, `scripts/deploy-cd.sh`).


