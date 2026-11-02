#!/usr/bin/env bash
# =============================================================================
# agent-ro.sh — commande forcée de la clé « agent » (LECTURE SEULE)
# =============================================================================
# Cette clé SSH ne peut PAS ouvrir de shell : `authorized_keys` la contraint à ce
# script, qui n'accepte qu'une liste fermée de verbes. Aucun argument libre n'est
# passé à un shell (`eval`, `sh -c`), toutes les requêtes SQL sont fixes.
#
# Verbes :
#   status      git du dépôt + conteneurs bêta
#   ps          conteneurs bêta
#   logs <svc>  logs d'un service (app|worker|ws|bot|db|redis|caddy)
#   migrations  10 dernières migrations appliquées (rôle sigil_ro)
#   counts      compteurs du guide rush-sylvestre (rôle sigil_ro)
#   crons       lignes de crontab surveillées
#   csp         valeur de CSP_ENFORCE
#
# Toute autre commande est refusée (code 2) et journalisée.
# Procédure et menace : docs/agents/vps-read-only.md.
# =============================================================================
set -euo pipefail

readonly REPO="/home/sigiladmin/SigilOS"
readonly DB_CONTAINER="sigilos-db-beta"
readonly APP_CONTAINER="sigilos-beta"
readonly PASS_FILE="/home/sigiladmin/.sigilos-ro.pgpass"
readonly BETA_FILTER='^sigilos-(beta|worker-beta|ws-beta|discord-bot-beta|db-beta|redis-beta)\|'

log() { logger -t sigilos-agent-ro -- "$*" 2>/dev/null || true; }
deny() { echo "Commande non autorisée"; log "DENY: $*"; exit 2; }

# `read` découpe sur l'IFS par défaut, SANS expansion de glob : le premier mot est
# le verbe, le second un éventuel argument (validé par un `case` fermé).
read -r CMD ARG _ <<< "${SSH_ORIGINAL_COMMAND:-}"

case "${CMD:-}" in
  status)
    echo "=== dépôt ==="
    git -C "$REPO" log -1 --oneline
    echo "=== conteneurs bêta ==="
    docker ps --format '{{.Names}}|{{.Status}}|{{.Image}}' | grep -E "$BETA_FILTER" || true
    ;;
  ps)
    docker ps --format '{{.Names}}|{{.Status}}|{{.Image}}' | grep -E "$BETA_FILTER" || true
    ;;
  logs)
    case "${ARG:-app}" in
      app) CONTAINER="$APP_CONTAINER" ;;
      worker) CONTAINER="sigilos-worker-beta" ;;
      ws) CONTAINER="sigilos-ws-beta" ;;
      bot) CONTAINER="sigilos-discord-bot-beta" ;;
      db) CONTAINER="sigilos-db-beta" ;;
      redis) CONTAINER="sigilos-redis-beta" ;;
      caddy) CONTAINER="sigilos-gateway" ;;
      *) deny "logs ${ARG:-}" ;;
    esac
    docker logs --since 30m --tail 200 "$CONTAINER" 2>&1
    ;;
  migrations)
    PGPASSWORD="$(cat "$PASS_FILE")" docker exec -e PGPASSWORD "$DB_CONTAINER" \
      psql -U sigil_ro -d sigilos -A -F '|' \
      -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC NULLS LAST, started_at DESC LIMIT 10;"
    ;;
  counts)
    PGPASSWORD="$(cat "$PASS_FILE")" docker exec -e PGPASSWORD "$DB_CONTAINER" \
      psql -U sigil_ro -d sigilos -A -F '|' \
      -c "SELECT count(*) AS total, count(*) FILTER (WHERE s.\"alignReq\" IS NOT NULL) AS align_req, count(*) FILTER (WHERE s.\"alignOrderCode\" IS NOT NULL) AS ordres, count(*) FILTER (WHERE s.\"classReq\" IS NOT NULL) AS classes FROM \"GuideSequence\" s JOIN \"GuideMilestone\" m ON m.id = s.\"milestoneId\" JOIN \"OptimizedGuide\" g ON g.id = m.\"guideId\" WHERE g.slug = 'rush-sylvestre';"
    ;;
  crons)
    crontab -l 2>&1 | grep -E 'live-watch|publish-scheduled-polls|seniority-roles|raid-reminders|event-reminders|dj-reminders|songes-reminders' || true
    ;;
  csp)
    docker exec "$APP_CONTAINER" printenv CSP_ENFORCE
    ;;
  *)
    deny "${SSH_ORIGINAL_COMMAND:-<vide>}"
    ;;
esac

log "OK: ${CMD}${ARG:+ $ARG}"
