# 📁 `src/temp/` — la zone volatile (règle)

> **Cette page est LA RÈGLE de la zone de brouillons.** Le dossier `src/temp/` **n'existe pas**
> dans le dépôt : il est **recréé à la demande** par la session qui a besoin d'un brouillon,
> et il est **ignoré par git** (`.gitignore` → `/src/temp/`).
> ⚠️ **Rien** de ce qui y est écrit n'est sauvegardé par git, par un commit ou par une corbeille.
> Un document qui doit survivre à la session va dans **`docs/`** (ou est commité ailleurs).
> Les **demandes ouvertes** ne vivent plus ici : source unique = **`docs/ROADMAP.md`**.

> 🧹 **MàJ 20/09/2026 — ménage du dépôt** (détail : `docs/arbo/AUDIT-ARBO-2026-09.md` §0, lot **D1→D9**) :
> - **toute la documentation est désormais sous `docs/`** (index `docs/README.md`) : plus aucun `.md` à la
>   racine sauf `README.md`, plus de `.agents/workflows/` (→ `docs/agents/`), plus de `.antigravity` ;
> - les kits de ménage `_menage-2026-09-13/17/19` ont été **sortis du dépôt** (kit `_git-purge.ps1` inclus) ;
> - les 12 reliques posées à la racine de `src/` ont été **sorties du dépôt** ;
> - ⛔ **ces archives externes ont toutes été supprimées du disque le 20/09/2026** (clôture de la purge
>   d'historique — cf. `docs/arbo/ARCHIVES-TEMP-2026-09.md`) : les chemins `A:\SigilOS--*` cités dans le
>   **journal historique ci-dessous sont donc historiques**, à ne pas chercher.

---

## 1. À quoi ça sert

| Type | Rôle | Nommage attendu |
|---|---|---|
| Plan conducteur | **LA** ligne directrice d'un chantier (lu en début de session) | `<chantier>/PLAN-MAITRE-*.md` |
| Amorce / prompt de reprise | Bloc à copier-coller pour démarrer une nouvelle session | `<chantier>/AMORCES-A-COPIER.md` · `prompt-next-chantier-<sujet>.md` |
| État de reprise | Où on en est + ce qui reste (reprise après incident ou contexte saturé) | `<chantier>/REPRISE-<BRANCHE>-ETAT.md` |
| Mémo de session | Décisions, fichiers touchés, vérifications, blocages | `memo-<AAAA-MM-JJ>-<chantier>.md` |
| Maquette / captures | Référence visuelle validée par le user | `<chantier>/maquette-*.html` · `<chantier>/captures/*.png` |
| Script jetable | Sonde de base, rattrapage local, inspection | `_<sujet>.mjs` · `_<sujet>.ps1` |

---

## 2. Règles d'hygiène (à tenir à chaque session)

1. **1 chantier = 1 dossier** (`<chantier>/`). Un chantier **livré** → `archive/<chantier>/`.
2. **Racine minimale** : `README.md`, `chantier-actif.md`, `chantier.md`, les mémos du mois en cours.
3. **Jamais** : `dev-*.log`, `*-log.txt`, `.env*`, dump SQL, artefact de build, secret, `node_modules`.
4. **Daté plutôt que flou** : `memo-2026-09-12-…`, jamais `debug`, `test`, `tmp`, `new`, `final-v2`.
5. **Préfixe `_`** pour tout script jetable → identifiable immédiatement comme supprimable.
6. Un fichier qui survit à **2 sessions** n'est plus un brouillon : il va dans **`docs/`**.

---

## 3. Structure

```text
src/temp/
├─ README.md                    ← ce fichier
├─ chantier-actif.md            ← statut du chantier en cours (lu par le plan §0.1)
├─ chantier.md                  ← historique léger des chantiers
├─ memo-AAAA-MM-JJ-<chantier>.md
├─ <chantier>/                  ← chantier EN COURS (plan, maquette, amorces, captures)
├─ archive/                     ← chantiers TERMINÉS
│  ├─ memos/  amorces/  commits/  contexte/  media/
│  └─ _decommissionne-AAAA-MM/
└─ _<script>.mjs / _*.ps1       ← scripts jetables
```

---

## 4. ⚠️ Leçon du **12/09/2026** — l'incident à ne plus reproduire

```powershell
# ❌ CE QUI A TOUT EFFACÉ
Get-ChildItem -Include '*.old' | Remove-Item
#    PowerShell IGNORE -Include quand il n'y a ni -Recurse ni un joker (« \\* ») sur le chemin :
#    la commande a reçu TOUT le contenu de src/temp → 100 % du dossier perdu
#    (gitignoré ⇒ aucun filet git, rien dans la corbeille)
```

**Le bon geste, en 3 temps :**

```powershell
# 1) LISTER d'abord — jamais de suppression à l'aveugle
Get-ChildItem -LiteralPath 'A:\SigilOS\src\temp' -Recurse -File -Filter '*.old' |
    Select-Object FullName, Length

# 2) VÉRIFIER avec -WhatIf (aucune écriture)
Get-ChildItem -LiteralPath 'A:\SigilOS\src\temp' -Recurse -File -Filter '*.old' |
    ForEach-Object { Remove-Item -LiteralPath $_.FullName -WhatIf }

# 3) SUPPRIMER explicitement la liste validée
```

- **Toujours `-LiteralPath`** (les crochets de `[guildId]` sont des jokers pour `-Path`).
- Une suppression **destructive** se fait **fichier par fichier**, sur une liste **relue**.
- En cas de doute : **déplacer** vers `archive/` ou vers une sauvegarde hors dépôt, **jamais** supprimer.

---

## 5. Si `src/temp/` disparaît encore — où regarder (dans cet ordre)

| # | Source | Détail | Limite |
|---|---|---|---|
| 1 | **`.next/standalone/src/temp/`** | copie du dossier faite par le build `next build` (mode standalone) | **écrasée au prochain build** ⇒ à copier **tout de suite** |
| 2 | **Historique local VS Code** | `%APPDATA%\Code\User\History` (une entrée par fichier **déjà ouvert/édité** dans l'éditeur) | seuls les fichiers édités dans VS Code y sont |
| 3 | **Historique des sessions d'agent** | `%USERPROFILE%\.cline\data\sessions\**\*.messages.json` (contenu des `read_files` / `write` passés) | reconstruction partielle, ligne à ligne |

> 🔒 **Corollaire** : si un document de `src/temp/` devient **important**, on le **promeut dans `docs/`**
> (exactement comme `docs/PLAN-REFONTE-ONBOARDING.md`) — c'est le seul endroit protégé par git.

---

## 6. 🧹 Ménage du **13/09/2026** — mise en quarantaine (rien n'est supprimé)

> Appliqué selon la procédure §4 : **lister → vérifier → déplacer**. Aucune suppression, aucun `Remove-Item`.

| Lot | Contenu | Volume | Destination (déplacement) |
|---|---|---|---|
| **L1** | scratch de session : dumps de commandes `__*.txt`, logs (`_build.log`, `_test-run.txt`), `_q*.sql`, `_stash0.patch`, `_*.txt`, corps de PR/commit | **100 fichiers / 684 KB** | `A:\SigilOS\_menage-2026-09-13\scratch\` |
| **L2** | exports de **sessions d'agent** (`{"info":{"id":"ses_…"}}`) | **2 fichiers / 29,5 MB** | `A:\SigilOS\_menage-2026-09-13\exports-sessions\` |

- Résultat : `src/temp` **469 → 367 fichiers** · **86,8 → 56,6 MB** (−30,2 MB), racine **148 → 46 fichiers**.
- **Inventaire** (nom · octets · mtime · SHA256) : `_menage-2026-09-13\INVENTAIRE.txt` (106 lignes).
- **Retour arrière testé** : `powershell -NoProfile -File A:\SigilOS\_menage-2026-09-13\RESTAURER.ps1` → 367 → 469 → 367 ✅.
- **Conservé volontairement** : les 6 sondes `_check-*.mjs` / `_s8-probe-*.mjs` / `_siphon-*.mjs` (preuve reproductible citée dans `chantier-actif.md`) · `refonte-guide-sylvestre/` (**dépendance dure des 7 `scripts/*.ts|mjs`**) · `exemple.png` (référence visuelle worldmap/grid).
- **Orpheline recollée** : `prompt-next-chantier-ladder-discord.md` — cité par `services/discord-bot/index.ts:42`, récupéré depuis `_restauration-backup\intrus-local-history\`.
- ⚠️ **Refs de doc périmées** (contenu **bien présent** dans `archive/memos/`, seul le chemin cité omet `archive/memos/`) : `memo-2026-08-08-tours-admin.md` · `memo-2026-08-21-resilience-discord.md` · `memo-2026-08-22-chantier-bloc-a.md` · `memo-2026-08-26-fixes-console-ui-sigil-bomb.md` · `memo-2026-08-27-double-boss-defi.md` · `memo-2026-08-27-galerie-stuff-classe.md` · `memo-2026-08-27-game-data.md`.
- **Non fait (sur validation)** : archivage des mémos/maquettes de chantiers terminés · promotion `docs/` (`specification-module-marche-sigilos.md`, `sigilos-design-system-etat-de-l-art.md`, `module-cycle-vie-membres-sigilos.md`, `plan-review-deploy-mission.md`) · `debug.md` (cité par `src/lib/dofus-grid.ts:129`) · `archive/media/*.mp3` (42 MB, cités par `CONTEXT.md:62`).

### 6.1 Suite du 13/09/2026 — `guide_backup.sql` sorti du dépôt + gel du scratch (PR **#638**)

| Action | Détail |
|---|---|
| **Dump hors dépôt** | `guide_backup.sql` (17,74 Mo, `pg_dump --data-only` de 5 tables de guides) était **suivi par git** depuis `b4eef64ba` (26/07/2026) alors qu'il n'est **référencé nulle part** dans le code. Déplacé dans `backups/guide_backup.sql` (déjà ignoré, SHA256 `FE4EEF69…EA72` conservé) → branche `fix/untrack-guide-backup-sql`, **PR #638 → `dev`**. Récupération à tout moment : `git show b4eef64ba:guide_backup.sql > guide_backup.sql`. |
| **`.gitignore`** | `/*.sql` + `/*_backup.sql` (scopé **racine** → `prisma/migrations/**` et `prisma/seed-data/**` non touchés) · scratch racine `/_*.mjs`, `/_*.ps1`, `/_*.txt` · `/_menage-*/`, `/_restauration-backup/`, `/_plan-recovery/`. |
| **`.dockerignore`** | `/*.sql` + `backups/*.sql` → le dump ne part plus dans le contexte de build ni dans l'image (c'est le `COPY . .` du `Dockerfile:23` qui l'embarquait). |
| **Protection immédiate (avant merge)** | Bloc équivalent ajouté à `.git/info/exclude` → les checkpoints Cline ne capturent plus ce scratch, **sur toutes les branches**, sans attendre #638. |
| **Réponse à « pourquoi `_menage-*/` finissait dans l'historique git »** | Sans règle d'ignore, chaque capture de checkpoint embarque les fichiers de travail : le kit de ménage (L2 : 29,5 Mo d'exports de sessions) a bien été enregistré dans la base d'objets **avant** sa mise en quarantaine. Les règles ci-dessus l'empêchent désormais à la source. |

---

### 6.2 Suite du **17/09/2026** — ménage complet de `src/temp` (6 lots, **rien supprimé**)

> Procédure du §4 tenue de bout en bout : **copie de sûreté → lister → vérifier → déplacer**. Aucun
> `Remove-Item` sur autre chose que des **dossiers vides** (18). Rien n'a été détruit.

| Lot | Contenu | Effectif | Destination (déplacement) |
|---|---|---|---|
| **0** | copie de sûreté **avant toute action** + garde-fou dans le script (il refuse de tourner si la copie pèse moins que la source) | 705 fichiers / 72,66 Mo | `A:\SigilOS--temp-backup-2026-09-17\` |
| **1** | éphémères : 28 logs, 7 fichiers 0 octet, 102 scripts de session `_*` non cités | **137 fichiers / 5,3 Mo** | `A:\SigilOS--temp-archive-2026-09-17\lot1\` |
| **2** | captures de la maquette abandonnée (série `12-guide-sylvestre-carnet-*`) | 13 fichiers / 1,45 Mo | `src/temp/refonte-guide-sylvestre/captures-maquettes/` |
| **3** | 10 chantiers livrés + 6 `*.old` (un `.old` ne se supprime pas — leçon du 12/09) | 16 entrées | `src/temp/archive/<chantier>/` · `…/<chantier>/versions-anciennes/` |
| **4** | racine minimale : mémos non cités, corps de PR, docs de contexte, 1 doublon | 28 fichiers | `src/temp/archive/{memos,pr-bodies,contexte,refonte_landing}/` |
| **5** | volumineux : 8 mp3 « ambiance Dofus » (43,3 Mo), zip DPLN, `exemple.png`, captures du Marché | **17 fichiers / 47,56 Mo** | `A:\SigilOS--temp-archive-2026-09-17\lot5\` |

- **Résultat : 704 → 552 fichiers** (−152) · **72,66 → 19,8 Mo** (−52,9 Mo) · **racine 223 → 57 fichiers** ·
  **18 dossiers vides supprimés** · **211 éléments déplacés** (154 hors dépôt + 57 dans le dépôt), **0 fichier détruit**.
- **La règle de tri est mesurée, pas devinée** : un élément ne bouge que si son nom n'apparaît **ni dans un
  fichier suivi par git, ni dans un doc actif** de `src/temp` (amorce, fiche de reprise, mémos du chantier,
  `chantier-actif.md`, `chantier.md`, `debug.md`, ce README). **125 chemins verrouillés** — dont tout
  `refonte-guide-sylvestre/` (**dépendance dure** de `scripts/build-rush-sylvestre-dataset.ts`,
  `enrich-rush-sylvestre.mjs`, `extract-apprentissage.mjs`, `resolve-rush-sylvestre-item-tags.mjs`,
  `scrape-dpln-alignment.mjs`, `build-rush-sylvestre-timeline.mjs` : `RUSH-SYLESTRE-*.json`,
  `ALIGNEMENT-dpln.json`, `APPRENTISSAGE-dpln.json`, `enrich-cache/`, `extracted/`), `refonte-marche/`,
  `refonte-siphon/`, `refonte_landing/`, `debug.md`, `test.html`…
- **Deux pièges de filtrage réglés par la mesure** (à ne pas rejouer) : ① les références de doc sont
  **entre backticks** (`` `src/temp/_check-items.ts` ``) → une classe de caractères **négative** laissait le
  backtick collé au nom : le fichier n'était plus reconnu comme cité (**14 sondes** sur le point de partir) ;
  filtrer avec une classe **positive** (`[0-9A-Za-z_.\-/]` + Latin-1). ② verrouiller **par préfixe dans les
  deux sens** (un chemin cité protège ses ancêtres **et** ses descendants), mais **réserver la règle de
  préfixe aux références avec composant de dossier** : sinon les gabarits de nommage cités dans les docs
  (`src/temp/memo-<AAAA-MM-JJ>-<sujet>.md`, `src/temp/_probe-*.ts`) verrouillent toute la racine.
- **Un défaut à connaître** : le lot 3 collectait les `*.old` **après** avoir déplacé leur dossier → un
  `src/temp/archive/archive/…` avait été créé ; corrigé (6 fichiers remis dans
  `archive/refonte-succes/versions-anciennes/`, `archive/archive` vide supprimé) et le manifeste réécrit.
- **9 pointeurs morts corrigés** dans des fichiers **suivis** (le contenu était bien dans `archive/memos/`, seul
  le chemin cité avait vieilli) — c'était le « non fait, sur validation » resté ouvert au **§6** : `CONTEXT.md`
  l.34 / 46 / 59 / 62 · `docs/ROADMAP.md` l.457 / 474 / 480 / 500.
  **Contrôle après** : sur **80 références suivies** (`git grep`), 2 « non résolues » — et ce sont des
  **gabarits de nommage** (`src/temp/memo-…`, `src/temp/_probe-*`) ⇒ **0 chemin réellement mort**.
- **Retour arrière testé** : `powershell -NoProfile -ExecutionPolicy Bypass -File A:\SigilOS\_menage-2026-09-17\RESTAURER.ps1`
  (simulation) puis `-Apply` → rejoue les manifestes **à l'envers**, ne supprime rien (« déjà en place » ignoré).
- **Kit** : `A:\SigilOS\_menage-2026-09-17\` → `menage.ps1` (simulation par défaut · `-Lot n -Apply` ·
  `-LiteralPath` partout · un fichier verrouillé fait échouer **son** déplacement, pas le lot), `INVENTAIRE.txt`
  (**242 lignes** : taille · mtime · **SHA256** · origine · destination, lu sur la copie de sûreté),
  `RESTAURER.ps1`. Manifestes par lot : `A:\SigilOS--temp-archive-2026-09-17\_manifests\`.
- **Conservé volontairement** : les **15 sondes** `_probe-*` / `_check-*` / `_shot-fiche.mjs` /
  `_siphon-referentials.mjs` citées nommément par du code ou un doc · `chantier.md`, `chantier-actif.md`,
  `debug.md` (cité par `src/lib/dofus-grid.ts:129`, `src/lib/market/format-date.ts`, `src/lib/market/item-image.ts`
  et 4 tests) · `test.html` + `sigilos-home-direction-2026.html` (cités `CONTEXT.md` l.59) · les 4 dossiers de
  chantier à pointeurs actifs (`refonte-marche/`, `refonte-guide-sylvestre/`, `refonte_landing/`, `refonte-siphon/`) ·
  les mémos du 02 → 16/09 cités par `docs/ROADMAP.md`.
- **⚠️ `exemple.png` a changé de camp** : le §6 (13/09) l'avait gardé comme « référence visuelle worldmap/grid » ;
  il est désormais **hors dépôt** (`…\lot5\exemple.png`) parce qu'**aucun** fichier suivi ne le cite.
  Le remettre est une commande.
- **Résidus assumés** : `_probe-mapvide.log` (1,8 Ko) **verrouillé par un processus tiers** → relancer
  `menage.ps1 -Lot 1 -Apply` après libération · `seed_all_bounties.ts` + `sync_accurate_bounties.ts` (chantier
  « Avis de recherche » **encore ouvert** : volontairement laissés) · `memo-2026-10-06-chantier-fiche-boss.md`
  (nom daté dans le futur, mtime 21/08 — à trancher) · `refonte-succes/refonte-legere-fiche-boss-sigilos.md`
  (document actif conservé dans un dossier archivé).

---

## 7. 🗄️ Pourquoi `.git` pèse 3,4 Go — état des lieux (13/09/2026, **aucune purge faite**)

| Mesure | Valeur |
|---|---|
| `.git` sur disque | **3,34 Go** (objets + packs : 3,32 Go · 7 packs · 78 718 objets en pack · 5 237 objets lâches) |
| Refs de checkpoint Cline | **614** (`refs/cline/checkpoints/<tâche>/<n>`, du 09/08 au 13/09) — elles **retiennent** leurs objets |
| Objets morts estimés | ~**42 000 blobs ≈ 2,3 Go** (sessions de checkpoint supprimées → objets inatteignables mais encore packés) |
| Coût réel de `guide_backup.sql` dans l'historique | **1,57 Mo compressés** (et non 18 Mo : c'est le coût dans les packs, pas la taille du fichier) |
| Stashes **à ne jamais purger** | `stash@{0}` « lint-staged automatic backup » (12/09, WIP marché S2) et `stash@{1}` WIP worldmap (11/09) — leurs 12 et 34 fichiers existent bien dans `HEAD`, mais **ce sont des filets de sécurité : on n'y touche pas** |

- **Le seul geste irréversible de tout ce chantier** : `git reflog expire --expire-unreachable=30.days --all` puis `git gc --prune=now` → **~2 à 2,5 Go récupérables**. Tout le reste (§6, §6.1) est réversible.
- **Garde-fous** : arbre de travail propre · **sauvegarde complète de `.git`** avant toute opération · jamais sur `dev`/`main` · hors période de chantier actif · contrôle `git fsck` après coup.
- **Outil prêt, simulation par défaut** (aucune écriture sans `-Apply`) :

```powershell
# 1) SIMULATION — mesure, refs par âge, commandes prévues (n'écrit rien)
powershell -NoProfile -ExecutionPolicy Bypass -File A:\SigilOS\_menage-2026-09-13\_git-purge.ps1

# 2) SIMULATION + cible les checkpoints d'août (384 des 614 refs)
powershell -NoProfile -ExecutionPolicy Bypass -File A:\SigilOS\_menage-2026-09-13\_git-purge.ps1 -DeleteClineRefsBefore '2026-09-01'

# 3) EXÉCUTION (sauvegarde .git obligatoire, ~3,3 Go dans A:\SigilOS--git-backup\)
powershell -NoProfile -ExecutionPolicy Bypass -File A:\SigilOS\_menage-2026-09-13\_git-purge.ps1 -Apply
```

> Le script **ne touche jamais** aux branches, tags, stashes ni à `refs/cline` sans l'option explicite `-DeleteClineRefsBefore` — et refusera de s'exécuter si l'arbre de travail n'est pas propre ou si la sauvegarde de `.git` est incomplète.

---

## 8. 🧹 Purge du **19/09/2026** — archivage externe puis suppression (réversible)

> Procédure §4 : **lister → vérifier → copier → vérifier la copie (fichiers + taille) → supprimer**.
> Copie de sûreté intégrale : **`A:\SigilOS--temp-archive-2026-09-19\`**

| Lot | Contenu déplacé (retiré du dépôt) | Volume |
|---|---|---|
| **L1** `lot1-racine\` | logs + scripts one-shot de la racine : `_dev-restart.log`, `dev.log`, `build.log`, `next-3001.log`, `_hits-*.txt`, `_inventaire-standalone-temp.txt`, `_restauration-rapport.txt`, `_analyze-plan.mjs`, `_extract-plan.mjs`/`.ps1`, `_inspect-block.mjs`, `_probe-dofusdb.mjs`, `_reconstruct-plan.mjs`, `_recover-temp.ps1`, `_restore-from-standalone.ps1` | 17 fichiers · 2,4 Mo |
| **L2** `lot2-sessions\` | `scratch\`, `_plan-recovery\` (1 659 fichiers de dumps), `_menage-2026-09-13\` (dont exports de sessions), `_restauration-backup\` | 1 904 fichiers · 57,7 Mo |
| **L3** `lot3-src-temp\` | **copie intégrale de `src/temp` AVANT purge** (583 fichiers) | 21,1 Mo |

- **Supprimé de `src/temp`** : mockups/captures `.png` et `.html`, patches de stash `.patch`, dumps `.txt`
  (`extrait-*`, `x-*`, `inv-*`, `inventaire-*`, `verif-*`) → **129 fichiers · 11,9 Mo**.
  `src/temp` passe de **21,1 → 9,2 Mo** (583 → 454 fichiers). **Aucun** `.md`, `.json`, `.mjs`, `.ts` supprimé.
- **⚠️ 4 restaurations immédiates** — des fichiers **cités par un doc ou du code** ont été emportés par le filtre
  « extension `.html` » : `test.html` + `sigilos-home-direction-2026.html` (cités `CONTEXT.md` §Assets),
  `refonte-rush-sylvestre-2026.html`, `refonte-marche/maquette-lot-multiple.html`.
  **Leçon à appliquer** : relire la liste « conservé volontairement » de ce README **avant** tout filtrage par extension.
- **Outils du ménage du 13/09 remis en place** (petits, encore utiles) : `_menage-2026-09-13\RESTAURER.ps1`,
  `_git-purge.ps1` (§7), `_menage-l1-l2.ps1`, `INVENTAIRE.txt`. Le volume du dossier (scratch + exports de sessions)
  reste dans l'archive externe, sous `lot2-sessions\_menage-2026-09-13\`.
- **Résidu assumé** : `scratch\_tunnel.log` + `_tunnel.log.out` **verrouillés** par un tunnel `ssh.exe` actif
  (msys/OpenSSH). À finir après fermeture du tunnel :
  `Remove-Item -LiteralPath 'A:\SigilOS\scratch' -Recurse -Force`.
- **Branches git** : 24 locales + 28 distantes supprimées le même jour, après vérification `gh` (`state=MERGED`)
  + `git cherry` (aucun patch absent de `dev`). Manifeste nom + SHA (pour restaurer) :
  `_menage-2026-09-19\branches-supprimees-2026-09-19.txt`. Reste : `dev`, `main`, `feat/inter-guilde`
  + 7 branches à trancher (reliquats post-merge).
