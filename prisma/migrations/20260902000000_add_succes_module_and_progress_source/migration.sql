-- Chantier #138 — module « Succès » dédié (checklist + annuaire) + provenance des validations

-- AlterTable
ALTER TABLE "GuildModules" ADD COLUMN "succes" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UserDungeonProgress" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';
