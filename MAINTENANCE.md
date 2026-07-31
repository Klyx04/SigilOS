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
# Revenir au commit précédent
cd ~/SigilOS
git log --oneline -5  # Trouver le commit précédent
git reset --hard <commit-hash>

# Redéployer
./scripts/deploy.sh beta  # ou prod
```

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

## 🔄 Mise à Jour Code

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

---

## 📞 Contacts & Alertes

**Discord Webhook**: Configuré dans `.env.prod`  
**Variable**: `DISCORD_ADMIN_WEBHOOK`  
**Alertes**: Saturation disque >85%

---

## 🔐 Rapports d'audit (bonne pratique)

- Les rapports d'audit de sécurité (`AUDIT_SECURITE_SIGILOS.md`, `AUDIT_INFRA_SIGILOS.md`, briefs `src/audit-*`) sont **générés en local et JAMAIS commités** (ils décrivent des vulnérabilités précises → ne pas les exposer).
- Ils sont ignorés via le `.gitignore` (`AUDIT_*.md`, `src/audit-cyber`, `src/audit-infra`).
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
