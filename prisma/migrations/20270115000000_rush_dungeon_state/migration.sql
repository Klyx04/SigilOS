-- État manuel des DONJONS **par quête** (migration ADDITIVE, aucune perte de données).
--
-- ⚠️ La coche est par OCCURRENCE : le même donjon demandé par deux quêtes se coche
-- deux fois. `sequenceId` fait donc partie de la clé unique, à côté de `dungeonKey`.
--
-- Deux états : DONE (« fait ») / TODO (« à faire »). L'absence de ligne = pas décidé.
-- Une quête dont un donjon REQUIS n'est pas DONE ne peut pas être validée (verrou
-- serveur dans `setRushSequenceProgress`).
--
-- `GuideSequence.dungeonOptionalIds` : donjons optionnels d'une quête (affichés et
-- cochables, mais ils ne bloquent pas la validation).

CREATE TYPE "GuideDungeonState" AS ENUM ('DONE', 'TODO');

CREATE TABLE "PlayerGuideDungeonState" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "characterSlot" TEXT NOT NULL DEFAULT 'PRINCIPAL',
    "dungeonKey" TEXT NOT NULL,
    "state" "GuideDungeonState" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerGuideDungeonState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerGuideDungeonState_profileId_guideId_sequenceId_dungeo_key" ON "PlayerGuideDungeonState"("profileId", "guideId", "sequenceId", "dungeonKey", "characterSlot");
CREATE INDEX "PlayerGuideDungeonState_guideId_sequenceId_idx" ON "PlayerGuideDungeonState"("guideId", "sequenceId");
CREATE INDEX "PlayerGuideDungeonState_guideId_state_idx" ON "PlayerGuideDungeonState"("guideId", "state");
CREATE INDEX "PlayerGuideDungeonState_profileId_idx" ON "PlayerGuideDungeonState"("profileId");

ALTER TABLE "PlayerGuideDungeonState" ADD CONSTRAINT "PlayerGuideDungeonState_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerGuideDungeonState" ADD CONSTRAINT "PlayerGuideDungeonState_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "OptimizedGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerGuideDungeonState" ADD CONSTRAINT "PlayerGuideDungeonState_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "GuideSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Donjons OPTIONNELS d'une quête : sous-ensemble de `dungeonIds`. Un donjon optionnel
-- s'affiche et se coche, mais ne bloque pas la validation de la quête.
ALTER TABLE "GuideSequence"
  ADD COLUMN "dungeonOptionalIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
