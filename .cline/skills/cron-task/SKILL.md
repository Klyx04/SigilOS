---
name: cron-task
description: Utiliser pour ajouter, modifier ou déboguer une tâche cron (route src/app/api/cron, worker BullMQ, script maintenance.sh). Couvre l'idempotence, la télémétrie, la crontab VPS, les alertes et les tests.
---
# Tâche cron

1. Créer/modifier la route `src/app/api/cron/<tache>/route.ts`.
2. Vérifier l'auth `CRON_SECRET` (fail-closed) et l'idempotence (garde d'état dans le `WHERE`).
3. Émettre la télémétrie (`recordCronExecution`, `boundCronList` si liste).
4. Ajouter la ligne de crontab dans `docs/MAINTENANCE.md` et `scripts/maintenance.sh` si besoin.
5. Tester : cas nominal, cas déjà fait, cas erreur Discord/DB.
6. Mettre à jour `docs/ROADMAP.md` si c'est un lot.

Détail : `docs/agents/add-cron-task.md`.