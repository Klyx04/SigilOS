#!/bin/bash
# =============================================================================
# 🧹 SigilOS — Beta Clean Reset
# Supprime toutes les données utilisateurs, conserve les game data.
# Usage : ./scripts/reset-beta.sh
# =============================================================================

set -e

DB_CONTAINER="sigilos-db-beta"
DB_USER="sigiluser"
DB_NAME="sigilos"
BACKUP_FILE="$HOME/backup_beta_$(date +%Y%m%d_%H%M%S).sql"

echo ""
echo "🧹 ════════════════════════════════════════"
echo "   BETA CLEAN RESET — SigilOS"
echo "════════════════════════════════════════════"
echo ""
echo "⚠️  Ce script va SUPPRIMER toutes les données utilisateurs :"
echo "   Users, Guildes, Profils, Missions, Sessions..."
echo ""
echo "✅  Les game data seront CONSERVÉES :"
echo "   Dungeons, Zones, Challenges, MonsterFamilies..."
echo ""
read -p "❓ Confirmer ? (tape 'RESET' pour continuer) : " CONFIRM

if [ "$CONFIRM" != "RESET" ]; then
    echo "❌ Annulé."
    exit 0
fi

# ─────────────────────────────────────────────────────────────
# ÉTAPE 1 — Backup automatique
# ─────────────────────────────────────────────────────────────
echo ""
echo "💾 Backup en cours → $BACKUP_FILE"
docker exec $DB_CONTAINER pg_dump -U $DB_USER $DB_NAME > "$BACKUP_FILE"
echo "✅ Backup sauvegardé : $BACKUP_FILE"

# ─────────────────────────────────────────────────────────────
# ÉTAPE 2 — Reset des données utilisateurs
# ─────────────────────────────────────────────────────────────
echo ""
echo "🗑️  Suppression des données utilisateurs..."

docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME << 'EOF'
TRUNCATE
  "User",
  "GuildConfig",
  "AllowedGuild",
  "PlatformBan",
  "ChangelogEntry",
  "DocPage",
  "ImageHash",
  "OcrApiUsage",
  "VerificationToken"
CASCADE;
EOF

echo "✅ Données utilisateurs supprimées."

# ─────────────────────────────────────────────────────────────
# ÉTAPE 3 — Vérification
# ─────────────────────────────────────────────────────────────
echo ""
echo "📊 Vérification :"
docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME << 'EOF'
SELECT 'Users'           AS table_name, COUNT(*) AS count FROM "User"
UNION ALL SELECT 'GuildConfig',         COUNT(*) FROM "GuildConfig"
UNION ALL SELECT 'UserProfile',         COUNT(*) FROM "UserProfile"
UNION ALL SELECT '--- GAME DATA ---',   0
UNION ALL SELECT 'Dungeons',            COUNT(*) FROM "Dungeon"
UNION ALL SELECT 'Challenges',          COUNT(*) FROM "Challenge"
UNION ALL SELECT 'Zones',               COUNT(*) FROM "Zone"
UNION ALL SELECT 'MonsterFamilies',     COUNT(*) FROM "MonsterFamily";
EOF

echo ""
echo "════════════════════════════════════════════"
echo "  ✅ Beta prête — bonne chance pour le test !"
echo "════════════════════════════════════════════"
echo ""
echo "💡 Prochaines étapes :"
echo "   1. Changer BETA_PASSWORD dans .env.beta"
echo "   2. docker restart sigilos-beta"
echo "   3. Importer les DJs via beta.sigilos.fr/god"
echo ""
