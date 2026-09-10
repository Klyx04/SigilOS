#!/bin/bash
# =============================================================================
# 🚀 SigilOS — Déploiement CI/CD (v5) — « pro, vulgarisé, 2026 »
# -----------------------------------------------------------------------------
# Usage :
#   ./scripts/deploy-cd.sh list beta|prod        → versions dispo sur GHCR
#   ./scripts/deploy-cd.sh beta|prod [sha]       → déploie la version (défaut : latest)
#   ./scripts/deploy-cd.sh --help                → aide
#
# En clair : ce script met à jour l'app depuis des images déjà construites sur
# GitHub (aucun build sur le serveur). Chaque étape est expliquée pour un humain,
# avec des barres de progression, et sans les messages npm inutiles.
# =============================================================================

set -u

# -----------------------------------------------------------------------------
# Couleurs (auto-détection TTY → texte brut si non-interactif, pour les logs)
# -----------------------------------------------------------------------------
if [[ -t 1 ]]; then
    C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
    C_RED=$'\033[31m';  C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'
    C_CYAN=$'\033[36m'; C_MAGENTA=$'\033[35m'; C_BLUE=$'\033[34m'
else
    C_RESET=""; C_BOLD=""; C_DIM=""; C_RED=""; C_GREEN=""; C_YELLOW=""
    C_CYAN=""; C_MAGENTA=""; C_BLUE=""
fi

# -----------------------------------------------------------------------------
# Helpers de log (message unique — jamais interprété comme format)
# -----------------------------------------------------------------------------
info() { printf "${C_CYAN}%s${C_RESET}\n" "$*"; }
ok()   { printf "${C_GREEN}✓ %s${C_RESET}\n" "$*"; }
warn() { printf "${C_YELLOW}⚠  %s${C_RESET}\n" "$*" >&2; }
err()  { printf "${C_RED}✗ %s${C_RESET}\n" "$*" >&2; }
dim()  { printf "${C_DIM}%s${C_RESET}\n" "$*"; }
horiz(){ printf "${C_DIM}──────────────────────────────────────────────────────${C_RESET}\n"; }
banner(){ printf "\n${C_BOLD}%s${C_RESET}\n" "$*"; }
fail() { err "$1"; exit "${2:-1}"; }

# Étape numérotée + titre + traduction humaine (vulgarisation).
#   step "1" "Authentification GHCR" "Connexion au dépôt d'images..."
step() {
    echo ""
    printf "${C_BOLD}${C_BLUE}── ÉTAPE %s/5 ── %s${C_RESET}\n" "$1" "$2"
    printf "${C_DIM}   ${3}${C_RESET}\n"
    horiz
}

# Barre de progression cosmétique (style 2026).
#   bar <libellé> <fait> <total> <largeur=30>
bar() {
    local label="$1" done="$2" total="$3" width="${4:-30}"
    local pct=0 filled=0
    if (( total > 0 )); then pct=$(( done * 100 / total )); fi
    filled=$(( pct * width / 100 ))
    local left right
    left="$(printf '█%.0s' $(seq 1 "$filled") 2>/dev/null)"
    right="$(printf '░%.0s' $(seq 1 "$(( width - filled ))") 2>/dev/null)"
    printf "\r  ${C_DIM}%-20s${C_RESET} [${C_GREEN}%s${C_DIM}%s${C_RESET}] ${C_BOLD}%3d%%${C_RESET}" "$label" "$left" "$right" "$pct"
}

