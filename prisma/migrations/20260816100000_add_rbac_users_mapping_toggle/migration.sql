-- Chantier #72 : toggle God « Membres Spécifiques » (permissions RBAC individuelles).
-- Kill-switch fail-closed : off → usersMapping ignoré en lecture (getUserContext)
-- et toute modification rejetée en écriture (updateRBACMapping). Traçage qui/quand.

ALTER TABLE "PlatformConfig" ADD COLUMN "rbacUsersMappingEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PlatformConfig" ADD COLUMN "rbacUsersMappingUpdatedAt" TIMESTAMP(3);
ALTER TABLE "PlatformConfig" ADD COLUMN "rbacUsersMappingUpdatedBy" TEXT;
