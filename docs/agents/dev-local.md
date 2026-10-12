---
description: How to start the local development environment correctly (avoid DB conflicts)
---

# 🖥️ Local Development Setup

## Prérequis Docker

En mode développement local (`npm run dev`), seuls **2 containers Docker** doivent tourner :

| Container | Rôle | Doit tourner ? |
|-----------|------|----------------|
| `sigilos-db` | PostgreSQL (port 5433) | ✅ OUI |
| `sigilos-redis` | Redis (port 6379) | ✅ OUI |
| `sigilos-app` | Next.js (Docker) | ❌ **NON** — conflit avec `npm run dev` |
| `sigilos-discord-bot` | Bot Discord | ❌ **NON** — consomme des connexions DB inutilement |
| `sigilos-caddy` | Reverse Proxy | ❌ NON (pas nécessaire en local) |

> ⚠️ **CRITICAL** : Si `sigilos-app` tourne en même temps que `npm run dev`, les deux se battent pour les connexions PostgreSQL → **timeout errors** (`Connection terminated due to connection timeout`). C'est la cause #1 des freezes en dev.

## Démarrage

// turbo-all

### 1. Vérifier l'état des containers
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

### 2. Stopper les containers inutiles (si actifs)
```bash
docker stop sigilos-app sigilos-discord-bot sigilos-caddy
```

### 3. S'assurer que DB + Redis tournent
```bash
docker start sigilos-db sigilos-redis
```

### 4. Lancer le dev server
```bash
npm run dev
```

### 5. (Optionnel) Lancer le worker Cloudflare pour le ladder
```bash
cd cloudflare-workers/dofus-ladder-proxy && npx wrangler dev worker.js --port 8787 --local
```

## Diagnostic rapide

Si les pages ne chargent pas ou timeout :

### Vérifier les connexions DB saturées
```bash
docker exec sigilos-db psql -U user -d sigilos -c "SELECT count(*) FROM pg_stat_activity;"
```
- **< 20** = Normal
- **> 50** = Quelque chose spam la DB (vérifier les containers Docker)

### Vérifier qu'aucun process zombie ne bloque le port 3000
```bash
netstat -ano | findstr :3000 | findstr LISTEN
```
Si un PID est listé mais que `npm run dev` est déjà arrêté → tuer le zombie :
```bash
taskkill /F /PID <PID>
```

## Port Database

- **En local** : PostgreSQL est accessible sur `localhost:5433` (mappé depuis Docker `5432→5433`)
- **En production** : PostgreSQL est sur `db-prod:5432` (réseau Docker interne)
- Cette logique est gérée automatiquement dans `src/lib/prisma.ts` et `prisma.config.js`
