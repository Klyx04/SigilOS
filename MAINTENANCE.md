# 🛠️ Maintenance VPS — SigilOS

Documentation des procédures de maintenance infrastructure pour le VPS SigilOS.

---

## 📅 Automation Quotidienne

### Backups (3h00 UTC)
```bash
Script: /home/sigiladmin/SigilOS/scripts/backup_db.sh
Logs: /home/sigiladmin/SigilOS/logs/backup.log
```

**Actions**:
1. Backup PostgreSQL (prod + beta)
2. Compression gzip
3. Chiffrement GPG
4. Upload vers Cloudflare R2
5. Rotation locale (30 jours)

### Maintenance (4h00 UTC)
```bash
Script: /home/sigiladmin/SigilOS/scripts/maintenance.sh
Logs: /home/sigiladmin/SigilOS/logs/maintenance.log
```

**Actions**:
1. Nettoyage Docker (images + build cache)
2. APT cleanup (autoremove + autoclean)
3. Rotation logs (journalctl 7j)
4. Rotation logs application (>10MB)
5. Alerte Discord si disque >85%

---

## 🔍 Monitoring

### Check Hardening
```bash
cd ~/SigilOS
./scripts/check-hardening.sh
```

**Vérifie**:
- Cron jobs configurés
- Espace disque
- Containers status
- SSH config
- Firewall UFW
- Fail2Ban
- Auto-updates
- Docker cleanup potentiel

### Logs Importants
```bash
# Backup execution
tail -f ~/SigilOS/logs/backup.log

# Maintenance execution
tail -f ~/SigilOS/logs/maintenance.log

# Application logs
sudo docker logs sigilos-prod --tail 100 -f
sudo docker logs sigilos-beta --tail 100 -f
```

---

## 🚨 Procédures d'Urgence

### Restauration Backup
```bash
# 1. Télécharger depuis R2
aws s3 cp s3://sigilos-backups/sigilos_YYYY-MM-DD_HH-MM-SS.sql.gz.gpg .

# 2. Déchiffrer
gpg --decrypt sigilos_*.sql.gz.gpg | gunzip > restore.sql

# 3. Restaurer
sudo docker exec -i sigilos-db-prod psql -U sigilos -d sigilos < restore.sql
```

### Rollback Déploiement
```bash
# ⏪ Méthode rapide (version "Ctrl+Z") — images taggées par SHA
./scripts/rollback.sh list beta        # trouver le SHA disponible
./scripts/rollback.sh beta <sha>       # revenir en beta

# 🐢 Méthode lente (ancienne) — re-build depuis un ancien commit
cd ~/SigilOS
git log --oneline -5  # Trouver le commit précédent
git reset --hard <commit-hash>
./scripts/deploy.sh beta  # ou prod
```
> ⚠️ NB : si la BDD a été migrée, un rollback de **code** ne restaure **pas** la BDD.
> Voir « Restauration Backup » pour revenir sur les données.

### Saturation Disque
```bash
# Nettoyage manuel immédiat
sudo docker image prune -a --force
sudo docker builder prune -a --force
sudo docker system prune -a --force
journalctl --vacuum-time=1d

# Vérifier gain
df -h
```

---

## 📊 Métriques Clés

### Stockage
- **Cible**: <50% utilisé
- **Alerte**: >85% (Discord webhook)
- **Action**: Cleanup manuel si alerte

### Containers
- **Attendu**: 11 containers UP
- **Critique**: app-prod, app-beta, db-prod, db-beta, caddy, redis

### Backups
- **Fréquence**: Quotidien @ 3h UTC
- **Rétention**: 30 jours local, illimité R2
- **Vérification**: `ls -lh backups/db/`

---

## 🔄 Mise à Jour Code (deploy.sh v2 — 2026-08)

### Beta
```bash
ssh vps
cd ~/SigilOS
git pull origin dev
./scripts/deploy.sh beta
```

### Production
```bash
# Local
git checkout main
git merge dev
git push origin main

# VPS
ssh vps
cd ~/SigilOS
git pull origin main
./scripts/deploy.sh prod
```