# -----------------------------------------------------------------------------
# Aide
# -----------------------------------------------------------------------------
usage() {
    local code="${1:-0}"
    cat <<'EOF'
🚀 SigilOS — Déploiement CI/CD (v5)

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
# Expiration du GHCR_TOKEN (affichage vulgarisé)
# -----------------------------------------------------------------------------
show_token_expiry() {
    if [[ -z "${GHCR_TOKEN_EXPIRY:-}" ]]; then
        dim "GHCR_TOKEN : expiration non renseignée (GHCR_TOKEN_EXPIRY=AAAA-MM-JJ)."
        return
    fi
    local EXP NOW DAYS
    EXP="$(date -d "$GHCR_TOKEN_EXPIRY" +%s 2>/dev/null)" || {
        warn "GHCR_TOKEN_EXPIRY invalide : $GHCR_TOKEN_EXPIRY (attendu AAAA-MM-JJ)."
        return
    }
    NOW="$(date +%s)"
    DAYS=$(( (EXP - NOW) / 86400 ))
    if (( DAYS < 0 )); then
        err "GHCR_TOKEN EXPIRÉ depuis $((-DAYS)) jour(s) — renouvelez-le (voir MAINTENANCE.md)."
    elif (( DAYS <= 14 )); then
        warn "GHCR_TOKEN expire dans $DAYS jour(s) ($GHCR_TOKEN_EXPIRY) — pensez à le renouveler."
    else
        ok "GHCR_TOKEN valide ($DAYS jours restants)."
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
    horiz
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
    horiz
    dim "Déployer une version précise : ./scripts/deploy-cd.sh ${target} <sha7>"
    exit 0
}


# -----------------------------------------------------------------------------
# Récupération du code source (NON bloquante — le déploiement CD n'en dépend pas)
# -----------------------------------------------------------------------------
git_fetch() {
    dim "Récupération du code source (non bloquant — le déploiement n'en dépend pas)..."
    local BRANCH DIRTY
    BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo dev)"

    # ─── Artefacts RÉGÉNÉRÉS au runtime (bind mount compose) ────────────────
    # Le siphon (cron `sync-monster-stats` + bouton God) réécrit ce fichier à travers
    # le bind mount `public/game-data` → le fichier VERSIONNÉ devient « modifié » côté
    # serveur et `git pull` refusait de l'écraser (« Your local changes ... would be
    # overwritten by merge → Aborting »). Son contenu est éphémère (régénéré au tick
    # suivant) ⇒ on restaure la version du dépôt avant le pull.
    # ➕ Ajouter ici tout futur artefact généré dans un dossier versionné.
    local GENERATED=(
        "public/game-data/dungeon-monsters.json"
    )
    local f
    for f in "${GENERATED[@]}"; do
        if [[ -f "$f" ]] && ! git diff --quiet -- "$f" 2>/dev/null; then
            dim "  → artefact régénéré : $f (restauration de la version du dépôt)"
            git checkout -- "$f"
        fi
    done

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

    # Synchronisation de la documentation officielle
    info "   Synchronisation de la documentation ${TARGET^^}..."
    sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec "$APP_SERVICE" npm run seed:docs:prod || warn "Seed docs ignoré ou non-critique"
    ok "Documentation à jour."
}

# -----------------------------------------------------------------------------
# Téléchargement d'une image avec barre de progression (basée sur les couches).
#   pull_image <image> <sha> <nom> <cible>
# -----------------------------------------------------------------------------
pull_image() {
    local IMG="$1" SHA="$2" NAME="$3" TARGET="$4"
    local TOTAL=0 DONE=0
    # Déjà présent localement ? → on re-tague et on passe (gain de temps pour les SHA fixes).
    # ⚠️ IMPORTANT : si SHA=="latest", GHCR a pu recevoir une nouvelle image. On ne court-circuite que pour les SHA fixes.
    if [[ "$SHA" != "latest" ]] && sudo docker image inspect "${IMG}:${SHA}" >/dev/null 2>&1; then
        sudo docker tag "${IMG}:${SHA}" "sigilos-${NAME}-${TARGET}:latest"
        printf "  ${C_DIM}%-20s${C_RESET} ${C_YELLOW}✓ déjà en cache (${SHA})${C_RESET}\n" "$NAME"
        return
    fi
    # Docker écrit sa progression avec des \r → on les transforme en \n pour
    # compter les couches téléchargées et afficher un % lisible.
    sudo docker pull "${IMG}:${SHA}" 2>&1 | tr '\r' '\n' | while IFS= read -r line; do
        case "$line" in
            *"Already exists"*)   TOTAL=$((TOTAL+1)); DONE=$((DONE+1)); bar "$NAME" "$DONE" "$TOTAL";;
            *"Pulling fs layer"*) TOTAL=$((TOTAL+1)); bar "$NAME" "$DONE" "$TOTAL";;
            *"Pull complete"*)    DONE=$((DONE+1)); bar "$NAME" "$DONE" "$TOTAL";;
        esac
    done
    # Le code retour est perdu via le pipe → on vérifie que l'image est bien là.
    if sudo docker image inspect "${IMG}:${SHA}" >/dev/null 2>&1; then
        # Retag :latest local (le compose utilise :latest avec --no-build)
        sudo docker tag "${IMG}:${SHA}" "sigilos-${NAME}-${TARGET}:latest" 2>/dev/null
        printf "\r  ${C_DIM}%-20s${C_RESET} ${C_GREEN}✓ téléchargée${C_RESET}\n" "$NAME"
    else
        printf "\r  ${C_DIM}%-20s${C_RESET} ${C_RED}✗ ÉCHEC${C_RESET}\n" "$NAME"
        PULL_OK=0
    fi
}


