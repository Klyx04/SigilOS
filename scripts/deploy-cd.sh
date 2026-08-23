#!/bin/bash
# =============================================================================
# 🚀 SigilOS — Déploiement CI/CD (v4) — produit pro, sortie lisible
# -----------------------------------------------------------------------------
# Usage :
#   ./scripts/deploy-cd.sh list beta|prod        → versions dispo sur GHCR
#   ./scripts/deploy-cd.sh beta|prod [sha]       → déploie la version (défaut : latest)
#   ./scripts/deploy-cd.sh --help                → aide
#
# Principe : les images sont buildées sur GitHub Actions et poussées vers GHCR
# (.github/workflows/deploy.yml). Ce script pull les 4 images, les retag en
# :latest local, puis fait `docker compose up -d --no-build`. AUCUN build sur
# le VPS — déploiement ~30 s.
# =============================================================================

set -u

# -----------------------------------------------------------------------------
# Couleurs (auto-détection TTY → texte brut si non-interactif, pour les logs)
# -----------------------------------------------------------------------------
if [[ -t 1 ]]; then
    C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
    C_RED=$'\033[31m';  C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'
    C_CYAN=$'\033[36m'; C_MAGENTA=$'\033[35m'
else
    C_RESET=""; C_BOLD=""; C_DIM=""; C_RED=""; C_GREEN=""; C_YELLOW=""; C_CYAN=""; C_MAGENTA=""
fi

# -----------------------------------------------------------------------------
# Helpers de log (message unique — jamais interprété comme format)
# -----------------------------------------------------------------------------
info()   { printf "${C_CYAN}%s${C_RESET}\n" "$*"; }
ok()     { printf "${C_GREEN}✓ %s${C_RESET}\n" "$*"; }
warn()   { printf "${C_YELLOW}⚠  %s${C_RESET}\n" "$*"; }
err()    { printf "${C_RED}✗ %s${C_RESET}\n" "$*" >&2; }
dim()    { printf "${C_DIM}%s${C_RESET}\n" "$*"; }
hr()     { printf "${C_DIM}──────────────────────────────────────────────────────${C_RESET}\n"; }
banner() { printf "\n${C_BOLD}%s${C_RESET}\n" "$*"; }
section() { # $1 = numéro d'étape, $2 = titre
    printf "\n${C_BOLD}── ÉTAPE %s/5 ── %s${C_RESET}\n" "$1" "$2"
    printf "${C_DIM}──────────────────────────────────────────────${C_RESET}\n"
}
fail() { err "$1"; exit "${2:-1}"; }
# -----------------------------------------------------------------------------
# Aide
# -----------------------------------------------------------------------------
usage() {
    local code="${1:-0}"
    cat <<'EOF'
🚀 SigilOS — Déploiement CI/CD (v4)

USAGE
  ./scripts/deploy-cd.sh list beta|prod        Affiche les versions dispo sur GHCR
  ./scripts/deploy-cd.sh beta|prod [sha]       Déploie la version (défaut : latest)
  ./scripts/deploy-cd.sh --help                Affiche cette aide

EXEMPLES
  ./scripts/deploy-cd.sh list beta
  ./scripts/deploy-cd.sh beta                  # déploie latest en bêta
  ./scripts/deploy-cd.sh prod 3f2a9c1          # déploie le SHA 3f2a9c1 en prod

PRÉREQUIS (à définir une fois)
  export GHCR_TOKEN=...                # token GHCR (read:packages)
  export GHCR_TOKEN_EXPIRY=AAAA-MM-JJ  # pour l'avertissement d'expiration
  export GHCR_USER=klyx04              # défaut : klyx04
EOF
    exit "$code"
}

