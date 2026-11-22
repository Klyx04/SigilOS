---
description: Harnais agentique — règles conditionnelles, skills, hooks, .clineignore, adaptateur OpenCode, mesures et hygiène de contexte
---

# 🧰 Harnais agentique — comment on travaille avec les assistants IA

> **Rôle.** Cette page décrit l'outillage qui encadre les assistants (Cline, OpenCode, Cursor, Copilot,
> Codex, Gemini CLI…) : ce qui est **toujours chargé**, ce qui se charge **à la demande**, ce qui s'exécute
> **sans LLM**, et ce qui reste **local**. Elle ne remplace ni `AGENTS.md` (le contrat) ni
> `docs/ROADMAP.md` (le backlog et l'ordre).
>
> **Dépôt public.** Aucun secret, aucun ID Discord, aucun chemin machine, aucune capture du poste.
> Les réglages personnels (`.vscode/`, `%USERPROFILE%\.cline\skills`) ne sont pas versionnés.
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
| **Hooks** | Sur événement, **sans LLM** | **0 token** | Les garde-fous déterministes (bloquer, rappeler) |
| **Workflows** | Dépréciés par Cline | — | **Ne pas utiliser** : migrer en Skills |

Avec OpenCode, seuls `AGENTS.md` et les `AGENTS.md` de zone sont toujours chargés ; les `.clinerules`
sont lues via le routage (§12). Cline, lui, garde ses `paths:`.

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
.clinerules/
├── 01-server.md                  règles serveur (paths: src/server/**, src/app/api/**…)
├── 02-ui.md                      règles UI (paths: src/components/**, src/app/**/*.tsx)
├── 03-tests.md                   règles tests (paths: tests/**)
├── 04-docs.md                    règles doc (paths: docs/**, AGENTS.md)
├── 05-runtime.md                 règles runtime Node (paths: .nvmrc, package.json, Dockerfile*, workflows)
├── 06-discord.md                 règles Discord (paths: src/app/api/discord/**, src/server/discord.ts, tickets…)
└── hooks/
    ├── PreToolUse.ps1            bloque les gestes irréversibles
    ├── TaskStart.ps1             injecte SHA + prochaine étape
    └── TaskComplete.ps1          rappelle la Definition of Done
.cline/skills/                    12 skills (voir §5) — source partagée Cline + OpenCode
opencode.json                     adaptateur OpenCode : skills, permissions, watcher, worktree, MCP
scripts/harness-links.mjs         liens locaux .agents/skills + .claude/skills (portabilité)
.opencode/commands/
├── reprise.md                    SHA + amorce de session
└── fin.md                        Definition of Done
.opencode/agents/
└── reviewer.md                   sous-agent read-only (délégation)
src/AGENTS.md                     routeur de zone (server, UI, Discord)
tests/AGENTS.md                   routeur de zone (tests)
docs/AGENTS.md                    routeur de zone (docs)
services/AGENTS.md                routeur de zone (bot Discord, runtime)
.clineignore                      sort les binaires et les builds de l'index Cline

Mémoire chaude   : docs/ROADMAP.md (~200 lignes) + activeContext.md (6 blocs)
Mémoire froide   : docs/agents/journal-sessions-2026.md + docs/agents/archive/**
Mémoire volatile : src/temp/ (UNE seule zone, gitignorée)
```

## 4. Versionné ou local ?

| Versionné (public) | Local (jamais poussé) |
|---|---|
| `AGENTS.md`, `AGENTS.md` de zone, `.clinerules/**`, `.cline/skills/**`, `.clineignore`, `opencode.json`, `.opencode/commands/**`, `.opencode/agents/**`, `scripts/harness-links.mjs` | `.vscode/settings.json` (préférences éditeur) |
| `docs/agents/harnais.md`, `docs/ROADMAP.md`, journal et archives | `%USERPROFILE%\.cline\skills` (skills globaux) ; liens `.agents/skills` / `.claude/skills` ; `.claude/settings.local.json`, `.claude/commands/`, `.claude/agents/` |
| hooks (relus en PR comme du code) | `docs/audits/`, `src/temp/`, `.env*`, artefacts de build |

Un hook est du **code exécutable** : il se relit, il ne contient aucun secret, et il tient en moins de
2 secondes.

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
| `responsive` | toute UI, layout, page, composant, classe Tailwind ou bug d'affichage mobile/tablette/desktop | `.cline/skills/responsive/` — les 8 règles non négociables (mobile-first, aucune largeur fixe, `svh`/`dvh`, reflow à 320 px) **et** la vérification obligatoire 390 / 768 / 1 024 / 1 440 + zoom 200 % ; cliquet `tests/unit/responsive-guard.test.ts` |
| `metamob-api` | tout appel Metamob (routes, schémas Zod, échanges, propositions) | la vérification de la doc officielle + `scripts/check-metamob-api.mjs` |
| `vps-ops` | toute écriture VPS (dump, archive Rush, suppression, vérification) | le conteneur `ops-*`, le dry-run avant `--apply`, la sauvegarde et la preuve avant/après |

Emplacement : **`.cline/skills/<nom>/SKILL.md`** (versionné). Le `name` doit être **identique au nom du
dossier** ; la `description` (≤ 1 024 caractères) est ce qui déclenche le skill. Un skill global du même
nom **écrase** le skill projet : on garde donc tout dans le dépôt.

⚠️ **Piège mesuré le 05/11/2026** : la `description` est un **scalaire YAML non cité**, elle ne peut donc
contenir **aucun `": "`** (deux-points + espace). Un seul suffit à casser le parseur, et le skill
**disparaît du panneau Cline sans message d'erreur** — c'est arrivé à `sentry-triage` (écrit en octobre,
jamais chargé) et à `sigilos-da-wakfu`. Utiliser un tiret cadratin `—`. Verrou :
`tests/unit/harness-config.test.ts` (une valeur citée `"…"` reste autorisée).

## 6. Hooks — le seul endroit où l'agent ne peut pas oublier

- dossier : **`.clinerules/hooks/`** (global : `%USERPROFILE%\.cline\hooks`) ;
- **Windows : un fichier `<Événement>.ps1`** ; Unix : un fichier exécutable sans extension ;
- **un seul fichier par événement et par dossier** ; les hooks global et projet s'additionnent ;
- événements : `TaskStart`, `TaskResume`, `TaskCancel`, `TaskComplete`, `UserPromptSubmit`,
  `PreToolUse`, `PostToolUse`, `PreCompact`, `Notification` ;
- entrée : **JSON sur stdin** (`hookName`, `taskId`, `workspaceRoots`, `tool_call { id, name, input }`,
  `tool_result`, `iteration`…) ;
- sortie : **JSON sur stdout** `{ "cancel": false, "errorMessage": "", "contextModification": "" }` ;
- **timeout par défaut : 3 secondes** ⇒ un hook ne lance **jamais** `npm run test:run` ni `tsc`.

Tests manuels :

```powershell
'{"tool_call":{"name":"write_to_file","input":{"path":".env"}}}' | powershell -NoProfile -File .clinerules/hooks/PreToolUse.ps1
'{"taskId":"test"}' | powershell -NoProfile -File .clinerules/hooks/TaskStart.ps1
'{}' | powershell -NoProfile -File .clinerules/hooks/TaskComplete.ps1
```

**OpenCode** : pas de hooks lifecycle 1:1. Les gardes sont dans `opencode.json` → `permissions` et les
rituels dans `.opencode/commands/reprise.md` / `fin.md`. Les hooks Cline restent actifs.

Les trois hooks Cline sont **testés par comportement** dans `tests/unit/harness-config.test.ts` :
blocage `.env` (sauf `.env.example`), migrations (`migrate dev`, `db push`), destructives, `--no-verify` ;
`TaskStart` (SHA + §0) ; `TaskComplete` (DoD + `git status`).

## 7. Règles conditionnelles

Les fichiers `.clinerules/*.md` portent un frontmatter `paths:` : Cline ne les charge que lorsqu'un
fichier du contexte correspond. On évite ainsi de payer la checklist sécurité pendant une retouche CSS,
et la checklist UI pendant une migration.

```markdown
---
paths:
  - "src/server/**"
  - "src/app/api/**"
---
```

**OpenCode** : pas de `paths:` natif. Le routage vit dans `AGENTS.md` §2 et dans les `AGENTS.md` de zone
(`src/`, `tests/`, `docs/`, `services/`), qui pointent vers les mêmes `.clinerules/*.md`. Une seule source.

> **Accès au VPS en lecture seule** — quel que soit l'assistant, la procédure et les règles vivent dans
> `docs/agents/acces-lecture-seule.md` (utilisateur dédié, **jamais** dans le groupe `docker`, rôle
> Postgres `SELECT` seulement). **Toute mesure de données se fait sur la bêta** : la base locale ne fait
> foi que pour le **schéma** et les **tests**.

## 8. `.clineignore` — pansement, pas fondation

Cline supporte `.clineignore` mais annonce sa **dépréciation**. On l'utilise pour sortir de l'index les
binaires et les builds (`public/assets/`, `public/uploads/`, `node_modules/`, `.next/`, `docs/audits/`,
`src/temp/`, `*.tsbuildinfo`). Si la fonction disparaît, les mêmes exclusions restent applicables à la
main (ne pas indexer 40 000 images).

**OpenCode** : `opencode.json` → `watcher.ignore` couvre les mêmes binaires ; `.clineignore` reste pour Cline.

## 9. MCP — Sentry connecté

Sentry est connecté via **OAuth** (`/mcps`) ; le serveur distant est déclaré dans `opencode.json`
(`mcp.servers.sentry`, URL `https://mcp.sentry.dev/mcp`). Les outils `search_issues`, `search_errors`,
`search_traces` et `get_sentry_resource` sont chargés. Le skill `sentry-triage` impose l'ordre :
**mesurer** (issue → error → trace → release) avant de proposer une cause. Aucun MCP de production avec
credentials : si un jour une base est branchée, ce sera un rôle **read-only** et une base **locale**.

## 10. Anti-patrons

1. Recopier `AGENTS.md` dans `.clinerules/` → deux vérités, double coût.
2. Créer des Workflows → dépréciés.
3. Un skill fourre-tout → ne se déclenche jamais ou charge trop.
4. Un hook qui lance la suite de tests → tué à 3 s.
5. Croire que `.clineignore` est éternel → déprécié.
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
11. **Dupliquer les skills dans `.opencode/skills`** → deux sources ; OpenCode lit `.cline/skills` via
    `"skills": [".cline/skills"]`.
12. **Croire que les hooks Cline existent dans OpenCode** → pas de lifecycle 1:1 ; permissions +
    commandes, hooks Cline conservés.

## 11. Journal du harnais

| Date | Lot | Contenu |
|---|---|---|
| 19/10/2026 | **H0-H7** | photo chiffrée · roadmap unique (~200 lignes) + journal archivé · 4 règles conditionnelles · 6 skills · 3 hooks · `.clineignore` · garde `tests/unit/harness-config.test.ts` · **426 fichiers / 4 608 tests**, `tsc` 0, `eslint` 0 erreur |
| 22/11/2026 | **OpenCode** | adaptateur `opencode.json` (skills partagés, permissions, watcher, Sentry MCP) · `/reprise` + `/fin` · routeurs `AGENTS.md` de zone · garde `harness-config` · Cline conservé |
| 22/11/2026 | **Lot 2** | sous-agent `reviewer` read-only · premier worktree · hooks Cline durcis et testés par comportement · inventaire exact des 12 skills · chemins `paths:` vérifiés |
| 22/11/2026 | **Lot 3** | liens locaux `.agents/skills` + `.claude/skills` (gitignorés) · scorecard de mesure · `/fin` déclenche `reviewer` · source `.cline/skills` conservée |

## 12. OpenCode — le même harnais, autre hôte

> **Statut (22/11/2026)** : OpenCode est le harnais **principal** pour les nouveaux lots ; Cline reste
> installé et opérationnel comme filet de sécurité. Aucun fichier Cline n'est supprimé.

| Brique | Emplacement | Rôle |
|---|---|---|
| Contrat | `AGENTS.md` + `AGENTS.md` de zone (`src/`, `tests/`, `docs/`, `services/`) | Toujours chargé, route vers les règles |
| Règles de zone | `.clinerules/01..07` | Source unique ; OpenCode les lit via le routage, Cline via `paths:` |
| Skills | `.cline/skills/**/SKILL.md` | Source unique partagée, branchée par `"skills": [".cline/skills"]` |
| Garde-fous | `opencode.json` → `permissions` | `.env` deny, migrations ask, commandes destructives ask, `--no-verify` deny |
| Rituels | `.opencode/commands/reprise.md` et `fin.md` | Remplacent `TaskStart` / `TaskComplete` (manuels, pas d'événement natif) |
| MCP | `opencode.json` → `mcp.servers.sentry` | Sentry connecté via OAuth, URL `https://mcp.sentry.dev/mcp` |
| Ignore | `opencode.json` → `watcher.ignore` | Remplace `.clineignore` côté OpenCode, qui reste pour Cline |

**Pourquoi `.cline/skills` et pas une copie** : une seule source, aucun doublon. Quand on ajoutera
Codex/Claude, on déplacera vers `.agents/skills` (standard Agent Skills) avec des liens pour Cline/Claude.

**Lancer depuis la racine** : `"skills": [".cline/skills"]` est relatif au répertoire de travail
OpenCode, pas au fichier `opencode.json`. Depuis un sous-dossier, les skills ne seraient pas trouvés.

**Vérifier** : `npx vitest run tests/unit/harness-config.test.ts` · `/reprise` · `/fin` · `opencode mcp list`.

**Suite** : lot 4 = mesure sur 3 lots réels + décision de migration vers `.agents/skills` (standard Agent Skills).

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

**Source unique** : `.cline/skills/` reste la source tant que Cline est conservé.

`npm run harness:links` crée deux liens **locaux et gitignorés** :
- `.agents/skills` → `.cline/skills` (Codex, DeepSeek Harness, Hermes ; OpenCode le découvre aussi) ;
- `.claude/skills` → `.cline/skills` (Claude Code).

Windows : jonctions ; Unix : symlinks. Un clone neuf lance `npm run harness:links`. Le script ne remplace
jamais un dossier réel.

**Décision du 22/11/2026 — source `.cline/skills` conservée** : la migration de la source vers
`.agents/skills` est **conditionnée** à :
1. 3 lots produit livrés dans OpenCode avec la scorecard remplie ;
2. Cline passé en secondaire (plus utilisé au quotidien) ;
3. CI et installation capables de recréer les liens (`npm run harness:links`) après un clone.

Tant que ces trois conditions ne sont pas réunies, les liens restent l'adaptateur de portabilité : Cline
garde sa source, Codex/Claude lisent la même chose, et OpenCode continue de pointer `.cline/skills`.

**Baseline harnais (rétrospectif)** :

| Lot | Fichiers | Tests | CI | Relecture |
|---|---|---|---|---|
| 1 — OpenCode | 13 | 8 325 | 7m37s | — |
| 2 — délégation | 11 | 8 332 | 10m24s | 15 findings, 14 intégrés |
| 3 — portabilité | 9 | 8 333 | 7m56s | 1 relecture, 2 bloquants corrigés |

**Scorecard produit (à remplir, 3 lots réels)** :

| Lot | Harnais | Temps | Tokens | Interventions | Bugs attrapés | Tests |
|---|---|---|---|---|---|---|
| 1 | OpenCode — Rush overlay | ~15 min | n/d | 0 | 1 (précédence 400×1000) | 4 neufs + 28 ciblés |
| 2 | OpenCode — Rush compact | ~20 min | n/d | 0 | 2 (onglets wrappés, badge coupé) | 1 neuf + 103 ciblés |
| 3 | OpenCode — Rush prérequis | ~25 min | n/d | 0 | 1 (document hôte en PiP) | 7 neufs + 159 ciblés |

Le but n'est pas de « sentir » si c'est mieux : c'est de comparer des chiffres.

**Checklist de migration (si déclenchée)** :
1. `git mv .cline/skills .agents/skills`.
2. `opencode.json` → `"skills": [".agents/skills"]`.
3. `scripts/harness-links.mjs` → liens `.cline/skills` et `.claude/skills` vers `.agents/skills`.
4. `.gitignore` → `/.cline/skills` et `/.claude/skills` (les liens), pas `.agents/skills`.
5. Mettre à jour les citations `.cline/skills` : `AGENTS.md`, `harnais.md`, `responsive/references/sigilos.md`,
   `tests/unit/harness-config.test.ts`.
6. CI/installation : exécuter `npm run harness:links` après le checkout.
7. Vérifier Cline, OpenCode, Codex/Claude sur un clone neuf.
