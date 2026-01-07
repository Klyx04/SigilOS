-- Exemples de données pour Donjons, Zones et Monstres
-- À copier dans Prisma Studio (pas d'exécution SQL directe dans Prisma Studio)
-- Ces données sont à titre indicatif, tu dois les créer manuellement

-- DONJONS (utilise le bouton "Add record" dans Prisma Studio)
-- Table: Dungeon
-- Champs: name, bossName, level, imageUrl (optionnel), dofusDbLink (optionnel)

1. Moon, Moon, 200, null, "https://dofusdb.fr/fr/database/dungeon/103"
2. Ilyzaelle, Ilyzaelle, 200, null, "https://dofusdb.fr/fr/database/dungeon/112"
3. Korriandre, Korriandre, 200, null, null
4. Merkator, Merkator, 195, null, null
5. Bethel et Otomaï, Count Harebourg, 200, null, null

-- ZONES (Table: Zone)
-- Champs: name, level

1. Ile de Moon, 200
2. Frigost 3, 190
3. Sufokia, 100
4. Bonta, 50
5. Tour des Rêves, 200

-- MONSTRES (Table: Monster)
-- Champs: name, zoneId (utilise l'ID de la zone créée), level

1. Tofu Maléfique, <ID_zone_Bonta>, 50
2. Gelée Royale Bleue, <ID_zone_Frigost3>, 190
3. Kanigrou, <ID_zone_Ile_Moon>, 200
4. Rêveur, <ID_zone_Tour_Reves>, 200
5. Kralamoure, <ID_zone_Sufokia>, 100
