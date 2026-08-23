-- Chantier #16 — Toggle God « Forcer le mode sombre » (kill-switch fail-closed)
ALTER TABLE "PlatformConfig" ADD COLUMN "forceDarkMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformConfig" ADD COLUMN "forceDarkModeUpdatedAt" TIMESTAMP(3);
ALTER TABLE "PlatformConfig" ADD COLUMN "forceDarkModeUpdatedBy" TEXT;

-- Chantier #5 — Couleur de guilde (teinte OKLCH 0-360°, nullable = fallback or)
ALTER TABLE "GuildConfig" ADD COLUMN "accentHue" INTEGER;
