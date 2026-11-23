---
description: Harnais agentique — règles de zone, skills, garde-fous OpenCode, mesures et hygiène de contexte
---

# 🧰 Harnais agentique — comment on travaille avec les assistants IA

> **Rôle.** Cette page décrit l'outillage qui encadre les assistants (Cline, OpenCode, Cursor, Copilot,
> Codex, Gemini CLI…) : ce qui est **toujours chargé**, ce qui se charge **à la demande**, ce qui s'exécute
> **sans LLM**, et ce qui reste **local**. Elle ne remplace ni `AGENTS.md` (le contrat) ni
> `docs/ROADMAP.md` (le backlog et l'ordre).
>
> **Dépôt public.** Aucun secret, aucun ID Discord, aucun chemin machine, aucune capture du poste.
> Les réglages personnels (`.vscode/`) ne sont pas versionnés.
## 0. Amorce de session — le prompt à coller (générique)

> **But** : ne plus écrire « fais le lot X » dans le premier message. L'agent lit **l'ordre** dans
> `ROADMAP.md`, pas une consigne inventée. Une seule amorce, valable pour **tous** les chantiers.

```text
Reprise SigilOS.

Lis, dans cet ordre :
1. AGENTS.md (en entier).
2. docs/ROADMAP.md : §0 « Reprise immédiate » (il dit le lot courant), puis — si §0 ne tranche pas —
   la ligne du premier rang **non livré et non bloqué** des tables §1 → §2 → §3.
3. docs/agents/activeContext.md : en-tête + les blocs qui concernent ce rang (jamais tout).
4. Les plans durables cités par cette ligne (docs/plans/…).

Ensuite, avant d'écrire du code :
- mesure l'état réel (git log/status, base en lecture seule, grep) ;
- réponds en 10 lignes : lot visé, déjà fait, manquant, fichiers, tests, migration oui/non ;
- si une migration est nécessaire, arrête-toi et demande mon accord.

Règles : 1 lot = 1 branche = 1 PR → dev · aucun fichier d'état nouveau · docs mises à jour là où
elles vivent · `npm run test:run` + `npx tsc --noEmit` + `npm run lint` verts · `git status --short`
propre à la fin.
Si le rang est déjà livré (vérifie §5), prends le suivant sans me demander.
```

**Pourquoi ça marche** : l'ordre ne dépend pas de la mémoire de l'agent, il est **dans le fichier** ;
« premier rang non livré » est vérifiable ; la mesure obligatoire et l'arrêt sur migration sont les deux
garde-fous qui ont évité le plus d'erreurs. **Ce qu'elle ne dit pas** : aucun nom de chantier, aucune
liste de fichiers — sinon l'amorce devient une deuxième feuille de route, qui se périme au premier merge.

**Cas particulier (reprise d'un sujet déjà ouvert)** : ajouter **une** ligne, « on reprend `<chantier>` »,
et rien d'autre. Si le rang et le sujet divergent, c'est le sujet qui gagne — mais il faut alors le dire.

## 1. Les quatre briques (et leur coût réel)

| Brique | Quand elle est chargée | Coût | À quoi elle sert ici |
|---|---|---|---|
| **Rules** | **Toujours**, à chaque message | Permanent | Les invariants : sécurité, conventions, hygiène |
| **Skills** | **À la demande** (métadonnées ~1 000 tokens au démarrage pour 12 skills) | Quasi nul au repos | Les procédures répétitives (PR, migration, cron, Sentry) |
| **Garde-fous** | Sur chaque action, **sans LLM** (`opencode.json` → `permissions`) | **0 token** | Bloquer les secrets et les gestes irréversibles (bloquer, demander) |
| **Workflows** | Dépréciés (ex-Cline) | — | **Ne pas utiliser** : migrer en Skills |

Les règles de zone vivent dans `docs/agents/rules/` ; leur frontmatter `paths:` documente la zone, et
OpenCode y accède par le routage de `AGENTS.md` et des `AGENTS.md` de zone (§12).

La règle qui gouverne tout : **ce qui est lu à chaque session doit rester petit** ; ce qui est gros vit
en archive et ne s'ouvre qu'à la demande.

## 2. Baseline mesurée le 19/10/2026 (avant ce lot)

| Élément | Mesure |
|---|---|
| `docs/ROADMAP.md` | **814 Ko** · 2 203 lignes · **171 blocs de session** · 335 mentions « Reste » |
| `docs/` versionnable (hors audits) | 55 `.md` · **1 597 Ko**, dont 443 Ko de plans (25 fichiers) |
| `public/` | **39 999 fichiers** · **2,2 Go** (assets de jeu, majoritairement binaires) |
| `temp/` (racine) | 41 fichiers · 2,8 Mo — **seconde** zone volatile |
| `src/temp/` | 18 fichiers · 0,2 Mo — zone documentée |
| Skills / hooks / règles conditionnelles / `.clineignore` | **0 / 0 / 0 / 0** |
| Budget d'amorçage | **≈ 825 Ko ≈ 200 000 tokens** avant le premier token utile |

Commandes de re-mesure (lecture seule) :

```powershell
(Get-Item docs/ROADMAP.md).Length
(Get-ChildItem docs -Recurse -File -Filter *.md | Where-Object { $_.FullName -notmatch '\\audits\\' } | Measure-Object Length -Sum).Sum
(Get-ChildItem public -Recurse -File | Measure-Object Length -Sum).Sum
(Get-ChildItem temp -Recurse -File | Measure-Object).Count
```

## 3. Architecture cible

```text
AGENTS.md                         contrat court, lu automatiquement (~13 Ko)
docs/agents/rules/
├── 01-server.md                  règles serveur (paths: src/server/**, src/app/api/**…)
├── 02-ui.md                      règles UI (paths: src/components/**, src/app/**/*.tsx)
├── 03-tests.md                   règles tests (paths: tests/**)
├── 04-docs.md                    règles doc (paths: docs/**, AGENTS.md)
├── 05-runtime.md                 règles runtime Node (paths: .nvmrc, package.json, Dockerfile*, workflows)
├── 06-discord.md                 règles Discord (paths: src/app/api/discord/**, src/server/discord.ts, tickets…)
└── 07-vps.md                     règles VPS (paths: scripts/agent-ro.sh, docs VPS)
.agents/skills/                   12 skills (voir §5) — source unique versionnée
opencode.json                     adaptateur OpenCode : skills, permissions, watcher, worktree, MCP
scripts/harness-links.mjs         lien local .claude/skills (portabilité)
.opencode/commands/
├── reprise.md                    SHA + amorce de session
└── fin.md                        Definition of Done
.opencode/agents/
└── reviewer.md                   sous-agent read-only (délégation)
src/AGENTS.md                     routeur de zone (server, UI, Discord)
tests/AGENTS.md                   routeur de zone (tests)
docs/AGENTS.md                    routeur de zone (docs)
services/AGENTS.md                routeur de zone (bot Discord, runtime)

Mémoire chaude   : docs/ROADMAP.md (~200 lignes) + activeContext.md (6 blocs)
Mémoire froide   : docs/agents/journal-sessions-2026.md + docs/agents/archive/**
Mémoire volatile : src/temp/ (UNE seule zone, gitignorée)
```

## 4. Versionné ou local ?

| Versionné (public) | Local (jamais poussé) |
|---|---|
| `AGENTS.md`, `AGENTS.md` de zone, `docs/agents/rules/**`, `.agents/skills/**`, `opencode.json`, `.opencode/commands/**`, `.opencode/agents/**`, `scripts/harness-links.mjs` | `.vscode/settings.json` (préférences éditeur) |
| `docs/agents/harnais.md`, `docs/ROADMAP.md`, journal et archives | lien `.claude/skills` ; `.claude/settings.local.json`, `.claude/commands/`, `.claude/agents/` |
| `opencode.json` : les garde-fous se relisent en PR comme du code | `docs/audits/`, `src/temp/`, `.env*`, artefacts de build |

Un garde-fou est du **code de configuration** : il se relit en PR, il ne contient aucun secret, et un
test vérifie que chaque geste dangereux y est couvert.

## 5. Skills — les procédures qui ne se réexpliquent plus

| Skill | Se déclenche quand… | Remplace |
|---|---|---|
| `lot-pr` | « implémente le lot X », « fais la PR » | la procédure de branche → tests → PR → merge |
| `prisma-change` | un changement touche `schema.prisma` / une migration | la procédure avec **arrêt obligatoire** |
| `cron-task` | ajouter/modifier une tâche cron | route + télémétrie + `maintenance.sh` |
| `sentry-triage` | « erreur Sentry », « 500 en prod », « régression » | le tri manuel via MCP |
| `route-securite` | nouvelle page/action, revue de code | la checklist auth / `guildId` / Zod / fail-closed |
| `doc-session` | fin de session | ROADMAP + activeContext sans doublon |
| `node-runtime` | avis de sécurité Node, conteneur plus vieux que `.nvmrc` | la procédure `.nvmrc` → images → rebuild bêta/prod |
| `discord-api` | toute nouveauté/modif/suppression côté Discord (commande, permission, salon, bouton, modale, intent) | la vérification doc officielle + types installés + `GET` de mesure **avant** de coder |
| `sigilos-da-wakfu` | tout habillage visuel du Rush (overlay, guide public, guide membre), puis passation au dashboard | la DA « Gouache Wakfu » : tokens `--da-*`, signatures, contraste, coût de rendu, règle « habillage seul » |
| `responsive` | toute UI, layout, page, composant, classe Tailwind ou bug d'affichage mobile/tablette/desktop | `.agents/skills/responsive/` — les 8 règles non négociables (mobile-first, aucune largeur fixe, `svh`/`dvh`, reflow à 320 px) **et** la vérification obligatoire 390 / 768 / 1 024 / 1 440 + zoom 200 % ; cliquet `tests/unit/responsive-guard.test.ts` |
| `metamob-api` | tout appel Metamob (routes, schémas Zod, échanges, propositions) | la vérification de la doc officielle + `scripts/check-metamob-api.mjs` |
| `vps-ops` | toute écriture VPS (dump, archive Rush, suppression, vérification) | le conteneur `ops-*`, le dry-run avant `--apply`, la sauvegarde et la preuve avant/après |

Emplacement : **`.agents/skills/<nom>/SKILL.md`** (versionné). Le `name` doit être **identique au nom du
dossier** ; la `description` (≤ 1 024 caractères) est ce qui déclenche le skill. Un skill global du même
nom **écrase** le skill projet : on garde donc tout dans le dépôt.

⚠️ **Piège mesuré le 05/11/2026** : la `description` est un **scalaire YAML non cité**, elle ne peut donc
contenir **aucun `": "`** (deux-points + espace). Un seul suffit à casser le parseur, et le skill
**disparaît du panneau de l'hôte sans message d'erreur** — c'est arrivé à `sentry-triage` (écrit en octobre,
jamais chargé) et à `sigilos-da-wakfu`. Utiliser un tiret cadratin `—`. Verrou :
`tests/unit/harness-config.test.ts` (une valeur citée `"…"` reste autorisée).

## 6. Garde-fous — ce que l'agent ne peut pas faire

Les garde-fous sont **déterministes** et vivent dans `opencode.json` → `permissions` : aucune
interprétation, aucun LLM. Deux niveaux :

- **`deny`** — l'action n'est pas exécutée : **lecture et écriture** d'un `.env` (outil de lecture/édition
  **et** commandes `Get-Content` / `cat` / `grep` / `Set-Content` / `Out-File` / `Add-Content` / `>`),
  dossiers de credentials (`~/.ssh`, `~/.aws`, `~/.config/gh`, `~/.config/opencode`, `~/.kube`),
  `--no-verify`, `git push --force` / `-f` ;
