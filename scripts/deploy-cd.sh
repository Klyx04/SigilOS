#!/bin/bash

# =============================================================================
# 🚀 SigilOS - Script de Déploiement CI/CD (2026) — v3
# =============================================================================
# Usage:
#   ./scripts/deploy-cd.sh list beta        -> Liste les versions (SHA) dispo
#   ./scripts/deploy-cd.sh list prod
#   ./scripts/deploy-cd.sh beta <sha>       -> Déploie la version <sha> en beta
#   ./scripts/deploy-cd.sh prod <sha>       -> Déploie la version <sha> en prod
#   ./scripts/deploy-cd.sh beta             -> Déploie latest en beta
#
# Principe :
#   Les images sont buildées sur GitHub Actions et poussées vers GHCR
#   (voir .github/workflows/deploy.yml). Ce script ne fait que :
#     1. se connecter à GHCR
#     2. pull les 4 images (app, worker, ws, discord-bot) taggées <sha>
#     3. les retagger en :latest local (pour utiliser le compose existant)
#     4. `docker compose up -d --no-build`  → AUCUN build sur le VPS
#
# Résultat : déploiement ~30s au lieu de ~5min (~4min de build économisées).
# ─────────────────────────────────────────────────────────────
# Prérequis :
#   - GHCR_TOKEN : token GHCR avec read:packages (sur le VPS).
#     À définir une fois : export GHCR_TOKEN=...
#   - GHCR_TOKEN_EXPIRY : date d'expiration du token, format AAAA-MM-JJ
#     (ex: 2026-11-01). Visible sur GitHub → Settings → Developer settings →
#     Personal access tokens → Tokens (classic) → « sigilos-vps » → Expires on.
#     À définir : export GHCR_TOKEN_EXPIRY=AAAA-MM-JJ
#   - GitHub user : GHCR_USER (défaut : klyx04, en minuscules comme GHCR).
# ─────────────────────────────────────────────────────────────

COMMAND=$1

if [ "$COMMAND" != "list" ] && [ "$COMMAND" != "beta" ] && [ "$COMMAND" != "prod" ]; then
    echo "Usage: ./scripts/deploy-cd.sh {list|beta|prod} [sha]"
    echo "  list beta|prod        -> Liste les versions disponibles"
    echo "  beta|prod <sha>       -> Déploie la version <sha>"
    echo "  beta|prod             -> Déploie latest"
    exit 1
fi

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
# GHCR impose des noms de repo en minuscules → on force klyx04
GHCR_USER="${GHCR_USER:-klyx04}"
GHCR_USER_LOWER="${GHCR_USER,,}"
GHCR_REG="ghcr.io/${GHCR_USER_LOWER}"
GHCR_TOKEN="${GHCR_TOKEN:?❌ GHCR_TOKEN non défini. Exportez-le : export GHCR_TOKEN=<token read:packages>}"

# -----------------------------------------------------------------------------
# ⏰ Affichage du temps restant avant expiration du GHCR_TOKEN
# La date d'expiration est stockée dans GHCR_TOKEN_EXPIRY (format YYYY-MM-DD),
# à définir dans ~/.bashrc. Si absente, on ne peut pas calculer (on l'indique).
# -----------------------------------------------------------------------------
show_token_expiry() {
    if [ -z "${GHCR_TOKEN_EXPIRY:-}" ]; then
        echo "⏰ GHCR_TOKEN : date d'expiration non renseignée (définissez GHCR_TOKEN_EXPIRY=AAAA-MM-JJ dans ~/.bashrc)."
        return
    fi

    local EXPIRY_SECONDS
    EXPIRY_SECONDS="$(date -d "$GHCR_TOKEN_EXPIRY" +%s 2>/dev/null)" || {
        echo "⏰ GHCR_TOKEN : format GHCR_TOKEN_EXPIRY invalide (attendu AAAA-MM-JJ), actuel : $GHCR_TOKEN_EXPIRY"
        return
    }

    local NOW_SECONDS
    NOW_SECONDS="$(date +%s)"
    local DAYS_LEFT=$(( (EXPIRY_SECONDS - NOW_SECONDS) / 86400 ))

    if [ "$DAYS_LEFT" -lt 0 ]; then
        echo "⏰⛔ GHCR_TOKEN EXPIRÉ depuis $(( -DAYS_LEFT )) jours — renouvelez-le ! (voir MAINTENANCE.md)"
    elif [ "$DAYS_LEFT" -le 14 ]; then
        echo "⏰⚠️  GHCR_TOKEN expire dans $DAYS_LEFT jours ($GHCR_TOKEN_EXPIRY) — pensez à le renouveler ! (voir MAINTENANCE.md)"
    else
        echo "⏰ GHCR_TOKEN expire dans $DAYS_LEFT jours ($GHCR_TOKEN_EXPIRY)."
    fi
}