> ✅ **Rien ne change** dans la façon de déployer — les commandes sont identiques.
> La sortie est désormais **beaucoup plus claire** : build silencieux (fini les 263s de logs), résumé par étape, vérif de santé auto.

### Comportement du script v2 (changements 2026-08)

| Avant | Après | Bénéfice |
|-------|-------|----------|
| Build Docker verboose (84/84 étapes) | Build silencieux (`build -q`), erreurs seulement | Sortie lisible |
| `prisma db push` en PROD | `migrate deploy` **seul** en prod (db push reste beta) | Sécurité BDD |
| Seed `game-data.json` à chaque déploiement | Seed **conditionnel** (hash) | Moins d'indisponibilité |
| Page maintenance pouvait disparaître trop tôt | Caddy recréé qu'à la fin | Maintenance servie pendant tout |
| `up` sans attendre la santé | `up --wait` (healthchecks) | Fini les 502 |
| Rien après déploiement | Vérif santé auto `/api/health` | Contrôle immédiat |

### Seeding conditionnel (détail)
- Le seed ne tourne **que si** `prisma/seed-data/game-data.json` a changé depuis le dernier déploiement.
- Le hash est stocké dans `.deploy-seed-hash.<beta|prod>`.
- **Forcer** le seed : `SEED_ALWAYS=1 ./scripts/deploy.sh beta`
- **Première exécution** après ce changement : le seed tournera une fois (pas de hash en mémoire) — normal.

### Healthchecks ajoutés
`docker-compose.prod.yml` définit des healthchecks (ancres `x-healthchecks`) sur tous les services applicatifs :
- `app-prod/beta` → `curl http://localhost:3000/api/health`
- `worker-prod/beta` → `pgrep worker.js`
- `ws-prod/beta` → `pgrep ws-server.js`
- `db-prod/beta` → `pg_isready`
- `discord-bot-prod/beta` → `pgrep discord`

⚠️ **Premier déploiement après ce changement** : Caddy sera recréé (nouveau compose). Vérifier que la beta est saine avec le script automatique en fin de déploiement, ou `curl https://beta.sigilos.fr/api/health`.

---

## 📞 Contacts & Alertes

**Discord Webhook**: Configuré dans `.env.prod`  
**Variable**: `DISCORD_ADMIN_WEBHOOK`  
**Alertes**: Saturation disque >85%

---

## 🔐 Rapports d'audit (bonne pratique)

- Les rapports d'audit de sécurité (`AUDIT_SECURITE_SIGILOS.md`, `AUDIT_INFRA_SIGILOS.md`, briefs `retour-kimik3.md` et `src/audit-*`) sont **générés en local et JAMAIS commités** (ils décrivent des vulnérabilités précises → ne pas les exposer).
- Ils sont centralisés dans `docs/audits/` et ignorés via le `.gitignore` (`docs/audits/`, `AUDIT_*.md`, `src/audit-cyber`, `src/audit-infra`).
- Après un audit : mettre à jour `docs/SECURITY_HARDENING_PLAN.md` (état + chantiers) et lancer `npm run test:run` en local pour vérifier.
- Les secrets (`.env`, `.env.prod`, `.env.beta`) ne doivent jamais être commités ni partagés dans un canal non sécurisé.

---

## ✅ Checklist Mensuelle

- [ ] Vérifier backups R2 (existence + taille)
- [ ] Analyser logs maintenance (erreurs ?)
- [ ] Vérifier croissance DB (`df -h`)
- [ ] Tester restauration backup (dry-run)
- [ ] Vérifier mises à jour système (`apt list --upgradable`)
- [ ] Review Grafana dashboards
- [ ] Vérifier certificats SSL Caddy

---

## 🗺️ Plan d'Industrialisation (phases 2 & 3 — à faire plus tard)

> **État actuel** : phase 1 ✅ fait (2026-08) — déploiement plus clair, plus sûr (voir section « Mise à Jour Code »).
> Les phases 2 et 3 sont des **améliorations de confort/vitesse/sécurité**, **pas des corrections de bugs**. À implémenter quand on aura le temps.

### 📐 Phase 2 — Accélérer les builds (~3-4 min gagnées par déploiement)