- **`ask`** — l'action attend un accord explicite : migration Prisma (`migrations/`, `migrate dev`,
  `migrate reset`, `db push`), `git reset --hard`, `drop database`, `rm -rf`, `Remove-Item -Recurse`,
  **toute sortie du projet** (`external_directory`) ;
- **`allow`** — un seul cas : `.env.example`, en lecture comme en écriture (le contrat des noms, jamais
  les valeurs).

Le test ne se contente pas de vérifier la présence des règles : il rejoue une **matrice de commandes**
réelles (`Set-Content .env foo`, `echo x >> .env.local`, `git push -f`, …) avec la sémantique d'OpenCode
(dernière règle qui matche). Retirer une ligne de cette table fait échouer la CI.

Limite connue : les motifs shell sont une **liste de verbes** (`Get-Content`, `cat`, `grep`…), pas une
barrière système ; un agent déterminé peut lire autrement (`node -e …`). Le bac à sable reste le vrai
correctif (WSL2 / conteneur). Mesure du 23/11/2026 : `Get-Content .env` lisait 53 lignes avant ces
règles, `Permission denied` après.

Les rituels `TaskStart` / `TaskComplete` sont remplacés par `/reprise` et `/fin` (`.opencode/commands/`).

## 7. Règles de zone

Les fichiers `docs/agents/rules/*.md` portent un frontmatter `paths:` qui **documente** la zone
concernée ; le corps est la règle. OpenCode ne le parse pas : le routage vit dans `AGENTS.md` §2 et dans
les `AGENTS.md` de zone (`src/`, `tests/`, `docs/`, `services/`), qui pointent vers ces fichiers.

