#!/bin/bash
# =============================================================================
# create-guild-symlinks.sh
# Crée des symlinks lisibles dans /uploads/guilds/ pour chaque guilde
# Usage: ./scripts/create-guild-symlinks.sh [env]
#   env: prod (default) | beta
#
# Exemple de résultat:
#   /uploads/guilds/STELLIUM -> cmm9esa260001d0oguribc37r
#   /uploads/guilds/SIGILOS_TEST -> cmk3uwrpn0002xwogzk66oz3m
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ENV="${1:-prod}"
UPLOADS_DIR="$PROJECT_ROOT/public/uploads/guilds"

if [ ! -d "$UPLOADS_DIR" ]; then
    echo "❌ Dossier introuvable: $UPLOADS_DIR"
    exit 1
fi

echo "🔗 Création des symlinks lisibles dans: $UPLOADS_DIR"
echo "   (Environnement: $ENV)"
echo ""

# --- Connexion à la DB pour récupérer la mapping CUID → nom --------------------
# Nécessite psql et les variables DB dans l'env
if [ "$ENV" = "beta" ]; then
    ENV_FILE="$PROJECT_ROOT/.env.beta"
else
    ENV_FILE="$PROJECT_ROOT/.env.prod"
fi

if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️  Fichier $ENV_FILE introuvable. Utilisation de la méthode manuelle."
    echo ""
    echo "   Liste des dossiers CUID existants:"
    for dir in "$UPLOADS_DIR"/*/; do
        # Ignore les symlinks existants
        if [ ! -L "$dir" ]; then
            echo "   → $(basename "$dir")"
        fi
    done
    echo ""
    echo "   Pour créer un symlink manuellement:"
    echo "   ln -sfn /chemin/vers/CUID /chemin/vers/guilds/NOM_GUILDE"
    exit 0
fi

# Charger DATABASE_URL depuis le fichier .env
source <(grep -E '^DATABASE_URL=' "$ENV_FILE" | sed 's/^/export /')

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL introuvable dans $ENV_FILE"
    exit 1
fi

# Requête: récupère id → name (sanitisé pour les noms de dossier)
echo "📡 Connexion à la base de données..."
MAPPING=$(psql "$DATABASE_URL" -t -c \
    "SELECT id, REGEXP_REPLACE(UPPER(name), '[^A-Z0-9_]', '_', 'g') FROM \"GuildConfig\" WHERE name IS NOT NULL;" \
    2>/dev/null)

if [ -z "$MAPPING" ]; then
    echo "❌ Impossible de récupérer les guildes depuis la DB."
    echo "   Vérifiez que DATABASE_URL est correct et que psql est installé."
    exit 1
fi

echo ""
CREATED=0
SKIPPED=0

while IFS='|' read -r cuid name; do
    cuid=$(echo "$cuid" | xargs)   # trim whitespace
    name=$(echo "$name" | xargs)

    if [ -z "$cuid" ] || [ -z "$name" ]; then
        continue
    fi

    TARGET_DIR="$UPLOADS_DIR/$cuid"
    LINK_PATH="$UPLOADS_DIR/$name"

    # Le dossier CUID doit exister sur le disque
    if [ ! -d "$TARGET_DIR" ]; then
        echo "   ⚠️  Dossier CUID introuvable (skip): $cuid → $name"
        ((SKIPPED++)) || true
        continue
    fi

    # Supprimer l'ancien symlink s'il existe (pour le mettre à jour)
    if [ -L "$LINK_PATH" ]; then
        rm "$LINK_PATH"
    fi

    # Ne pas écraser un vrai dossier
    if [ -d "$LINK_PATH" ] && [ ! -L "$LINK_PATH" ]; then
        echo "   ✋ Dossier réel déjà présent (skip): $name"
        ((SKIPPED++)) || true
        continue
    fi

    # Créer le symlink
    ln -sfn "$cuid" "$LINK_PATH"
    echo "   ✅ $name → $cuid"
    ((CREATED++)) || true

done <<< "$MAPPING"

echo ""
echo "🎉 Terminé ! $CREATED symlinks créés, $SKIPPED ignorés."
echo ""
echo "   Navigation rapide:"
echo "   ls $UPLOADS_DIR/"
echo "   cd $UPLOADS_DIR/NOM_GUILDE/proofs/"
