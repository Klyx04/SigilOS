#!/bin/bash

# =============================================================================
# 📦 SigilOS - Script de Synchronisation des Assets (Sécurisé)
# =============================================================================
# Version: 1.2 - Best Practices Security + SCP Fallback
# Synchronise le dossier public/game-data/ vers le VPS.
# =============================================================================

set -euo pipefail

# ── 1. Sécurité : Vérification Root ──────────────────────────────────────────
if [[ $EUID -eq 0 ]]; then
   echo "⚠️  ATTENTION : Il est déconseillé de lancer ce script en tant que ROOT."
   echo "    L'utilisation d'un utilisateur standard est recommandée pour SSH."
   echo ""
fi

# ── 2. Chargement du Contexte ──────────────────────────────────────────────────
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Load local secrets if they exist (.gitignore protected)
if [[ -f "$PROJECT_ROOT/.env.local" ]]; then
    # Filter to only load SSH related vars safely, stripping comments, spaces AND carriage returns (CRLF)
    export $(grep -E '^VPS_' "$PROJECT_ROOT/.env.local" | sed 's/[[:space:]]*#.*//' | tr -d '\r' | xargs)
fi

# ── 3. Arguments & Mode Dry-Run ───────────────────────────────────────────────
TARGET="${1:-}"
DRY_RUN=""
if [[ "${2:-}" == "--dry-run" ]]; then
    DRY_RUN="--dry-run"
    echo "🔍 MODE PREVIEW (Dry-run) - Aucun changement réel"
fi

# ── 4. Choix de l'Hôte et du Chemin ──────────────────────────────────────────
if [[ "$TARGET" == "beta" ]]; then
    VPS_SSH_ALIAS="${VPS_SSH_ALIAS_BETA:-}"
    VPS_IP="${VPS_IP_BETA:-}"
    VPS_PATH="${VPS_PATH_BETA:-}"
elif [[ "$TARGET" == "prod" ]]; then
    VPS_SSH_ALIAS="${VPS_SSH_ALIAS_PROD:-}"
    VPS_IP="${VPS_IP_PROD:-}"
    VPS_PATH="${VPS_PATH_PROD:-}"
fi

# Prefer SSH alias (respects ~/.ssh/config) over raw IP
if [[ -n "${VPS_SSH_ALIAS:-}" ]]; then
    VPS_HOST="$VPS_SSH_ALIAS"
elif [[ -n "${VPS_IP:-}" ]]; then
    VPS_USER="${VPS_USER:-sigiladmin}"
    VPS_HOST="$VPS_USER@$VPS_IP"
else
    echo "❌ Erreur : Ni VPS_SSH_ALIAS_BETA ni VPS_IP_BETA définis dans .env.local"
    exit 1
fi

if [[ -z "$VPS_PATH" ]]; then
    echo "❌ Erreur : VPS_PATH non défini. Configurez-le dans .env.local"
    exit 1
fi

# ── 5. Validations de Sécurité ────────────────────────────────────────────────
if [[ "$TARGET" != "beta" ]] && [[ "$TARGET" != "prod" ]]; then
    echo "❌ Usage: $0 {beta|prod} [--dry-run]"
    exit 1
fi

LOCAL_ASSETS="$PROJECT_ROOT/public/game-data/"
if [[ ! -d "$LOCAL_ASSETS" ]]; then
    echo "❌ Erreur critique : Le dossier local $LOCAL_ASSETS n'existe pas."
    exit 1
fi

# Protection contre la synchronisation racine
if [[ "$VPS_PATH" == "/" ]] || [[ "$VPS_PATH" == "/root" ]]; then
    echo "❌ Sécurité : VPS_PATH trop risqué ($VPS_PATH). Opération annulée."
    exit 1
fi

# ── 5. Confirmation Interactive ───────────────────────────────────────────────
echo ""
echo "🔐 ══════════════════════════════════════════════════════"
echo "   SÉCURITÉ : SYNCHRONISATION DES ASSETS → $TARGET"
echo "════════════════════════════════════════════════════════"
echo "   Hôte Distant : $VPS_HOST"
echo "   Chemin Cible : $VPS_PATH/public/game-data/"
echo ""

if [[ "$TARGET" == "prod" ]] && [[ -z "$DRY_RUN" ]]; then
    read -r -p "⚠️  DANGER : Écraser les images de PRODUCTION ? (Saisir 'OUI' pour confirmer) : " CONFIRM
    [[ "$CONFIRM" != "OUI" ]] && echo "Annulé." && exit 0
fi

# ── 6. Exécution (Mode Intelligent via Rsync ou Fallback SCP) ──────────────────
if command -v rsync &> /dev/null; then
    echo "🔄 Calcul des deltas et transfert intelligent (rsync)..."
    rsync -avzc --progress \
        --human-readable \
        --stats \
        $DRY_RUN \
        "$LOCAL_ASSETS" \
        "$VPS_HOST:$VPS_PATH/public/game-data/"
else
    echo "⚠️  'rsync' n'est pas installé sur cette machine — Utilisation de 'scp'."
    echo "   Note: Ce mode est beaucoup plus lent car il renvoie tous les fichiers."
    echo ""
    
    if [[ -n "$DRY_RUN" ]]; then
        echo "🔍 Dry-run avec SCP : Liste des premiers fichiers locaux :"
        ls -R "$LOCAL_ASSETS" | head -n 20
    else
        scp -r "$LOCAL_ASSETS" "$VPS_HOST:$VPS_PATH/public/game-data/"
    fi
fi

echo ""
echo "════════════════════════════════════════════════════════"
[[ -n "$DRY_RUN" ]] && echo "✅ Fin de l'aperçu." || echo "✅ Transfert terminé."
echo "════════════════════════════════════════════════════════"
