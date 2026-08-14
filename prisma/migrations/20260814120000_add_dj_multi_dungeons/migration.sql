-- Migration : colonne dungeonsJson sur DjSearchPost (mode multi-donjons #26)
-- UN SEUL post porte N donjons (2-5) : snapshot JSON de chaque donjon
-- (nom/image/niveau/boss/succès) + succès visés + note + date prévue.
-- dungeonId reste NULL en mode multi. Non-breaking (nullable).

ALTER TABLE "DjSearchPost" ADD COLUMN "dungeonsJson" JSONB;
