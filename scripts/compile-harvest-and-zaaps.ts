import fs from "fs";
import path from "path";

const DOFUS_ZAAPS = [
    // --- AMAKNA & CONTINENT ---
    { id: 1, name: "Le village d'Amakna", x: -2, y: 0, worldId: 1, subArea: "Le village" },
    { id: 2, name: "Château d'Amakna", x: 3, y: -5, worldId: 1, subArea: "Le château d'Amakna" },
    { id: 3, name: "Rivage sufokien", x: 10, y: 22, worldId: 1, subArea: "Rivage sufokien" },
    { id: 5, name: "Montagne des Craqueleurs", x: -5, y: -8, worldId: 1, subArea: "Montagne des Craqueleurs" },
    { id: 6, name: "Plaine des Scarafeuilles", x: -1, y: 24, worldId: 1, subArea: "Plaine des Scarafeuilles" },
    { id: 7, name: "Madrestam (Port)", x: 7, y: -4, worldId: 1, subArea: "Port de Madrestam" },
    { id: 8, name: "Tainéla (Berceau)", x: 1, y: -32, worldId: 1, subArea: "Tainéla" },
    { id: 9, name: "Astrub (Cité)", x: 5, y: -18, worldId: 1, subArea: "Cité d'Astrub" },
    { id: 10, name: "Plaine des Porkass", x: -5, y: -23, worldId: 1, subArea: "Plaine des Porkass" },
    { id: 11, name: "Le coin des Bouftous", x: 5, y: 7, worldId: 1, subArea: "Le coin des Bouftous" },
    { id: 12, name: "Bord de la forêt maléfique", x: -1, y: 13, worldId: 1, subArea: "Bord de la forêt maléfique" },
    { id: 13, name: "Village des Éleveurs", x: -16, y: 1, worldId: 1, subArea: "Montagne des Koalaks" },
    { id: 14, name: "Cimetière primitif", x: -12, y: 19, worldId: 1, subArea: "Cimetière primitif" },

    // --- PLAINES DE CANIA ---
    { id: 15, name: "Champs de Cania", x: -27, y: -36, worldId: 1, subArea: "Champs de Cania" },
    { id: 16, name: "Lac de Cania", x: -3, y: -42, worldId: 1, subArea: "Lac de Cania" },
    { id: 17, name: "Massif de Cania", x: -13, y: -28, worldId: 1, subArea: "Massif de Cania" },
    { id: 18, name: "Plaines Rocheuses", x: -17, y: -47, worldId: 1, subArea: "Plaines Rocheuses" },
    { id: 19, name: "Route de la Roche", x: -20, y: -20, worldId: 1, subArea: "Route de la Roche" },
    { id: 20, name: "Pics de Cania", x: -26, y: -60, worldId: 1, subArea: "Pics de Cania" },
    { id: 21, name: "Foire du Trool", x: -11, y: -36, worldId: 1, subArea: "Foire du Trool" },
    { id: 22, name: "Village des Kanigs", x: 0, y: -56, worldId: 1, subArea: "Village des Kanigs" },

    // --- SIDIMOTE & CITÉS ---
    { id: 23, name: "Route des Roulottes", x: -25, y: 12, worldId: 1, subArea: "Route des Roulottes" },
    { id: 24, name: "Cité de Bonta", x: -32, y: -56, worldId: 1, subArea: "Centre-ville de Bonta" },
    { id: 25, name: "Cité de Brâkmar", x: -26, y: 35, worldId: 1, subArea: "Centre-ville de Brâkmar" },
    { id: 26, name: "Sufokia", x: 13, y: 26, worldId: 1, subArea: "Sufokia" },

    // --- PANDALA ---
    { id: 27, name: "Pandala (Faubourgs)", x: 20, y: -29, worldId: 1, subArea: "Faubourgs de Pandala" },
    { id: 28, name: "Mont des Tombeaux", x: 40, y: -44, worldId: 1, subArea: "Mont des Tombeaux" },

    // --- OTOMAÏ ---
    { id: 29, name: "Otomaï (Village côtier)", x: -46, y: 18, worldId: 1, subArea: "Village côtier" },
    { id: 30, name: "Otomaï (Village de la Canopée)", x: -54, y: 16, worldId: 1, subArea: "Village de la Canopée" },
    { id: 31, name: "Village des Zoths", x: -53, y: 18, worldId: 1, subArea: "Village des Zoths" },

    // --- FRIGOST ---
    { id: 32, name: "Frigost (La bourgade)", x: -78, y: -41, worldId: 1, subArea: "La bourgade" },
    { id: 33, name: "Frigost (Village enseveli)", x: -77, y: -73, worldId: 1, subArea: "Village enseveli" },
    { id: 34, name: "Château de Harebourg", x: -67, y: -77, worldId: 1, subArea: "Château de Harebourg" },

    // --- SAHARACH ---
    { id: 35, name: "Saharach (Dunes des ossements)", x: 15, y: -58, worldId: 1, subArea: "Dunes des ossements" },

    // --- ÎLES & MONDES SPÉCIAUX ---
    { id: 36, name: "Île des Wabbits", x: 25, y: -4, worldId: 1, subArea: "Île des Wabbits" },
    { id: 37, name: "Laboratoires abandonnés", x: 27, y: -14, worldId: 1, subArea: "Laboratoires abandonnés" },
    { id: 38, name: "Île de Moon", x: 35, y: 12, worldId: 1, subArea: "Plage de Moon" },
    { id: 39, name: "Futaie enneigée", x: 39, y: -82, worldId: 1, subArea: "Futaie enneigée" },
    { id: 40, name: "Village des Brigandins", x: -15, y: -23, worldId: 1, subArea: "Village des Brigandins" },
    { id: 41, name: "Village des Dopeuls", x: -26, y: -13, worldId: 1, subArea: "Village des Dopeuls" },
    { id: 42, name: "Village des Bworks", x: -5, y: 10, worldId: 1, subArea: "Village des Bworks" },
    { id: 43, name: "Nimotopia", x: -64, y: 27, worldId: 1, subArea: "Nimotopia" },
    { id: 44, name: "Crokuzko", x: -83, y: -15, worldId: 1, subArea: "Archipel des Écailles" },

    // --- INCARNAM (worldId: 2) ---
    { id: 45, name: "Route des âmes", x: -1, y: -3, worldId: 2, subArea: "Route des âmes" },
    { id: 46, name: "Pâturages", x: 2, y: -5, worldId: 2, subArea: "Pâturages" },
    { id: 47, name: "Cimetière d'Incarnam", x: 3, y: 0, worldId: 2, subArea: "Cimetière" }
];

