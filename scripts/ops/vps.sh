#!/usr/bin/env bash
# =============================================================================
# vps.sh — runbook d'écriture sur le VPS (verbes fermés)
# =============================================================================
# Un outil d'administration ne tourne JAMAIS dans l'image applicative :
# `app-beta` / `app-prod` sont des images standalone Next et n'embarquent pas
# les dépendances des scripts (mesuré le 20/11/2026 : @prisma/driver-adapter-utils,
# puis postgres-array). Les verbes d'écriture passent par `ops-beta` / `ops-prod`
# (stage `ops` du Dockerfile : toutes les dépendances + client Prisma généré).
#
# Verbes :
#   dump <beta|prod>                          sauvegarde PostgreSQL datée (hôte)
#   rush-archive <beta|prod> [--apply]        archive le guide + en crée un vide
#   rush-delete-archive <env> <slug> [--apply]
#   rush-verify <beta|prod>                   compteurs du guide (lecture)
#
# Sans `--apply`, tout est en dry-run. `--apply` est le seul mot qui écrit.
# Procédure et rollback : docs/agents/vps-ops.md.
# =============================================================================
set -euo pipefail

readonly COMPOSE_FILE="docker-compose.prod.yml"
readonly ARCHIVE_PREFIX="rush-sylvestre-archive-"
readonly OPS_SCRIPT="scripts/archive-rush-guide.mjs"

die() { echo "ERREUR : $*" >&2; exit 2; }

usage() {
  cat <<'EOF'
Usage : ./scripts/ops/vps.sh <verbe> <beta|prod> [options]

  dump <env>                                    sauvegarde PostgreSQL (~/backups)
  rush-archive <env> [--apply]                  archive le guide Rush + crée un vide
  rush-delete-archive <env> <slug> [--apply]    supprime UNIQUEMENT une archive
  rush-verify <env>                             compteurs du guide Rush

Sans --apply, tout est en dry-run.
EOF
}

# Journal local (append-only) : qui, quand, quel verbe. Aucun secret.
trace() {
  mkdir -p "$HOME/backups"
  printf '%s|%s|%s\n' "$(date -Is)" "$(id -un)" "$*" >> "$HOME/backups/ops.log"
}

env_or_die() {
  case "${1:-}" in
    beta|prod) printf '%s' "$1" ;;
    *) die "environnement attendu : beta|prod (reçu : '${1:-}')" ;;
  esac
}

compose() {
  local env="$1"; shift
  docker compose -f "$COMPOSE_FILE" --env-file ".env.$env" "$@"
}

# `--apply` explicite, rien d'autre : le dry-run est le défaut.
mode_or_die() {
  case "${1:-}" in
    "") printf '%s' "--dry-run" ;;
    --apply) printf '%s' "--apply" ;;
    *) die "option inconnue : ${1}" ;;
  esac
}

[ -f "$COMPOSE_FILE" ] || die "exécute-moi depuis le dépôt (~/SigilOS) : $COMPOSE_FILE introuvable"

case "${1:-}" in
  dump)
    env="$(env_or_die "${2:-}")"
    trace "dump $env"
    out="$HOME/backups/sigilos-$env-$(date +%F-%H%M).dump"
    compose "$env" exec -T "db-$env" \
      sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$out"
    # Un dump vide ressemble à une sauvegarde : on refuse de continuer.
    [ -s "$out" ] || die "dump vide — rien n'est sauvegardé : $out"
    echo "OK $out ($(du -h "$out" | cut -f1))"
    ;;

  rush-archive)
    env="$(env_or_die "${2:-}")"
    mode="$(mode_or_die "${3:-}")"
    trace "rush-archive $env $mode"
    compose "$env" build "ops-$env"
    compose "$env" run --rm -T --no-deps "ops-$env" node "$OPS_SCRIPT" "$mode"
    ;;

  rush-delete-archive)
    env="$(env_or_die "${2:-}")"
    slug="${3:-}"
    case "$slug" in
      "$ARCHIVE_PREFIX"*) ;;
      *) die "refus : « $slug » n'est pas une archive ($ARCHIVE_PREFIX*)" ;;
    esac
    mode="$(mode_or_die "${4:-}")"
    trace "rush-delete-archive $env $slug $mode"
    compose "$env" build "ops-$env"
    compose "$env" run --rm -T --no-deps "ops-$env" \
      node "$OPS_SCRIPT" --delete-archive "$slug" "$mode"
    ;;

  rush-verify)
    env="$(env_or_die "${2:-}")"
    trace "rush-verify $env"
    compose "$env" exec -T "db-$env" \
      sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -A -F "|"' <<'SQL'
SELECT 'sequences' AS mesure, count(*)::text AS valeur
FROM "GuideSequence" s
JOIN "GuideMilestone" m ON m.id = s."milestoneId"
JOIN "OptimizedGuide" g ON g.id = m."guideId"
WHERE g.slug = 'rush-sylvestre'
UNION ALL
SELECT 'conseils', count(*)::text
FROM "GuideSequence" s
JOIN "GuideMilestone" m ON m.id = s."milestoneId"
JOIN "OptimizedGuide" g ON g.id = m."guideId"
WHERE g.slug = 'rush-sylvestre' AND s.tips IS NOT NULL AND btrim(s.tips) <> ''
UNION ALL
SELECT 'pos_tags', count(*)::text
FROM "GuideSequence" s
JOIN "GuideMilestone" m ON m.id = s."milestoneId"
JOIN "OptimizedGuide" g ON g.id = m."guideId",
LATERAL jsonb_array_elements(s."activityTags") t
WHERE g.slug = 'rush-sylvestre' AND t->>'type' = 'pos_tags'
UNION ALL
SELECT 'tags_avec_monstres', count(*)::text
FROM "GuideSequence" s
JOIN "GuideMilestone" m ON m.id = s."milestoneId"
JOIN "OptimizedGuide" g ON g.id = m."guideId",
LATERAL jsonb_array_elements(s."activityTags") t
WHERE g.slug = 'rush-sylvestre'
  AND t->>'type' IN ('combat_solo', 'combat_plusieurs')
  AND (t->'monsters') IS NOT NULL;
SQL
    ;;

  ""|-h|--help)
    usage
    exit 0
    ;;

  *)
    usage
    exit 2
    ;;
esac