# -----------------------------------------------------------------------------
# Bandeau d'en-tête (pré-vol) — style 2026
# -----------------------------------------------------------------------------
title_banner() {
    local TARGET="$1" MODE="$2" ENV="$3" SHA="$4" GIT="$5" URL="$6"
    echo ""
    printf "${C_BOLD}${C_BLUE}  ╔══════════════════════════════════════════════════════════════╗${C_RESET}\n"
    printf "${C_BOLD}${C_BLUE}  ║${C_RESET}   ${C_CYAN}◆ SigilOS — Déploiement CI/CD${C_RESET}${C_BOLD}${C_BLUE}                                         ║${C_RESET}\n"
    printf "${C_BOLD}${C_BLUE}  ╚══════════════════════════════════════════════════════════════╝${C_RESET}\n"
    printf "${C_BOLD}  Cible      :${C_RESET} %s  ${C_DIM}(%s — %s)${C_RESET}\n" "$TARGET" "$MODE" "$ENV"
    printf "${C_BOLD}  Version    :${C_RESET} %s  ${C_DIM}(SHA local %s)${C_RESET}\n" "$SHA" "$GIT"
    printf "${C_BOLD}  Santé      :${C_RESET} %s/api/health\n" "$URL"
    printf "${C_BOLD}  Images     :${C_RESET} app · worker · ws · discord-bot\n"
}

