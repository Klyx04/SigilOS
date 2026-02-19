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
RESTARTS=$(sudo docker ps --format "{{.Names}}: {{.RestartCount}} restarts" | grep -v "restarts: 0")
if [ -z "$RESTARTS" ]; then
    echo -e "${GREEN}✅ Aucun redémarrage anormal détecté.${NC}"
else
    echo -e "${RED}⚠️ Alertes Redémarrage :${NC}"
    echo "$RESTARTS"
fi

# 2. Vérification de la Base de Données (Schema Drift)
echo -e "\n${YELLOW}🗄️ 2. Intégrité de la Base de Données${NC}"
CONTAINER_APP=$(sudo docker ps --format '{{.Names}}' | grep -E "sigilos-(prod|beta|app)" | head -n 1)

if [ ! -z "$CONTAINER_APP" ]; then
    echo -e "Analyse du schéma via $CONTAINER_APP..."
    # On check si Prisma voit des migrations non appliquées
    DRIFT=$(sudo docker exec "$CONTAINER_APP" npx prisma migrate status 2>&1 | grep -iE "unapplied|different|not found")
    if [ -z "$DRIFT" ]; then
        echo -e "${GREEN}✅ Schéma de base de données à jour.${NC}"
    else
        echo -e "${RED}❌ ALERTE SCHEMA DRIFT :${NC}"
        echo "$DRIFT"
        echo -e "${YELLOW}👉 Action suggérée : Lance 'npx prisma migrate deploy' sur le VPS.${NC}"
    fi
else
    echo -e "${RED}❌ Erreur : Impossible de trouver un conteneur App pour vérifier la DB.${NC}"
fi

# 3. Connectivité Réseau Inter-Services
echo -e "\n${YELLOW}🔌 3. Connectivité Inter-Services${NC}"
if [ ! -z "$CONTAINER_APP" ]; then
    # Test Redis
    REDIS_PING=$(sudo docker exec "$CONTAINER_APP" node -e "const r=require('redis'); const c=r.createClient({url:process.env.REDIS_URL}); c.on('error', (e)=>console.log(e.message)); c.connect().then(()=> {console.log('PONG'); process.exit(0)}).catch(e=>console.log(e.message))" 2>&1 | grep "PONG")
    if [[ "$REDIS_PING" == *"PONG"* ]]; then
        echo -e "${GREEN}✅ Connectivité Redis OK.${NC}"
    else
        echo -e "${RED}❌ Connectivité Redis ÉCHOUÉE (DNS ou Auth).${NC}"
    fi
    
    # Test Postgres (ping basique via pg_isready dans le container DB)
    CONTAINER_DB=$(sudo docker ps --format '{{.Names}}' | grep "sigilos-db" | head -n 1)
    if [ ! -z "$CONTAINER_DB" ]; then
        DB_STATUS=$(sudo docker exec "$CONTAINER_DB" pg_isready -q && echo "OK" || echo "FAIL")
        if [ "$DB_STATUS" == "OK" ]; then
            echo -e "${GREEN}✅ Connectivité PostgreSQL OK.${NC}"
        else
            echo -e "${RED}❌ PostgreSQL ne répond pas sur le port 5432.${NC}"
        fi
    fi
fi

# 4. Scannage des Logs (Filtrage du bruit)
echo -e "\n${YELLOW}📜 4. Analyse des Logs (Derniers 100 évènements)${NC}"
# On ignore les erreurs connues de node-exporter et de config postgres_exporter
ERRORS=$(sudo docker ps -q | xargs -L 1 sudo docker logs --tail 100 2>&1 | \
    grep -iE "error|fatal|exception|denied" | \
    grep -vE "postgres_exporter.yml|/run/udev/data|netclass")

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
