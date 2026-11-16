# 🚀 GUIDE TECHNIQUE DU JOUR J — DÉPLOIEMENT PROD & BASLE PRA/PRI (ANTI-REGRESSION)

> **Document Maître d'Exploitation & de Bascule Prod**
> Prépare et cadre la bascule de la Beta vers la Production officielle (`sigilos.fr`) sans perte de données, sans régression d'assets et sans conflit Discord.

> ⚠️ **État mesuré le 16/11/2026** — les trous de ce guide ont été corrigés dans cette version :
> ① le bloc Caddy à appliquer est celui de la **bêta** (le snippet minimal précédent cassait la worldmap
> et les WebSockets) ; ② le `Caddyfile` est **versionné** et monté dans le conteneur (`docker-compose.prod.yml:307`),
> on ne l'édite pas dans `/etc/caddy/` ; ③ le partage des assets `game-data` est à **vérifier** (voir §2) et les
> WebP siphonnés sont dans des **volumes Docker séparés** ; ④ `.env.prod` liste désormais les variables dont
> l'absence **empêche le démarrage** (`src/lib/env.ts:62-71`) ; ⑤ la matrice §6 couvre les interactions réelles
> (commandes slash, WebSocket, crons, webhooks, Workers). **Décision restante** : prod et bêta partagent-elles
> le même checkout `/home/sigiladmin/SigilOS` (le compose actuel le suppose) ou deux dossiers distincts ?

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
  - Lien d'invitation avec les permissions requises (`bitmask 326686043268`, 11 droits — voir `src/lib/discord-permissions.ts`) pour inviter le bot sur le serveur Discord de la guilde.

### C. Fichier `.env.prod` sur le VPS

> **Source de vérité** : `.env.example` (racine) + `src/lib/env.ts`. En production, le démarrage est
> **refusé** si l'une des variables critiques manque (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_DISCORD_ID`,
> `AUTH_DISCORD_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`, `STORAGE_SIGNING_SECRET`, `GOD_ROUTE`).
> Ne jamais réutiliser les secrets de la bêta.

```ini
# ── Identité ────────────────────────────────────────────────────────────────
NODE_ENV="production"
AUTH_URL="https://sigilos.fr"
NEXTAUTH_URL="https://sigilos.fr"          # alias historique, même valeur
NEXT_PUBLIC_APP_URL="https://sigilos.fr"

# ── Auth.js / Discord OAuth (noms canoniques) ────────────────────────────────
AUTH_SECRET="<openssl rand -base64 32>"
AUTH_DISCORD_ID="<ID_APP_PROD>"
AUTH_DISCORD_SECRET="<SECRET_APP_PROD>"
AUTH_DISCORD_ISSUER="https://discord.com"  # sans ça : error=Configuration au callback
DISCORD_CLIENT_ID="<ID_APP_PROD>"          # alias hérité — garder aligné
DISCORD_CLIENT_SECRET="<SECRET_APP_PROD>"  # alias hérité — garder aligné

# ── Bot / interactions ───────────────────────────────────────────────────────
DISCORD_BOT_TOKEN="<TOKEN_BOT_PROD>"
DISCORD_PUBLIC_KEY="<PUBLIC_KEY_PROD>"

# ── Base de données & Redis ──────────────────────────────────────────────────
DATABASE_URL="postgresql://user:<PASSWORD>@sigilos-db-prod:5432/sigilos?schema=public"
REDIS_URL="redis://:password@sigilos-redis-prod:6379"

# ── Secrets critiques (refus de démarrage si absents) ────────────────────────
ENCRYPTION_KEY="<64 hex — NE JAMAIS ROTATIONNER>"
CRON_SECRET="<≥ 16 caractères>"
STORAGE_SIGNING_SECRET="<≥ 32 caractères>"
GOD_ROUTE="/mng-<secret ≥ 5 caractères après le préfixe>"

# ── Interrupteurs (valeur explicite, jamais un booléen implicite) ────────────
CSP_ENFORCE="true"
WS_AUTH_ENABLED="true"
PUBLIC_VISITOR_ENTRY="1"

# ── Observabilité ────────────────────────────────────────────────────────────
SENTRY_DSN="<DSN prod>"
NEXT_PUBLIC_SENTRY_DSN="<DSN prod>"
PROMETHEUS_URL="http://prometheus:9090"

# ── Médias / assets ──────────────────────────────────────────────────────────
ASSETS_REMOTE_FETCH="false"                # true = autorise DofusDB en secours réseau
# DOFUS_ASSETS_DIR="/data/dofus_assets"    # si les 2x sont montés en lecture seule

# ── Metamob (optionnel, chiffré en base par utilisateur) ─────────────────────
METAMOB_API_KEY="<clé partagée éventuelle>"

# ── Sauvegardes R2 ───────────────────────────────────────────────────────────
R2_ENDPOINT_URL="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID="<R2_KEY>"
R2_SECRET_ACCESS_KEY="<R2_SECRET>"
R2_BUCKET_NAME="sigilos-backups"
BACKUP_ENCRYPTION_KEY="<clé GPG/AES — à conserver HORS du VPS>"
```

