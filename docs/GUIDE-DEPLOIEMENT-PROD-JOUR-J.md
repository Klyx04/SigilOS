# 🚀 GUIDE TECHNIQUE DU JOUR J — DÉPLOIEMENT PROD & BASLE PRA/PRI (ANTI-REGRESSION)

> **Document Maître d'Exploitation & de Bascule Prod**
> Prépare et cadre la bascule de la Beta vers la Production officielle (`sigilos.fr`) sans perte de données, sans régression d'assets et sans conflit Discord.

---

## 🎯 Architecture Cible au Jour J

```
                      INTERNET / UTILISATEURS
                               │
                       [ CADDY REVERSE PROXY ]
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
     https://sigilos.fr                   https://beta.sigilos.fr
     [ PROD ENVIRONNEMENT ]               [ BETA ENVIRONNEMENT ]
     - Conteneur: sigilos-prod            - Conteneur: sigilos-beta
     - DB: sigilos-db-prod                - DB: sigilos-db-beta
     - Bot: App Discord PROD              - Bot: App Discord BETA
     - Env: .env.prod                     - Env: .env.beta
            │                                     │
            └──────────────────┬──────────────────┘
                               │
                   [ ASSETS PARTAGÉS VPS ]
                   /var/sigilos-assets/
                   ├── game-data/ (tiles 13k, hd_maps 15k)
                   └── uploads/ (monstres WebP, avis, custom icons)
```

---

