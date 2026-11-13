-- ============================================================================
-- Rôle PostgreSQL « lecture seule » pour un assistant — mesures de la bêta
-- ============================================================================
--
-- Exécution (sur le VPS, dans le conteneur de la bêta) :
--
--   cd ~/SigilOS
--   sudo docker exec -i sigilos-db-beta sh -c \
--     'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
--     < scripts/sql/agent-ro.sql
--
-- Le mot de passe ne figure JAMAIS ici (dépôt public) : il se pose juste après,
-- en interactif, par `\password cline_ro` — voir docs/agents/acces-lecture-seule.md §2.
--
-- 🔒 SEULE source des droits du rôle. Ce qui est interdit, et pourquoi, est
--    verrouillé par tests/unit/agent-ro-grants.test.ts :
--      • GRANT ... ON ALL TABLES  → donnerait `Account.access_token` /
--        `refresh_token` / `id_token` et `Session.sessionToken` (jetons OAuth) ;
--      • ALTER DEFAULT PRIVILEGES → toute table FUTURE deviendrait lisible (fail-open) ;
--      • PASSWORD en clair        → dépôt public ;
--      • INSERT / UPDATE / DELETE / TRUNCATE / REFERENCES / TRIGGER → aucune écriture.
--
-- ⚠️ `default_transaction_read_only` et `statement_timeout` sont USERSET : ce sont
--    des garde-fous contre l'accident, PAS des verrous contre un adversaire (le rôle
--    peut les changer dans sa session). Le verrou, c'est l'absence de privilège
--    d'écriture — section 5.
-- ============================================================================

\set ON_ERROR_STOP on

-- 1. Le rôle -------------------------------------------------------------------
--    `VALID UNTIL` et `CONNECTION LIMIT` sont appliqués par le serveur (le rôle ne
--    peut pas les contourner). `NOSUPERUSER … NOBYPASSRLS` : aucune élévation.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cline_ro') THEN
    CREATE ROLE cline_ro LOGIN
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
      CONNECTION LIMIT 2
      VALID UNTIL '2027-01-31';
  END IF;
END
$$;

-- 2. Défauts de session --------------------------------------------------------
ALTER ROLE cline_ro SET default_transaction_read_only = on;
ALTER ROLE cline_ro SET statement_timeout = '15s';
ALTER ROLE cline_ro SET lock_timeout = '3s';
ALTER ROLE cline_ro SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE cline_ro SET search_path = public;

-- 3. Base et schéma : se connecter et voir, rien de plus -----------------------
SELECT format('GRANT CONNECT ON DATABASE %I TO cline_ro', current_database()) \gexec
GRANT USAGE ON SCHEMA public TO cline_ro;

-- 4. Remise à zéro : le script est rejouable (idempotent) ----------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM cline_ro;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM cline_ro;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM cline_ro;

-- 5. ALLOWLIST — données de RÉFÉRENCE du jeu uniquement ------------------------
--    Aucune de ces tables ne porte de champ `guildId`, `userId`, `discordId`,
--    `email` ni `token` (invariant vérifié par le test) : mesurer le contenu du
--    jeu ne demande jamais de lire une personne.
--
--    Ajouter une table = l'ajouter ici, justifier dans la PR, relancer le test.
GRANT SELECT ON
  "Dungeon",
  "DungeonAchievement",
  "Monster",
  "MonsterFamily",
  "MonsterStat",
  "Zone",
  "GameItem",
  "GameItemSet",
  "GameQuest",
  "ClassSpellbook",
  "DofusQuestChain",
  "DofusQuestEntry",
  "DofusQuestPrerequisite",
  "DreamFloor",
  "DreamBonus",
  "Defi",
  "Titan"
TO cline_ro;

-- 6. Volumes : aucun droit de table supplémentaire -----------------------------
--    `pg_stat_user_tables` est lisible par tout rôle : le nombre de lignes par
--    table (estimé) s'obtient sans accorder une seule table d'identité.
--      SELECT relname, n_live_tup FROM pg_stat_user_tables
--      ORDER BY n_live_tup DESC LIMIT 20;