```markdown
---
paths:
  - "src/server/**"
  - "src/app/api/**"
---
```

> **Accès au VPS en lecture seule** — quel que soit l'assistant, la procédure et les règles vivent dans
> `docs/agents/acces-lecture-seule.md` (utilisateur dédié, **jamais** dans le groupe `docker`, rôle
> Postgres `SELECT` seulement). **Toute mesure de données se fait sur la bêta** : la base locale ne fait
> foi que pour le **schéma** et les **tests**.

## 8. Fichiers ignorés — `.gitignore` et `watcher.ignore`

Deux mécanismes, deux rôles :
- `.gitignore` = ce qui n'entre **jamais** dans le dépôt (secrets, builds, zones volatiles) ;
- `opencode.json` → `watcher.ignore` = ce que l'agent **ne scanne pas** (`public/assets/**`,
  `public/uploads/**`, `docs/audits/**`, `src/temp/**`, binaires et artefacts).

Il n'y a plus de fichier d'ignore propre à un hôte : la liste vit aux deux endroits ci-dessus, et un test
vérifie que `watcher.ignore` couvre bien les binaires.

## 9. MCP — Sentry connecté

Sentry est connecté via **OAuth** (`/mcps`) ; le serveur distant est déclaré dans `opencode.json`
(`mcp.servers.sentry`, URL `https://mcp.sentry.dev/mcp`). Les outils `search_issues`, `search_errors`,
`search_traces` et `get_sentry_resource` sont chargés. Le skill `sentry-triage` impose l'ordre :
**mesurer** (issue → error → trace → release) avant de proposer une cause. Aucun MCP de production avec
credentials : si un jour une base est branchée, ce sera un rôle **read-only** et une base **locale**.

