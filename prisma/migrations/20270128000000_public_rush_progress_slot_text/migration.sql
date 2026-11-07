-- V1d — l'emplacement de progression devient une **chaîne**, comme les trois tables internes
-- (`PlayerGuideProgress`, `PlayerGuideResourceCheck`, `PlayerGuideDungeonState`) : `PRINCIPAL` pour le
-- personnage principal, le pseudo pour une mule.
--
-- Pourquoi cette conversion : la clé de progression invitée (`guestCharacterSlot`) est déjà un
-- texte (`pseudo-serveur`). Un entier aurait obligé à inventer un index, qui se décale dès que
-- la liste des mules change — la progression aurait sauté d'un personnage à l'autre.
--
-- La table est **vide par construction** (aucun writer avant ce lot) : la conversion ne peut pas
-- perdre de données. `USING "characterSlot"::text` reste explicite (PostgreSQL l'exige).
ALTER TABLE "PublicRushProgress"
    ALTER COLUMN "characterSlot" DROP DEFAULT,
    ALTER COLUMN "characterSlot" TYPE TEXT USING "characterSlot"::text,
    ALTER COLUMN "characterSlot" SET DEFAULT 'PRINCIPAL';
