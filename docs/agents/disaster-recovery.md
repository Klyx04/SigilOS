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

> 🔑 **`BACKUP_ENCRYPTION_KEY` doit être disponible HORS du VPS** (gestionnaire de mots de passe
> du mainteneur, coffre hors ligne). La clé ne vit que dans `.env.prod` / `.env.beta` : si le VPS
> est perdu, elle part avec lui et **toutes les archives R2 deviennent illisibles**. Un PRA sans
> cette clé rangée ailleurs n'est pas un PRA.

---

## 🚀 Procédure de Restauration Rapide (1-Clic Automatisé)

> ⚠️ **Arrêter les conteneurs applicatifs avant** (`sigilos-prod`, `sigilos-beta`, worker, bot, ws) :
> `pg_dumpall -c` commence par des `DROP DATABASE`, qu'une connexion active fait échouer. Depuis le
> 29/10/2026 le script s'arrête à la première erreur (`ON_ERROR_STOP=1`) et sort en **code 1** au
> lieu d'annoncer un faux succès : un échec est visible, mais il ne répare rien.

### A. Restauration de la Prod depuis le dernier backup Beta (Bascule Jour J)
```bash
# `--from beta` = on lit la SOURCE (beta) et on écrit dans la CIBLE (prod).
# Sans `--from`, le script restaure le dernier backup de la cible (`sigilos_prod_`).
./scripts/restore_db.sh prod --download-latest --from beta
```

### B. Restauration d'Urgence Prod (Dernier backup Prod)
```bash
# En cas d'incident sur la Prod :
./scripts/restore_db.sh prod --download-latest
```

### C. Restauration d'un fichier spécifique
```bash
# Le nom nu est résolu dans `backups/db/` (plus besoin du chemin complet) :
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
- **Fréquence :** chaque nuit à **3h00 UTC** (4h00 Paris l'hiver) via `scripts/backup_db.sh` dans le crontab.
- **Chiffrement :** symétrique AES-256 avec la clé `BACKUP_ENCRYPTION_KEY` (voir le prérequis hors site).
- **Rétention locale :** les **5** derniers `.gpg` (`BACKUP_LOCAL_KEEP`), jamais supprimés « au temps »
  sans tenir compte de ce qui reste — l'ancien `-mtime +3` pouvait emporter la seule copie restante
  pendant une panne d'upload.
- **Rétention R2 :** **bornée par le script lui-même**, pas par une Lifecycle Rule externe (celle-ci se
  perd avec l'abonnement Cloudflare — mesuré le 29/10/2026) :
  **7 derniers dumps** (`BACKUP_KEEP_DAILY`) + **le dernier de chacun des 3 derniers mois**
  (`BACKUP_KEEP_MONTHLY`), avec un **plafond dur de 4 Go** (`BACKUP_R2_MAX_MB`, soit 40 % des 10 Go du
  plan gratuit). Au-delà, le script purge du plus ancien et **alerte** si le plafond reste dépassé.
- **Coût :** plan gratuit R2 (10 Go, 1 M op. A, 10 M op. B / mois). Écritures et suppressions d'un dump
  par nuit = quelques opérations par mois ; la sortie de données est gratuite. **Aucune facture tant
  que le bucket reste sous le plafond** — d'où le plafond dans le script plutôt qu'une confiance dans
  la règle Cloudflare.

## ⚠️ Ce qui n'est PAS dans le dump

| Non sauvegardé | Conséquence | Contournement |
|---|---|---|
| `private_uploads` (preuves, visuels de guilde, médias marché) | images cassées après restauration | volume Docker sur le VPS : à copier à part si le disque est perdu |
| Redis (files BullMQ, caches) | jobs en attente perdus, aucun impact sur les données | — |
| `.env.*` (secrets, dont `BACKUP_ENCRYPTION_KEY`) | réinstallation complète impossible sans eux | coffre hors ligne obligatoire |
| État antérieur à J-1 | RPO = 24 h (pas d'archivage WAL) | — |
