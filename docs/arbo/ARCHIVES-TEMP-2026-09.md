# Archives de la zone de travail `src/temp` — état au 19/09/2026

> **Mise à jour du 20/09/2026 — la zone est VIDE et n'existe plus.**
> `src/temp/` a été supprimé du disque (son contenu est archivé hors dépôt :
> `A:\SigilOS--menage-2026-09-20\lot4-src-temp\` → `chantier-actif.md` 136 Ko, `debug.md`,
> `refonte_landing/` 47 fichiers). La **règle** de cette zone a été promue dans le dépôt :
> **`docs/agents/zone-volatile.md`**. Les « demandes ouvertes » vivent désormais dans
> **`docs/ROADMAP.md`** (source unique) et l'historique des chantiers est hors dépôt.
> Une session qui a besoin d'un brouillon **recrée `src/temp/`** (dossier ignoré par git).

`src/temp/` est une **zone volatile non versionnée** (`.gitignore` → `/src/temp/`). Elle a été
purgée le **19/09/2026** : le contenu est **conservé hors dépôt**, il n'est pas perdu.

## Où sont les fichiers

| Archive externe (hors dépôt) | Contenu |
|---|---|
| `A:\SigilOS--temp-archive-2026-09-19\lot4-src-temp-avant-vidage\` | **copie intégrale de `src/temp`** avant vidage (458 fichiers / 9,3 Mo) |
| `A:\SigilOS--temp-archive-2026-09-19\lot3-src-temp\` | copie précédente (583 fichiers) — avant la purge des captures/mockups |
| `A:\SigilOS--temp-archive-2026-09-19\lot2-sessions\` | `scratch/`, `_plan-recovery/`, `_menage-2026-09-13/`, `_restauration-backup/` |
| `A:\SigilOS--temp-archive-2026-09-19\lot1-racine\` | logs et scripts one-shot qui étaient à la racine du dépôt |
| `A:\SigilOS--temp-archive-2026-09-17\` | archive du ménage précédent (17/09) |

## Comment lire les références dans le dépôt

Les fichiers suivis (code, tests, docs) ne doivent **plus** pointer vers `src/temp/`.
Quand un commentaire ou un doc cite un **nom de fichier nu** — `memo-2026-09-13-marche-cloture.md`,
`_probe-stat-icons-audit.mjs`, `chantier.md`, `debug.md`, `PLAN-MAITRE-*.md`, `REPRISE-*.md` — il s'agit
d'un **artefact de travail archivé** : le retrouver dans l'archive ci-dessus (recherche par nom de fichier).

## Outils promus dans `scripts/` (versionnés, car cités par des procédures)

| Outil | Cité par |
|---|---|
| `scripts/probe-figure-slots.mjs` | `docs/MAINTENANCE.md` §figures landing · `src/lib/landing-figures.ts` |
| `scripts/crop-landing-visuels.mjs` | `docs/MAINTENANCE.md` · `docs/plans/DECISION-OUVERTURE-LANDING.md` · `src/lib/landing-figures.ts` |
| `scripts/scan-mojibake-all.mjs` | `docs/CONTEXT.md` §Encodage (règle dure : doit afficher **0 fichier**) |
| `scripts/fix-mojibake.mjs` | `docs/CONTEXT.md` §Encodage (réparation) |

## Ce qui vit encore dans `src/temp` (50 fichiers / 0,66 Mo)

- `README.md` — la règle de la zone (ce qu'on peut y mettre, nommage, procédure de purge).
- `chantier-actif.md` — demandes **ouvertes** de la session en cours (lu au démarrage ; la consigne vit
  désormais dans `AGENTS.md`, les demandes ouvertes dans `docs/ROADMAP.md`).
- `debug.md` — retours en cours de session (cité par `docs/agents/session-amorce.md`).
- `refonte_landing/` — **kit de mesure** de la refonte des pages publiques (~40 sondes `probe-*`,
  `audit-*`, `shot-*` + index `OUTILS.md`). Sa propre règle dit : « ne pas les supprimer : un fixe = une
  mesure ». **Statut en attente de décision** : soit il rejoint `scripts/` (versionné, comme les 4 outils
  déjà promus), soit il part à l'archive comme le reste.

Tout le reste (mémos, amorces, plans, sondes `_probe-*`, maquettes, `archive/`, dossiers `refonte-marche`,
`refonte-guide-sylvestre`, `refonte-siphon`, `refonte-long-terme-discord-compatibilite`) a été archivé
le 19/09/2026 et **retiré du dépôt**.

## Outils one-shot supprimés du dépôt (19/09/2026)

8 générateurs de données du guide Rush Sylvestre, dont le travail est terminé (données livrées et versionnées
dans `src/data/`) — ils lisaient des entrées de `src/temp` désormais archivées :
`build-rush-sylvestre-dataset.ts`, `build-rush-sylvestre-timeline.mjs`, `enrich-rush-sylvestre.mjs`,
`extract-apprentissage.mjs`, `extract-rush-sylvestre-guide.mjs`, `map-rush-sylvestre-game-data.ts`,
`resolve-rush-sylvestre-item-tags.mjs`, `scrape-dpln-alignment.mjs`.

**Conservé** : `scripts/capture-landing-visuels.mjs` (cité comme producteur des visuels par `docs/MAINTENANCE.md`
et `src/lib/landing-figures.ts` — ses chemins internes pointent désormais vers `scripts/probe-figure-slots.mjs`).

## ⚠️ Volontairement non modifié

`prisma/migrations/20261201000000_add_market_bundle/migration.sql` cite un artefact archivé dans un
commentaire : **ne pas le corriger** — Prisma stocke le **checksum** des migrations appliquées, toute
retouche du fichier casserait `migrate deploy` (« migration modified after being applied »).

