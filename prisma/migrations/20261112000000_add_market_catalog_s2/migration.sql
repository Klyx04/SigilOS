-- 🛒 Module « Marché » — S2 (branche B2) : catalogue d'objets enrichi + référentiels d'effets.
--
-- Migration IDEMPOTENTE (rejouable sans dégât) : `IF NOT EXISTS` + blocs
-- `DO $$ … EXCEPTION WHEN duplicate_object`. Aucune opération destructive.
--
-- 1) Extension ADDITIVE de `GameItem` (§6.11) : champs DofusDB jusqu'ici non stockés.
ALTER TABLE "GameItem" ADD COLUMN IF NOT EXISTS "realWeight" INTEGER;
ALTER TABLE "GameItem" ADD COLUMN IF NOT EXISTS "priceNpc" INTEGER;
ALTER TABLE "GameItem" ADD COLUMN IF NOT EXISTS "itemSetId" INTEGER;
ALTER TABLE "GameItem" ADD COLUMN IF NOT EXISTS "itemSetName" TEXT;
ALTER TABLE "GameItem" ADD COLUMN IF NOT EXISTS "isLegendary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GameItem" ADD COLUMN IF NOT EXISTS "isSaleable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GameItem" ADD COLUMN IF NOT EXISTS "superTypeId" INTEGER;
ALTER TABLE "GameItem" ADD COLUMN IF NOT EXISTS "superTypeName" TEXT;
-- Version LÉGÈRE des effets natifs (plages min–max) pour l'éditeur FM + la carte d'item.
ALTER TABLE "GameItem" ADD COLUMN IF NOT EXISTS "nativeEffects" JSONB;

-- Index de filtrage du catalogue (panoplie / famille).
CREATE INDEX IF NOT EXISTS "GameItem_itemSetId_idx" ON "GameItem"("itemSetId");
CREATE INDEX IF NOT EXISTS "GameItem_superTypeId_idx" ON "GameItem"("superTypeId");

-- 2) Référentiels data-driven (S2.5bis) : libellés / « % » / icônes.
CREATE TABLE IF NOT EXISTS "GameEffect" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "characteristic" INTEGER,
    "isInPercent" BOOLEAN NOT NULL DEFAULT false,
    "category" INTEGER,
    "iconKey" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GameEffect_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GameEffect_characteristic_idx" ON "GameEffect"("characteristic");

CREATE TABLE IF NOT EXISTS "GameCharacteristic" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "keyword" TEXT,
    "iconKey" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GameCharacteristic_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GameCharacteristic_keyword_idx" ON "GameCharacteristic"("keyword");