## 10. Anti-patrons

1. Recopier `AGENTS.md` dans `docs/agents/rules/` → deux vérités, double coût.
2. Créer des Workflows → dépréciés.
3. Un skill fourre-tout → ne se déclenche jamais ou charge trop.
4. Un garde-fou qui lance la suite de tests → une permission bloque un geste, elle ne vérifie pas le code.
5. Croire que le routage des règles est automatique → OpenCode ne lit pas `paths:` ; ce sont les
   `AGENTS.md` de zone qui portent le routage.
6. MCP base de production → jamais.
7. Memory Bank parallèle à `docs/` → troisième source de vérité.
8. **Prouver une donnée avec la base locale** → `sigilos-db` (5433) n'a ni le même contenu ni les mêmes
   volumes que `db-beta` (mesure du 31/10 : **287** `MonsterStat` / **145** donjons en local, contre
   **106 fiches boss sur 146** et « 25 pages sans `sp-cial` » en bêta). Une mesure de **contenu** se fait
   sur la **bêta** (`docs/agents/acces-lecture-seule.md`) ; le local ne prouve que le **schéma** et les tests.
9. **Écrire sur le VPS « pour vérifier »** → l'accès de l'assistant est **lecture seule** ; toute écriture,
   déploiement ou suppression se fait par le mainteneur, avec son accord explicite.
10. **Committer les fichiers d'un chantier en cours du mainteneur** → `docs/ROADMAP.md` modifié et un
    `docs/plans/*.md` non suivi appartiennent à **son** chantier : l'assistant ne stage **que** ses propres
    fichiers, **nommés un par un** (jamais `git add -A`), et laisse ces deux-là intacts.
