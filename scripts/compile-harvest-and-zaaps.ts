import fs from "fs";
import path from "path";

// ═══════════════════════════════════════════════════════════════
// ZAAPS — Liste complète officielle Dofus
// ═══════════════════════════════════════════════════════════════
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
    { id: 41, name: "Village des Dopeuls", x: -34, y: -8, worldId: 1, subArea: "Village des Dopeuls" },
    { id: 43, name: "Nimotopia", x: -64, y: 27, worldId: 1, subArea: "Nimotopia" },
    { id: 44, name: "Crokuzko", x: -83, y: -15, worldId: 1, subArea: "Archipel des Écailles" },

    // --- INCARNAM (worldId: 2) ---
    { id: 45, name: "Route des âmes", x: -1, y: -3, worldId: 2, subArea: "Route des âmes" },
    { id: 46, name: "Pâturages", x: 2, y: -5, worldId: 2, subArea: "Pâturages" },
    { id: 47, name: "Cimetière d'Incarnam", x: 3, y: 0, worldId: 2, subArea: "Cimetière" }
];

type SpotData = { x: number; y: number; count: number; subAreaId: number; worldId: number };

async function main() {
    console.log("🚀 Compilation des circuits de récolte Opti-Farm (méthodologie trajets bots Dofus)...\n");

    // 1. Sauvegarde des Zaaps
    const zaapsPath = path.join(process.cwd(), "public/game-data/zaaps.json");
    fs.writeFileSync(zaapsPath, JSON.stringify(DOFUS_ZAAPS, null, 2), "utf-8");
    console.log(`✅ ${DOFUS_ZAAPS.length} Zaaps enregistrés dans public/game-data/zaaps.json`);

    // 2. Chargement de worldmap.json pour les sous-zones et les maps réelles
    const worldmapPath = path.join(process.cwd(), "public/game-data/worldmap.json");
    const wm = JSON.parse(fs.readFileSync(worldmapPath, "utf-8"));
    const subAreasMap = new Map<number, string>();
    (wm.subareas || []).forEach((s: any) => subAreasMap.set(s.id, s.name?.fr || s.name));

    // Indexation des maps outdoor par clé `${worldId}_${x},${y}`
    const mapsByCoord = new Map<string, any>();
    (wm.maps || []).forEach((m: any) => {
        if (m.outdoor) {
            const wId = m.worldMap === -1 ? 1 : (m.worldMap || 1);
            mapsByCoord.set(`${wId}_${m.x},${m.y}`, m);
        }
    });
    console.log(`🗺️  ${mapsByCoord.size} maps terrestres outdoor indexées pour le pathfinding.\n`);

    // 3. Fonction BFS pour trouver le chemin continu map par map
    function bfsPath(start: [number, number], goal: [number, number], worldId: number): [number, number][] | null {
        if (start[0] === goal[0] && start[1] === goal[1]) return [start];
        const q: [number, number][][] = [[start]];
        const visited = new Set<string>([`${start[0]},${start[1]}`]);
        const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        let maxIter = 1500;

        while (q.length > 0 && maxIter-- > 0) {
            const curPath = q.shift()!;
            const [cx, cy] = curPath[curPath.length - 1];
            if (cx === goal[0] && cy === goal[1]) return curPath;

            for (const [dx, dy] of dirs) {
                const nx = cx + dx, ny = cy + dy;
                const k = `${nx},${ny}`;
                if (visited.has(k)) continue;
                if (!mapsByCoord.has(`${worldId}_${k}`)) continue;

                visited.add(k);
                q.push([...curPath, [nx, ny]]);
            }
        }
        return null;
    }

    // 4. Charger les données existantes de harvest-resources.json
    const harvestPath = path.join(process.cwd(), "public/game-data/harvest-resources.json");
    const existingData: any[] = JSON.parse(fs.readFileSync(harvestPath, "utf-8"));

    let totalCircuitsCount = 0;
    let totalContinuousCount = 0;

    for (const job of existingData) {
        console.log(`📡 Génération des circuits pour ${job.name}...`);

        for (const res of job.resources) {
            // Regrouper les spots par (worldId, subAreaId)
            const spotsBySub = new Map<string, { worldId: number; subAreaId: number; spots: SpotData[] }>();
            (res.spots || []).forEach((sp: SpotData) => {
                const wId = sp.worldId || 1;
                const k = `${wId}_${sp.subAreaId}`;
                if (!spotsBySub.has(k)) {
                    spotsBySub.set(k, { worldId: wId, subAreaId: sp.subAreaId, spots: [] });
                }
                spotsBySub.get(k)!.spots.push(sp);
            });

            const circuits: any[] = [];

            for (const [, grp] of spotsBySub) {
                if (grp.spots.length < 2) continue; // Au moins 2 maps de récolte

                const sName = subAreasMap.get(grp.subAreaId) || `Zone #${grp.subAreaId}`;

                // Trouver le Zaap d'accès dans le même monde
                const avgX = grp.spots.reduce((s, p) => s + p.x, 0) / grp.spots.length;
                const avgY = grp.spots.reduce((s, p) => s + p.y, 0) / grp.spots.length;
                const worldZaaps = DOFUS_ZAAPS.filter(z => (z.worldId || 1) === grp.worldId);
                const candidates = worldZaaps.length > 0 ? worldZaaps : DOFUS_ZAAPS;

                // Choix intelligent du Zaap d'accès
                let bestZaap = candidates[0];
                let bestDist = Infinity;

                // Exceptions officielles Dofus : Forêt des pins perdus / Champs de glace partent TOUJOURS de La bourgade
                if (grp.subAreaId === 604 || grp.subAreaId === 601 || grp.subAreaId === 602 || grp.subAreaId === 615) {
                    const bourgadeZaap = candidates.find(z => z.id === 32);
                    if (bourgadeZaap) bestZaap = bourgadeZaap;
                } else if (grp.subAreaId === 93 || grp.subAreaId === 165 || grp.subAreaId === 166 || grp.subAreaId === 167) {
                    const moonZaap = candidates.find(z => z.id === 38);
                    if (moonZaap) bestZaap = moonZaap;
                } else {
                    for (const z of candidates) {
                        // Éviter Harebourg pour les zones qui ne sont pas le château
                        if (z.id === 34 && grp.subAreaId !== 611) continue;
                        const d = Math.abs(z.x - avgX) + Math.abs(z.y - avgY);
                        if (d < bestDist) {
                            bestDist = d;
                            bestZaap = z;
                        }
                    }
                }

                // Génération du trajet continu (méthodologie bot Dofus)
                const spotCountMap = new Map<string, number>();
                grp.spots.forEach(s => spotCountMap.set(`${s.x},${s.y}`, s.count));

                // Spot d'entrée dans la zone = le plus proche du Zaap
                let startSpotIdx = 0;
                let startDist = Infinity;
                for (let i = 0; i < grp.spots.length; i++) {
                    const d = Math.abs(grp.spots[i].x - bestZaap.x) + Math.abs(grp.spots[i].y - bestZaap.y);
                    if (d < startDist) {
                        startDist = d;
                        startSpotIdx = i;
                    }
                }

                const unvisited = [...grp.spots];
                const first = unvisited.splice(startSpotIdx, 1)[0];

                // ── ÉTAPE CRUCIALE : Le trajet commence STRICTEMENT au Zaap de départ ! ──
                const fullPath: { x: number; y: number; count?: number }[] = [];
                const zaapStart: [number, number] = [bestZaap.x, bestZaap.y];
                const pathToFirst = bfsPath(zaapStart, [first.x, first.y], grp.worldId);

                if (pathToFirst && pathToFirst.length > 0) {
                    for (let j = 0; j < pathToFirst.length - 1; j++) {
                        const pt = pathToFirst[j];
                        const k = `${pt[0]},${pt[1]}`;
                        fullPath.push({ x: pt[0], y: pt[1], count: spotCountMap.get(k) || 0 });
                    }
                } else {
                    fullPath.push({ x: bestZaap.x, y: bestZaap.y, count: 0 });
                }

                fullPath.push({ x: first.x, y: first.y, count: first.count });
                let current: [number, number] = [first.x, first.y];

                while (unvisited.length > 0) {
                    let bestIdx = -1;
                    let bestLen = Infinity;
                    let bestP: [number, number][] | null = null;

                    for (let i = 0; i < unvisited.length; i++) {
                        const p = bfsPath(current, [unvisited[i].x, unvisited[i].y], grp.worldId);
                        if (p && p.length < bestLen) {
                            bestLen = p.length;
                            bestIdx = i;
                            bestP = p;
                        }
                    }

                    if (bestIdx === -1 || !bestP) {
                        // Îlot isolé sans chemin terrestre direct
                        const nextTarget = unvisited.shift()!;
                        fullPath.push({ x: nextTarget.x, y: nextTarget.y, count: nextTarget.count });
                        current = [nextTarget.x, nextTarget.y];
                        continue;
                    }

                    // Insérer toutes les maps de transition intermédiaires
                    for (let j = 1; j < bestP.length; j++) {
                        const pt = bestP[j];
                        const k = `${pt[0]},${pt[1]}`;
                        const count = spotCountMap.get(k) || 0;
                        fullPath.push({ x: pt[0], y: pt[1], count });
                    }

                    current = [unvisited[bestIdx].x, unvisited[bestIdx].y];
                    unvisited.splice(bestIdx, 1);
                }

                // Boucler vers le zaap ou le premier spot pour fermer le circuit
                const closeP = bfsPath(current, zaapStart, grp.worldId) || bfsPath(current, [first.x, first.y], grp.worldId);
                if (closeP && closeP.length > 1) {
                    for (let j = 1; j < closeP.length; j++) {
                        const pt = closeP[j];
                        const k = `${pt[0]},${pt[1]}`;
                        const count = (j === closeP.length - 1) ? 0 : (spotCountMap.get(k) || 0);
                        fullPath.push({ x: pt[0], y: pt[1], count });
                    }
                }

                const totalRes = grp.spots.reduce((sum, s) => sum + s.count, 0);

                let isContinuous = true;
                for (let i = 0; i < fullPath.length - 1; i++) {
                    const stepD = Math.abs(fullPath[i].x - fullPath[i+1].x) + Math.abs(fullPath[i].y - fullPath[i+1].y);
                    if (stepD > 1) { isContinuous = false; break; }
                }

                totalCircuitsCount++;
                if (isContinuous) totalContinuousCount++;

                circuits.push({
                    zaapId: bestZaap.id,
                    zaapName: bestZaap.name,
                    zaapCoord: [bestZaap.x, bestZaap.y],
                    zoneName: sName,
                    subAreaId: grp.subAreaId,
                    worldId: grp.worldId,
                    totalResources: totalRes,
                    mapCount: grp.spots.length,
                    path: fullPath
                });
            }

            // Trier par volume de ressources récoltables descendant
            circuits.sort((a, b) => b.totalResources - a.totalResources);
            res.circuits = circuits;
        }
    }

    // 5. Écrire le fichier final
    fs.writeFileSync(harvestPath, JSON.stringify(existingData, null, 2), "utf-8");
    console.log(`\n🎉 Compilation terminée avec succès !`);
    console.log(`   - Circuits générés : ${totalCircuitsCount}`);
    console.log(`   - Circuits 100% continus (case par case) : ${totalContinuousCount}`);
}

main().catch(console.error);
