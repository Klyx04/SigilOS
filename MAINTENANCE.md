# 🛠️ SigilOS : Manuel de Maintenance

Ce document contient toutes les procédures pour maintenir SigilOS en conditions opérationnelles. **Réservé à l'administrateur système (Klyx).**

---

## 🏗️ Architecture des Environnements

| Environnement | Domain | Docker Container | DB Container |
| :--- | :--- | :--- | :--- |
| **Production** | sigilos.fr | `sigilos-prod` | `sigilos-db-prod` |
| **Bêta** | beta.sigilos.fr | `sigilos-beta` | `sigilos-db-beta` |
| **Monitoring** | monitor.sigilos.fr | `sigilos-grafana` | - |

---

## 🚀 Procédures de Déploiement

### Déployer la Bêta (Labo)
C'est ici qu'on teste les nouveautés avec la guilde Stellium.
```bash
./scripts/deploy.sh beta
```

### Déployer la Production (Live)
À ne faire QUE si la Bêta est validée.
```bash
./scripts/deploy.sh prod
```

### Procédure de secours (Rollback)
Si la production crash après une mise à jour :
```bash
# On arrête le nouveau conteneur fautif
docker stop sigilos-prod
# On relance l'ancienne version stable (si image dispo)
./scripts/deploy.sh prod
```

---

## 🔐 Gestion des Secrets (.env)

Les fichiers d'environnement sont sur le VPS dans le dossier racine :
- `.env.prod` : Configuration réelle.
- `.env.beta` : Configuration tests.

**Action requise après modification :** Relancer `./scripts/deploy.sh [env]` pour que Next.js prenne en compte les changements.

---

## 🛡️ Sécurité & Hardening

1. **Rotation des clés** : Changer `ENCRYPTION_KEY` tous les 12 mois (Attention: demande un script de re-chiffrement).
2. **Logs d'Audit** : Consultables dans le dashboard `/god` ou directement en base via `select * from "AuditLog"`.
3. **Images Docker** : Nettoyer régulièrement pour économiser le disque :
   ```bash
   docker image prune -f
   ```

---

## 📊 Monitoring (Grafana)

URL : [https://monitor.sigilos.fr](https://monitor.sigilos.fr)
- **Login** : GitHub OAuth (Uniquement Klyx04).
- **Statut** : Vérifier les jauges de CPU et RAM avant chaque grosse mise à jour.

---

## ⚖️ Rétention GDPR (Janitor)

Le script de nettoyage tourne automatiquement ou peut être lancé manuellement depuis la page `/god`.
- **Ghost Users** : Supprimés après 24h sans profil créé.
- **Profils Archivés** : Wipe total après 90 jours d'inactivité.
- **Force Wipe** : Possible via `MemberHistory` dans l'admin si un membre est banni.

---

## 🆘 En cas de pépin

1. **Le site répond 502 Bad Gateway** : Caddy ne trouve plus le conteneur `app-prod`. Vérifier si le conteneur crashed : `docker ps -a`.
2. **Erreur de BDD (Prisma)** : Lancer `npx prisma db push` (seulement si le script de déploiement a échoué).
3. **Redis Error** : Vérifier le mot de passe dans le `.env` et dans `docker-compose`.

---
*Dernière mise à jour : Février 2026 - Antigravity (IA)*
