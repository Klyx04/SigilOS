-- Consentement **progression de rush** (D-V21).
--
-- Publier ses blocs, sa quete en cours et ses donjons coches aux visiteurs du meme serveur est
-- une finalite DISTINCTE :
--   · `showOnDirectory` = figurer dans l annuaire (pseudo, classe, Dofus) ;
--   · `showPresence`    = etre vu en ligne (V2c) ;
--   · `showRushProgress`= publier sa progression de rush (ce lot).
-- Reutiliser un des deux premiers publierait des progressions deja en base sans consentement.
-- Colonne FERMEE par defaut : personne n est publie retroactivement.
--
-- Ecrite a la main (ce depot n utilise pas `migrate dev`, cf. docs/agents/prisma-schema-change.md
-- §0) : additive et idempotente, aucune donnee reecrite.

ALTER TABLE "PublicProfile"
    ADD COLUMN IF NOT EXISTS "showRushProgress" BOOLEAN NOT NULL DEFAULT false;

-- Meme forme que l index de l annuaire : le panneau communautaire filtre par (serveur, consentement).
CREATE INDEX IF NOT EXISTS "PublicProfile_dofusServerId_showRushProgress_idx"
    ON "PublicProfile" ("dofusServerId", "showRushProgress");