import fs from 'fs';
import path from 'path';

async function syncWorldMapDeep() {
    console.log('🔄 Démarrage de la synchronisation profonde avec DofusDB...');

    // 1. Fetch World Definitions
    const worldsRes = await fetch('https://api.dofusdb.fr/worlds?$limit=100&lang=fr');
    const worldsJson = await worldsRes.json();
    const worldsData = worldsJson.data;
    fs.writeFileSync(path.join(process.cwd(), 'public/game-data/worlds.json'), JSON.stringify(worldsData, null, 2));
    console.log(`✅ ${worldsData.length} mondes enregistrés.`);

    // 2. Fetch SubAreas
    let subAreas: any[] = [];
    let sSkip = 0;
    console.log('📡 Récupération des sous-zones...');
    while (true) {
        const sr = await fetch(`https://api.dofusdb.fr/subareas?$limit=50&$skip=${sSkip}&lang=fr`);
        const sj = await sr.json();
        if (!sj.data || sj.data.length === 0) break;
        subAreas = subAreas.concat(sj.data.map((s: any) => ({
            id: s.id,
            name: s.name?.fr || "Zone Inconnue",
            areaId: s.areaId,
            level: s.level,
            shape: s.shape // Needed for Doflex-style solid zone filling
        })));
        sSkip += sj.data.length;
        if (sSkip >= sj.total) break;
        await new Promise(r => setTimeout(r, 20));
    }
    console.log(`✅ ${subAreas.length} sous-zones enregistrées.`);

    // 3. Fetch Dungeons
    let allDungeons: any[] = [];
    let dSkip = 0;
    while (true) {
        const dr = await fetch(`https://api.dofusdb.fr/dungeons?$limit=50&$skip=${dSkip}`);
        const dj = await dr.json();
        if (!dj.data || dj.data.length === 0) break;
        allDungeons = allDungeons.concat(dj.data.map((d: any) => ({
            id: d.id,
            name: d.name?.fr || "Donjon inconnu",
            optimalPlayerLevel: d.optimalPlayerLevel,
            entranceMapId: d.entranceMapId
        })));
        dSkip += dj.data.length;
        if (dSkip >= dj.total) break;
        await new Promise(r => setTimeout(r, 20));
    }
    console.log(`✅ ${allDungeons.length} donjons enregistrés.`);

    // 4. Fetch ALL Map Positions (Deep Scan)
    // IMPORTANT: On ne se fie plus à un total arbitraire.
    // On va boucler jusqu'à ce que l'API n'ait plus RIEN à donner.
    let allMaps: any[] = [];
    let skip = 0;
    console.log('📡 Scan profond des positions de cartes...');

    while (true) {
        try {
            const res = await fetch(`https://api.dofusdb.fr/map-positions?$limit=100&$skip=${skip}`);
            const data = await res.json();

            if (!data.data || data.data.length === 0) break;

            const processed = data.data
                .filter((m: any) => {
                    // On filtre les cartes à 0,0 sauf si elles ont un SubAreaId valide et non nul
                    // Car beaucoup de cartes de test sont à 0,0
                    if (m.posX === 0 && m.posY === 0 && (!m.subAreaId || m.subAreaId === 0)) return false;
                    return true;
                })
                .map((m: any) => ({
                    id: m.id,
                    x: m.posX,
                    y: m.posY,
                    subAreaId: m.subAreaId,
                    worldMap: m.worldMap,
                    outdoor: !!m.outdoor
                }));

            allMaps = allMaps.concat(processed);
            
            if (skip % 500 === 0) {
                console.log(`📊 Progression: ${allMaps.length} cartes trouvées... (skip: ${skip})`);
            }
            
            skip += data.data.length;
            if (skip >= data.total) {
                 // Double check: parfois le total de l'API est menteur. 
                 // On continue un peu si on a encore des données.
                 // Mais ici on fait confiance si data.data.length était plein.
            }
            
            // Speed up but stay safe
            await new Promise(r => setTimeout(r, 10));
        } catch (e) {
            console.error(`❌ Erreur au skip ${skip}, tentative de continuation...`);
            skip += 100;
        }
    }

    const result = {
        subareas: subAreas,
        dungeons: allDungeons,
        maps: allMaps,
        updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(
        path.join(process.cwd(), 'public/game-data/worldmap.json'),
        JSON.stringify(result)
    );

    console.log(`🚀 Finalisé ! ${allMaps.length} cartes sauvegardées.`);
    
    // Vérification Frigost
    const frigostCheck = allMaps.find(m => m.x === -72 && m.y === -68);
    if (frigostCheck) {
        console.log("✅ SUCCÈS : Frigost [-72,-68] a été trouvé !");
    } else {
        console.warn("⚠️ ALERTE : Frigost [-72,-68] est toujours manquant.");
    }
}

syncWorldMapDeep().catch(console.error);
