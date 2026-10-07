---
description: How to safely push a feature branch to GitHub (avoid CI lockfile crashes)
---

// turbo-all

## Avant chaque push — Checklist anti-crash CI

### 0. La porte de sécurité (hook `pre-push`, même commande que la CI)

```bash
npm run security:audit          # exécuté automatiquement par le hook `pre-push`
SKIP_AUDIT=1 git push           # échappatoire assumée (jamais en CI)
```

> **Pourquoi elle existe** (mesure du 05/10/2026) : deux PR Dependabot sont parties rouges parce
> que `npm audit` n'était vérifié **qu'en CI**. `dev` était lui-même rouge — 7 avis, dont 5 `high`
> venant d'**une seule chaîne de développement** (`eslint-config-next` → `fast-glob` → `micromatch`
> → `braces`, ce dernier sans version corrigée publiée). Toute PR naissait donc rouge.
>
> La porte est volontairement **asymétrique** (`scripts/security-gate.mjs`) :
> 1. **le livré** (`--omit=dev`) — échec sur `high` ou `critical` ;
> 2. **tout l'arbre** — échec sur `critical` seulement (un `high` de dev, non livré, n'empêche plus
>    une PR ; il reste **visible** à chaque run et **bloquant** dans le job hebdo).
>
> Ce qui est ignoré est toujours **écrit** dans la sortie : aucune exception silencieuse.

### 1. Toujours sync avec `dev` avant de push
```bash
git fetch origin dev
git merge origin/dev --no-edit
```
> ⚠️ OBLIGATOIRE si la branche a plus de 24h ou si Dependabot a mergé entre-temps.
> Sans ça, `npm ci` sur le robot CI crashe avec `EUSAGE` (lockfile désynchronisé).

### 2. Régénérer le lockfile après merge
```bash
npm install --package-lock-only
```
> ⚠️ Utiliser `--package-lock-only` (pas juste `npm install`) pour forcer la résolution complète de **toutes** les sous-dépendances (ex: `@prisma/debug`) sans toucher à `node_modules`.

### 3. Vérifier qu'il n'y a pas de fichiers temporaires à exclure
```bash
git status --short
```
Exclure du commit : `scratch-*.ts`, `tmp_*.js`, `scripts/check-*.ts`, etc.

### 4. Stager les fichiers (en excluant les scripts de test)
```bash
git add . -- ':!scratch-test.ts' ':!tmp_check.js'
```

### 5. Commit (le pre-commit hook tourne automatiquement)
```bash
git commit -m "feat: ..."
```
Le hook vérifie : secrets ✅ · lint ✅ · TypeScript ✅

### 6. Push
```bash
git push origin feat/ma-branche
```

---

## Pourquoi ce workflow ?

Dependabot merge des mises à jour dans `dev` chaque semaine. Ces merges modifient
`package.json` ET `package-lock.json`. Si ta branche est basée sur une version
antérieure, le robot CI (qui utilise `npm ci`) détecte le désaccord et crash
avec l'erreur :

```
npm error `npm ci` can only install packages when your package.json
and package-lock.json are in sync.
```

Un simple `git merge origin/dev` avant le push évite systématiquement ce crash.
