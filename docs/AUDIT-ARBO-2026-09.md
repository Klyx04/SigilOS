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

### ✅ Fait

| Lot | Contenu | Preuve / récupération |
|---|---|---|
| **L1/L2** | 13 fichiers **générés** + **données d'exécution** détrackés : `dist/*.js`, `prisma/seed.js`, `seed_simple.js`, `scripts/database-janitor.js`, `siphon-guide-images.js`, `seed-v3-compiled.js`, `services/discord-bot/dist/index.js`, cache `.wrangler/`, 3 `.py` d'agent, `private_uploads/**`, `backups/**` — + règles `.gitignore` | `git ls-files -i -c --exclude-standard` → **0** (hors `public/game-data`) |
| **L3** | `.playwright-profile/` supprimé (**87,5 Mo**) | se recrée : `node scripts/capture-landing-visuels.mjs --login` |
| **L4** | Racine **8 → 6 `.md`** : `WORKFLOW.md` (doublon de `RULES.md §Git Workflow`, 0 citation) et `USER_ACTIONS_REQUIRED.md` (0 citation) supprimés ; `MAINTENANCE.md` **conservé** (cité 20× dont dans du code) | `git log -- <fichier>` |
| **L5** | `scripts/` **93 → 76** : 19 one-shot jamais cités retirés. **Pièges conservés** : `bounties.json` (importé par `src/lib/bounty-ignore.ts`), `capture-landing-visuels.mjs` (`MAINTENANCE.md` + code), `siphon-guide-images.ts` (`npm run build:siphon`), `seed-dofus-quests.ts` (chargeur de 30 JSON maintenus) | `git show <sha>:scripts/<nom>` |
| — | `src/temp` : **583 → 50 fichiers**, **148 références** nettoyées dans 28 fichiers, 8 outils Rush supprimés, 4 outils promus dans `scripts/` | `docs/ARCHIVES-TEMP-2026-09.md` |
| — | `src/scripts/` vidé (ses 2 outils sont dans `scripts/`) | — |
| — | Branches : **34 → 3** (`dev`, `main`, `feat/inter-guilde`) + 28 branches GitHub supprimées | `_menage-2026-09-19/branches-supprimees-2026-09-19.txt` (nom + SHA) |
| — | `.next/` supprimé (**43,6 Go**) · `docs/` 15 → 13 | se reconstruit |

**Vérifications** : `tsc --noEmit` **0 erreur** · `eslint .` **0 erreur** · `npm run test:run` **1722 tests / 161 fichiers** · `node scripts/scan-mojibake-all.mjs` → **0 fichier**.

### ⏳ Reste à faire (ordre conseillé)

| # | Sujet | Méthode |
|---|---|---|
| **1** | **`.git` = 3,43 Go** (~2,3 Go récupérables : refs de checkpoints) | `powershell -NoProfile -ExecutionPolicy Bypass -File A:\SigilOS\_menage-2026-09-13\_git-purge.ps1` (**simulation** par défaut) → `-Apply` **après sauvegarde complète de `.git`**. ⚠️ **irréversible** |
| **2** | `public/uploads/{guides,docs,guilds,proofs}` : **636 fichiers suivis (~20 Mo)** = **ancien** système d'upload | Vérifier en base qu'aucune ligne ne pointe sur ces chemins (cf. `scripts/migrate-uploads.mjs`), puis archiver |
| **3** | `public/game-data` : **473 fichiers suivis ALORS QUE `.gitignore` les ignore** | Trancher : versionner (retirer la règle) **ou** détracker — servis en prod par bind mount `./public/game-data` (`docker-compose.prod.yml`) |
| **4** | `.agents/workflows/activeContext.md` (**77 Ko**, journal qui grossit sans fin) | Écrire une règle de rotation (N dernières sessions + archive) |
| **5** | `prometheus/prometheus.yml` (dev, `docker-compose.yml:192`) vs `monitoring/prometheus/prometheus.yml` (prod, `docker-compose.prod.yml:367`) | Unifier + adapter les 2 compose |
| **6** | `src/temp/refonte_landing/` (**47 fichiers**, kit de mesure, règle « ne pas supprimer : un fixe = une mesure ») | Versionner dans `scripts/landing/` **ou** archiver — décision explicite |
| **7** | `scratch/_tunnel.log` | Verrouillé par un tunnel `ssh` → `Remove-Item -LiteralPath 'A:\SigilOS\scratch' -Recurse -Force` après fermeture |
| **8** | **Merger la PR #688** | Après relecture (volume supprimé important, risque faible : docs, détrackages, outils) |