# -----------------------------------------------------------------------------
# Expiration du GHCR_TOKEN (affichage)
# -----------------------------------------------------------------------------
show_token_expiry() {
    if [[ -z "${GHCR_TOKEN_EXPIRY:-}" ]]; then
        dim "GHCR_TOKEN : expiration non renseignée (GHCR_TOKEN_EXPIRY=AAAA-MM-JJ)."
        return
    fi
    local EXPIRY_SECONDS NOW_SECONDS DAYS_LEFT
    EXPIRY_SECONDS="$(date -d "$GHCR_TOKEN_EXPIRY" +%s 2>/dev/null)" || {
        warn "GHCR_TOKEN_EXPIRY invalide : $GHCR_TOKEN_EXPIRY (attendu AAAA-MM-JJ)."
        return
    }
    NOW_SECONDS="$(date +%s)"
    DAYS_LEFT=$(( (EXPIRY_SECONDS - NOW_SECONDS) / 86400 ))
    if (( DAYS_LEFT < 0 )); then
        err "GHCR_TOKEN EXPIRÉ depuis $((-DAYS_LEFT)) jours — renouvelez-le (voir MAINTENANCE.md)."
    elif (( DAYS_LEFT <= 14 )); then
        warn "GHCR_TOKEN expire dans $DAYS_LEFT jours ($GHCR_TOKEN_EXPIRY) — pensez à le renouveler."
    else
        ok "GHCR_TOKEN valide ($DAYS_LEFT jours restants)."
    fi
}

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
GHCR_USER="${GHCR_USER:-klyx04}"
GHCR_USER_LOWER="${GHCR_USER,,}"            # GHCR impose des noms en minuscules
GHCR_REG="ghcr.io/${GHCR_USER_LOWER}"

cd "$(dirname "$0")/.."
# -----------------------------------------------------------------------------
# Commande : list — versions disponibles sur GHCR
# -----------------------------------------------------------------------------
list_handler() {
    local target="$1"
    if [[ "$target" != "beta" && "$target" != "prod" ]]; then
        err "Usage : ./scripts/deploy-cd.sh list {beta|prod}"
        exit 1
    fi
    [ -n "${GHCR_TOKEN:-}" ] || fail "GHCR_TOKEN non défini. Exportez : export GHCR_TOKEN=<token read:packages>"
    banner "Versions disponibles — $target ($GHCR_REG)"
    hr
    printf "${C_BOLD}  %-32s %s${C_RESET}\n" "Image" "latest (digest)"
    for NAME in app worker ws discord-bot; do
        local IMG="${GHCR_REG}/sigilos-${NAME}-${target}"
        local DIGEST
        DIGEST="$(sudo docker buildx imagetools inspect "${IMG}:latest" 2>/dev/null | grep -oE 'sha256:[a-f0-9]{12}' | head -1 || true)"
        if [[ -z "$DIGEST" ]]; then
            printf "  %-32s %s\n" "sigilos-${NAME}-${target}" "introuvable (build GHCR ?)"
        else
            printf "  %-32s %s\n" "sigilos-${NAME}-${target}" "$DIGEST"
        fi
    done
    hr
    dim "Déployer une version précise : ./scripts/deploy-cd.sh ${target} <sha7>"
    exit 0
}

