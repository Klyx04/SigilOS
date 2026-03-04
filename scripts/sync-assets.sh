#!/bin/bash

# =============================================================================
# 📦 SigilOS - Script de Synchronisation des Assets (Images de jeu)
# =============================================================================
# Synchronise le dossier public/game-data/ local vers le VPS (beta ou prod)
# SANS redémarrer le serveur — fonctionne à chaud avec des utilisateurs connectés.
#
# Usage:
#   ./scripts/sync-assets.sh beta    -> Synce vers Beta  (beta.sigilos.fr)
#   ./scripts/sync-assets.sh prod    -> Synce vers Prod  (sigilos.fr)
#   ./scripts/sync-assets.sh beta --dry-run  -> Aperçu sans transfert réel
#
# Prérequis:
#   - SSH configuré avec clé publique (~/.ssh/config ou clé chargée)
#   - La variable VPS_HOST doit correspondre à ton entrée SSH (ex: sigilos-vps)
# =============================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
TARGET="${1:-}"
DRY_RUN=""
if [ "${2:-}" == "--dry-run" ]; then
    DRY_RUN="--dry-run"
    echo "🔍 Mode dry-run activé — aucun fichier ne sera transféré."
fi

VPS_HOST="sigilos-vps"                       # Entrée SSH dans ~/.ssh/config
VPS_PATH="/home/sigiladmin/SigilOS"          # Chemin du projet sur le VPS

# ── Validation ────────────────────────────────────────────────────────────────
if [ "$TARGET" != "beta" ] && [ "$TARGET" != "prod" ]; then
    echo "❌ Usage: ./scripts/sync-assets.sh {beta|prod} [--dry-run]"
    exit 1
fi

# Confirmation pour la production
if [ "$TARGET" == "prod" ] && [ -z "$DRY_RUN" ]; then
    echo "⚠️  Tu t'apprêtes à synchroniser vers la PRODUCTION."
    read -r -p "   Confirme (oui/non) : " CONFIRM
    if [ "$CONFIRM" != "oui" ]; then
        echo "Annulé."
        exit 0
    fi
fi

# ── Répertoires ───────────────────────────────────────────────────────────────
# On se place à la racine du projet (indépendamment d'où le script est lancé)
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_ASSETS="$PROJECT_ROOT/public/game-data/"

if [ ! -d "$LOCAL_ASSETS" ]; then
    echo "❌ Dossier introuvable : $LOCAL_ASSETS"
    exit 1
fi

# ── Affichage de ce qui va être synced ────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════"
echo "📦 SigilOS - Sync Assets → $TARGET"
echo "══════════════════════════════════════════════════════"
echo "Source  : $LOCAL_ASSETS"
echo "Dest    : $VPS_HOST:$VPS_PATH/public/game-data/"
echo ""

# Lister les catégories locales (sous-dossiers = toutes les catégories futures)
echo "📂 Catégories détectées :"
for dir in "$LOCAL_ASSETS"*/; do
    category=$(basename "$dir")
    count=$(find "$dir" -type f | wc -l)
    echo "   • $category/ ($count fichiers)"
done
echo ""

# ── Transfert (rsync si dispo, scp sinon) ─────────────────────────────────────
if command -v rsync &> /dev/null; then
    echo "🔄 Utilisation de rsync..."
    # --archive  : préserve permissions, timestamps, liens symboliques
    # --compress : compresse pendant le transfert
    # --checksum : compare par checksum → idempotent
    # --progress : affiche la progression fichier par fichier
    rsync \
        --archive \
        --compress \
        --checksum \
        --progress \
        --human-readable \
        --stats \
        $DRY_RUN \
        "$LOCAL_ASSETS" \
        "$VPS_HOST:$VPS_PATH/public/game-data/"
else
    echo "⚠️  rsync non trouvé — utilisation de scp (moins optimisé mais fonctionnel)."
    if [ -n "$DRY_RUN" ]; then
        echo "🔍 Dry-run : scp ne supporte pas le dry-run, aperçu des fichiers locaux :"
        find "$LOCAL_ASSETS" -type f | head -20
        echo "   ... (et plus)"
    else
        scp -r "$LOCAL_ASSETS" "$VPS_HOST:$VPS_PATH/public/game-data/"
    fi
fi

# ── Résultat ──────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════"
if [ -n "$DRY_RUN" ]; then
    echo "✅ Dry-run terminé. Lance sans --dry-run pour transférer."
else
    echo "✅ Assets synchronisés vers $TARGET avec succès !"
    echo ""
    echo "💡 Prochaine étape : importe le game-data.json depuis"
    echo "   GOD → Import/Export (les images sont déjà en place)."
fi
echo "══════════════════════════════════════════════════════"
