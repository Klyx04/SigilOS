-- Lot M1 — recherches d'achat (WANTED) : quota dédié, souhait de forge,
-- critères de jet (exo/over/trans).
-- Générée à la main (même raison que 20261230000000_raid_live_session :
-- `migrate dev` bloqué par la migration pré-existante cassée
-- `20261010000000_add_component_stats`, hors périmètre).

-- Quota WANTED par membre (compteur séparé des ventes).
ALTER TABLE "GuildConfig" ADD COLUMN IF NOT EXISTS "marketMaxWantedPerMember" INTEGER NOT NULL DEFAULT 5;

-- Souhait de forge d'une recherche d'achat.
ALTER TABLE "MarketListing" ADD COLUMN IF NOT EXISTS "wantedTranscendence" TEXT NOT NULL DEFAULT 'ANY';

-- Critères de jet d'une recherche d'achat.
CREATE TABLE IF NOT EXISTS "MarketWantedCriterion" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "effectId" INTEGER NOT NULL,
    "characteristic" INTEGER,
    "label" TEXT NOT NULL,
    "minValue" INTEGER NOT NULL,
    "naturalMax" INTEGER,
    "exo" BOOLEAN NOT NULL DEFAULT false,
    "tag" TEXT NOT NULL DEFAULT 'NATIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketWantedCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MarketWantedCriterion_listingId_effectId_key" ON "MarketWantedCriterion"("listingId", "effectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MarketWantedCriterion_listingId_idx" ON "MarketWantedCriterion"("listingId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'MarketWantedCriterion_listingId_fkey'
    ) THEN
        ALTER TABLE "MarketWantedCriterion" ADD CONSTRAINT "MarketWantedCriterion_listingId_fkey"
            FOREIGN KEY ("listingId") REFERENCES "MarketListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;