> `STORAGE_LEGACY_TOKENS_UNTIL` est **optionnel** : à ne retirer qu'après le 13/12/2026 (liens Discord
> déjà envoyés). Voir `.env.example` § « VALIDATION DE DÉMARRAGE ».

---

## <a id="2-mutualisation-assets"></a>2. Assets disque — ce qui est partagé, ce qui ne l'est pas

### A. `game-data` (tuiles worldmap, cartes HD) — **à vérifier, pas à supposer**

Le compose monte **le même chemin hôte** pour la prod **et** la bêta :
`/home/sigiladmin/SigilOS/public/game-data` (`docker-compose.prod.yml:76` et `:196`), et Caddy monte
`./public/game-data` en lecture seule (`:313`). **Si prod et bêta sont déployées depuis le même checkout**,
le dossier est déjà partagé : il n'y a **rien à copier**. Si la bêta vit dans un autre dossier, le compose
est incohérent et doit être corrigé **avant** l'ouverture.

Mesurer (lecture seule) :
```bash
docker inspect sigilos-prod --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'
docker inspect sigilos-beta --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'
# Les deux lignes game-data doivent pointer vers le MÊME Source.
```

### B. WebP siphonnés (`public/uploads/assets-dofus`) — **NON partagés**

Ce sont des **volumes Docker distincts** : `assets-prod-data` et `assets-beta-data`
(`docker-compose.prod.yml:75-76` / `:195-196`). La prod démarre donc avec un volume **vide** : les icônes
siphonnées ne sont pas là. Deux options, à trancher le jour J :

```bash
# 1) Mesurer les deux volumes (lecture seule)
docker run --rm -v assets-beta-data:/v alpine du -sh /v
docker run --rm -v assets-prod-data:/v alpine du -sh /v

# 2) Rejouer le siphon côté prod (voie normale, idempotente)
#    Déclencheur : /api/cron/siphon-monster-assets (CRON_SECRET), ou le script dédié.
#    Alternative ponctuelle : copier le volume bêta → prod (même hôte, arrêt de la prod conseillé).
```

### C. `sync-assets.sh` ne fait que `game-data`

