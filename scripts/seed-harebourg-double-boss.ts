/**
 * 🏰 Seed — Donjon du Comte Harebourg : les 4 variantes « double boss ».
 *
 * Le donjon Dofense id 71 (« Donjon du Comte Harebourg ») contient 4 maps « Balcon de … »
 * (une par boss optionnel). La fiche boss affiche AUTOMATIQUEMENT la map du monstre
 * (via getDofensiveDungeonForBoss + SpellRangeGrid, qui auto-sélectionne la map `isBoss`).
 * Pour que CHAQUE variante récupère SA map (et pas celle du Comte), le `bossName` doit
 * être le nom EXACT du monstre Dofensive (Missiz Frizz / Sylargh / Klime / Nileza),
 * et non « Comte Harebourg & X » (sinon le résolveur retombe sur le 1er monstre du donjon).
 *
 * Upsert par clé unique @@unique([name, bossName]) → idempotent (relançable).
 *
 * Usage (sur le VPS / en local) :
 *   npx -y tsx scripts/seed-harebourg-double-boss.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LOCATION = "Donjon du Comte Harebourg";
const LEVEL = 200;
// Lien Dofensive fourni (donjon de base id 71 → monstre 3416). La map est résolue par le bossName.
const DOF_URL = "https://dofensive.com/fr/monster/3416?q=N4IgygpgNhDGAuEAmBZA9gOwM6IE4gC4BmAFgEYA2AGhHWzy0NFMqZAHFcBDJCQsmmAAO0KIwIBtALoBfOUA";

// `bossName` = nom exact du monstre Dofensive (clé de résolution de la map).
const VARIANTS: { bossName: string; map: string; mapId: number }[] = [
    { bossName: "Missiz Frizz", map: "Balcon de Missiz Frizz", mapId: 112206341 },
    { bossName: "Sylargh",      map: "Balcon de Sylargh",      mapId: 112206337 },
    { bossName: "Klime",        map: "Balcon de Klime",        mapId: 112206593 },
    { bossName: "Nileza",       map: "Balcon de Nileza",       mapId: 112206343 },
];

async function main() {
    for (const v of VARIANTS) {
        const existing = await prisma.dungeon.findUnique({
            where: { name_bossName: { name: LOCATION, bossName: v.bossName } },
            select: { id: true },
        });

        const data = {
            name: LOCATION,
            bossName: v.bossName,
            level: LEVEL,
            dofensiveUrl: DOF_URL,
            // La map Dofense n'a pas de champ dédié actuellement : elle est résolue à la volée
            // par la fiche boss (getDofensiveDungeonForBoss → map isBoss = Balcon de {v.bossName}).
            // `dofusdbId`/`mapId` (position carte du monde) non renseignés ici (champ optionnel).
        };

        if (existing) {
            await prisma.dungeon.update({ where: { id: existing.id }, data });
            console.log(`↻ mis à jour : ${LOCATION} · ${v.bossName} → ${v.map}`);
        } else {
            await prisma.dungeon.create({ data });
            console.log(`+ créé : ${LOCATION} · ${v.bossName} → ${v.map}`);
        }
    }
    console.log("✅ Seed Comte Harebourg (4 variantes) terminé.");
}

main()
    .catch((e) => {
        console.error("❌ Erreur seed :", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
