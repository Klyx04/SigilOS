-- Migration : colonne dungeonIndex sur DjSearchParticipant (multi-donjons #26)
-- Index (0-based) du donjon rejoint dans DjSearchPost.dungeonsJson, pour
-- différencier les inscriptions par donjon sur l'embed Discord + la carte.
-- Non-breaking (nullable).

ALTER TABLE "DjSearchParticipant" ADD COLUMN "dungeonIndex" INTEGER;
