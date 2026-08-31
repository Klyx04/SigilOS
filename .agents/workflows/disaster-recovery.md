---
description: Plan de Reprise d'Activité (PRA) — Restore depuis un backup chiffré R2
---

# 🛡️ PRA SigilOS — Restauration depuis Cloudflare R2

> À utiliser en cas de corruption de DB, bascule Beta ➔ Prod, perte du VPS, ou incident critique.
> Les backups sont des dumps intégraux PostgreSQL (`pg_dumpall`), chiffrés AES-256 (GPG) et stockés sur Cloudflare R2.

---

## 🏗️ Ce qui est restauré lors d'un PRA
Le dump `pg_dumpall` contient **100%** de l'état applicatif :
- Profils utilisateurs (`User`, `Account`, `UserProfile`), mules, planning et disponibilités.
- Builds Galerie de Stuff (`dofusBookLinks`), classes associées et tags.
- Progression Quêtes Dofus, Dokille (20 krokilles) et Rush Sylvestre / Ganymède (`UserGuideProgress`, bookmarks, étapes).
- Donjons, Songes Infinis (`DreamRun`), Défis (`Defi`), progression succès.
- Catalogue de jeu local (`GameItem`, zones, monstres, boss).
- Tickets de support, sondages, notes internes et logs.

---

## 📋 Prérequis sur le VPS

```bash
# Vérifier les dépendances
aws --version      # AWS CLI (accès R2)
gpg --version      # GPG (déchiffrement AES-256)
docker ps          # Docker opérationnel
```

---

## 🚀 Procédure de Restauration Rapide (1-Clic Automatisé)

### A. Restauration de la Prod depuis le dernier backup Beta (Bascule Jour J)
```bash
# Télécharge automatiquement le dernier backup Beta sur R2, le déchiffre et l'injecte dans sigilos-db-prod :
./scripts/restore_db.sh prod --download-latest
```

### B. Restauration d'Urgence Prod (Dernier backup Prod)
```bash
# En cas d'incident sur la Prod :
./scripts/restore_db.sh prod --download-latest
```

### C. Restauration d'un fichier spécifique
```bash
# Si tu souhaites cibler un timestamp précis :
./scripts/restore_db.sh prod sigilos_prod_2026-08-31_04-00-00.sql.gz.gpg
```

---

## 🔍 Étape de Vérification Post-Restauration

Exécuter cette requête SQL pour valider le volume des données restaurées :
```bash
docker exec sigilos-db-prod psql -U user -d sigilos -c "
SELECT 'Comptes' AS entite, COUNT(*) FROM \"User\"
UNION ALL SELECT 'Profils Membres', COUNT(*) FROM \"UserProfile\"
UNION ALL SELECT 'Guildes', COUNT(*) FROM \"GuildConfig\"
UNION ALL SELECT 'Items Siphonnés', COUNT(*) FROM \"GameItem\"
UNION ALL SELECT 'Dofus', COUNT(*) FROM \"DofusItem\"
UNION ALL SELECT 'Progression Dofus', COUNT(*) FROM \"UserDofusProgress\"
UNION ALL SELECT 'Runs Songes', COUNT(*) FROM \"DreamRun\";
"
```

---

## 🔄 Redémarrage des Conteneurs

Pour vider les caches mémoire Prisma et forcer la reconnexion du pool de connexions :
```bash
docker restart sigilos-prod
```

---

## 🕐 Fréquence & Rétention des Backups
- **Fréquence :** Chaque nuit à **4h00** via `scripts/backup_db.sh` dans le crontab.
- **Chiffrement :** Symétrique AES-256 avec la clé `BACKUP_ENCRYPTION_KEY`.
- **Rétention Locale :** 3 jours (purgé automatiquement).
- **Rétention R2 :** Géré par la Lifecycle Rule du bucket Cloudflare R2 `sigilos-backups`.