11. **Dupliquer les skills dans `.opencode/skills`** → deux sources ; OpenCode lit `.agents/skills` via
    `"skills": [".agents/skills"]`.
12. **Croire qu'un garde-fou de permission remplace la règle** → il bloque un geste, il n'explique pas
    comment travailler ; la règle de zone reste la référence.

## 11. Journal du harnais

| Date | Lot | Contenu |
|---|---|---|
| 19/10/2026 | **H0-H7** | photo chiffrée · roadmap unique (~200 lignes) + journal archivé · 4 règles conditionnelles · 6 skills · 3 hooks · `.clineignore` · garde `tests/unit/harness-config.test.ts` · **426 fichiers / 4 608 tests**, `tsc` 0, `eslint` 0 erreur |
| 22/11/2026 | **OpenCode** | adaptateur `opencode.json` (skills partagés, permissions, watcher, Sentry MCP) · `/reprise` + `/fin` · routeurs `AGENTS.md` de zone · garde `harness-config` · Cline conservé |
| 22/11/2026 | **Lot 2** | sous-agent `reviewer` read-only · premier worktree · hooks Cline durcis et testés par comportement · inventaire exact des 12 skills · chemins `paths:` vérifiés |
| 22/11/2026 | **Lot 3** | liens locaux `.agents/skills` + `.claude/skills` (gitignorés) · scorecard de mesure · `/fin` déclenche `reviewer` · source `.cline/skills` conservée |
| 23/11/2026 | **PR 1** | source déplacée vers `.agents/skills` (standard Agent Skills) · liens `.cline/skills` + `.claude/skills` recréés par `harness:links` (`--check`, idempotent) · `install:safe` + CI · Cline opérationnel via le lien |
| 23/11/2026 | **PR 2** | règles déplacées vers `docs/agents/rules` · hooks `.ps1` retirés (permissions OpenCode = garde active, testées ligne par ligne) · `.clineignore` supprimé · lien `.cline/skills` retiré · `git push --force` et écriture `.env` en `deny` · Cline désinstallé |

## 12. OpenCode — le même harnais, autre hôte

> **Statut (23/11/2026)** : OpenCode est le harnais **unique**. Cline a été désinstallé ; plus aucun
> fichier Cline dans le dépôt. Les skills restent au standard `.agents/skills`, lisibles par Codex ou
> Claude Code sans configuration.

| Brique | Emplacement | Rôle |
|---|---|---|
| Contrat | `AGENTS.md` + `AGENTS.md` de zone (`src/`, `tests/`, `docs/`, `services/`) | Toujours chargé, route vers les règles |
| Règles de zone | `docs/agents/rules/01..07` | Source unique ; routées par `AGENTS.md` et les `AGENTS.md` de zone |
| Skills | `.agents/skills/**/SKILL.md` | Source unique versionnée, branchée par `"skills": [".agents/skills"]` |
| Garde-fous | `opencode.json` → `permissions` | `.env` deny (édition et commandes), `--no-verify` deny, `--force` deny ; migrations et gestes destructifs ask |
| Rituels | `.opencode/commands/reprise.md` et `fin.md` | Reprise (SHA + amorce) et fin de session (DoD + `reviewer`) |
| MCP | `opencode.json` → `mcp.servers.sentry` | Sentry connecté via OAuth, URL `https://mcp.sentry.dev/mcp` |
| Ignore | `opencode.json` → `watcher.ignore` | Binaires et artefacts hors du scan de l'agent |

**Pourquoi `.agents/skills` et pas une copie** : une seule source versionnée, aucun doublon. Claude Code
la lit via un lien local (`npm run harness:links`) ; c'est le standard Agent Skills, donc Codex et les
autres hôtes la découvrent sans configuration.

**Lancer depuis la racine** : `"skills": [".agents/skills"]` est relatif au répertoire de travail
OpenCode, pas au fichier `opencode.json`. Depuis un sous-dossier, les skills ne seraient pas trouvés.

**Vérifier** : `npx vitest run tests/unit/harness-config.test.ts` · `/reprise` · `/fin` · `opencode mcp list`.

**Historique** : sortie de Cline (PR 1 et PR 2), voir §14.

## 13. Délégation — le sous-agent `reviewer`