`scripts/sync-assets.sh {beta|prod}` synchronise **uniquement** `public/game-data/` vers `VPS_PATH`
(voir l'en-tête du script). Il **ne pousse pas** les WebP siphonnés : ne pas l'utiliser comme preuve que
les images sont prêtes.

```bash
# Depuis la machine locale (WSL / Git Bash)
./scripts/sync-assets.sh prod --dry-run
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

> Le `Caddyfile` est **versionné à la racine du dépôt** et monté dans le conteneur `sigilos-gateway`
> (`docker-compose.prod.yml:307`). On ne l'édite **pas** dans `/etc/caddy/`.

### 1. Remplacer le bloc `sigilos.fr` (vitrine) par le bloc de l'application

Le bloc actuel `sigilos.fr { ... }` (`Caddyfile:75-158`) est une **vitrine** : `X-Robots-Tag noindex`,
handlers statiques `robots.txt`/`sitemap.xml`, rewrite `maintenance.html`. À l'ouverture, il doit devenir
une copie du bloc `beta.sigilos.fr` (`Caddyfile:167-233`) avec **trois adaptations** :

- `reverse_proxy sigilos-prod:3000` (au lieu de `sigilos-beta:3000`) ;
- `reverse_proxy sigilos-ws-prod:3001` pour `/socket.io/*` (au lieu de `sigilos-ws-beta:3001`) ;
- drapeau de maintenance prod : `/srv/maintenance-on` + `maintenance.html`.

**À conserver** (sinon la worldmap ou les WebSockets cassent) :
`import security_headers` · `import rate_limit_base` · `import error_page_429` · le `503` des écritures
pendant la maintenance · `header /game-data/* Cache-Control "no-cache, must-revalidate"` ·
`header /sw.js` et `/manifest.webmanifest` · `handle /game-data/*` (statique, `root /srv/game-data`) ·
`handle /socket.io/*` · `handle { reverse_proxy … }`.

**À supprimer** : `header X-Robots-Tag "noindex, nofollow"`, `handle /robots.txt`, `handle /sitemap.xml`,
le `handle @vitrineFichier` et le `rewrite * /maintenance.html`.

> `robots.txt`, `sitemap.xml` et `llms.txt` sont désormais servis **par l'application**
> (`src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/llms.txt/route.ts`). Aucun handler statique ne doit
> les intercepter, sinon ils renverront l'ancien contenu de la vitrine.

### 2. Valider et recharger sans coupure

```bash
docker exec sigilos-gateway caddy validate --config /etc/caddy/Caddyfile
docker exec sigilos-gateway caddy reload   --config /etc/caddy/Caddyfile
```

### 3. Vérifier les en-têtes et les routes

```bash
curl -sI https://sigilos.fr/ | grep -i 'x-robots-tag'          # doit être ABSENT
curl -sSI https://sigilos.fr/robots.txt | head -1                # 200
curl -sS  https://sigilos.fr/robots.txt                          # Allow: / + Disallow des zones privées
curl -sSI https://sigilos.fr/sitemap.xml | head -1               # 200 application/xml
curl -sSI https://sigilos.fr/llms.txt | head -1                  # 200
curl -sSI https://sigilos.fr/game-data/worldmap.json | head -1   # 200 (servi par Caddy)
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
| 8 | **Crons & Sauvegardes** | Vérifier crontab VPS | `backup_db.sh prod` tourne à 4h00 vers R2. **`APP_URL` bascule sur `prod`** (toute la crontab le suit) ; une **seule** ligne `data-watch` (dim. 05h00) et une **seule** ligne `siphon-item-conditions` (1er du mois) ; les siphons `siphon-item-sets` puis `siphon-item-conditions` sont joués **avant** d'ouvrir les variantes (ordre exact dans `docs/ROADMAP.md` §0). |
| 9 | **Commandes slash** | `/dashboard/<guildId>/commandes` → « Resynchroniser » (ou panneau God) | La liste prod contient les commandes attendues ; `/legendaire` répond en moins de 3 s. |
| 10 | **WebSocket** | Ouvrir le dashboard et vérifier la connexion `wss://sigilos.fr/socket.io` | Handshake 101, notifications temps réel reçues (côté prod, pas bêta). |
| 11 | **Bot & worker** | `docker ps` (`discord-bot-prod`, `worker-prod`, `ws-prod`) puis un bouton de ticket | Conteneurs `healthy`, réponse éphémère du bot prod. |
| 12 | **Webhook Ko-fi** | `POST /api/webhooks/kofi` (test signé) | 200 + remerciement, aucun 401. |
| 13 | **Relais Dofusbook** | Workers Cloudflare (origine configurée) | L'origine pointe vers `sigilos.fr`, pas `beta.sigilos.fr`. |
| 14 | **Stockage signé** | Ouvrir un lien `/api/storage/...` depuis un message Discord | 200, pas 401/403 ; `STORAGE_SIGNING_SECRET` posé. |
| 15 | **Porte visiteur** | Compte sans guilde → `/` puis `/dashboard` | Redirection vers `/espace-visiteur/general`, aucune boucle ; `PUBLIC_VISITOR_ENTRY=1`. |
| 16 | **Observabilité** | `curl /api/health` + événement Sentry de test | Health 200 ; événement reçu avec la bonne release. |
| 17 | **Entrées SEO** | `curl -sSI https://sigilos.fr/{robots.txt,sitemap.xml,llms.txt}` | 200, servis par l'app ; aucun `X-Robots-Tag: noindex`. |

---

## <a id="7-rollback"></a>7. Procédure de Rollback Immédiat

Si un problème bloquant survient lors de l'ouverture :
```bash
# 1. Remettre la page de maintenance en < 1 min.
#    Le Caddyfile est versionné : restaurer le bloc vitrine (HEAD~1) puis recharger le conteneur.
git -C /home/sigiladmin/SigilOS show HEAD~1:Caddyfile > /home/sigiladmin/SigilOS/Caddyfile
docker exec sigilos-gateway caddy validate --config /etc/caddy/Caddyfile
docker exec sigilos-gateway caddy reload   --config /etc/caddy/Caddyfile

# 2. Restaurer la DB précédente si nécessaire
./scripts/restore_db.sh prod <nom_du_backup_pre_deploy>.sql.gz.gpg

# 3. Laisser la Beta intacte pour que la guilde continue de jouer sans interruption
```