cd "$(dirname "$0")/.."

# -----------------------------------------------------------------------------
# Récupération du code (NON bloquante)
# S'il échoue (ex: clé SSH non chargée), on continue quand même — le déploiement
# CD n'a besoin que des images GHCR déjà prêtes, pas du code source.
# -----------------------------------------------------------------------------
echo "Récupération du code source (étape optionnelle, non bloquante)..."
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
PULL_LOG="$(mktemp)"
if git pull origin "$BRANCH" >"$PULL_LOG" 2>&1; then
    echo "   ✅ Code source récupéré (branche: ${BRANCH:-?})."
    echo "   Dernier commit : $(git log -1 --oneline 2>/dev/null || echo 'n/a')"
    if [ -s "$PULL_LOG" ] && ! grep -q "Already up to date" "$PULL_LOG"; then
        echo "   ── Détail du pull ──"
        sed 's/^/   /' "$PULL_LOG" | head -20
    fi
else
    echo "   ⚠️  git pull EN ÉCHEC — on continue quand même avec les images GHCR."
    echo "   ── Erreur (voir aussi ci-dessous pour les fichiers locaux) ──"
    sed 's/^/   /' "$PULL_LOG" | head -20
    echo "   ⚠️  ATTENTION : les fichiers source locaux peuvent être obsolètes (ex: prisma/seed-data)."
fi
rm -f "$PULL_LOG"

# -----------------------------------------------------------------------------
# ACTION : list — affiche les versions disponibles
# -----------------------------------------------------------------------------
if [ "$COMMAND" == "list" ]; then
    TARGET=$2
    if [ "$TARGET" != "beta" ] && [ "$TARGET" != "prod" ]; then
        echo "Usage: ./scripts/deploy-cd.sh list {beta|prod}"
        exit 1
    fi
    echo "Versions disponibles pour $TARGET (sur $GHCR_REG) :"
    echo ""
    for NAME in app worker ws discord-bot; do
        echo "── ${GHCR_REG}/sigilos-${NAME}-${TARGET} ──"
        sudo docker buildx imagetools inspect "${GHCR_REG}/sigilos-${NAME}-${TARGET}:latest" 2>/dev/null \
            || sudo docker manifest inspect "${GHCR_REG}/sigilos-${NAME}-${TARGET}:latest" 2>/dev/null \
            || echo "  (pas d'image trouvée — le build GHCR a-t-il tourné ?)"
    done
    exit 0
fi

