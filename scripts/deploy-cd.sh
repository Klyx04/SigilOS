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
# Exécution d'une commande DANS un conteneur, sortie affichée EN DIRECT
# -----------------------------------------------------------------------------
# Pourquoi ce helper existe (incident 19/09/2026, « jamais attendu aussi
# longtemps ») : `npx prisma@…` retélécharge le CLI à chaque déploiement (l'image
# runner ne contient pas les devDependencies). Avec la sortie redirigée dans un
# fichier temporaire, l'étape 4 restait MUETTE 1 à 3 minutes : impossible de
# savoir si ça travaillait ou si c'était figé → réflexe Ctrl+C (dangereux en
# pleine migration). Ici :
#   • la sortie est suivie en direct (≤ 1 s de latence) ;
#   • l'exécution est bornée par `timeout` → soit ça réussit, soit ça échoue
#     proprement AVEC un message (plus jamais d'attente infinie) ;
#   • `exec -T` + `< /dev/null` : aucun risque de blocage sur une saisie.
#
#   compose_exec_streamed <env-file> <service> <durée max s> <fichier log> <commande sh -c>
# Retour : code de sortie de la commande ; 124 si la durée maximale est atteinte.
compose_exec_streamed() {
    local ENV_FILE_C="$1" SERVICE="$2" MAX_S="$3" LOG="$4"; shift 4
    local RC_FILE; RC_FILE="$(mktemp)"
    : >"$LOG"
    (
        timeout --kill-after=30 "$MAX_S" \
            sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE_C" \
            exec -T "$SERVICE" sh -c "$*" </dev/null >"$LOG" 2>&1
        printf '%s' "$?" >"$RC_FILE"
    ) &
    local PID=$! SHOWN=0 LINES=0
    while kill -0 "$PID" 2>/dev/null; do
        LINES="$(wc -l <"$LOG" 2>/dev/null || printf '0')"
        if (( LINES > SHOWN )); then
            sed -n "$(( SHOWN + 1 )),${LINES}p" "$LOG" | sed '/^[[:space:]]*$/d; s/^/     /'
            SHOWN="$LINES"
        fi
        sleep 1
    done
    # Dernières lignes écrites juste avant la fin du process (flush).
    LINES="$(wc -l <"$LOG" 2>/dev/null || printf '0')"
    if (( LINES > SHOWN )); then
        sed -n "$(( SHOWN + 1 )),${LINES}p" "$LOG" | sed '/^[[:space:]]*$/d; s/^/     /'
    fi
    wait "$PID" 2>/dev/null
    local RC; RC="$(cat "$RC_FILE" 2>/dev/null || printf '1')"
    rm -f "$RC_FILE"
    return "${RC:-1}"
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
  ./scripts/deploy-cd.sh list beta|prod sha7   Vérifie qu'un tag précis est publié
  ./scripts/deploy-cd.sh beta|prod [sha]       Déploie la version (défaut : latest)
  ./scripts/deploy-cd.sh --help                Affiche cette aide

EXEMPLES
  ./scripts/deploy-cd.sh list beta
  ./scripts/deploy-cd.sh list beta da4ec40     # ce commit est-il publié sur GHCR ?
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
        err "GHCR_TOKEN EXPIRÉ depuis $((-DAYS)) jour(s) — renouvelez-le (voir docs/MAINTENANCE.md)."
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

# Version du CLI Prisma épinglée (⚠️ MIROIR de l'ARG PRISMA_VERSION du Dockerfile :
# les deux doivent rester alignées, et alignées sur `prisma` de package.json —
# actuellement 7.10.0). Épingler est obligatoire : sans version, `npx prisma`
# tire `prisma@latest` (une RC cassée où `migrate` est renommé `migration`).
# Sert uniquement de REPLI : si l'image embarque /opt/prisma-cli, aucun
# téléchargement n'a lieu (voir compose_exec_streamed / deploy()).
PRISMA_PIN="${PRISMA_PIN:-7.10.0}"

# Durée maximale d'une étape Prisma (secondes). Borne de sécurité : une étape
# muette qui dure « trop longtemps » échoue désormais avec un message au lieu
# de laisser l'opérateur deviner (et Ctrl+C en pleine migration).
PRISMA_TIMEOUT="${PRISMA_TIMEOUT:-900}"

cd "$(dirname "$0")/.."
# -----------------------------------------------------------------------------
# Commande : list — versions disponibles sur GHCR
# -----------------------------------------------------------------------------
list_handler() {
    local target="$1"
    local sha="${2:-}"
    if [[ "$target" != "beta" && "$target" != "prod" ]]; then
        err "Usage : ./scripts/deploy-cd.sh list {beta|prod} [sha7]"
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

    # `list beta <sha7>` répond à LA question qui coûte le plus de temps :
    # « ce commit a-t-il vraiment été publié par la CI ? ». Un tag absent et un
    # registre cassé produisent le même échec au pull — ici on tranche avant.
    if [[ -n "$sha" ]]; then
        printf "${C_BOLD}  Tag %s${C_RESET}\n" "$sha"
        local MISSING=0
        for NAME in app worker ws discord-bot; do
            local IMG="${GHCR_REG}/sigilos-${NAME}-${target}"
            if sudo docker buildx imagetools inspect "${IMG}:${sha}" >/dev/null 2>&1; then
                printf "  %-32s ${C_GREEN}✓ publié${C_RESET}\n" "sigilos-${NAME}-${target}"
            else
                printf "  %-32s ${C_RED}✗ absent${C_RESET}\n" "sigilos-${NAME}-${target}"
                MISSING=1
            fi
        done
        horiz
        if [[ "$MISSING" == "1" ]]; then
            err "Tag $sha incomplet : la CI ne l'a pas publié (onglet Actions → Build & Push)."
        else
            ok "Tag $sha publié sur les 4 images — déployable et rollback-able."
        fi
    fi

    dim "Déployer une version précise : ./scripts/deploy-cd.sh ${target} <sha7>"
    dim "Vérifier un tag sans déployer  : ./scripts/deploy-cd.sh list ${target} <sha7>"
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
    # `dungeon-monsters.json` est ÉPHÉMÈRE (le siphon le réécrit au tick suivant) :
    # restaurer la version du dépôt ne perd rien.
    local GENERATED=(
        "public/game-data/dungeon-monsters.json"
    )
    # À l'inverse `ignored-monsters.json` est CURÉ à la main (God) : l'écraser ferait
    # perdre les exclusions configurées sur CE serveur. Il est donc sauvegardé hors
    # de l'arbre le temps du pull, puis restauré (voir plus bas).
    local PRESERVED=(
        "public/game-data/ignored-monsters.json"
    )

    # ── Git peut être AVEUGLE sur ces fichiers : ne jamais croire l'index ───────
    # Les bits `assume-unchanged` / `skip-worktree` (posés à la main pour ne plus voir
    # le bruit dans `git status`) font répondre « aucun changement » à `git diff` et
    # « No local changes to save » à `git stash`… alors que le merge refuse ensuite
    # d'écraser le fichier (« Your local changes would be overwritten by merge »).
    # ⇒ ni `git diff` ni `--autostash` ne protègent dans ce cas.
    # Deux règles apprises le 18/09/2026 (git 2.39, reproduit en bac à sable) :
    #   1. les deux options d'un MÊME `update-index` s'annulent en silence (le drapeau
    #      reste `S`) → il faut deux appels SÉPARÉS ;
    #   2. l'état des fichiers se compare au CONTENU (`git show HEAD:<f> | cmp -s`),
    #      jamais via l'index qui ment.
    local f
    for f in "${GENERATED[@]}" "${PRESERVED[@]}"; do
        [[ -f "$f" ]] || continue
        git cat-file -e "HEAD:$f" 2>/dev/null || continue
        if git ls-files -v -- "$f" 2>/dev/null | grep -qE '^[a-z]|^S'; then
            dim "  → $f : bit skip-worktree/assume-unchanged levé (git le voyait « propre »)"
            git update-index --no-skip-worktree -- "$f" 2>/dev/null || true
            git update-index --no-assume-unchanged -- "$f" 2>/dev/null || true
        fi
    done

    # Artefacts régénérés au runtime : la version du dépôt suffit (rien à conserver).
    for f in "${GENERATED[@]}"; do
        [[ -f "$f" ]] || continue
        git cat-file -e "HEAD:$f" 2>/dev/null || continue
        if ! git show "HEAD:$f" 2>/dev/null | cmp -s - "$f"; then
            dim "  → artefact régénéré : $f (restauration de la version du dépôt)"
            git show "HEAD:$f" > "$f"
        fi
    done

    # Données curées : copie hors de l'arbre, version du dépôt remise pour que le pull
    # soit propre, puis restauration — c'est la curation du serveur qui fait foi.
    local PRESERVE_DIR=""
    for f in "${PRESERVED[@]}"; do
        [[ -f "$f" ]] || continue
        git cat-file -e "HEAD:$f" 2>/dev/null || continue
        if ! git show "HEAD:$f" 2>/dev/null | cmp -s - "$f"; then
            [[ -n "$PRESERVE_DIR" ]] || PRESERVE_DIR="$(mktemp -d)"
            cp "$f" "$PRESERVE_DIR/$(basename "$f")"
            dim "  → donnée locale conservée : $f (mise de côté hors de l'arbre)"
            git show "HEAD:$f" > "$f"
        fi
    done

    DIRTY="$(git status --porcelain 2>/dev/null)"
    if [[ -n "$DIRTY" ]]; then
        warn "Des fichiers locaux sont modifiés — ils seront stashed puis réappliqués (--autostash)."
        printf '%s\n' "$DIRTY" | sed 's/^/     /' | head -10
        dim "  → Pour rétablir à la main : git checkout -- <fichier>   (ou   git stash)"
    fi
    # `--autostash` reste la ceinture de sécurité pour tout autre fichier modifié à la
    # main sur le serveur : mise de côté, pull, ré-application. Un conflit de
    # ré-application laisse le stash intact (aucune perte) et l'affiche ci-dessous.
    if git pull --autostash origin "$BRANCH" >/tmp/sigilos-pull.log 2>&1; then
        ok "Code source à jour (branche $BRANCH, $(git log -1 --oneline 2>/dev/null || echo '?'))."
    else
        warn "git pull en échec (ou ré-application du stash) — on continue avec les images GHCR (non bloquant)."
        sed 's/^/     /' /tmp/sigilos-pull.log | tail -8
        if ! git stash list | grep -q .; then :; else
            dim "  → stash conservé : 'git stash pop' après résolution (rien n'est perdu)."
        fi
    fi
    rm -f /tmp/sigilos-pull.log

    # Restauration des données curées (elles écrasent la version du dépôt).
    if [[ -n "$PRESERVE_DIR" ]]; then
        for f in "${PRESERVED[@]}"; do
            [[ -f "$PRESERVE_DIR/$(basename "$f")" ]] || continue
            cp "$PRESERVE_DIR/$(basename "$f")" "$f"
            dim "  → donnée locale restaurée : $f"
        done
        rm -rf "$PRESERVE_DIR"
    fi
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
        local SEED_RC=0
        # Borne de sécurité 15 min (le seed peut être long, mais jamais muet :
        # la sortie est désormais affichée en direct).
        compose_exec_streamed "$ENV_FILE" "$APP_SERVICE" 900 "$SEED_LOG" \
            "npm run seed:game-data:prod" || SEED_RC=$?
        if (( SEED_RC == 0 )); then
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
    # On garde aussi la sortie BRUTE : en cas d'échec on affiche la cause réelle
    # (disque plein, tag introuvable, 403 GHCR…) au lieu d'un « ✗ ÉCHEC » muet.
    local PULL_LOG
    PULL_LOG="$(mktemp)"
    sudo docker pull "${IMG}:${SHA}" 2>&1 | tr '\r' '\n' | tee "$PULL_LOG" | while IFS= read -r line; do
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
        dim "     cause : docker pull ${IMG}:${SHA}"
        grep -viE 'Pulling fs layer|Waiting|Downloading|Extracting|Pull complete|Already exists|Verifying Checksum|Download complete|^$' "$PULL_LOG" | tail -3 | sed 's/^/     /'
        dim "     repères : espace disque (df -h) · tags publiés (./scripts/deploy-cd.sh list beta) · expiration GHCR_TOKEN"
        PULL_OK=0
    fi
    rm -f "$PULL_LOG"
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
# Garde-fou proxy Caddy — le conteneur sert-il bien le Caddyfile DU DÉPÔT ?
# -----------------------------------------------------------------------------
# Le compose monte UN FICHIER (`./Caddyfile:/etc/caddy/Caddyfile`). Quand git remplace ce
# fichier, l'inode change : le conteneur reste collé à l'ANCIENNE version jusqu'à sa
# recréation (un bind-mount de fichier ne suit pas un remplacement). Le correctif est donc
# silencieusement inerte, parfois pendant des semaines. Deux incidents réels, mêmes
# symptômes : 23/08/2026 (`handle /assets/*` absent → images de la vitrine cassées) puis
# 04/09/2026 (`handle /robots.txt` absent → la prod a servi un robots.txt/HTML pendant
# 20 jours, constaté le 24/09). On compare donc les empreintes, on valide la config AVANT
# de toucher au proxy, et on ne recrée que si nécessaire.
caddy_config_check() {
    local ENV_FILE_C="$1"
    local CONTAINER="sigilos-gateway" HOST_SUM CONT_SUM

    [[ -f Caddyfile ]] || { dim "   Caddyfile absent du dépôt — contrôle ignoré."; return; }
    if ! sudo docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
        warn "Conteneur $CONTAINER absent — contrôle de config ignoré."
        return
    fi

    HOST_SUM="$(md5sum Caddyfile | awk '{print $1}')"
    CONT_SUM="$(sudo docker exec "$CONTAINER" md5sum /etc/caddy/Caddyfile 2>/dev/null | awk '{print $1}')"
    if [[ -n "$HOST_SUM" && "$HOST_SUM" == "$CONT_SUM" ]]; then
        ok "Proxy Caddy à jour (config identique au dépôt)."
        return
    fi

    warn "Proxy Caddy EN RETARD : le conteneur sert une ancienne config (bind-mount d'un fichier)."
    local NEXT_CONFIG="/tmp/Caddyfile.next"
    if ! sudo docker cp Caddyfile "$CONTAINER:$NEXT_CONFIG" >/dev/null 2>&1; then
        err "Copie de la config impossible — recréation à faire à la main :"
        dim "   sudo docker compose -f docker-compose.prod.yml --env-file $ENV_FILE_C up -d --force-recreate --no-deps caddy"
        return
    fi
    if ! sudo docker exec "$CONTAINER" caddy validate --config "$NEXT_CONFIG" >/dev/null 2>&1; then
        err "La config Caddy du dépôt est INVALIDE — proxy non touché (l'ancienne reste en service)."
        dim "   Détail : sudo docker exec $CONTAINER caddy validate --config $NEXT_CONFIG"
        return
    fi
    ok "Config Caddy du dépôt valide."
    info "   Recréation du proxy (quelques secondes d'interruption)..."
    if sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE_C" up -d --force-recreate --no-deps caddy; then
        ok "Proxy Caddy recréé avec la config du dépôt."
    else
        err "Échec de la recréation du proxy — à faire à la main :"
        dim "   sudo docker compose -f docker-compose.prod.yml --env-file $ENV_FILE_C up -d --force-recreate --no-deps caddy"
    fi
}

# -----------------------------------------------------------------------------
# Contrôle SEO post-déploiement — ce qui est RÉELLEMENT servi (pas ce que dit Git)
# -----------------------------------------------------------------------------
# « Un `robots.ts` correct dans Git ne prouve pas ce que le robot reçoit » : le 24/09/2026, la
# prod renvoyait la vitrine HTML (200 `text/html`) sur `/robots.txt` ET `/sitemap.xml`, ce qui
# faisait échouer le rapport « Sitemaps » de Search Console. On vérifie donc les deux URL
# publiques de chaque domaine, après le déploiement (voir aussi docs/agents/deploy-vps.md).
seo_check() {
    local URL="$1" CT CODE

    # robots.txt : doit être du TEXTE BRUT sur les deux domaines (jamais du HTML).
    CT="$(curl -fsS -m 20 -D - -o /dev/null "$URL/robots.txt" 2>/dev/null | tr -d '\r' \
        | awk 'tolower($1)=="content-type:"{print tolower($2); exit}')"
    if [[ "$CT" == text/plain* ]]; then
        ok "$URL/robots.txt → text/plain"
    else
        warn "$URL/robots.txt → Content-Type « ${CT:-aucun} » (attendu : text/plain)"
        dim "   → proxy servie par une ancienne config : voir le contrôle Caddy ci-dessus."
    fi

    # sitemap.xml : la bêta l'expose (XML), la vitrine répond 404 (hors index pendant la bêta).
    CODE="$(curl -sS -m 20 -o /dev/null -w '%{http_code}' "$URL/sitemap.xml" 2>/dev/null)"
    if [[ "$URL" == *beta.* ]]; then
        if [[ "$CODE" == "200" ]]; then
            ok "$URL/sitemap.xml → HTTP 200"
        else
            warn "$URL/sitemap.xml → HTTP ${CODE:-aucun} (la bêta doit exposer son sitemap)."
        fi
    else
        if [[ "$CODE" == "404" ]]; then
            ok "$URL/sitemap.xml → HTTP 404 attendu (vitrine hors index)."
        else
            warn "$URL/sitemap.xml → HTTP ${CODE:-aucun} (404 attendu : vitrine hors index)."
        fi
    fi

    # Pages clés : une application « healthy » peut quand même servir des 500/404 sur ses pages
    # (erreur de rendu, données manquantes, redirection cassée). On interroge donc les 4 pages
    # publiques qui portent le trafic — un `curl` de statut coûte 30 ms et évite de découvrir la
    # panne par un joueur. Aucune écriture, aucune donnée touchée : simple lecture HTTP.
    local PAGES
    if [[ "$URL" == *beta.* ]]; then
        PAGES=("/" "/guides" "/guides/rush-sylvestre" "/boss")
    else
        PAGES=("/")
    fi
    local PAGE
    for PAGE in "${PAGES[@]}"; do
        CODE="$(curl -sS -m 20 -o /dev/null -w '%{http_code}' "${URL}${PAGE}" 2>/dev/null)"
        if [[ "$CODE" == "200" ]]; then
            ok "  ${PAGE} → HTTP 200"
        else
            warn "  ${PAGE} → HTTP ${CODE:-aucun} (attendu 200 — vérifier les logs de l'app)."
        fi
    done
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

    # ── Pré-vol « le tag existe-t-il vraiment ? » ──────────────────────────────
    # Un tag jamais publié et un registre injoignable donnent le MÊME échec au
    # pull. On tranche la question AVANT de toucher aux conteneurs, image par
    # image, en lisant seulement le manifeste (aucune couche téléchargée).
    if [[ "$SHA" != "latest" ]]; then
        step "1.5" "Vérification du tag ${SHA}" "Contrôle que la CI a bien publié ce commit sur GHCR (manifeste seulement, aucun téléchargement)."
        local MISSING_TAG=0
        for NAME in app worker ws discord-bot; do
            local IMG="${GHCR_REG}/sigilos-${NAME}-${TARGET}"
            if sudo docker buildx imagetools inspect "${IMG}:${SHA}" >/dev/null 2>&1; then
                ok "${NAME} : tag ${SHA} publié"
            else
                err "${NAME} : tag ${SHA} absent (${IMG})"
                MISSING_TAG=1
            fi
        done
        if [[ "$MISSING_TAG" == "1" ]]; then
            echo ""
            dim "  Un tag absent = une image jamais publiée par la CI. Ce n'est donc NI"
            dim "  le disque NI le token du serveur : vérifie l'onglet Actions (Build &"
            dim "  Push vert pour ce commit) puis relance."
            dim "  Vérifier sans déployer : ./scripts/deploy-cd.sh list ${TARGET} ${SHA}"
            fail "Tag ${SHA} incomplet sur GHCR — déploiement annulé avant tout changement."
        fi
        echo ""
    fi

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
    # CLI Prisma : celui EMBARQUÉ dans l'image (rapide, zéro réseau) s'il est là,
    # sinon repli npx (téléchargement 1 à 3 min, source de l'attente muette du
    # 19/09/2026). Le repli garantit qu'un déploiement ne casse jamais si l'image
    # ne contient pas /opt/prisma-cli.
    # ⚠️ Prisma CLI absent de l'image runner (devDependency, non incluse dans .next/standalone) :
    # sans pin, `npx prisma` tire `prisma@latest` (actuellement une RC cassée 8.0.0-rc.10 où la
    # commande est renommée `migration` → "No command registered for `migrate`"). On épingle la
    # version du projet (7.10.0) comme dans services/discord-bot/Dockerfile.
    local PRISMA_CMD="npx --yes prisma@${PRISMA_PIN}"
    if sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec -T app-${TARGET} \
        sh -c 'node /opt/prisma-cli/node_modules/prisma/build/index.js --version' >/dev/null 2>&1; then
        PRISMA_CMD="node /opt/prisma-cli/node_modules/prisma/build/index.js"
        dim "     CLI Prisma embarqué dans l'image — aucun téléchargement."
    else
        dim "     CLI Prisma absent de l'image → npx le télécharge (1 à 3 min, c'est normal)."
    fi
    local MIGRATE_LOG MIGRATE_T0
    MIGRATE_LOG="$(mktemp)"; MIGRATE_T0="$SECONDS"
    local MIGRATE_RC=0
    compose_exec_streamed "$ENV_FILE" "app-${TARGET}" "$PRISMA_TIMEOUT" "$MIGRATE_LOG" \
        "NO_UPDATE_NOTIFIER=1 npm_config_update_notifier=false ${PRISMA_CMD} migrate deploy" || MIGRATE_RC=$?
    if (( MIGRATE_RC == 0 )); then
        if grep -qi "no pending migrations" "$MIGRATE_LOG"; then
            ok "Base à jour — aucune migration en attente ($(( SECONDS - MIGRATE_T0 ))s)."
        else
            ok "Migrations appliquées ($(( SECONDS - MIGRATE_T0 ))s)."
        fi
    elif (( MIGRATE_RC == 124 )); then
        err "Migrations Prisma interrompues après ${PRISMA_TIMEOUT}s (durée maximale dépassée)."
        dim "   → Cause probable : le serveur télécharge le CLI Prisma via npm (accès réseau lent/bloqué)."
        dim "     Relancer le déploiement, ou allonger le délai : PRISMA_TIMEOUT=1800 ./scripts/deploy-cd.sh $TARGET"
        tail -20 "$MIGRATE_LOG" | sed 's/^/     /'
        rm -f "$MIGRATE_LOG"
        exit 1
    else
        err "Échec des migrations Prisma (code ${MIGRATE_RC}) :"
        tail -20 "$MIGRATE_LOG" | sed 's/^/     /'
        rm -f "$MIGRATE_LOG"
        exit 1
    fi
    rm -f "$MIGRATE_LOG"
    if [[ "$TARGET" == "beta" ]]; then
        info "   Synchronisation du schéma (beta, db push)..."
        local PUSH_LOG; PUSH_LOG="$(mktemp)"
        local PUSH_RC=0
        compose_exec_streamed "$ENV_FILE" "app-${TARGET}" "$PRISMA_TIMEOUT" "$PUSH_LOG" \
            "NO_UPDATE_NOTIFIER=1 npm_config_update_notifier=false ${PRISMA_CMD} db push" || PUSH_RC=$?
        if (( PUSH_RC == 0 )); then
            if grep -qi "already in sync" "$PUSH_LOG"; then
                ok "Schéma déjà à jour."
            else
                ok "Schéma synchronisé."
            fi
        elif (( PUSH_RC == 124 )); then
            err "db push interrompu après ${PRISMA_TIMEOUT}s (durée maximale dépassée)."
            dim "     Relancer le déploiement, ou allonger : PRISMA_TIMEOUT=1800 ./scripts/deploy-cd.sh $TARGET"
            tail -20 "$PUSH_LOG" | sed 's/^/     /'
            rm -f "$PUSH_LOG"
            exit 1
        else
            err "Échec du db push (code ${PUSH_RC}) :"
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

    # ── Contrôles post-déploiement ───────────────────────────────────────────
    # 1) le proxy sert-il la config DU DÉPÔT ? (sinon : il la reprend — inode figé) ;
    # 2) ce qui est RÉELLEMENT servi aux robots (robots.txt / sitemap.xml) ;
    # 3) l'application elle-même.
    caddy_config_check "$ENV_FILE"
    seo_check "$URL"
    health_check "$URL"
}

# -----------------------------------------------------------------------------
# Dispatch des commandes
# -----------------------------------------------------------------------------
COMMAND="${1:-}"
case "$COMMAND" in
    beta|prod)   deploy "$COMMAND" "${2:-latest}" ;;
    list)        list_handler "${2:-}" "${3:-}" ;;
    --help|-h)   usage 0 ;;
    *)           usage 1 ;;
esac

