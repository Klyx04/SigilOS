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

## Déployer quand le VPS a des fichiers curés en local

Les listes God (`public/game-data/ignored-monsters.json`, etc.) sont **modifiées sur
le serveur** : elles sont donc toujours « sales » pour git.

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
correctif est intégré à `git_fetch` (levée du bit, sauvegarde hors de l'arbre,
pull, restauration de la curation). **Déblocage manuel une seule fois** :

```bash
cd ~/SigilOS
F=public/game-data/ignored-monsters.json

git ls-files -v "$F"                                        # h / S = le piège
git update-index --no-assume-unchanged --no-skip-worktree -- "$F"

cp "$F" /tmp/ignored-monsters.SAUVEGARDE.json                # curation serveur
git checkout -- "$F"                                        # version du dépôt
git pull origin dev                                         # passe (fast-forward)
cp /tmp/ignored-monsters.SAUVEGARDE.json "$F"                # curation restaurée

git rev-parse --short HEAD                                  # le commit attendu
grep -c autostash scripts/deploy-cd.sh                      # ≥ 2 → correctif en place
```

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
