---
description: Harnais agentique — règles conditionnelles, skills, hooks, .clineignore, mesures et hygiène de contexte
---

# 🧰 Harnais agentique — comment on travaille avec les assistants IA

> **Rôle.** Cette page décrit l'outillage qui encadre les assistants (Cline, Cursor, Copilot, Codex,
> Gemini CLI…) : ce qui est **toujours chargé**, ce qui se charge **à la demande**, ce qui s'exécute
> **sans LLM**, et ce qui reste **local**. Elle ne remplace ni `AGENTS.md` (le contrat) ni
> `docs/ROADMAP.md` (le backlog et l'ordre).
>
> **Dépôt public.** Aucun secret, aucun ID Discord, aucun chemin machine, aucune capture du poste.
> Les réglages personnels (`.vscode/`, `%USERPROFILE%\.cline\skills`) ne sont pas versionnés.

## 1. Les quatre briques (et leur coût réel)

| Brique | Quand elle est chargée | Coût | À quoi elle sert ici |
|---|---|---|---|
| **Rules** | **Toujours**, à chaque message | Permanent | Les invariants : sécurité, conventions, hygiène |
| **Skills** | **À la demande** (métadonnées ~100 tokens au démarrage) | Quasi nul au repos | Les procédures répétitives (PR, migration, cron, Sentry) |
| **Hooks** | Sur événement, **sans LLM** | **0 token** | Les garde-fous déterministes (bloquer, rappeler) |
| **Workflows** | Dépréciés par Cline | — | **Ne pas utiliser** : migrer en Skills |

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
AGENTS.md                         contrat court, lu automatiquement (~11 Ko)
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
.cline/skills/
├── lot-pr/SKILL.md
├── prisma-change/SKILL.md
├── cron-task/SKILL.md
├── sentry-triage/SKILL.md
├── route-securite/SKILL.md
├── doc-session/SKILL.md
├── discord-api/SKILL.md
└── node-runtime/SKILL.md
.clineignore                      sort les binaires et les builds de l'index

Mémoire chaude   : docs/ROADMAP.md (~200 lignes) + activeContext.md (6 blocs)
Mémoire froide   : docs/agents/journal-sessions-2026.md + docs/agents/archive/**
Mémoire volatile : src/temp/ (UNE seule zone, gitignorée)
```

## 4. Versionné ou local ?

| Versionné (public) | Local (jamais poussé) |
|---|---|
| `AGENTS.md`, `.clinerules/**`, `.cline/skills/**`, `.clineignore` | `.vscode/settings.json` (préférences éditeur) |
| `docs/agents/harnais.md`, `docs/ROADMAP.md`, journal et archives | `%USERPROFILE%\.cline\skills` (skills globaux) |
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

Emplacement : **`.cline/skills/<nom>/SKILL.md`** (versionné). Le `name` doit être **identique au nom du
dossier** ; la `description` (≤ 1 024 caractères) est ce qui déclenche le skill. Un skill global du même
nom **écrase** le skill projet : on garde donc tout dans le dépôt.

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

> **Accès au VPS en lecture seule** — quel que soit l'assistant, la procédure et les règles vivent dans
> `docs/agents/acces-lecture-seule.md` (utilisateur dédié, **jamais** dans le groupe `docker`, rôle
> Postgres `SELECT` seulement). **Toute mesure de données se fait sur la bêta** : la base locale ne fait
> foi que pour le **schéma** et les **tests**.

## 8. `.clineignore` — pansement, pas fondation

Cline supporte `.clineignore` mais annonce sa **dépréciation**. On l'utilise pour sortir de l'index les
binaires et les builds (`public/assets/`, `public/uploads/`, `node_modules/`, `.next/`, `docs/audits/`,
`src/temp/`, `*.tsbuildinfo`). Si la fonction disparaît, les mêmes exclusions restent applicables à la
main (ne pas indexer 40 000 images).

## 9. MCP — Sentry est déjà branché

Les outils Sentry (`search_issues`, `search_errors`, `search_traces`, `get_sentry_resource`) sont
disponibles dans la session. Le skill `sentry-triage` impose l'ordre : **mesurer** (issue → error →
trace → release) avant de proposer une cause. Aucun MCP de production avec credentials : si un jour une
base est branchée, ce sera un rôle **read-only** et une base **locale**.

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

## 11. Journal du harnais

| Date | Lot | Contenu |
|---|---|---|
| 19/10/2026 | **H0-H7** | photo chiffrée · roadmap unique (~200 lignes) + journal archivé · 4 règles conditionnelles · 6 skills · 3 hooks · `.clineignore` · garde `tests/unit/harness-config.test.ts` · **426 fichiers / 4 608 tests**, `tsc` 0, `eslint` 0 erreur |