# -----------------------------------------------------------------------------
# 🔁 Fonction : seeding conditionnel des données de jeu
# Ne seed QUE si le hash de game-data.json a changé (ou si SEED_ALWAYS=1).
# -----------------------------------------------------------------------------
run_conditional_seed() {
    local APP_SERVICE=$1
    local HASH_FILE=".deploy-seed-hash.${TARGET}"
    local SEED_FILE="prisma/seed-data/game-data.json"
    local SEED_LOG

    if [ ! -f "$SEED_FILE" ]; then
        echo "⚠️  $SEED_FILE introuvable — seed ignoré."
        return
    fi

    local CURRENT_HASH
    CURRENT_HASH="$(sha256sum "$SEED_FILE" | awk '{print $1}')"
    local PREV_HASH=""
    [ -f "$HASH_FILE" ] && PREV_HASH="$(cat "$HASH_FILE")"

    if [ "$SEED_ALWAYS" == "1" ] || [ "$CURRENT_HASH" != "$PREV_HASH" ]; then
        echo "🌱 Mise à jour des données de jeu ${TARGET^^} (nouvelles données détectées)..."
        # On cache le détail (207 lignes) et on n'affiche qu'un résumé,
        # ou l'erreur complète en cas de problème.
        SEED_LOG="$(mktemp)"
        if ! sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec "$APP_SERVICE" npm run seed:game-data:prod >"$SEED_LOG" 2>&1; then
            echo "❌ Seeding en échec. Dernières lignes :"
            tail -40 "$SEED_LOG"
            rm -f "$SEED_LOG"
            exit 1
        fi
        rm -f "$SEED_LOG"
        # Résumé du seed : on extirpe le total depuis la sortie
        echo "✅ Données de jeu synchronisées (voir total ci-dessous)."
        echo "$CURRENT_HASH" > "$HASH_FILE"
    else
        echo "⏭️  Données de jeu inchangées — mise à jour ignorée (gain de temps)."
    fi
}

# -----------------------------------------------------------------------------
# ACTION : rollback/deploy — revenir à une version <sha>
# -----------------------------------------------------------------------------
TARGET=$COMMAND
SHA=${2:-latest}

ENV_FILE=".env.prod"
[ "$TARGET" == "beta" ] && ENV_FILE=".env.beta"

echo ""
show_token_expiry
echo ""
echo "ÉTAPE 1/5 — Connexion au registre GitHub (GHCR)..."
echo "   (Droit de télécharger les images construites par GitHub.)"
echo "$GHCR_TOKEN" | sudo docker login ghcr.io -u "$GHCR_USER_LOWER" --password-stdin

# Pull + retag des 4 images pour <sha>
echo ""
echo "ÉTAPE 2/5 — Téléchargement des versions pré-fabriquées (aucun build)..."
echo "   Ce sont les images compilées sur GitHub, prêtes à l'emploi."
echo "   ('up to date' = la version est déjà en cache local.)"
for NAME in app worker ws discord-bot; do
    IMG="${GHCR_REG}/sigilos-${NAME}-${TARGET}"
    echo "  ↪ ${IMG}:${SHA}"
    sudo docker pull "${IMG}:${SHA}" || {
        echo "❌ Image ${IMG}:${SHA} introuvable sur GHCR."
        echo "   Vérifiez que le workflow GitHub a bien tourné (onglet Actions) pour ce SHA."
        exit 1
    }
    # Retagge en :latest local (le compose utilise :latest avec --no-build)
    sudo docker tag "${IMG}:${SHA}" "sigilos-${NAME}-${TARGET}:latest"
done

echo ""
echo "ÉTAPE 3/5 — Redémarrage des conteneurs (attente que chaque service réponde)..."
sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d --no-build --wait app-${TARGET} worker-${TARGET} ws-${TARGET} discord-bot-${TARGET}

echo ""
echo "ÉTAPE 4/5 — Synchronisation base de données..."
echo "   Migration des fichiers + application des migrations Prisma."
sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec app-${TARGET} npm run migrate:uploads
sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec app-${TARGET} npx --yes prisma migrate deploy
# db push en beta uniquement (itération rapide), jamais en prod
if [ "$TARGET" == "beta" ]; then
    sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec app-${TARGET} npx --yes prisma db push
fi

echo ""
echo "ÉTAPE 5/5 — Données de jeu..."
run_conditional_seed app-${TARGET}

echo ""
echo "✅ Déploiement ${TARGET^^} (SHA $SHA) terminé en mode CD !"
echo "   Vérif santé : curl https://${TARGET}.sigilos.fr/api/health"