# -----------------------------------------------------------------------------
# Vérification de santé post-déploiement
# -----------------------------------------------------------------------------
health_check() {
    local URL="$1" HEALTH HTTP_CODE
    info "Vérification de la santé post-déploiement..."
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
# Déploiement (beta|prod)
# -----------------------------------------------------------------------------
deploy() {
    local TARGET="$1"
    local SHA="${2:-latest}"
    [ -n "${GHCR_TOKEN:-}" ] || fail "GHCR_TOKEN non défini. Exportez : export GHCR_TOKEN=<token read:packages>"
    local ENV_FILE=".env.prod"; [[ "$TARGET" == "beta" ]] && ENV_FILE=".env.beta"
    local GIT_SHORT; GIT_SHORT="$(git rev-parse --short HEAD 2>/dev/null || echo '?')"
    local URL="https://${TARGET}.sigilos.fr"
    local MODE_LABEL="bêta — branche dev"; [[ "$TARGET" == "prod" ]] && MODE_LABEL="production — branche main"

    # ── Pré-vol ──────────────────────────────────────────────────────────────
    title_banner "$TARGET" "$MODE_LABEL" "$ENV_FILE" "$SHA" "$GIT_SHORT" "$URL"
    show_token_expiry
    horiz

    git_fetch

    step "1" "Authentification GHCR" "Connexion au «dépôt» d'images (ghcr.io) : la clé GHCR_TOKEN (lecture seule) permet de lire les images privées. Aucune donnée n'est exécutée ici."
    if sudo docker login ghcr.io -u "$GHCR_USER_LOWER" --password-stdin <<<"$GHCR_TOKEN" >/tmp/sigilos-login.log 2>&1; then
        ok "Connecté au registre $GHCR_REG"
    else
        err "Échec de connexion à GHCR :"
        sed 's/^/     /' /tmp/sigilos-login.log | tail -5
        rm -f /tmp/sigilos-login.log
        exit 1
    fi
    rm -f /tmp/sigilos-login.log

    step "2" "Téléchargement des images" "Récupère les 4 composants de l'app (app, worker, ws, bot) déjà «cuisinés» sur GitHub — aucun re-build sur le serveur."
    local PULL_OK=1
    for NAME in app worker ws discord-bot; do
        local IMG="${GHCR_REG}/sigilos-${NAME}-${TARGET}"
        pull_image "$IMG" "$SHA" "$NAME" "$TARGET"
    done
    echo ""
    [[ "$PULL_OK" == "1" ]] || fail "Une ou plusieurs images n'ont pas pu être téléchargées."


    step "3" "Redémarrage des conteneurs" "Relance les services avec les nouvelles images et attend qu'ils soient «Healthy» (prêts à servir les requêtes)."
    # --wait-timeout 240 : évite que l'étape 3 « fige » indéfiniment si un conteneur
    # n'est pas healthy à temps (l'app pouvait sembler bloquée → Ctrl+C). On échoue
    # proprement après 240s au lieu de bloquer sans message.
    # Flag CONDITIONNEL (Compose >= 2.17) pour ne pas casser sur les versions plus anciennes.
    local COMPOSE_VER WAIT_FLAG
    COMPOSE_VER="$(sudo docker compose version --short 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1)"
    WAIT_FLAG=""
    if [[ -n "$COMPOSE_VER" ]] && awk -v v="$COMPOSE_VER" 'BEGIN{ split(v,p,"."); if (p[1]>2 || (p[1]==2 && p[2]>=17)) exit 0; else exit 1 }'; then
        WAIT_FLAG="--wait-timeout 240"
    fi
    if sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d --no-build --wait $WAIT_FLAG app-${TARGET} worker-${TARGET} ws-${TARGET} discord-bot-${TARGET}; then
        ok "Conteneurs démarrés et sains."
    else
        fail "Échec au démarrage des conteneurs."
    fi

    step "4" "Base de données" "Met à jour la structure de la BDD (tables/colonnes), migre les fichiers uploads vers le stockage privé. Les messages npm inutiles sont masqués."
    info "   Migration des fichiers uploads..."
    if sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec app-${TARGET} sh -c 'NO_UPDATE_NOTIFIER=1 npm_config_update_notifier=false npm run --silent migrate:uploads'; then
        ok "Uploads migrés."
    else
        err "Échec migration uploads."
        exit 1
    fi
    info "   Application des migrations Prisma..."
    local MIGRATE_LOG; MIGRATE_LOG="$(mktemp)"
    # ⚠️ Prisma CLI absent de l'image runner (devDependency, non incluse dans .next/standalone) :
    # sans pin, `npx prisma` tire `prisma@latest` (actuellement une RC cassée 8.0.0-rc.10 où la
    # commande est renommée `migration` → "No command registered for `migrate`"). On épingle la
    # version du projet (7.9.1) comme dans services/discord-bot/Dockerfile.
    if sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec app-${TARGET} sh -c 'NO_UPDATE_NOTIFIER=1 npm_config_update_notifier=false npx --yes prisma@7.9.1 migrate deploy' >"$MIGRATE_LOG" 2>&1; then
        if grep -qi "no pending migrations" "$MIGRATE_LOG"; then
            ok "Base à jour — aucune migration en attente."
        else
            ok "Migrations appliquées."
        fi
    else
        err "Échec des migrations Prisma :"
        tail -20 "$MIGRATE_LOG" | sed 's/^/     /'
        rm -f "$MIGRATE_LOG"
        exit 1
    fi
    rm -f "$MIGRATE_LOG"
    if [[ "$TARGET" == "beta" ]]; then
        info "   Synchronisation du schéma (beta, db push)..."
        local PUSH_LOG; PUSH_LOG="$(mktemp)"
        if sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec app-${TARGET} sh -c 'NO_UPDATE_NOTIFIER=1 npm_config_update_notifier=false npx --yes prisma@7.9.1 db push' >"$PUSH_LOG" 2>&1; then
            if grep -qi "already in sync" "$PUSH_LOG"; then
                ok "Schéma déjà à jour."
            else
                ok "Schéma synchronisé."
            fi
        else
            err "Échec du db push :"
            tail -20 "$PUSH_LOG" | sed 's/^/     /'
            rm -f "$PUSH_LOG"
            exit 1
        fi
        rm -f "$PUSH_LOG"
    fi
    ok "Base de données prête."

    step "5" "Données de jeu" "Synchronise les données (cartes/sorts) si la version a changé — sinon ne fait rien pour aller plus vite."
    run_conditional_seed "app-${TARGET}"

    # ── Récapitulatif + santé ────────────────────────────────────────────────
    horiz
    printf "${C_GREEN}${C_BOLD}✅ Déploiement %s terminé${C_RESET}\n" "$TARGET"
    printf "${C_DIM}   Version   :${C_RESET} %s${C_DIM}  (SHA local %s)${C_RESET}\n" "$SHA" "$GIT_SHORT"
    printf "${C_DIM}   Santé     :${C_RESET} %s/api/health\n" "$URL"
    printf "${C_DIM}   Rollback  :${C_RESET} ./scripts/rollback.sh %s\n" "$TARGET"
    horiz

    health_check "$URL"
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