async function main() {
    console.log("🚀 Siphonnage et compilation des données de Récolte et Zaaps...");

    // 1. Sauvegarde des Zaaps
    const zaapsPath = path.join(process.cwd(), "public/game-data/zaaps.json");
    fs.writeFileSync(zaapsPath, JSON.stringify(DOFUS_ZAAPS, null, 2), "utf-8");
    console.log(`✅ ${DOFUS_ZAAPS.length} Zaaps enregistrés dans public/game-data/zaaps.json`);

    // 2. Mapping officiel des 5 métiers de récolte et de leurs typeIds dans DofusDB
    const HARVEST_JOBS = [
        { id: 2, name: "Bûcheron", typeIds: [38], iconId: 1, icon: "🪓", img: "/game-data/harvest-icons/job-1.jpg" },
        { id: 24, name: "Mineur", typeIds: [39], iconId: 24, icon: "⛏️", img: "/game-data/harvest-icons/job-24.jpg" },
        { id: 26, name: "Alchimiste", typeIds: [35, 36], iconId: 26, icon: "🧪", img: "/game-data/harvest-icons/job-26.jpg" },
        { id: 28, name: "Paysan", typeIds: [34], iconId: 28, icon: "🌾", img: "/game-data/harvest-icons/job-28.jpg" },
        { id: 36, name: "Pêcheur", typeIds: [41], iconId: 36, icon: "🎣", img: "/game-data/harvest-icons/job-36.jpg" }
    ];

    // 3. Charger la worldmap locale pour associer les mapId aux coordonnées et Zaaps
    const worldMapPath = path.join(process.cwd(), "public/game-data/worldmap.json");
    const localWorldMap = JSON.parse(fs.readFileSync(worldMapPath, "utf-8"));
    const mapsById = new Map<number, any>();
    (localWorldMap.maps || []).forEach((m: any) => {
        mapsById.set(m.id, m);
    });

    // Helper: Distance Manhattan entre deux coordonnées
    const dist = (x1: number, y1: number, x2: number, y2: number) => Math.abs(x1 - x2) + Math.abs(y1 - y2);

    const compiledJobs = [];

    for (const job of HARVEST_JOBS) {
        console.log(`📡 Récupération des ressources pour ${job.name} (typeIds: ${job.typeIds.join(", ")})...`);
        const rawItems: any[] = [];
        for (const tId of job.typeIds) {
            const res = await fetch(`https://api.dofusdb.fr/items?$limit=150&typeId=${tId}`);
            const data = await res.json();
            rawItems.push(...(data.data || []));
        }

        const resources: any[] = [];

        for (const item of rawItems) {
            // Récupérer les VRAIES positions exactes de récolte map par map (API v2 officielle)
            let skip = 0;
            const spotMap = new Map<string, { x: number; y: number; count: number; subAreaId: number; worldId: number }>();
            let totalSpots = 0;

            while (true) {
                try {
                    const res = await fetch(`https://api.dofusdb.fr/recoltables2?resources[$in][]=${item.id}&$limit=50&$skip=${skip}`);
                    if (!res.ok) break;
                    const data = await res.json();
                    if (!data.data || data.data.length === 0) break;

                    for (const entry of data.data) {
                        const pos = entry.pos;
                        if (!pos) continue;

                        const worldId = pos.worldMap || 1;
                        let count = 0;
                        (entry.quantities || []).forEach((q: any) => {
                            if (q.item === item.id) count += (q.quantity || 1);
                        });
                        if (count === 0) count = 1;

                        totalSpots += count;

                        const key = `${worldId}_${pos.posX},${pos.posY}`;
                        if (spotMap.has(key)) {
                            spotMap.get(key)!.count += count;
                        } else {
                            spotMap.set(key, {
                                x: pos.posX,
                                y: pos.posY,
                                count,
                                subAreaId: pos.subAreaId || 0,
                                worldId
                            });
                        }
                    }

                    skip += data.data.length;
                    if (skip >= data.total) break;
                } catch (e) {
                    console.error(`Erreur fetch recoltables2 pour item ${item.id}:`, e);
                    break;
                }
            }

            const spots = Array.from(spotMap.values());
            if (spots.length === 0) continue;

            // Calcul des Circuits Opti-Farm (Clustering par Zaap du MÊME MONDE le plus proche)
            const circuitsByZaap = new Map<number, { zaap: typeof DOFUS_ZAAPS[0]; spots: typeof spots; totalResources: number }>();

            spots.forEach(sp => {
                let nearestZaap: typeof DOFUS_ZAAPS[0] | null = null;
                let minDist = 16; // Rayon max pour un circuit de farm cohérent

                for (const z of DOFUS_ZAAPS) {
                    if ((z.worldId || 1) !== (sp.worldId || 1)) continue; // Isolation par monde
                    const d = dist(sp.x, sp.y, z.x, z.y);
                    if (d < minDist) {
                        minDist = d;
                        nearestZaap = z;
                    }
                }

                if (nearestZaap) {
                    if (!circuitsByZaap.has(nearestZaap.id)) {
                        circuitsByZaap.set(nearestZaap.id, { zaap: nearestZaap, spots: [], totalResources: 0 });
                    }
                    const c = circuitsByZaap.get(nearestZaap.id)!;
                    c.spots.push(sp);
                    c.totalResources += sp.count;
                }
            });

            // Convertir en liste de circuits classés par pertinence (plus de ressources d'abord)
            const circuits = Array.from(circuitsByZaap.values())
                .filter(c => c.spots.length >= 2) // Minimum 2 maps pour constituer un circuit
                .map(c => {
                    // Ordonner le chemin de la boucle depuis le Zaap (Nearest Neighbor Heuristic)
                    const unvisited = [...c.spots];
                    const path: { x: number; y: number; count?: number }[] = [{ x: c.zaap.x, y: c.zaap.y }];
                    let currX = c.zaap.x;
                    let currY = c.zaap.y;

                    while (unvisited.length > 0) {
                        let bestIdx = 0;
                        let bestDist = Infinity;
                        for (let i = 0; i < unvisited.length; i++) {
                            const d = dist(currX, currY, unvisited[i].x, unvisited[i].y);
                            if (d < bestDist) {
                                bestDist = d;
                                bestIdx = i;
                            }
                        }
                        const next = unvisited.splice(bestIdx, 1)[0];
                        path.push({ x: next.x, y: next.y, count: next.count });
                        currX = next.x;
                        currY = next.y;
                    }

                    // Fermer la boucle vers le Zaap
                    path.push({ x: c.zaap.x, y: c.zaap.y });

                    return {
                        zaapId: c.zaap.id,
                        zaapName: c.zaap.name,
                        zaapCoord: [c.zaap.x, c.zaap.y],
                        worldId: c.zaap.worldId || 1,
                        totalResources: c.totalResources,
                        mapCount: c.spots.length,
                        path
                    };
                })
                .sort((a, b) => b.totalResources - a.totalResources);

            resources.push({
                id: item.id,
                name: item.name?.fr || item.name?.en || `Item #${item.id}`,
                level: item.level || 1,
                iconId: item.iconId,
                img: `/game-data/harvest-icons/${item.iconId}.png`,
                totalSpots,
                spots,
                circuits
            });
        }

        resources.sort((a: any, b: any) => a.level - b.level);

        console.log(`  -> ${resources.length} ressources récoltables pour ${job.name}.`);

        compiledJobs.push({
            id: job.id,
            name: job.name,
            iconId: job.iconId,
            icon: job.icon,
            img: job.img,
            resources
        });
    }

    const outputPath = path.join(process.cwd(), "public/game-data/harvest-resources.json");
    fs.writeFileSync(outputPath, JSON.stringify(compiledJobs, null, 2), "utf-8");
    console.log(`✅ Fichier harvest-resources.json généré avec succès (${compiledJobs.length} métiers complets avec circuits Opti-Farm) !`);
}

main().catch(console.error);
