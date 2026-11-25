-- 20270208000000_add_guide_milestone_child
--
-- Pourquoi : permettre d'insérer, DANS un bloc existant du Rush, les blocs qui vivent
-- aujourd'hui uniquement au niveau du guide (Conseil/Tips, Obtention Dofus, Séparateur,
-- Combat tactique / semi-tactique). Le sous-bloc se place après une quête (`position`
-- s'intercale avec `GuideSequence.order`) ou à la fin du bloc (`position = 9999`).
--
-- Ce qu'elle contient : une table neuve `GuideMilestoneChild` + son index + sa FK vers
-- `GuideMilestone` (ON DELETE CASCADE). Aucune colonne existante n'est modifiée, aucune
-- donnée n'est réécrite : la progression, la route, les compteurs et les requêtes des
-- blocs restent inchangés.
--
-- Pourquoi à la main : `prisma migrate dev` est inutilisable sur cet historique local
-- (migration absente du dépôt, base en drift) — voir docs/agents/prisma-schema-change.md §0.

CREATE TABLE IF NOT EXISTS "GuideMilestoneChild" (
  "id"          TEXT NOT NULL,
  "milestoneId" TEXT NOT NULL,
  "type"        "GuideMilestoneType" NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "tips"        TEXT,
  "links"       JSONB,
  "imageUrl"    TEXT,
  "accentColor" TEXT,
  "dofusId"     TEXT,
  "position"    DOUBLE PRECISION NOT NULL DEFAULT 9999,
  "order"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuideMilestoneChild_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GuideMilestoneChild_milestoneId_position_order_idx"
  ON "GuideMilestoneChild"("milestoneId", "position", "order");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GuideMilestoneChild_milestoneId_fkey'
  ) THEN
    ALTER TABLE "GuideMilestoneChild"
      ADD CONSTRAINT "GuideMilestoneChild_milestoneId_fkey"
      FOREIGN KEY ("milestoneId") REFERENCES "GuideMilestone"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
