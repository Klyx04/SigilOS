-- Additive : cache persistant des sorts de classes (19 lignes max, une par classe).
-- Remplace le seul cache Redis 24 h de `getClassSpells` (survit au restart/expire).
-- `IF NOT EXISTS` : rejouable sans effet (siphon manuel + `migrate deploy`).
CREATE TABLE IF NOT EXISTS "ClassSpellbook" (
    "classId" INTEGER NOT NULL,
    "className" TEXT NOT NULL,
    "spells" JSONB NOT NULL,
    "spellCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClassSpellbook_pkey" PRIMARY KEY ("classId")
);
