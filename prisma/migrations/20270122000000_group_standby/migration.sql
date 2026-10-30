-- « Stand-by » des groupes (posts DJ/quêtes, runs Songes, événements calendrier).
--
-- POURQUOI : un groupe programmé se décale parfois entre membres (quelqu'un n'est pas là,
-- on reporte) ; le cron H-1 et les relances d'inactivité continuaient de pinger un groupe
-- que son créateur avait de fait mis en pause. La pause est désormais portée par la donnée,
-- lue par les crons, les embeds Discord et le dashboard (règle unique :
-- `src/lib/group-standby.ts`).
--
-- CONTENU : une colonne `standBy JSONB` nullable sur les trois modèles concernés.
--   NULL                    = groupe actif (comportement historique, inchangé)
--   { at, userId, name }    = pause posée par cet auteur (pseudo figé à cet instant)
-- Aucune donnée existante n'est réécrite, aucun backfill n'est nécessaire : toutes les
-- lignes restent actives tant qu'un humain n'a pas posé une pause.
--
-- ÉCRITE À LA MAIN : `prisma migrate dev` est inutilisable sur cet historique local
-- (migration absente du dépôt, base en drift) — cf. docs/agents/prisma-schema-change.md §0.
-- Additive et idempotente : rejouable sans erreur.

ALTER TABLE "DjSearchPost" ADD COLUMN IF NOT EXISTS "standBy" JSONB;
ALTER TABLE "DreamRun"     ADD COLUMN IF NOT EXISTS "standBy" JSONB;
ALTER TABLE "GuildEvent"   ADD COLUMN IF NOT EXISTS "standBy" JSONB;
