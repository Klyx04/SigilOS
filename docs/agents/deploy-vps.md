---
description: Déployer la beta/prod sur le VPS et diagnostiquer un deploy qui échoue (procédure unique)
---

# 🚀 Déploiement VPS & diagnostic

Les images sont construites par GitHub (workflow **Build & Push**), le VPS ne fait
que les télécharger. **Aucun build sur le serveur.**

## La règle d'or

> Une image n'existe qu'après un workflow **Build & Push** **vert**.
> Un `docker pull` refusé et une image jamais publiée renvoient le même message
> côté serveur. Donc : **regarde GitHub AVANT de relancer le deploy.**

## Ordre à respecter (sinon on perd du temps)

1. `git push origin dev` (ou merge de PR).
2. Onglet **Actions** de GitHub :
   - `SigilOS CI` → vert (lint + types + tests) ;
   - `Build & Push` → vert, avec le tag du commit (`<sha>`).
3. Sur le VPS : `./scripts/deploy-cd.sh beta` (ou `prod`).

## Déployer

```bash
cd ~/SigilOS
./scripts/deploy-cd.sh list beta     # versions publiées sur GHCR
./scripts/deploy-cd.sh beta          # déploie `latest`
./scripts/deploy-cd.sh beta <sha>    # déploie un commit précis (rollback propre)
```