### 📌 Fichiers de référence produits
- `docs/CARTE-DU-PROJET.md` — la carte du projet + méthode « ce fichier sert-il encore ? » (§0).
- `docs/ARCHIVES-TEMP-2026-09.md` — où est passé `src/temp`, et comment lire une référence devenue un nom nu.
- `src/temp/README.md` — la règle de la zone volatile (+ journal de purge §8).
- `_menage-2026-09-19/` — manifeste des branches supprimées, scripts de ménage, `lot*-` archivés.

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
| `.agents/` | 13 | 0,2 Mo | ⚠️ 12 `.md` de workflow (dont `activeContext.md` = journal de session) |
| `docs/` | 12 | 0,4 Mo | ✅ (les 6 fichiers d'`docs/audits/` restent **non suivis**, conformément à `PROMPT_START.md`) |
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
| `CONTEXT.md` | point d'entrée technique (condensé) | **garder** |
| `RULES.md` | conventions + règles de sécurité non négociables | **garder** |
| `SECURITY.md` | politique de sécurité (convention GitHub) | **garder** |
| `PROMPT_START.md` | amorce de session (lu par les agents) | **garder** (raccourcir) |
| `WORKFLOW.md` | process git | **fusionner dans `RULES.md`** (2 Ko) |
| `MAINTENANCE.md` | exploitation/ops (50 Ko) | **déplacer dans `docs/`** |
| `USER_ACTIONS_REQUIRED.md` | actions attendues du propriétaire | **vérifier la fraîcheur** puis archiver si périmé |

### 🟠 P2 — `scripts/` : 84 fichiers, on ne sait pas lesquels sont vivants

Critère proposé : un script est **vivant** s'il est cité par `package.json`, `docs/`, `MAINTENANCE.md`,
le code ou une procédure d'ops. Sinon c'est un **one-shot déjà livré** (seed/siphon/backfill d'un chantier
terminé) → archive externe.

### 🟡 P3 — Divers

- `_menage-2026-09-13/`, `_menage-2026-09-17/`, `_menage-2026-09-19/` — rapports de ménage (ignorés).
- `scratch/` — 2 fichiers verrouillés par un tunnel `ssh` en cours (`_tunnel.log`).
- `tsconfig.tsbuildinfo` — présent sur disque, **non suivi** ✅ (déjà dans `.gitignore`).

---

## 3. Plan de nettoyage proposé (par lots, du plus sûr au plus sensible)

| Lot | Contenu | Risque | Vérification | État |
|---|---|---|---|---|
| **L1** | Détracker les artefacts générés (P1) + règles `.gitignore` | faible | `npm run build` repasse, Dockerfile inchangé | ✅ **fait le 19/09** (8 fichiers + règles) |
| **L2** | Détracker les données d'exécution (`private_uploads`, `backups`) | faible | aucun code ne lit ces chemins en dur | ✅ **fait le 19/09** (7 fichiers) |
| **L3** | `.playwright-profile/` supprimé (87,5 Mo) | nul | se recrée via `--login` | ⏳ à faire |
| **L4** | Racine : fusionner `WORKFLOW.md` → `RULES.md`, déplacer `MAINTENANCE.md` → `docs/`, archiver `USER_ACTIONS_REQUIRED.md` si périmé | faible | corriger les liens citants | ✅ **fait le 19/09** — `WORKFLOW.md` (doublon exact de `RULES.md §Git Workflow`, 0 citation) **supprimé**, `USER_ACTIONS_REQUIRED.md` (0 citation) **supprimé** ; `MAINTENANCE.md` **reste à la racine** (20 citations dont du code) |
| **L5** | `scripts/` : tri one-shot vs vivants, archive des one-shot | moyen | vérifier les citations avant chaque suppression | ⏳ à faire |
| **L6** | `src/temp` : sort du kit de mesure `refonte_landing/` (le versionner dans `scripts/` ou l'archiver) | faible | sa propre règle dit « ne pas supprimer » → décision explicite | ⏳ décision |
| **L7** | `.git` : 3,43 Go dont ≈ 2,3 Go récupérables (refs de checkpoints) — outil `_git-purge.ps1` prêt | **irréversible** | sauvegarde complète de `.git` obligatoire, hors chantier actif | ⏳ à faire |

**Bilan racine après L1/L2/L4** : 6 `.md` (README, CONTEXT, RULES, SECURITY, PROMPT_START, MAINTENANCE)
au lieu de 8, plus aucun fichier généré ni donnée d'exécution suivi par git.

---

## 4. Journal des suppressions — 19/09/2026 (tout est archivé ou dans git)

| Élément retiré | Motif | Récupération |
|---|---|---|
| `WORKFLOW.md` | Doublon exact de `RULES.md §Git Workflow`, **0 citation** | `git log -- WORKFLOW.md` |
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
- `docs/OCR_STRATEGY_2026.md` + `docs/REDIS-OCR-SETUP.md` → l'OCR **existe** (`src/lib/llm-ocr.ts`, ~570 lignes,
  via LLM vision) ;
- `docs/PLAN-REFONTE-ONBOARDING.md` → référence active du chantier onboarding en cours ;
- `MAINTENANCE.md` → cité 20× dont dans du code (`src/app/api/cron/avatar-resync/route.ts`, `scripts/deploy-cd.sh`).


