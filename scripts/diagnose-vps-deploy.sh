#!/bin/bash
# =============================================================================
# 🔎 SigilOS — Diagnostic de déploiement VPS (lecture seule)
# -----------------------------------------------------------------------------
# Usage :
#   ./scripts/diagnose-vps-deploy.sh              → diagnostic complet
#   ./scripts/diagnose-vps-deploy.sh beta         → idem, cible beta
#
# À lancer SUR LE VPS quand `./scripts/deploy-cd.sh beta` échoue. Le script ne
# modifie RIEN : il collecte, dans l'ordre, tout ce qu'un déploiement cassé
# laisse comme traces, puis imprime la cause la plus probable.
#
# Pourquoi un script : les pannes réelles de la beta (18/09/2026) avaient toutes
# la même signature « pull d'image échoué » mais 3 causes différentes — disque
# plein, token GHCR expiré, tag jamais publié par la CI. Sans collecte ordonnée
# on relance le deploy et on perd 10 minutes par essai.
# =============================================================================

set -u

if [[ -t 1 ]]; then
    C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
    C_RED=$'\033[31m';  C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'
    C_CYAN=$'\033[36m'
else
    C_RESET=""; C_BOLD=""; C_DIM=""; C_RED=""; C_GREEN=""; C_YELLOW=""; C_CYAN=""
fi

banner() { printf "\n${C_BOLD}%s${C_RESET}\n" "$*"; }
info()   { printf "${C_CYAN}%s${C_RESET}\n" "$*"; }
ok()     { printf "${C_GREEN}✓ %s${C_RESET}\n" "$*"; }
warn()   { printf "${C_YELLOW}! %s${C_RESET}\n" "$*"; }
err()    { printf "${C_RED}✗ %s${C_RESET}\n" "$*"; }
dim()    { printf "${C_DIM}  %s${C_RESET}\n" "$*"; }
horiz()  { printf "${C_DIM}%s${C_RESET}\n" "────────────────────────────────────────────────────────────"; }

ENV_NAME="${1:-beta}"
case "$ENV_NAME" in
    beta|prod) IMG_PREFIX="ghcr.io/klyx04/sigilos" ;;
    *) err "Environnement inconnu : $ENV_NAME (attendu : beta | prod)"; exit 2 ;;
esac

# Services déployés : si l'un d'eux manque, le compose entier part en échec — la
# cause est donc TOUJOURS à chercher service par service.
SERVICES="app worker ws"
CAUSES=()

banner "🔎 Diagnostic déploiement — cible : $ENV_NAME"
horiz
dim "date      : $(date -Is)"
dim "hôte      : $(hostname)"
dim "répertoire: $(pwd)"
horiz

# -----------------------------------------------------------------------------
# 1. Le dépôt est-il dans l'état attendu par le deploy ?
# -----------------------------------------------------------------------------
banner "1. Dépôt git"
if [ -d .git ]; then
    BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
    dim "branche     : $BRANCH"
    dim "commit      : $(git log -1 --format='%h %s' 2>/dev/null | cut -c1-80)"
    dim "remote HEAD : $(git rev-parse --short origin/$BRANCH 2>/dev/null || echo 'inconnu')"

    DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    if [ "$DIRTY" = "0" ]; then
        ok "Arbre de travail propre"
    else
        warn "$DIRTY fichier(s) modifié(s) localement :"
        git status --short | head -20
        dim "Note : les listes curées côté serveur (God) sont normales ici — le deploy"
        dim "      fait `git pull --autostash` pour les stasher puis les réappliquer."
        CAUSES+=("Arbre git modifié : vérifie que deploy-cd.sh utilise bien --autostash (sans lui, git pull bloque)")
    fi

    STASHES=$(git stash list | wc -l | tr -d ' ')
    if [ "$STASHES" != "0" ]; then
        warn "$STASHES stash(es) en attente (un autostash interrompu bloque le pull suivant)"
        git stash list
    fi
else
    err "Pas de dépôt git ici — lance le script depuis la racine de SigilOS"
    CAUSES+=("Mauvais répertoire")
fi