`.opencode/agents/reviewer.md` définit un agent **read-only** : `edit` refusé, `shell` limité à `git diff`,
`git status` et `git log`. Il relit le diff, liste les findings par sévérité et rend un verdict « prêt pour
PR / corrections à faire ».

Invocation : demander explicitement « utilise le sous-agent `reviewer` sur le diff ». Il relit avec
`git diff origin/dev...HEAD` (ou `git diff --cached` si le parent a indexé) et `git status --short` pour
les fichiers non suivis. Il tourne dans une session enfant, avec son propre contexte et ses propres
permissions ; le parent ne reçoit que le rapport. Il ne remplace pas les tests : il les complète. La
commande `/fin` le déclenche automatiquement avant le rapport final.

**Worktrees** : `opencode.json` → `worktree.directory = ../sigilos-worktrees` pour rester sur le même
volume que le dépôt. Mesure du 22/11 : un worktree sur `C:` avec `node_modules` en jonction a fait
dépasser les 5 s de six à huit tests qui scannent `src/` ; le même test seul repasse en 4 s. Le worktree
reste valable, mais le volume compte.

## 14. Portabilité — liens locaux et scorecard

**Source unique** : `.agents/skills/` (standard Agent Skills), **versionnée**. `npm run harness:links`
crée un lien **local et gitignoré** : `.claude/skills` → `.agents/skills` (Claude Code).

Windows : jonction ; Unix : symlink relatif. `--check` vérifie sans rien modifier ; le script refuse
de remplacer un dossier réel non vide (un dossier vide est remplacé). Un clone neuf lance
`npm run harness:links` — `install:safe` et la CI le font déjà. Un poste issu de la PR 1 peut garder
l'ancien lien : le supprimer une fois (`cmd /c rmdir .cline\skills`).

**Décision du 22/11/2026 — migration conditionnée** : elle a été exécutée le 23/11/2026, une fois les
trois conditions remplies : 3 lots produit mesurés (scorecard ci-dessous), Cline passé en secondaire,
installation et CI capables de recréer les liens.

**Baseline harnais (rétrospectif)** :

| Lot | Fichiers | Tests | CI | Relecture |
|---|---|---|---|---|
| 1 — OpenCode | 13 | 8 325 | 7m37s | — |
| 2 — délégation | 11 | 8 332 | 10m24s | 15 findings, 14 intégrés |
| 3 — portabilité | 9 | 8 333 | 7m56s | 1 relecture, 2 bloquants corrigés |

**Scorecard produit (3 lots réels)** :

| Lot | Harnais | Temps | Tokens | Interventions | Bugs attrapés | Tests |
|---|---|---|---|---|---|---|
| 1 | OpenCode — Rush overlay | ~15 min | n/d | 0 | 1 (précédence 400×1000) | 4 neufs + 28 ciblés |
| 2 | OpenCode — Rush compact | ~20 min | n/d | 0 | 2 (onglets wrappés, badge coupé) | 1 neuf + 103 ciblés |
| 3 | OpenCode — Rush prérequis | ~25 min | n/d | 0 | 1 (document hôte en PiP) | 11 neufs + 159 ciblés |

Le but n'est pas de « sentir » si c'est mieux : c'est de comparer des chiffres.

**État au 23/11/2026 — migration terminée.** Cline est sorti du dépôt : la source des skills est
`.agents/skills`, les règles vivent dans `docs/agents/rules/`, les garde-fous sont dans
`opencode.json` (vérifiés ligne par ligne par un test), `.clineignore` n'existe plus.

**Ce qui a été supprimé** : `.clinerules/` (7 règles déplacées, 3 hooks `.ps1` retirés),
`.clineignore`, l'installation Cline. Aucune règle n'a été perdue : les gardes (`PreToolUse`) sont
portées par les permissions OpenCode, et les rituels (`TaskStart`/`TaskComplete`) par `/reprise` et
`/fin`.

**Risques résiduels** : un lien qui pointe ailleurs est signalé et jamais remplacé ; CI qui ne
recréerait pas les liens (couverte par l'étape `verify`).

**Commandes de reprise** : `npm run install:safe` (après clone) → `npm run harness:links` →
`npx vitest run tests/unit/harness-config.test.ts` → `git status --short` doit être propre (liens
gitignorés).