# -----------------------------------------------------------------------------
# Récupération du code source (NON bloquante — le déploiement CD n'en dépend pas)
# -----------------------------------------------------------------------------
git_fetch() {
    dim "Récupération du code source (étape non bloquante)..."
    local BRANCH DIRTY
    BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo dev)"
    DIRTY="$(git status --porcelain 2>/dev/null)"
    if [[ -n "$DIRTY" ]]; then
        warn "Des fichiers locaux sont modifiés — le pull peut être bloqué (non bloquant)."
        printf '%s\n' "$DIRTY" | sed 's/^/     /' | head -10
        dim "  → Pour rétablir : git checkout -- <fichier>   (ou   git stash)"
    fi
    if git pull origin "$BRANCH" >/tmp/sigilos-pull.log 2>&1; then
        ok "Code source à jour (branche $BRANCH, $(git log -1 --oneline 2>/dev/null || echo '?'))."
    else
        warn "git pull en échec — on continue avec les images GHCR (non bloquant)."
        sed 's/^/     /' /tmp/sigilos-pull.log | tail -8
    fi
    rm -f /tmp/sigilos-pull.log
}
# -----------------------------------------------------------------------------
# Seeding conditionnel des données de jeu (si le hash de game-data.json change)
# -----------------------------------------------------------------------------
run_conditional_seed() {
    local APP_SERVICE="$1"
    local HASH_FILE=".deploy-seed-hash.${TARGET}"
    local SEED_FILE="prisma/seed-data/game-data.json"
    if [[ ! -f "$SEED_FILE" ]]; then
        warn "$SEED_FILE introuvable — seed ignoré."
        return
    fi
    local CURRENT_HASH PREV_HASH
    CURRENT_HASH="$(sha256sum "$SEED_FILE" | awk '{print $1}')"
    PREV_HASH="$(cat "$HASH_FILE" 2>/dev/null || echo '')"
    if [[ "${SEED_ALWAYS:-0}" == "1" || "$CURRENT_HASH" != "$PREV_HASH" ]]; then
        info "   Synchronisation des données de jeu ${TARGET^^}..."
        local SEED_LOG; SEED_LOG="$(mktemp)"
        if sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec "$APP_SERVICE" npm run seed:game-data:prod >"$SEED_LOG" 2>&1; then
            ok "Données de jeu synchronisées."
        else
            err "Seeding en échec. Dernières lignes :"
            tail -20 "$SEED_LOG" | sed 's/^/     /'
            rm -f "$SEED_LOG"
            exit 1
        fi
        rm -f "$SEED_LOG"
        echo "$CURRENT_HASH" > "$HASH_FILE"
    else
        dim "   Données de jeu inchangées — seed ignoré (gain de temps)."
    fi
}
# -----------------------------------------------------------------------------
# Déploiement (beta|prod)
# -----------------------------------------------------------------------------
deploy() {
    local TARGET="$1"
    local SHA="$2"
    [ -n "${GHCR_TOKEN:-}" ] || fail "GHCR_TOKEN non défini. Exportez : export GHCR_TOKEN=<token read:packages>"
    local ENV_FILE; ENV_FILE=".env.prod"; [[ "$TARGET" == "beta" ]] && ENV_FILE=".env.beta"
    local GIT_SHORT; GIT_SHORT="$(git rev-parse --short HEAD 2>/dev/null || echo '?')"
    local URL; URL="https://${TARGET}.sigilos.fr"
    local MODE_LABEL; MODE_LABEL="bêta — branche dev"; [[ "$TARGET" == "prod" ]] && MODE_LABEL="production — branche main"

    # ── Pré-vol : récapitulatif clair ────────────────────────────────────────
    banner "SigilOS — Déploiement CI/CD (v4)"
    hr
    printf "${C_DIM}  Cible         :${C_RESET} %s (%s)\n" "$TARGET" "$MODE_LABEL"
    printf "${C_DIM}  Environnement :${C_RESET} %s\n" "$ENV_FILE"
    printf "${C_DIM}  Version       :${C_RESET} %s${C_DIM}  (SHA local : %s)${C_RESET}\n" "$SHA" "$GIT_SHORT"
    printf "${C_DIM}  Images        :${C_RESET} app · worker · ws · discord-bot\n"
    printf "${C_DIM}  Santé         :${C_RESET} %s/api/health\n" "$URL"
    show_token_expiry
    hr

    git_fetch

    # ── ÉTAPE 1/5 — Authentification GHCR ───────────────────────────────────
    section "1" "Authentification GHCR"
    if sudo docker login ghcr.io -u "$GHCR_USER_LOWER" --password-stdin <<<"$GHCR_TOKEN" >/tmp/sigilos-login.log 2>&1; then
        ok "Connecté au registre $GHCR_REG"
    else
        err "Échec de connexion à GHCR :"
        sed 's/^/     /' /tmp/sigilos-login.log | tail -5
        rm -f /tmp/sigilos-login.log
        exit 1
    fi
    rm -f /tmp/sigilos-login.log

    # ── ÉTAPE 2/5 — Pull des images (aucun build) ───────────────────────────
    section "2" "Téléchargement des images (aucun build sur le VPS)"
    echo ""
    local PULL_OK=1
    for NAME in app worker ws discord-bot; do
        local IMG="${GHCR_REG}/sigilos-${NAME}-${TARGET}"
        printf "     ⤓ %-30s :%s  " "sigilos-${NAME}-${TARGET}" "$SHA"
        local PLOG; PLOG="$(mktemp)"
        if sudo docker pull "${IMG}:${SHA}" >"$PLOG" 2>&1; then
            if grep -qi "up to date" "$PLOG"; then
                printf "${C_GREEN}✓ déjà à jour${C_RESET}\n"
            else
                printf "${C_GREEN}✓ téléchargée${C_RESET}\n"
            fi
            # Retag en :latest local (le compose utilise :latest avec --no-build)
            sudo docker tag "${IMG}:${SHA}" "sigilos-${NAME}-${TARGET}:latest"
        else
            printf "${C_RED}✗ ÉCHEC${C_RESET}\n"
            tail -8 "$PLOG" | sed 's/^/         /'
            PULL_OK=0
        fi
        rm -f "$PLOG"
    done
    echo ""
    [[ "$PULL_OK" == "1" ]] || fail "Une ou plusieurs images n'ont pas pu être téléchargées."
    # ── ÉTAPE 3/5 — Redémarrage des conteneurs ──────────────────────────────
    section "3" "Redémarrage des conteneurs (attente santé)"
    if sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d --no-build --wait app-${TARGET} worker-${TARGET} ws-${TARGET} discord-bot-${TARGET}; then
        ok "Conteneurs démarrés et sains."
    else
        fail "Échec au démarrage des conteneurs."
    fi

    # ── ÉTAPE 4/5 — Base de données ─────────────────────────────────────────
    section "4" "Base de données"
    info "   Migration des fichiers uploads..."
    sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec app-${TARGET} npm run migrate:uploads
    info "   Application des migrations Prisma..."
    sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec app-${TARGET} npx --yes prisma migrate deploy
    if [[ "$TARGET" == "beta" ]]; then
        info "   Synchronisation du schéma (beta, db push)..."
        sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec app-${TARGET} npx --yes prisma db push
    fi
    ok "Base de données synchronisée."

    # ── ÉTAPE 5/5 — Données de jeu ──────────────────────────────────────────
    section "5" "Données de jeu"
    run_conditional_seed "app-${TARGET}"

    # ── Récapitulatif final + santé ─────────────────────────────────────────
    echo ""
    hr
    printf "${C_GREEN}${C_BOLD}✅ Déploiement %s terminé${C_RESET}\n" "$TARGET"
    printf "${C_DIM}   Version   :${C_RESET} %s${C_DIM}  (SHA local %s)${C_RESET}\n" "$SHA" "$GIT_SHORT"
    printf "${C_DIM}   Santé     :${C_RESET} %s/api/health\n" "$URL"
    printf "${C_DIM}   Rollback  :${C_RESET} ./scripts/rollback.sh %s\n" "$TARGET"
    hr

    info "Vérification de la santé post-déploiement..."
    local HEALTH HTTP_CODE
    HEALTH="$(curl -fsS -m 20 -w '\n%{http_code}' "$URL/api/health" 2>/dev/null)" || {
        warn "Le service ne répond pas encore — vérifier manuellement :"
        dim "   curl $URL/api/health"
        return
    }
    HTTP_CODE="$(printf '%s\n' "$HEALTH" | tail -1)"
    if [[ "$HTTP_CODE" == "200" ]]; then
        ok "$URL/api/health → HTTP $HTTP_CODE"
    else
        warn "$URL/api/health → HTTP $HTTP_CODE"
    fi
}

# -----------------------------------------------------------------------------
# Dispatch des commandes
# -----------------------------------------------------------------------------
COMMAND="${1:-}"
case "$COMMAND" in
    beta|prod)   deploy "$COMMAND" "${2:-latest}" ;;
    list)        list_handler "${2:-}" ;;
    --help|-h)   usage 0 ;;
    *)           usage 1 ;;
esac