# -----------------------------------------------------------------------------
# 2. Disque & Docker : cause n°1 d'un `docker pull` qui échoue
# -----------------------------------------------------------------------------
banner "2. Espace disque"
df -h / /var/lib/docker 2>/dev/null | awk 'NR==1 || !seen[$1]++'
ROOT_USE=$(df --output=pcent / 2>/dev/null | tail -1 | tr -d ' %')
if [ -n "${ROOT_USE:-}" ] && [ "$ROOT_USE" -ge 90 ]; then
    err "Disque racine à ${ROOT_USE}% : docker pull va échouer (« no space left on device »)"
    CAUSES+=("Disque plein (${ROOT_USE}%) → sudo docker system prune -af --volumes")
elif [ -n "${ROOT_USE:-}" ]; then
    ok "Disque racine à ${ROOT_USE}%"
fi

banner "3. Empreinte Docker"
sudo docker system df 2>/dev/null || warn "docker inaccessible sans sudo ?"

banner "4. Conteneurs & état"
sudo docker compose ps 2>/dev/null || sudo docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' 2>/dev/null || warn "compose/ps indisponible"

# -----------------------------------------------------------------------------
# 5. Pull des images — SEULE source de vérité
# -----------------------------------------------------------------------------
banner "5. Pull des images $ENV_NAME"
PULL_FAILED=0
for SVC in $SERVICES; do
    IMG="${IMG_PREFIX}-${SVC}-${ENV_NAME}:latest"
    printf "${C_BOLD}→ %s${C_RESET}\n" "$IMG"
    if OUT=$(sudo docker pull "$IMG" 2>&1); then
        ok "${SVC} : image à jour"
    else
        PULL_FAILED=1
        err "${SVC} : pull REFUSÉ — erreur brute :"
        printf "%s\n" "$OUT" | tr '\r' '\n' | tail -6 | sed 's/^/      /'
        case "$OUT" in
            *"no space left"*) CAUSES+=("Disque plein pendant le pull de $SVC") ;;
            *"denied"*|*"unauthorized"*|*"403"*) CAUSES+=("Token GHCR refusé (relance le workflow Build & Push, rafraîchis GHCR_TOKEN)") ;;
            *"not found"*|*"manifest unknown"*) CAUSES+=("Image $SVC inexistante : la CI ne l'a pas publiée (onglet Actions → Build & Push doit être vert)") ;;
            *"TLS"*|*"dial tcp"*|*"timeout"*) CAUSES+=("Réseau/DNS du VPS pendant le pull de $SVC") ;;
            *) CAUSES+=("Cause inconnue sur $SVC — voir l'erreur brute ci-dessus") ;;
        esac
    fi
done

if [ "$PULL_FAILED" = "0" ]; then
    ok "Les 3 images se téléchargent : le registre n'est PAS la cause."
    dim "Cherche alors côté conteneur :"
    dim "  sudo docker logs --tail 80 sigilos-${ENV_NAME}-app-1"
    dim "  sudo docker compose config | head -40   (variable d'env manquante)"
fi

# -----------------------------------------------------------------------------
# 6. Secrets & variables d'environnement
# -----------------------------------------------------------------------------
banner "6. Fichier d'environnement"
if [ -f .env ]; then
    MISSING=()
    for VAR in DATABASE_URL AUTH_SECRET DISCORD_BOT_TOKEN NEXT_PUBLIC_APP_URL; do
        grep -q "^${VAR}=" .env || MISSING+=("$VAR")
    done
    if [ ${#MISSING[@]} -eq 0 ]; then
        ok ".env présent avec les variables clés"
    else
        err ".env incomplet — manquant : ${MISSING[*]}"
        CAUSES+=("Variables d'env manquantes : ${MISSING[*]}")
    fi
else
    err "Aucun .env à la racine"
    CAUSES+=(".env absent")
fi
if [ -n "${GHCR_TOKEN:-}" ]; then
    ok "GHCR_TOKEN défini dans la session shell"
else
    dim "GHCR_TOKEN non exporté ici (normal si `docker login` a déjà été fait)"
fi

# -----------------------------------------------------------------------------
# Verdict
# -----------------------------------------------------------------------------
banner "🧭 Verdict"
if [ ${#CAUSES[@]} -eq 0 ]; then
    ok "Aucune cause évidente détectée."
    dim "Relance ./scripts/deploy-cd.sh $ENV_NAME : en cas d'échec, lis la ligne « cause : »."
else
    for C in "${CAUSES[@]}"; do err "$C"; done
fi
horiz
dim "Rappel : la CI (Build & Push) doit être VERTE avant tout deploy — une image"
dim "jamais publiée est indiscernable d'un registre cassé côté serveur."
horiz