**Problème** : le build `npm run build` (194s) tourne **3× en parallèle** (app-beta, worker-beta, ws-beta partagent le même Dockerfile) → gaspillage de CPU/RAM/temps.

**Solution prévue** :
- Créer une **image de base partagée** (`Dockerfile.base` : `npm ci` + `prisma generate`, taggée `sigilos-base:latest`).
- Les 3 services partent de cette base → le build n'est fait **qu'une seule fois**.
- Déplacer `build:seeds`, `build:siphon`, etc. **avant** le `COPY . .` pour profiter du cache Docker.
- (Optionnel) Docker build cache distant (BuildKit `cache-to` S3/GCS).

**Impact pour l'utilisateur** : aucun — toujours `./scripts/deploy.sh beta` / `prod`, juste plus rapide.

---

### 🏭 Phase 3 — Industrialisation complète

#### 3a. Rollback en 1 commande ✅ fait (2026-08)
- **Problème** : pas de bouton "annuler" si un déploiement casse la prod (il fallait retaper l'ancien code, rebuild).
- **Solution implémentée** :
  - `deploy.sh` v2 **tagge automatiquement** les images avec le SHA git court (`sigilos-app-beta:<sha>`, etc.) après chaque build, et **garde les 5 dernières** versions.
  - Nouveau script **`scripts/rollback.sh`** pour revenir en arrière.
- **Utilisation** :
  ```bash
  # Voir les versions disponibles
  ./scripts/rollback.sh list beta   # ou prod

  # Revenir à une version précise (le "Ctrl+Z" du déploiement)
  ./scripts/rollback.sh beta <sha>  # ou prod

  # Note : si la BDD a été migrée, un rollback de code ne restaure PAS la BDD
  # (voir procédure Restauration Backup + migrations en double).
  ```
- ⚠️ **Prérequis** : le premier `./scripts/deploy.sh` post-refactor doit tourner pour que les images soient taggées.

#### 3b. CI/CD GitHub Actions ✅ fait (2026-08)
- **Problème** : le build lourd tournait sur le VPS (~4 min à CPU/RAM à fond).
- **Solution implémentée** :
  - **`.github/workflows/deploy.yml`** : sur `push` vers `dev` (beta) ou `main` (prod), GitHub **build** les 4 images (app, worker, ws, discord-bot) et les **pousse vers GHCR** (GitHub Container Registry), taggées par SHA + `latest`.
  - **`scripts/deploy-cd.sh`** : sur le VPS, fait `pull` + `up -d --no-build` depuis GHCR → **aucun build local**, déploiement ~30s.
- **Utilisation** (sur le VPS, une fois GHCR_TOKEN défini) :
  ```bash
  export GHCR_TOKEN=<token read:packages>   # à définir une fois
  ./scripts/deploy-cd.sh beta <sha>          # déployer la version <sha> en beta
  ./scripts/deploy-cd.sh beta                # déployer latest
  ```
- **Note** : le workflow GHCR ne remplace PAS `verify.yml` (qui reste le garde-fou lint/test/audit). Les deux coexistent : `verify` valide, `deploy.yml` build/push.
- ⚠️ **Prérequis secrets GitHub** : `BETA_PASSWORD` (settings > secrets). `NEXT_PUBLIC_APP_URL` est défini automatiquement selon la branche.
- ⚠️ **GHCR Token sur le VPS** : générer un PAT GitHub avec scope `read:packages`, et l'exporter (ou le mettre dans le `.bashrc`/cron).

#### 3c. Séparer le Redis beta/prod (chantier I-07)
- **Problème** : la beta et la prod partagent le **même Redis** → risque de collision de jobs BullMQ/queues.
- **Solution** : un Redis dédié par environnement.
- **Impact** : aucun pour l'utilisateur, plus sûr.

---

### 📌 Priorité recommandée (mise à jour 2026-08)
**Fait** : phase 1, 3a (rollback), 3b (CI/CD GHCR).
**Reste** :
1. **3c** (séparer le Redis beta/prod) — chantier de sécurité I-07 déjà recensé dans SECURITY.md.
2. **Phase 2** (image de base partagée) — optionnel, le CI/CD règle déjà le build redondant sur le VPS.


