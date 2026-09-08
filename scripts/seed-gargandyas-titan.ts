/**
 * Seed idempotent : Titan « Gargandyas » (1ᵉʳ Titan / Événement Krosmique).
 * À lancer après la migration `20261101000000_add_titan` :
 *   npx tsx scripts/seed-gargandyas-titan.ts
 * (ou via `prisma migrate deploy` + `npm run seed` si intégré au seed principal).
 */
import "dotenv/config";
import { db } from "../src/lib/prisma";

async function main() {
    const titan = await db.titan.upsert({
        where: { slug: "gargandyas" },
        update: {
            name: "Gargandyas",
            level: 200,
            zone: "Osavora",
            imageUrl: "/game-data/titans/gargandyas.webp",
            dpnlUrl: "https://www.dofuspourlesnoobs.com/temple-de-gargandyas.html",
            dofuspourlesnoobsUrl: "https://www.dofuspourlesnoobs.com/temple-de-gargandyas.html",
            dofensiveUrl: "https://dofensive.com/fr/monster/8062",
            mapName: "Temple de Gargandyas — Salle du Graogarm",
            dofusdbId: 8062,
            questName: "Destructeur de mondes",
            questUrl: "https://www.dofuspourlesnoobs.com/temple-de-gargandyas.html",
            scheduleConfig: {
                onlyWeekend: true,
                daysOfWeek: [5, 6, 0], // Ven, Sam, Dim
                startTime: "19:00",
                endTime: "08:00",
                maxWinsPerWeekend: 5,
            },
            seasons: ["Naissances", "Chasse", "Repos"],
            currentSeason: "Naissances",
            maxMembers: 4,
            isPermanent: true,
            description:
                "Premier Titan de Dofus, affronté via son esprit dans le Temple de Gargandyas (dimension Osavora, [17,8]). " +
                "Disponible uniquement le week-end (vendredi 19h → lundi 8h), 5 victoires max par week-end, une offrande de " +
                "ressource selon la saison. Le boss de phase 4 varie selon la saison (Naissances → Déchireuse, Chasse → Supervizoeuf, Repos → Vénérable Endormi).",
        },
        create: {
            name: "Gargandyas",
            slug: "gargandyas",
            level: 200,
            zone: "Osavora",
            imageUrl: "/game-data/titans/gargandyas.webp",
            dpnlUrl: "https://www.dofuspourlesnoobs.com/temple-de-gargandyas.html",
            dofuspourlesnoobsUrl: "https://www.dofuspourlesnoobs.com/temple-de-gargandyas.html",
            dofensiveUrl: "https://dofensive.com/fr/monster/8062",
            mapName: "Temple de Gargandyas — Salle du Graogarm",
            dofusdbId: 8062,
            questName: "Destructeur de mondes",
            questUrl: "https://www.dofuspourlesnoobs.com/temple-de-gargandyas.html",
            scheduleConfig: {
                onlyWeekend: true,
                daysOfWeek: [5, 6, 0],
                startTime: "19:00",
                endTime: "08:00",
                maxWinsPerWeekend: 5,
            },
            seasonBosses: [
                { season: "Naissances", bossName: "Déchireuse" },
                { season: "Chasse", bossName: "Supervizoeuf" },
                { season: "Repos", bossName: "Vénérable Endormi" },
            ],
            seasons: ["Naissances", "Chasse", "Repos"],
            currentSeason: "Naissances",
            maxMembers: 4,
            isPermanent: true,
            description:
                "Premier Titan de Dofus, affronté via son esprit dans le Temple de Gargandyas (dimension Osavora, [17,8]). " +
                "Disponible uniquement le week-end (vendredi 19h → lundi 8h), 5 victoires max par week-end, une offrande de " +
                "ressource selon la saison. Le boss de phase 4 varie selon la saison (Naissances → Déchireuse, Chasse → Supervizoeuf, Repos → Vénérable Endormi).",
        },
    });

    console.log(`✅ Titan seed OK — Gargandyas (id=${titan.id})`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
