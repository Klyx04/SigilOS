#!/bin/bash

# audit.sh - Le médecin de garde de SigilOS (2026)
# Scannage intelligent des services, de la DB et des logs.

# Couleurs pour le terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}🔍 DIAGNOSTIC SIGILOS INFRA - $(date)${NC}"
echo -e "${BLUE}==================================================${NC}"

# 1. État des Containers
echo -e "\n${YELLOW}📦 1. État des Services Docker${NC}"
# Utilisation de .RestartCount via --format "json" ou une syntaxe plus robuste
RESTARTS=$(docker ps --format "{{.Names}}: {{.Status}}" | grep -i "restarts")
if [ -z "$RESTARTS" ]; then
    echo -e "${GREEN}✅ Aucun redémarrage anormal détecté.${NC}"
else
    echo -e "${RED}⚠️ Alertes Redémarrage :${NC}"
    echo "$RESTARTS"
fi

# 2. Vérification de la Base de Données (Schema Drift)
echo -e "\n${YELLOW}🗄️ 2. Intégrité de la Base de Données${NC}"
CONTAINER_APP=$(docker ps --format '{{.Names}}' | grep -E "sigilos-(prod|beta|app)" | head -n 1)

if [ ! -z "$CONTAINER_APP" ]; then
    echo -e "Analyse du schéma via $CONTAINER_APP..."
    # On check si Prisma voit des migrations non appliquées
    DRIFT=$(docker exec "$CONTAINER_APP" npx prisma@7.9.1 migrate status 2>&1)
    if [[ "$DRIFT" == *"up to date"* ]]; then
        echo -e "${GREEN}✅ Schéma de base de données à jour.${NC}"
    else
        echo -e "${RED}❌ ALERTE SCHEMA DRIFT :${NC}"
        echo "$DRIFT"
        echo -e "${YELLOW}👉 Action suggérée : Lance 'docker exec $CONTAINER_APP npx prisma@7.9.1 migrate deploy'${NC}"
    fi
else
    echo -e "${RED}❌ Erreur : Impossible de trouver un conteneur App pour vérifier la DB.${NC}"
fi

# 3. Connectivité Réseau Inter-Services
echo -e "\n${YELLOW}🔌 3. Connectivité Inter-Services${NC}"
if [ ! -z "$CONTAINER_APP" ]; then
    # Test Redis
    echo -n "Test Redis... "
    CONTAINER_REDIS=$(docker ps --format '{{.Names}}' | grep "sigilos-redis" | head -n 1)
    if [ ! -z "$CONTAINER_REDIS" ]; then
        # Récupérer le mot de passe Redis depuis l'app (priorité à REDIS_PASSWORD, sinon parse REDIS_URL)
        REDIS_PASS=$(docker exec "$CONTAINER_APP" env | grep '^REDIS_PASSWORD=' | cut -d'=' -f2-)
        if [ -z "$REDIS_PASS" ]; then
            REDIS_URL_VAL=$(docker exec "$CONTAINER_APP" env | grep '^REDIS_URL=' | cut -d'=' -f2-)
            # Gère redis://:pass@host / redis://user:pass@host (ou rediss://)
            REDIS_PASS=$(echo "$REDIS_URL_VAL" | sed -E 's#^rediss?://[^@:]*:([^@]*)@.*$#\1#')
        fi

        if [ -n "$REDIS_PASS" ]; then
            REDIS_PING=$(docker exec "$CONTAINER_REDIS" redis-cli -a "$REDIS_PASS" --no-auth-warning ping 2>/dev/null)
        else
            REDIS_PING=$(docker exec "$CONTAINER_REDIS" redis-cli ping 2>/dev/null)
        fi

        if [[ "$REDIS_PING" == *"PONG"* ]]; then
            echo -e "${GREEN}✅ Connectivité Redis OK.${NC}"
        else
            echo -e "${RED}❌ Redis ne répond pas (Auth ou Downtime).${NC}"
        fi
    else
        echo -e "${RED}❌ Conteneur Redis introuvable.${NC}"
    fi
    
    # Test Postgres (ping basique via pg_isready dans le container DB)
    echo -n "Test PostgreSQL... "
    CONTAINER_DB=$(docker ps --format '{{.Names}}' | grep "sigilos-db" | head -n 1)
    if [ ! -z "$CONTAINER_DB" ]; then
        # Récupérer l'user et la DB
        DB_USER=$(docker exec "$CONTAINER_APP" env | grep POSTGRES_USER | cut -d'=' -f2)
        DB_NAME=$(docker exec "$CONTAINER_APP" env | grep POSTGRES_DB | cut -d'=' -f2)
        DB_USER=${DB_USER:-user}
        DB_NAME=${DB_NAME:-sigilos}

        DB_STATUS=$(docker exec "$CONTAINER_DB" pg_isready -U "$DB_USER" -d "$DB_NAME" -q && echo "OK" || echo "FAIL")
        if [ "$DB_STATUS" == "OK" ]; then
            echo -e "${GREEN}✅ Connectivité PostgreSQL OK (User: $DB_USER, DB: $DB_NAME).${NC}"
        else
            echo -e "${RED}❌ PostgreSQL ne répond pas sur le port 5432.${NC}"
        fi
    fi
fi

# 4. Scannage des Logs (Filtrage du bruit)
echo -e "\n${YELLOW}📜 4. Analyse des Logs (Derniers 100 évènements)${NC}"
# On ignore les erreurs connues de node-exporter et de config postgres_exporter
ERRORS=$(docker ps -q | xargs -L 1 docker logs --tail 100 2>&1 | \
    grep -iE "error|fatal|exception|denied" | \
    grep -vE "postgres_exporter.yml|/run/udev/data|netclass|role \"root\"|role \"postgres\"|database \"sigiluser\"")

if [ -z "$ERRORS" ]; then
    echo -e "${GREEN}✅ Aucun log critique détecté (hormis bruit ignoré).${NC}"
else
    echo -e "${RED}⚠️ Erreurs relevées dans les logs :${NC}"
    echo "$ERRORS" | head -n 15
    echo -e "... (tronqué, voir 'docker logs' pour le détail)"
fi

echo -e "\n${BLUE}==================================================${NC}"
echo -e "${BLUE}✨ Diagnostic Terminé${NC}"
echo -e "${BLUE}==================================================${NC}"
