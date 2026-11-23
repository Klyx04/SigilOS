---
paths:
  - "scripts/agent-ro.sh"
  - "docs/agents/vps-read-only.md"
  - "docs/MAINTENANCE.md"
---

# Règle VPS — lecture seule par défaut

- **La clé agent est en `command=` forcé** : elle ne peut exécuter que les verbes de
  `scripts/agent-ro.sh` (`status`, `ps`, `logs`, `migrations`, `counts`, `crons`, `csp`).
  Aucun shell, aucun tunnel, aucun `sudo`.
- **Interdits** avec cette clé : `deploy-cd.sh`/`deploy.sh`, `docker compose up|restart|run`,
  `prisma migrate deploy`, toute écriture SQL, `crontab -e`, rechargement Caddy, flag de
  maintenance. Un déploiement est une action humaine ou un lot séparé (smoke test + rollback).
- **Base** : le rôle `sigil_ro` est `SELECT` seulement. Le mot de passe vit dans
  `/home/sigiladmin/.sigilos-ro.pgpass` (600), jamais dans le dépôt.
- **Changement de capacité** : revue + mise à jour de `docs/agents/vps-read-only.md` + test
  de la matrice (`status`, `logs`, `migrations`, `whoami` refusé).
- **Pas de secret dans les sorties** : les commandes autorisées ne lisent ni `.env`, ni
  token, ni snowflake ; `csp` ne renvoie qu'un booléen.
