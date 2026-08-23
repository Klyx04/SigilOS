#!/bin/bash
# =============================================================================
# create-guild-symlinks.sh
# Crée des symlinks LISIBLES dans /uploads/guilds/ à partir de la DB
# via Docker (pas besoin de psql sur le host)
#
# Usage:
#   ./scripts/create-guild-symlinks.sh          → beta (defaut)
#   ./scripts/create-guild-symlinks.sh prod     → production
#
# Résultat:
#   /uploads/guilds/STELLIUM     → cmm9esa260001d0oguribc37r/
#   /uploads/guilds/MON_SERVEUR  → cmk3uwrpn0002xwogzk66oz3m/
# =============================================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
UPLOADS_DIR="$PROJECT_ROOT/public/uploads/guilds"

ENV="${1:-beta}"

if [ "$ENV" = "prod" ]; then
    DB_CONTAINER="sigilos-db-prod"
    ENV_FILE="$PROJECT_ROOT/.env.prod"
else
    DB_CONTAINER="sigilos-db-beta"
    ENV_FILE="$PROJECT_ROOT/.env.beta"
fi

echo "🔗 SigilOS — Symlinks lisibles ($ENV)"
echo "   Dossier : $UPLOADS_DIR"
echo ""

# Charger les variables DB depuis le .env
source <(grep -E '^POSTGRES_(USER|PASSWORD|DB)=' "$ENV_FILE" | sed 's/^/export /')

if [ -z "$POSTGRES_USER" ]; then
    echo "❌ Impossible de lire POSTGRES_USER dans $ENV_FILE"
    exit 1
fi

# Requête via docker exec (pas besoin de psql sur le host)
echo "📡 Lecture de la base via Docker ($DB_CONTAINER)..."
MAPPING=$(docker exec "$DB_CONTAINER" psql \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -t -c "SELECT id, REGEXP_REPLACE(UPPER(name), '[^A-Z0-9]', '_', 'g') FROM \"GuildConfig\" WHERE name IS NOT NULL;" \
    2>/dev/null | grep '|')

if [ -z "$MAPPING" ]; then
    echo "❌ Aucune guilde trouvée (le container DB est-il démarré ?)"
    exit 1
fi

echo ""
CREATED=0

while IFS='|' read -r cuid name; do
    cuid=$(echo "$cuid" | xargs)
    name=$(echo "$name" | xargs)
    [ -z "$cuid" ] || [ -z "$name" ] && continue

    TARGET="$UPLOADS_DIR/$cuid"
    LINK="$UPLOADS_DIR/$name"

    [ ! -d "$TARGET" ] && echo "   ⚠️  Dossier manquant (skip) : $cuid" && continue
    [ -L "$LINK" ] && rm "$LINK"
    [ -d "$LINK" ] && ! [ -L "$LINK" ] && echo "   ✋ Dossier réel déjà là (skip) : $name" && continue

    ln -sfn "$cuid" "$LINK"
    echo "   ✅  $name  →  $cuid"
    ((CREATED++)) || true
done <<< "$MAPPING"

echo ""
echo "🎉 $CREATED symlink(s) créé(s)."
echo ""
echo "Tu peux maintenant naviguer par nom :"
echo "   ls $UPLOADS_DIR/"
echo "   cd $UPLOADS_DIR/STELLIUM/proofs/"
