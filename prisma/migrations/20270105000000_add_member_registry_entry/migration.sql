-- B-2 — rendre les membres Discord « hors dashboard » éditables :
--  ① un commentaire du registre peut viser un profil dashboard OU un membre Discord (xor) ;
--  ② une ligne de registre dédiée porte les données éditables des membres sans profil.
-- Migration ADDITIVE (aucune réécriture de données) : `profileId` perd seulement sa
-- contrainte NOT NULL, et une nouvelle table est créée.

-- ① Commentaires : cible polymorphe (profil dashboard ou membre Discord hors dashboard).
ALTER TABLE "MemberRegistryComment" ALTER COLUMN "profileId" DROP NOT NULL;
ALTER TABLE "MemberRegistryComment" ADD COLUMN "discordId" TEXT;
CREATE INDEX "MemberRegistryComment_discordId_createdAt_idx" ON "MemberRegistryComment"("discordId", "createdAt");

-- ② Ligne de registre d'un membre Discord sans profil dashboard.
CREATE TABLE "MemberRegistryEntry" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "pseudoDofus" TEXT,
    "ankamaId" TEXT,
    "guildJoinedAt" TIMESTAMP(3),
    "recruitedById" TEXT,
    "trialValidated" BOOLEAN NOT NULL DEFAULT false,
    "trialEndsAt" TIMESTAMP(3),
    "altPseudos" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MemberRegistryEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberRegistryEntry_guildId_discordId_key" ON "MemberRegistryEntry"("guildId", "discordId");
CREATE INDEX "MemberRegistryEntry_guildId_idx" ON "MemberRegistryEntry"("guildId");
CREATE INDEX "MemberRegistryEntry_discordId_idx" ON "MemberRegistryEntry"("discordId");

ALTER TABLE "MemberRegistryEntry" ADD CONSTRAINT "MemberRegistryEntry_guildId_fkey"
    FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