Le script fait, dans l'ordre : `git fetch` → `git pull --autostash` → `prisma migrate
deploy` → `docker login` GHCR → `docker pull` des 4 images (`app`, `worker`, `ws`,
`discord-bot`) → `docker compose up -d` → healthchecks.

## L'arbre de travail du serveur : quatre classes, une décision par fichier

Le serveur n'est **pas** un poste de travail : tout fichier **suivi** y est classé, et les
**deux** scripts (`deploy-cd.sh` **et** `deploy.sh`) appliquent la même règle **avant** leur
`git pull`. Parité et interdictions verrouillées par `tests/unit/deploy-source-sync.test.ts` :

| Classe | Contenu (suivi) | Décision |
|---|---|---|
| `GENERATED` | `public/game-data/dungeon-monsters.json` (réécrit par le siphon via le bind mount) | **version du dépôt restaurée** (fichier éphémère) |
| `REPO_OWNED` | médias **sans écrivain au runtime** : `game-data/achievements`, `images`, `assets`, `ordres`, `bonus_guilde`, `songes`, `module-dofus`, `banners` | **version du dépôt restaurée** (contenu **et** mode) |
| `PRESERVED` | curation God : `ignored-monsters.json`, `ignored-bounties.json` | **version du serveur conservée** (mise de côté → pull → restaurée) |
| `SERVER_OWNED` | écrits **par le serveur** : `game-data/{monsters,dungeons,legendary,invader,harvest-icons}` + les 7 JSON générés (`worldmap`, `worlds`, `zaaps`, `harvest-resources`, `bomb-dictionary{,-mixed}`, `secret-passages`) | **aucune écriture** : ni restaurés, ni signalés — **comptés à part** (information) |

🚫 **Ne jamais mettre dans `REPO_OWNED`** : `public/game-data/{monsters,dungeons,legendary}`,
`invader`, `harvest-icons` ni les 7 JSON générés (classe `SERVER_OWNED` : le serveur y écrit —
galerie God, panneau God, siphons), `public/uploads/**` (contenu utilisateur, **non suivi**),
`ignored-*.json` (curation, classe `PRESERVED`). Seules les entrées de `git ls-files` sont
examinées : un fichier **non suivi** n'est ni restauré ni rapporté, donc une **nouvelle** image
déposée par la galerie God n'est jamais touchée.

### 🔁 Pourquoi `REPO_OWNED` existe (cause racine mesurée le 30/09/2026)

Un fichier **binaire** suivi, modifié une fois sur le serveur, **ne converge jamais** avec
`git pull --autostash` : le pop du stash binaire retombe sur l'ancien contenu (conflit →
stash conservé) ou s'applique proprement quand le blob ne bouge pas dans le merge ⇒ **les
mêmes fichiers reviennent à chaque déploiement**, indéfiniment. Cas mesuré : les **25**
icônes de succès réécrites par la purge d'empreintes du 20/09/2026 (`7c69d579`) restaient
« modifiées » côté serveur, plus `conquerant.png` (dernier changement : `b211517a`) — et
**aucun** écrivain runtime ne touche ces dossiers (vérifié : tous les `writeFile*` de `src/`
visent `public/uploads/**`, la galerie God `.webp` ou `prisma/seed-data/**`).

### 🔬 2ᵉ mesure (30/09/2026, VPS) : la divergence n'est pas toujours de contenu

448 `M` mesurés sur le serveur (`git diff --numstat` + `stat -c %a`) :

| Constat | Valeur | Conséquence |
|---|---|---|
| Divergence de **mode seul** (contenu identique) | **11** fichiers (les JSON) | `100644` → `100755` : git les voit « modifiés » à vie ⇒ la restauration doit remettre **le mode** |
| Divergence de **contenu** | **436** binaires (+1 JSON curé) | ré-appliqués par le `stash pop` à chaque déploiement (mtime **identique** sur les 448) |
| Mode des fichiers du serveur | **775** | vient de la synchro d'assets : `sync-assets.ps1` rsync `-a` **sans** `--chmod` (le `.sh` l'impose) |

⚠️ **Défaut corrigé (prouvé, pas déduit)** : `dungeon-monsters.json`, de la classe `GENERATED`,
figurait quand même dans le rapport — `cmp -s` est **aveugle au mode** et `git show HEAD:$f > $f`
**préserve** le `775` du fichier local. Les boucles utilisent désormais
`git diff --quiet HEAD -- "$f"` (garde) et `git checkout -- "$f"` (contenu **et** mode).

**Diagnostic (10 s)** si un fichier **suivi** revient dans le message :

```bash
cd ~/SigilOS
git status --porcelain --untracked-files=no | wc -l   # combien, et rien que du suivi
git stash list                                        # un stash résiduel ? (git stash clear)
git log -1 --oneline -- <fichier>                     # dernier changement côté dépôt
git show HEAD:<fichier> | md5sum ; md5sum <fichier>   # l'écart est-il réel (contenu) ?
git diff --numstat -- public/game-data                # `0 0` = MODE SEUL · `- -` = binaire
git diff --summary -- public/game-data | head -3      # `mode change 100644 => 100755 <f>`
```

Le script écrit, **avant toute restauration**, un patch réversible dans
`/tmp/sigilos-ecrase-*.patch` (`git apply <patch>` pour revenir) : rien ne disparaît en
silence. Un média **volontairement** modifié côté serveur se **committe** — pour ces
dossiers, c'est le dépôt qui fait foi. Pour les chemins `SERVER_OWNED`, c'est l'**inverse** : le
serveur fait foi, aucune écriture n'a lieu, et une modification du dépôt sur ces chemins ne
s'applique **pas** toute seule (arbitrage du 30/09/2026 — à rouvrir si la propagation devient
nécessaire).

Le **rapport de fin** ne nomme que les vraies surprises. Les caches runtime **non suivis**
(`.webp` de la galerie God, proxy-cache, preuves téléversées) ne sont pas comptés — ils ne
bloquent pas le pull. Les listes curées non plus : elles sont remises à la version du dépôt
**avant** le rapport (mise de côté → pull → restaurée juste après), donc elles n'apparaissent
jamais en avertissement. Les fichiers `SERVER_OWNED` sont affichés en **information**, avec leur
détail par dossier (`monsters=63 harvest-icons=84 …`), jamais en avertissement. Ce qui reste = un
fichier **hors** des quatre classes, c'est-à-dire une édition locale assumée : le committer, ou
`git checkout -- <fichier>` / `git stash`.

## Déployer quand le VPS a des fichiers curés en local

Les listes God (`public/game-data/ignored-monsters.json`, etc.) sont **modifiées sur
le serveur** : elles sont donc toujours « sales » pour git — et c'est **voulu** : elles
appartiennent à la classe `PRESERVED` (tableau ci-dessus), la curation du serveur fait foi,
le script les met de côté le temps du pull puis les restaure.

```bash
# Le script le fait tout seul (sauvegarde hors de l'arbre → pull → restauration) :
./scripts/deploy-cd.sh beta
```

### ⚠️ Le piège qui a bloqué la beta le 18/09/2026

Certains fichiers curés portent les bits **`assume-unchanged` / `skip-worktree`**
(posés à la main pour ne plus voir le bruit dans `git status`). Git devient alors
**aveugle** sur leur contenu :

```
git ls-files -v public/game-data/ignored-monsters.json   → h (minuscule) ou S
git status --porcelain                                    → VIDE (git les croit propres)
git stash push -- <fichier>                               → "No local changes to save"
git pull --autostash origin dev                           → "Your local changes … would be overwritten by merge"
```

⇒ `--autostash` **ne protège pas** dans ce cas (il n'y a rien à stasher). Le
correctif est intégré à `git_fetch` (levée du bit par **appels séparés**, sauvegarde
hors de l'arbre, `git show HEAD:<f> > <f>`, pull, restauration de la curation).
**Déblocage manuel une seule fois** (séquence validée en bac à sable) :

```bash
cd ~/SigilOS
F=public/game-data/ignored-monsters.json

git ls-files -v "$F"                    # S (skip-worktree) ou h (assume-unchanged)

# 1) Lever le bit — DEUX appels SÉPARÉS (combinés, git 2.39 les ignore en silence)
git update-index --no-skip-worktree -- "$F"
git update-index --no-assume-unchanged -- "$F"
git ls-files -v "$F"                    # doit afficher H

# 2) Sauvegarder la curation, remettre la version du dépôt, pull, restaurer
cp "$F" /tmp/ignored-monsters.SAUVEGARDE.json
git show HEAD:"$F" > "$F"               # ⚠️ `git checkout -- "$F"` échoue avec le bit
git pull origin dev
cp /tmp/ignored-monsters.SAUVEGARDE.json "$F"

# 3) Vérifier
git rev-parse --short HEAD
grep -c autostash scripts/deploy-cd.sh  # ≥ 2 → correctif en place
```

Trois pièges git rencontrés le 18/09/2026 (reproduits en bac à sable, git 2.39) :

| Commande | Comportement |
|---|---|
| `git update-index --no-assume-unchanged --no-skip-worktree -- <f>` | **s'annulent en silence** (le drapeau reste `S`) → appels séparés |
| `git checkout -- <f>` sur un fichier `skip-worktree` | `error: pathspec … did not match any file(s) known to git` → utiliser `git show HEAD:<f> > <f>` |
| `git diff` / `git status` sur ce fichier | muets (git est aveugle) → comparer le **contenu** (`cmp -s`) |

## Diagnostic — un seul outil

```bash
./scripts/diagnose-vps-deploy.sh beta
```

Le script (lecture seule) vérifie dans l'ordre : état git (+ stash), espace disque,
empreinte Docker, conteneurs, **pull brut des 3 images**, variables d'`.env`, puis
imprime la cause probable. Il ne modifie rien.

## Table de correspondance panne → cause

| Symptôme | Cause réelle | Correctif |
|---|---|---|
| `git pull` refuse / « local changes would be overwritten » | fichier curé modifié sur le serveur | géré par `git_fetch` (sauvegarde hors arbre → pull → restauration) |
| ℹ️ « N fichier(s) suivi(s) portés par CE serveur » | écritures **légitimes** du serveur (galerie God, panneau God, siphons) | **rien à faire** : classe `SERVER_OWNED`, ni restaurée ni signalée ; le détail par dossier est affiché |
| ⚠️ « Des fichiers suivis modifiés hors des classes connues » à **chaque** déploiement, **toujours les mêmes** | fichier **binaire** suivi modifié côté serveur : `--autostash` ne peut **pas** le résorber | géré par `git_fetch` (classes `GENERATED`/`REPO_OWNED` restaurées **avant** le pull) — voir § L'arbre de travail du serveur |
| `git stash push` répond « No local changes to save » **puis** le merge refuse | bits `assume-unchanged` / `skip-worktree` → git aveugle | `git update-index --no-assume-unchanged --no-skip-worktree -- <fichier>` (voir juste au-dessus) |
| Le deploy s'arrête à l'étape **1.5 « Vérification du tag »** | le tag n'a jamais été publié par la CI | regarder **Build & Push** dans Actions, relancer après le vert |
| `no space left on device` pendant le pull | disque plein | `sudo docker system prune -af --volumes` |
| `denied` / `unauthorized` / `403` | token GHCR expiré | rafraîchir le secret `GHCR_TOKEN` puis re-relancer **Build & Push** |
| `manifest unknown` / `not found` | tag jamais publié (CI rouge) | attendre/relancer **Build & Push**, vérifier le nom du tag |
| Pull OK mais conteneur qui redémarre en boucle | variable d'env manquante / migration | `sudo docker logs --tail 80 sigilos-beta-app-1` · `npx prisma migrate deploy` |
| Migration bloquée (`P3009`) | migration échouée en base | `npx prisma migrate resolve --rolled-back <nom>` puis relancer |

### Vérifier un tag sans rien déployer

```bash
./scripts/deploy-cd.sh list beta da4ec40   # ✓ publié / ✗ absent, image par image
```

C'est le réflexe à avoir **avant un rollback** ou un deploy pinné : le script
s'arrête désormais à l'étape 1.5 si le tag manque, **avant** de toucher aux
conteneurs (le déploiement n'est donc jamais à moitié appliqué).

## Après le deploy

- Le deploy lance `npm run seed:docs` : une fiche de doc modifiée dans
  `src/lib/docs-catalog.ts` arrive automatiquement en base.
- Vérifier l'app : `sudo docker compose ps` (3 services `Up/healthy`), puis un
  chargement de page réel.
