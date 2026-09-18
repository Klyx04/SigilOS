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
deploy` → `docker login` GHCR → `docker pull` des 3 images (`app`, `worker`, `ws`) →
`docker compose up -d` → healthchecks.

## Déployer quand le VPS a des fichiers curés en local

Les listes God (`public/game-data/ignored-monsters.json`, etc.) sont **modifiées sur
le serveur** : elles sont donc toujours « sales » pour git.

```bash
# deploy-cd.sh le fait déjà pour toi (git pull --autostash) :
./scripts/deploy-cd.sh beta
```

Si tu veux le faire à la main (ou si un autostash a été interrompu) :

```bash
git stash push -- public/game-data/ignored-monsters.json
git pull
git stash pop
# Conflit attendu ? Le serveur fait foi pour ces fichiers :
git checkout --theirs -- public/game-data/ignored-monsters.json && git stash drop
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
| `git pull` refuse / « local changes would be overwritten » | fichier curé modifié sur le serveur | `git pull --autostash` (déjà dans `deploy-cd.sh`) |
| `no space left on device` pendant le pull | disque plein | `sudo docker system prune -af --volumes` |
| `denied` / `unauthorized` / `403` | token GHCR expiré | rafraîchir le secret `GHCR_TOKEN` puis re-relancer **Build & Push** |
| `manifest unknown` / `not found` | tag jamais publié (CI rouge) | attendre/relancer **Build & Push**, vérifier le nom du tag |
| Pull OK mais conteneur qui redémarre en boucle | variable d'env manquante / migration | `sudo docker logs --tail 80 sigilos-beta-app-1` · `npx prisma migrate deploy` |
| Migration bloquée (`P3009`) | migration échouée en base | `npx prisma migrate resolve --rolled-back <nom>` puis relancer |

## Après le deploy

- Le deploy lance `npm run seed:docs` : une fiche de doc modifiée dans
  `src/lib/docs-catalog.ts` arrive automatiquement en base.
- Vérifier l'app : `sudo docker compose ps` (3 services `Up/healthy`), puis un
  chargement de page réel.