## 📋 Table des Matières
1. [Étape 1 — Configuration des 2 Applications Discord (Developer Portal)](#1-applications-discord)
2. [Étape 2 — Mutualisation des Assets Disque (0 Mo en double)](#2-mutualisation-assets)
3. [Étape 3 — Migration de la Base de Données (PRA : Beta ➔ Prod)](#3-migration-db)
4. [Étape 4 — Déploiement Applicatif & Migrations Prisma](#4-deploiement-app)
5. [Étape 5 — Configuration Caddy (Ouverture du site officiel)](#5-configuration-caddy)
6. [Étape 6 — Matrice de Vérification Post-Bascule & Checklist](#6-verifications)
7. [Étape 7 — Procédure de Rollback Immédiat](#7-rollback)

---

## <a id="1-applications-discord"></a>1. Configuration des 2 Applications Discord

> ⚠️ **Règle absolue :** Ne jamais mélanger le bot de Beta et le bot de Prod.

### A. Création sur le Discord Developer Portal
1. Créer une nouvelle application : **`SigilOS`** (pour la Prod).
2. L'application existante reste : **`SigilOS [Beta]`**.

### B. Configuration de l'Application PROD
- **OAuth2 → General :**
  - Redirects : `https://sigilos.fr/api/auth/callback/discord`
- **Bot :**
  - Récupérer le `DISCORD_BOT_TOKEN`.
  - Privileged Gateway Intents : `SERVER MEMBERS INTENT`, `MESSAGE CONTENT INTENT`.
- **General Information :**
  - Récupérer `APPLICATION ID` (`DISCORD_CLIENT_ID`) et `PUBLIC KEY` (`DISCORD_PUBLIC_KEY`).
  - Interactions Endpoint URL : `https://sigilos.fr/api/discord/interactions`
- **Installation / Permissions :**
  - Lien d'invitation avec les permissions requises (`bitmask 6356836904068`) pour inviter le bot sur le serveur Discord de la guilde.

### C. Fichier `.env.prod` sur le VPS
```ini
NEXTAUTH_URL=https://sigilos.fr
NEXT_PUBLIC_APP_URL=https://sigilos.fr

# Discord OAuth & Bot (PROD)
DISCORD_CLIENT_ID="<ID_APP_PROD>"
DISCORD_CLIENT_SECRET="<SECRET_APP_PROD>"
DISCORD_BOT_TOKEN="<TOKEN_BOT_PROD>"
DISCORD_PUBLIC_KEY="<PUBLIC_KEY_PROD>"

# Base de données & Redis
DATABASE_URL="postgresql://user:<PASSWORD>@sigilos-db-prod:5432/sigilos?schema=public"
REDIS_URL="redis://:password@sigilos-redis-prod:6379"

# R2 Backup & Chiffrement
R2_ENDPOINT_URL="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID="<R2_KEY>"
R2_SECRET_ACCESS_KEY="<R2_SECRET>"
R2_BUCKET_NAME="sigilos-backups"
BACKUP_ENCRYPTION_KEY="<CLE_GPG_AES256>"
```

---

## <a id="2-mutualisation-assets"></a>2. Mutualisation des Assets Disque (0 Mo en double)

Sur le VPS, les tuiles de la Worldmap (`~13 000 fichiers`), les cartes HD (`~15 000 fichiers`) et les monstres siphonnés WebP vivent déjà sur la Beta.

### Option A — Hardlinks immédiats (Recommandé, simple & 0 Mo)
Sur le VPS (`sigiladmin`) :
```bash
# 1. Créer les dossiers de destination sur la Prod
mkdir -p /home/sigiladmin/SigilOS/public/game-data
mkdir -p /home/sigiladmin/SigilOS/public/uploads

# 2. Lier les blocs physiques des assets Beta vers Prod (0 octet supplémentaire)
cp -al /home/sigiladmin/SigilOS_beta/public/game-data/* /home/sigiladmin/SigilOS/public/game-data/
cp -al /home/sigiladmin/SigilOS_beta/public/uploads/* /home/sigiladmin/SigilOS/public/uploads/
```

### Option B — Si synchronisation depuis la machine locale
Si de nouvelles maps ont été générées en local :
```bash
# Dans WSL / Git Bash local :
./scripts/sync-assets.sh prod
```

---

## <a id="3-migration-db"></a>3. Migration de la Base de Données (PRA : Beta ➔ Prod)

Pour conserver tous les profils, les builds de stuff, les quêtes, le Dokille, les progressions Ocre et les runs Songes :

```bash
# 1. Effectuer le dump chiffré complet de la Beta et envoi sur Cloudflare R2
./scripts/backup_db.sh beta

# 2. Télécharger et restaurer ce dernier dump directement sur la Prod
./scripts/restore_db.sh prod --download-latest

# 3. Vérifier le compte des tables restaurées
docker exec sigilos-db-prod psql -U user -d sigilos -c "
SELECT 'Users' AS table_name, COUNT(*) FROM \"User\"
UNION ALL SELECT 'UserProfile', COUNT(*) FROM \"UserProfile\"
UNION ALL SELECT 'GuildConfig', COUNT(*) FROM \"GuildConfig\"
UNION ALL SELECT 'GameItem', COUNT(*) FROM \"GameItem\"
UNION ALL SELECT 'DofusItem', COUNT(*) FROM \"DofusItem\";
"
```

---

## <a id="4-deploiement-app"></a>4. Déploiement Applicatif & Migrations Prisma

```bash
# 1. Se placer dans le répertoire Prod du VPS
cd /home/sigiladmin/SigilOS

# 2. Mettre à jour le code vers la branche main
git checkout main
git pull origin main

# 3. Déployer les migrations Prisma sur la base Prod
npx prisma@7.9.1 migrate deploy

# 4. Lancer le déploiement de l'image de production
./scripts/deploy.sh prod
```

---

## <a id="5-configuration-caddy"></a>5. Configuration Caddy (Ouverture du site officiel)

### Modification du `Caddyfile` sur le VPS :
1. Ouvrir le Caddyfile :
   ```bash
   sudo nano /etc/caddy/Caddyfile
   ```
2. Remplacer la règle de maintenance par le reverse proxy vers `sigilos-prod:3000` :
   ```caddy
   sigilos.fr {
       encode zstd gzip

       # Rate limiting & Security headers
       header {
           Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
           X-Content-Type-Options "nosniff"
           X-Frame-Options "DENY"
           Referrer-Policy "strict-origin-when-cross-origin"
       }

       reverse_proxy sigilos-prod:3000
   }
   ```
3. Recharger Caddy à chaud (zéro coupure) :
   ```bash
   sudo systemctl reload caddy
   ```

---

## <a id="6-verifications"></a>6. Matrice de Vérification Post-Bascule & Checklist

| # | Élément à Tester | Action / URL | Résultat Attendu |
|---|---|---|---|
| 1 | **Connexion Discord** | Clic sur "Connexion" sur `https://sigilos.fr` | Redirection Discord OAuth OK, connexion transparente sans perte de profil. |
| 2 | **Galerie de Stuff** | `/dashboard/[guildId]/stuff-hub` | Builds de stuff, classes et tags intacts. |
| 3 | **Progression Dofus** | `/dashboard/[guildId]/quetes-dofus` | Grille 3 colonnes, étapes cochées, Dokille synchronisé. |
| 4 | **Worldmap & Tuiles** | `/dashboard/[guildId]/worldmap` | Zoom fluide 0..6, aucune tuile grise/manquante. |
| 5 | **Fiches Boss & Sorts** | `/dashboard/[guildId]/succes` | Maps Dofensive chargées, géométrie isométrique OK. |
| 6 | **Recherche Cmd+K** | Raccourci `Cmd+K` / `Ctrl+K` | Recherche fonctionnelle sur Items, Dofus, Quêtes et Membres. |
| 7 | **Interactions Bot** | Bouton Discord (Ticket / Sortie Donjon) | Réponse éphémère immédiate du bot PROD. |
| 8 | **Crons & Sauvegardes** | Vérifier crontab VPS | `backup_db.sh prod` tourne à 4h00 vers R2. |

---

## <a id="7-rollback"></a>7. Procédure de Rollback Immédiat

Si un problème bloquant survient lors de l'ouverture :
```bash
# 1. Remettre la page de maintenance Caddy instantanément
sudo nano /etc/caddy/Caddyfile # Réactiver : rewrite * /maintenance.html
sudo systemctl reload caddy

# 2. Restaurer la DB précédente si nécessaire
./scripts/restore_db.sh prod <nom_du_backup_pre_deploy>.sql.gz.gpg

# 3. Laisser la Beta intacte pour que la guilde continue de jouer sans interruption
```
