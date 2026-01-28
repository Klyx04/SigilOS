# Guide de Déploiement VPS

Ce document décrit les étapes pour déployer SigilOS sur un VPS Linux.

## Prérequis

- VPS avec Ubuntu 22.04+ (ou Debian 11+)
- Node.js 22+ installé
- PostgreSQL 15+ (local ou hébergé)
- Nginx (reverse proxy)
- Domaine avec certificat SSL (Let's Encrypt)

---

## 1. Variables d'Environnement

Créer un fichier `.env` sur le VPS avec :

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/sigilos?schema=public"

# Auth.js
AUTH_SECRET="clé_secrète_longue_générée_avec_openssl"
AUTH_DISCORD_ID="ton_discord_client_id"
AUTH_DISCORD_SECRET="ton_discord_client_secret"

# Discord Bot
DISCORD_BOT_TOKEN="ton_bot_token"
DISCORD_PUBLIC_KEY="ta_public_key"

# Guilds autorisées (séparées par des virgules)
ALLOWED_GUILD_IDS="1234567890,0987654321"

# Cron Security
CRON_SECRET="clé_secrète_pour_cron_job"

# Production
NODE_ENV="production"
```

---

## 2. Build et Démarrage

```bash
# Installer les dépendances
npm ci --production=false

# Générer Prisma
npx prisma generate

# Migrer la base de données
npx prisma migrate deploy

# Build Next.js
npm run build

# Démarrer en production
npm run start
```

Pour un démarrage automatique, utiliser **PM2** :

```bash
# Installer PM2
npm install -g pm2

# Démarrer l'app
pm2 start npm --name "sigilos" -- start

# Auto-restart au reboot
pm2 startup
pm2 save
```

---

## 3. Configuration Nginx

Créer `/etc/nginx/sites-available/sigilos` :

```nginx
server {
    listen 80;
    server_name ton-domaine.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ton-domaine.com;

    ssl_certificate /etc/letsencrypt/live/ton-domaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ton-domaine.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Activer le site :

```bash
sudo ln -s /etc/nginx/sites-available/sigilos /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 4. Cron Job - Synchronisation des Membres

Éditer le crontab :

```bash
crontab -e
```

Ajouter cette ligne pour sync quotidienne à 4h du matin :

```bash
0 4 * * * curl -X GET -H "x-cron-secret: TA_CRON_SECRET" https://ton-domaine.com/api/sync/members >> /var/log/sigilos-sync.log 2>&1
```

### Alternatives de fréquence :

| Expression | Signification |
|------------|---------------|
| `0 4 * * *` | Tous les jours à 4h |
| `0 */6 * * *` | Toutes les 6 heures |
| `0 4 * * 1` | Tous les lundis à 4h |

### Vérifier le cron :

```bash
# Voir les crons actifs
crontab -l

# Voir les logs
tail -f /var/log/sigilos-sync.log
```

---

## 5. Cleanup des Profils Archivés

Le cleanup des profils archivés (suppression après 90j/30j selon le cas) 
peut être déclenché via le même principe :

```bash
# Ajouter au crontab (1x par semaine, dimanche 3h)
0 3 * * 0 curl -X POST -H "x-cron-secret: TA_CRON_SECRET" https://ton-domaine.com/api/lifecycle/cleanup >> /var/log/sigilos-cleanup.log 2>&1
```

> Note : L'endpoint `/api/lifecycle/cleanup` peut être créé si nécessaire.

---

## 6. Sécurité

### Firewall (UFW)

```bash
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Fail2Ban

```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

### Mises à jour automatiques

```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

---

## 7. Monitoring

### Logs Next.js (via PM2)

```bash
pm2 logs sigilos
```

### Status de l'app

```bash
pm2 status
```

### Ressources système

```bash
htop
```
