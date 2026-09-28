/**
 * CŒUR — fiche monstre (`MonsterStat` local, DofusDB en source) : identité, stats et
 * résistances par grade, sorts (dont sous-sorts déclenchés), butin, encyclopédie.
 *
 * 🔴 Pourquoi ce module vit dans `src/lib` et plus dans `src/server/actions` (A1, 28/09/2026) :
 * `src/lib/anomaly-boss-siphon.ts` et `src/lib/bounty-siphon.ts` (datasets d'ARRIÈRE-PLAN du worker
 * BullMQ) importaient `@/server/actions/game-data-actions` pour `getMonsterStats`. Une action
 * serveur traîne `@/lib/security` → `isomorphic-dompurify` → **jsdom**, qui lit
 * `browser/default-stylesheet.css` relativement à son `__dirname` **à l'évaluation du module** :
 * dans `dist/worker.js` (déployé en `/app/`), les `..` du `path.resolve` donnaient
 * `/browser/default-stylesheet.css` ⇒ `ENOENT` **une fois par item** (le module qui lève est
 * réévalué au `import()` suivant) alors que la même passe marchait « dans l'onglet ».
 * Ici : ni `@/auth`, ni Next — le worker BullMQ peut appeler ce cœur tel quel ; l'enveloppe
 * (`src/server/actions/game-data-actions.ts`) ne fait plus que déléguer (mêmes nom et signature).
 *
 * 🛰️ Local-first « stale-while-offline » : une ligne locale **périmée** est servie (datée via
 * `stale`/`syncedAt`), elle n'est jamais transformée en absence ; seul « aucune ligne » autorise
 * le repli réseau. Fail-closed : toute erreur rend `{ success: false }` avec la cause écrite.
 *
 * Le refus de quota DofusDB est EXPLICITE (« Quota DofusDB atteint (429) — relancer plus tard »)
 * et jamais un `throw` opaque : le siphon d'avis appelait ce cœur en concurrence 4 et une 429
 * locale (notre limiteur, 30 req/min) faisait perdre 20 fiches en silence (23/09/2026).
 */
import fs from "fs";
import path from "path";
import { logger } from "@/lib/logger";
import { dofusDbFetch } from "@/lib/dofusdb-limiter";
import { getLocalMonsterStatAny, persistMonsterStat } from "@/lib/dofensive-sync";
import { encycloGrade, encycloIdentity, resolveEncycloNames } from "@/lib/dofus-encyclo";
import { getDofensiveDungeonForBoss } from "@/lib/dofensive-api";

type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

// #138 — cache mémoire 1h pour les fiches monstres (dofusdb externe, jusqu'à 5 requêtes/boss).
const monsterStatsCache = new Map<string, { data: any; expiresAt: number }>();
const MONSTER_STATS_TTL = 60 * 60 * 1000; // 1 h — data de jeu statique
/**
 * 🛰️ Lot 1 « stale-while-offline » : une fiche servie depuis une ligne PÉRIMÉE est mise en
 * cache très peu de temps — on l'affiche (datée) mais on veut re-tenter la synchronisation
 * vite, sans marteler la source à chaque clic.
 */
const STALE_STATS_TTL = 5 * 60 * 1000; // 5 min

/**
 * Options de fetch DofusDB pour les **fiches** (boss, monstre d'une salle) :
 * jamais de cache HTTP **et délai dur de 8 s**.
 *
 * Sans borne, un DofusDB (ou Dofensive) en carafe laissait la requête ouverte
 * indéfiniment ⇒ la fiche et la simulation « tournaient à l'infini sans charger »
 * (constat user du 15/09/2026). Le repli local (`getLocalMonsterStat`,
 * `getLocalDofensiveDungeon`) est déjà servi avant tout appel réseau ; cette borne
 * garantit qu'un incident amont se termine toujours en échec fail-closed, donc en
 * affichage local/état vide — jamais en spinner infini.
 */
export function dofusdbFicheInit(): RequestInit {
    return { cache: 'no-store', signal: AbortSignal.timeout(8_000) };
}

export async function getMonsterStats(
    monsterName: string,
    dungeonName?: string,
    forceRefresh = false,
    monsterId?: number,
    locale: "fr" | "en" = "fr"
): Promise<ActionResponse<any>> {
    // 🎯 Résolution **par ID** (chantier « Avis de recherche ») : les homonymes existent en jeu
    // (3 × « Ronce » 3530/3555/3531, plusieurs « Mouchâme »). La recherche se fait sinon par
    // `name.fr`, qui renvoie TOUJOURS le premier homonyme ⇒ fiche croisée. Un appelant qui
    // connaît l'id (siphon, fiche d'avis) le passe et obtient la fiche EXACTE.
    const safeId = Number.isFinite(Number(monsterId)) && Math.floor(Number(monsterId)) > 0
        ? Math.floor(Number(monsterId))
        : 0;
    // #138 — évite de re-frapper dofusdb à chaque sélection de donjon (la fiche est statique).
    // Le locale est inclus dans la clé uniquement pour EN car FR est le cas par défaut.
    const cacheKey = (safeId > 0
        ? `id:${safeId}`
        : `${monsterName.trim().toLowerCase()}::${(dungeonName ?? "").toLowerCase()}`) + (locale === "en" ? "::en" : "");
    const cached = monsterStatsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return { success: true, data: cached.data };
    }

    let coordinates = null;

    // Attempt local coordinate lookup first (very fast and reliable)
    try {
        const filePath = path.join(process.cwd(), 'public', 'game-data', 'worldmap.json');
        if (fs.existsSync(filePath)) {
            const worldMapData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

            // 1. Try to find the dungeon by name if provided
            let dungeonInfo = null;
            if (dungeonName) {
                const searchName = dungeonName.toLowerCase().replace("défi du ", "").replace(/\s*\(\d+\)$/, "").trim();
                dungeonInfo = worldMapData.dungeons?.find((d: any) =>
                    d.name.toLowerCase().includes(searchName) ||
                    searchName.includes(d.name.toLowerCase())
                );
            }

            // 2. If no dungeon match, try to find monster subarea coordinate from file
            const entranceMapId = dungeonInfo?.entranceMapId || dungeonInfo?.mapId;
            if (entranceMapId) {
                const mapNode = worldMapData.maps?.find((m: any) => m.id === entranceMapId);
                if (mapNode) {
                    coordinates = {
                        x: mapNode.x,
                        y: mapNode.y,
                        worldMapId: mapNode.worldMap === -1 ? 1 : mapNode.worldMap
                    };
                }
            }
        }
    } catch (err) {
        logger.error("[getMonsterStats] Local coordinate fetch error:", { error: err });
    }

    // Local-first (siphon local) — 🛰️ Lot 1 « stale-while-offline » : une ligne **périmée**
    // est servie elle aussi (marquée `stale` + datée), jamais transformée en absence.
    // Seul « aucune ligne » autorise le repli live. Les coordonnées du donjon sont
    // ré-attachées si absentes (le cron ne les stocke pas — elles viennent du worldmap.json).
    // `forceRefresh` (crons de sync) re-fetch TOUJOURS la source.
    if (process.env.VITEST !== "true" && !forceRefresh) {
        try {
            const hit = await getLocalMonsterStatAny(monsterName);
            if (hit) {
                const local = { ...hit.data, stale: hit.stale, syncedAt: hit.lastSyncedAt };
                if (!local.coordinates && coordinates) local.coordinates = coordinates;

                // 🇬🇧 Enrichissement EN des drops : si la DB locale n'a pas de `nameEn` sur les drops
                // (lignes persistées avant l'ajout du champ), on fait un fetch rapide DofusDB
                // items?id[$in][]=...&lang=en pour obtenir les noms anglais, sans bloquer la FR.
                if (locale === "en" && Array.isArray(local.drops) && local.drops.length > 0) {
                    const missingEnIds = (local.drops as any[])
                        .filter((d: any) => !d.nameEn && (d.objectId || d.id))
                        .map((d: any) => d.objectId || d.id);
                    if (missingEnIds.length > 0) {
                        try {
                            const chunks: number[][] = [];
                            for (let i = 0; i < missingEnIds.length; i += 40) chunks.push(missingEnIds.slice(i, i + 40));
                            const enItemsMap: Record<number, string> = {};
                            await Promise.all(chunks.map(async (chunk) => {
                                const q = chunk.map((id: number) => `id[$in][]=${id}`).join("&");
                                const res = await dofusDbFetch(`https://api.dofusdb.fr/items?${q}&$limit=50&lang=en`, dofusdbFicheInit());
                                if (res.ok) {
                                    const data = await res.json();
                                    if (Array.isArray(data?.data)) {
                                        data.data.forEach((it: any) => { if (it.name?.en) enItemsMap[it.id] = it.name.en; });
                                    }
                                }
                            }));
                            if (Object.keys(enItemsMap).length > 0) {
                                local.drops = (local.drops as any[]).map((d: any) => ({
                                    ...d,
                                    nameEn: d.nameEn || enItemsMap[d.objectId] || enItemsMap[d.id] || null,
                                }));
                            }
                        } catch { /* enrichissement EN optionnel — jamais bloquant */ }
                    }
                }

                const ttl = hit.stale ? STALE_STATS_TTL : MONSTER_STATS_TTL;
                monsterStatsCache.set(cacheKey, { data: local, expiresAt: Date.now() + ttl });
                return { success: true, data: local };
            }
        } catch (err) {
            logger.warn("[getMonsterStats] Local-first échec:", { error: String(err) });
        }
    }

    try {
        // Search for the monster - search by name.fr (sauf quand l'id est fourni : résolution exacte)
        let monsterHeader: any = null;
        if (safeId > 0) {
            monsterHeader = { id: safeId };
        } else {
            const searchRes = await dofusDbFetch(
                `https://api.dofusdb.fr/monsters?name.fr=${encodeURIComponent(monsterName.trim())}&lang=fr&$limit=5`,
                dofusdbFicheInit()
            );
            if (!searchRes.ok) {
                // ⚠️ 23/09/2026 — un `throw` ici faisait cascader le siphon d'avis (concurrency 4)
                // sur la grille vide ET un log opaque : on rend la cause EXPLICITE et on laisse
                // l'appelant décider (il gère déjà `!res.ok`).
                const reason = searchRes.status === 429
                    ? "Quota DofusDB atteint (429) — relancer plus tard"
                    : `DofusDB HTTP ${searchRes.status}`;
                logger.warn(`[getMonsterStats] ${monsterName}: ${reason}`);
                return { success: false, error: reason };
            }
            const searchData = await searchRes.json();

            monsterHeader = searchData.data?.find((m: any) => m.name?.fr?.toLowerCase() === monsterName.toLowerCase().trim()) || searchData.data?.[0];
        }

        // Fallback 1: Si non trouvé, chercher par nom de donjon sur DofusDB
        if (!monsterHeader && dungeonName && dungeonName.trim()) {
            try {
                const cleanDungeonQuery = dungeonName.replace(/\s*\(\d+\)$/, "").trim();
                const djRes = await dofusDbFetch(
                    `https://api.dofusdb.fr/dungeons?name.fr=${encodeURIComponent(cleanDungeonQuery)}&lang=fr&$limit=5`,
                    dofusdbFicheInit()
                );
                if (djRes.ok) {
                    const djData = await djRes.json();
                    const dj = djData.data?.[0];
                    if (dj && Array.isArray(dj.monsters) && dj.monsters.length > 0) {
                        const firstMobId = dj.monsters[0];
                        const mobRes = await dofusDbFetch(`https://api.dofusdb.fr/monsters/${firstMobId}?lang=fr`, dofusdbFicheInit());
                        if (mobRes.ok) {
                            monsterHeader = await mobRes.json();
                        }
                    }
                }
            } catch {}
        }

        // Fallback 2: Si non trouvé, chercher dans Dofensive preview
        if (!monsterHeader && dungeonName && dungeonName.trim()) {
            try {
                const dofDungeon = await getDofensiveDungeonForBoss(monsterName, dungeonName);
                if (dofDungeon.success && dofDungeon.data?.monsters?.length) {
                    const firstMob = dofDungeon.data.monsters[0];
                    const searchMob = await dofusDbFetch(
                        `https://api.dofusdb.fr/monsters?name.fr=${encodeURIComponent(firstMob.name)}&lang=fr&$limit=5`,
                        dofusdbFicheInit()
                    );
                    if (searchMob.ok) {
                        const smData = await searchMob.json();
                        monsterHeader = smData.data?.[0];
                    }
                }
            } catch {}
        }

        if (!monsterHeader) return { success: false, error: 'Monstre non trouvé' };

        // Fetch FULL details
        const fullRes = await dofusDbFetch(
            `https://api.dofusdb.fr/monsters/${monsterHeader.id}?lang=fr`,
            dofusdbFicheInit()
        );
        if (!fullRes.ok) {
            const reason = fullRes.status === 429
                ? "Quota DofusDB atteint (429) — relancer plus tard"
                : `DofusDB HTTP ${fullRes.status}`;
            logger.warn(`[getMonsterStats] ${monsterName} (détails): ${reason}`);
            return { success: false, error: reason };
        }
        const monster = await fullRes.json();

        // Get items and spells mappings in parallel
        const rawDropObjectIds = monster.drops?.map((d: any) => d.objectId) || [];
        const dropObjectIds = Array.from(new Set(rawDropObjectIds)); // Deduplicate

        const allSpellIds = [...(monster.spells || [])];
        monster.grades?.forEach((g: any) => {
            if (g.startingSpellId) allSpellIds.push(g.startingSpellId);
        });
        const spellIds = Array.from(new Set(allSpellIds));

        const itemsMap: Record<number, any> = {};
        let spellsArr: any[] = [];

        const fetchPromises = [];

        // Chunk items fetch by 40 to prevent any URI length limits or DofusDB $limit=50 truncations
        for (let i = 0; i < dropObjectIds.length; i += 40) {
            const chunk = dropObjectIds.slice(i, i + 40);
            const queryQuery = chunk.map((id: unknown) => `id[$in][]=${id}`).join('&');
            fetchPromises.push(
                // ⚠️ 23/09/2026 — `dofusDbFetch` (et non `fetch` brut) : ces 2 appels étaient les
                // SEULS de la fiche à contourner le limiteur partagé (30 req/min). Mesure : le
                // siphon d'avis (concurrency 4 × ~5 requêtes) saturait la fenêtre ⇒ 429 local ⇒
                // « Error: {} » ×20 et repli sur une grille vide. Le limiteur espace et rejoue.
                dofusDbFetch(`https://api.dofusdb.fr/items?${queryQuery}&$limit=50&lang=fr`, dofusdbFicheInit())
                    .then(res => (res.ok ? res.json() : null))
                    .then(data => {
                        if (data && Array.isArray(data.data)) {
                            data.data.forEach((it: any) => { itemsMap[it.id] = it; });
                        }
                    })
                    .catch((err) => logger.warn('[getMonsterStats] Items liés indisponibles:', { error: err }))
            );
        }

        if (spellIds.length > 0) {
            const spellQuery = spellIds.map((id: unknown) => `id[$in][]=${id}`).join('&');
            fetchPromises.push(
                dofusDbFetch(`https://api.dofusdb.fr/spells?${spellQuery}&$limit=50&lang=fr`, dofusdbFicheInit())
                    .then(res => (res.ok ? res.json() : null))
                    .then(data => {
                        if (data && Array.isArray(data.data)) {
                            spellsArr = data.data;
                        }
                    })
                    .catch((err) => logger.warn('[getMonsterStats] Sorts indisponibles:', { error: err }))
            );
        }

        await Promise.all(fetchPromises);

        // Fetch spell levels details AFTER we have spells data
        const spellLevelsMap: Record<number, any> = {};
        if (spellsArr.length > 0) {
            const requestedLevels = spellsArr.flatMap(s => {
                const levels = s.spellLevels || [];
                // Use the last level for bosses as they are high level
                return levels.length > 0 ? levels[levels.length - 1] : null;
            }).filter(Boolean);

            if (requestedLevels.length > 0) {
                const levelQuery = requestedLevels.map((id: unknown) => `id[$in][]=${id}`).join('&');
                const levelRes = await dofusDbFetch(`https://api.dofusdb.fr/spell-levels?${levelQuery}&$limit=50&lang=fr`, dofusdbFicheInit());
                if (levelRes.ok) {
                    const levelData = await levelRes.json();
                    if (levelData && Array.isArray(levelData.data)) {
                        levelData.data.forEach((l: any) => {
                            spellLevelsMap[l.id] = l;
                        });
                    }
                }
            }
        }

        // 1. Scan for triggered spell IDs
        const triggeredSpellIds: number[] = [];
        spellsArr.forEach(s => {
            const levelId = s.spellLevels?.length > 0 ? s.spellLevels[s.spellLevels.length - 1] : s.spellLevels?.[0];
            const level = spellLevelsMap[levelId];
            if (level && Array.isArray(level.effects)) {
                level.effects.forEach((eff: any) => {
                    if (eff.effectId === 1160 || eff.effectId === 2160 || eff.effectId === 2161) {
                        const tid = eff.diceNum || eff.value;
                        if (tid && typeof tid === 'number') {
                            triggeredSpellIds.push(tid);
                        }
                    }
                });
            }
        });

        // Deduplicate triggeredSpellIds and remove any that are already in spellIds
        const uniqueTriggeredIds = Array.from(new Set(triggeredSpellIds)).filter((id: number) => !spellIds.includes(id));
        const subSpellsMap: Record<number, { name: string, effects: any[] }> = {};

        // Also add main spells to subSpellsMap in case they trigger each other
        spellsArr.forEach(s => {
            const levelId = s.spellLevels?.length > 0 ? s.spellLevels[s.spellLevels.length - 1] : s.spellLevels?.[0];
            const level = spellLevelsMap[levelId];
            subSpellsMap[s.id] = {
                name: s.name?.fr || "Sort",
                effects: level?.effects || []
            };
        });

        if (uniqueTriggeredIds.length > 0) {
            try {
                // Fetch sub-spells
                const subSpellQuery = uniqueTriggeredIds.map((id: number) => `id[$in][]=${id}`).join('&');
                const subSpellsRes = await dofusDbFetch(`https://api.dofusdb.fr/spells?${subSpellQuery}&$limit=50&lang=fr`, dofusdbFicheInit());
                if (subSpellsRes.ok) {
                    const subSpellsData = await subSpellsRes.json();
                    const subSpellsArr = subSpellsData.data || [];

                    // Fetch sub-spells levels
                    const subLevelsToFetch = subSpellsArr.flatMap((s: any) => {
                        const levels = s.spellLevels || [];
                        return levels.length > 0 ? levels[levels.length - 1] : null;
                    }).filter(Boolean);

                    if (subLevelsToFetch.length > 0) {
                        const subLevelQuery = subLevelsToFetch.map((id: any) => `id[$in][]=${id}`).join('&');
                        const subLevelRes = await dofusDbFetch(`https://api.dofusdb.fr/spell-levels?${subLevelQuery}&$limit=50&lang=fr`, dofusdbFicheInit());
                        if (subLevelRes.ok) {
                            const subLevelData = await subLevelRes.json();
                            const subLevelsMap: Record<number, any> = {};
                            if (subLevelData && Array.isArray(subLevelData.data)) {
                                subLevelData.data.forEach((l: any) => {
                                    subLevelsMap[l.id] = l;
                                });
                            }

                            subSpellsArr.forEach((s: any) => {
                                const levelId = s.spellLevels?.length > 0 ? s.spellLevels[s.spellLevels.length - 1] : s.spellLevels?.[0];
                                const level = subLevelsMap[levelId];
                                subSpellsMap[s.id] = {
                                    name: s.name?.fr || "Effet secondaire",
                                    effects: level?.effects || []
                                };
                            });
                        }
                    }
                }
            } catch (err) {
                logger.error("[getMonsterStats] Failed to fetch triggered sub-spells:", { error: err });
            }
        }

        // Final monster grade for scaling calculations
        const g5 = monster.grades?.[monster.grades.length - 1] || {};
        const monsterStats = {
            earth: g5.strength || 0,
            water: g5.chance || 0,
            fire: g5.intelligence || 0,
            air: g5.agility || 0,
            neutral: 0 // Le Neutre n'est boosté par aucune stat élémentaire.
        };

        // Mapping effect types for description with Stat Scaling & comprehensive effect dictionary
        const parseEffects = (effects: any[], isSubSpell = false): string | null => {
            if (!effects || effects.length === 0) return null;
            const parsed = effects.map(eff => {
                // If DofusDB provides a pre-formatted string, use it directly
                if (eff.formatted?.fr) return eff.formatted.fr;
                if (eff.description?.fr) return eff.description.fr;
                if (typeof eff.formatted === 'string' && eff.formatted.trim()) return eff.formatted.trim();

                const id = eff.effectId;
                const min = eff.diceNum || eff.value || 0;
                const max = eff.diceSide || 0;
                // Traction/repoussement : la distance vit parfois dans la zone (diceNum=0).
                const zoneParam = eff.zoneDescr?.param1 || 0;
                let text = "";

                // Helper to scale damage
                const scale = (val: number, stat: number) => Math.floor(val * (1 + stat / 100));
                const dmg = (scaledMin: number, scaledMax: number) =>
                    scaledMax > 0 && scaledMax !== scaledMin ? `${scaledMin} à ${scaledMax}` : `${scaledMin}`;

                // Element-based direct damage IDs — effectElement: 1=Terre 2=Feu 3=Eau 4=Air 5+=Neutre
                const elementDamageIds = [91, 92, 93, 94, 95, 112, 113, 117];
                if (elementDamageIds.includes(id) && min > 0) {
                    const elem = eff.effectElement;
                    if (elem === 1)      text = `Dommages Terre : ${dmg(scale(min, monsterStats.earth),   scale(max, monsterStats.earth))}`;
                    else if (elem === 2) text = `Dommages Feu : ${dmg(scale(min, monsterStats.fire),    scale(max, monsterStats.fire))}`;
                    else if (elem === 3) text = `Dommages Eau : ${dmg(scale(min, monsterStats.water),   scale(max, monsterStats.water))}`;
                    else if (elem === 4) text = `Dommages Air : ${dmg(scale(min, monsterStats.air),     scale(max, monsterStats.air))}`;
                    else                text = `Dommages Neutre : ${dmg(scale(min, monsterStats.neutral), scale(max, monsterStats.neutral))}`;
                // Vol de vie / classic steal-damage IDs
                } else if (id === 100 || id === 108) {
                    text = `Vol de vie Neutre : ${dmg(scale(min, monsterStats.neutral), scale(max, monsterStats.neutral))}`;
                } else if (id === 97) {
                    text = `Dommages Terre : ${dmg(scale(min, monsterStats.earth), scale(max, monsterStats.earth))}`;
                } else if (id === 96) {
                    text = `Dommages Eau : ${dmg(scale(min, monsterStats.water), scale(max, monsterStats.water))}`;
                } else if (id === 99) {
                    text = `Dommages Feu : ${dmg(scale(min, monsterStats.fire), scale(max, monsterStats.fire))}`;
                } else if (id === 98) {
                    text = `Dommages Air : ${dmg(scale(min, monsterStats.air), scale(max, monsterStats.air))}`;
                } else if (id === 275 || id === 276 || id === 277 || id === 278 || id === 279) {
                    // Dégâts en % de PV érodés / PV max
                    text = `Dommages : ${min}% des PV max`;
                } else if (id === 85 || id === 86 || id === 87 || id === 88 || id === 89) {
                    // Dégâts en % de la vie actuelle
                    text = `Dommages : ${min}% de la vie de la cible`;
                } else if (id === 6 || id === 8) {
                    const dist = min > 0 ? min : zoneParam;
                    text = dist > 0 ? `Attire de ${dist} case${dist > 1 ? "s" : ""}` : "";
                } else if (id === 5 || id === 4) {
                    const dist = min > 0 ? min : zoneParam;
                    text = dist > 0 ? `Repousse de ${dist} case${dist > 1 ? "s" : ""}` : "";
                } else if (id === 1103) {
                    const val = eff.value || min;
                    text = val > 0 ? `Repousse différée de ${val} case${val > 1 ? "s" : ""}` : `Repousse (effet différé)`;
                } else if (id === 753 || id === 754) {
                    text = `+${min} Tacle`;
                } else if (id === 752) {
                    text = `-${min} Fuite`;
                } else if (id === 132) {
                    text = `Retire tous les PM (État Pesanteur / Enraciné)`;
                } else if (id === 1039 || id === 1040) {
                    text = `Donne ${min} points de Bouclier`;
                } else if (id === 293 || id === 294) {
                    text = `+${eff.diceSide || eff.value || min || 5} Dommages fixes`;
                } else if (id === 138 || id === 114) {
                    text = `+${min} Puissance`;
                } else if (id === 115) {
                    text = `+${min} % Critique`;
                } else if (id === 1160 || id === 2160 || id === 2161) {
                    const triggeredId = eff.diceNum || eff.value;
                    if (isSubSpell) {
                        text = `Déclenche un sous-effet`;
                    } else {
                        const subSpell = subSpellsMap[triggeredId];
                        if (subSpell) {
                            const subEffectsParsed = parseEffects(subSpell.effects, true);
                            text = subEffectsParsed ? `Déclenche ${subSpell.name} : ${subEffectsParsed}` : `Déclenche ${subSpell.name}`;
                        } else {
                            text = `Déclenche un effet passif / secondaire`;
                        }
                    }
                } else if (id === 181 || id === 623) {
                    text = `Invoque une créature alliée`;
                } else if (id === 82 || id === 108) {
                    text = `Soigne : ${min}${max > 0 && max !== min ? ` à ${max}` : ""} PV`;
                } else if (id === 81) {
                    text = `Soigne ${min}% des PV max`;
                } else if (id === 1) {
                    text = `Transpose / Échange de place`;
                } else if (id === 4) {
                    text = `Avance de ${min} case${min > 1 ? "s" : ""}`;
                } else if (id === 140 || id === 126) {
                    text = `Retrait direct : ${min} PV`;
                } else if (id === 950 || id === 951 || id === 952) {
                    const stateId = eff.value || eff.diceNum || eff.diceSide;
                    text = `Applique un État`;
                } else if (id === 168 || id === 101) {
                    text = `Retrait de ${min} PA`;
                } else if (id === 169 || id === 127) {
                    text = `Retrait de ${min} PM`;
                } else if (id === 174) {
                    text = `Retrait de ${min} Portée`;
                } else if (id === 111) {
                    text = `+${min} PA`;
                } else if (id === 128) {
                    text = `+${min} PM`;
                } else if (id === 160) {
                    text = `Téléporte la cible`;
                } else if (id === 121) {
                    text = `Dommages subis x${(min / 100 + 1).toFixed(2)}`;
                } else if (id === 1122) {
                    text = `Applique ${min}% d'Érosion`;
                } else if (id === 131) {
                    text = `Applique un Poison élémentaire (${min} dégâts)`;
                } else if (id === 400 || id === 401 || id === 402) {
                    text = `Pose un Glyphe / Piège sur le terrain`;
                } else if (id === 141) {
                    text = `Tue instantanément la cible (OS)`;
                } else if (id === 265) {
                    text = `Réduit les dégâts de ${min}`;
                } else {
                    // Effet inconnu / mécanique scriptée → on ne l'affiche pas (pas de brut API).
                    text = "";
                }

                return text;
            }).filter((t): t is string => Boolean(t) && t.trim().length > 0);

            return parsed.length > 0 ? parsed.join(" · ") : null;
        };

        // Fallback to subarea lookup via local file if coordinates is still null
        if (!coordinates && monster.subareas?.length > 0) {
            try {
                const filePath = path.join(process.cwd(), 'public', 'game-data', 'worldmap.json');
                if (fs.existsSync(filePath)) {
                    const worldMapData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    const firstMapInSubarea = worldMapData.maps?.find((m: any) =>
                        m.subAreaId === monster.subareas[0]
                    );
                    if (firstMapInSubarea) {
                        coordinates = {
                            x: firstMapInSubarea.x,
                            y: firstMapInSubarea.y,
                            worldMapId: firstMapInSubarea.worldMap === -1 ? 1 : firstMapInSubarea.worldMap
                        };
                    }
                }
            } catch (err) { logger.error("Fallback coordinate fetch error:", err); }
        }

        // Fiche encyclopédique (lot « encyclopédie Dofus ») : caractéristiques par
        // grade + identité (race, zone, agression, restrictions) + noms résolus.
        // Fail-soft : si DofusDB est injoignable pour les noms, `names` vaut null
        // et la fiche masque les lignes — jamais de valeur inventée.
        const encycloId = encycloIdentity(monster);
        const encycloNames = await resolveEncycloNames(encycloId).catch(() => ({
            raceName: null,
            superRaceName: null,
            zoneName: null,
        }));

        const resultData = {
            id: monster.id,
            name: monster.name?.fr || (typeof monster.name === "string" ? monster.name : ""),
            nameEn: monster.name?.en || null,
            imageUrl: monster.img || `https://static.ankama.com/dofus/www/game/monsters/${monster.id}.png`,
            familyId: monster.race ?? null,
            coordinates,
            encyclo: { ...encycloId, names: encycloNames },
            grades: monster.grades.map((g: any, idx: number) => {
                const carac = encycloGrade(g);
                return {
                    level: g.level,
                    lifePoints: g.lifePoints,
                    actionPoints: g.pa || g.actionPoints,
                    movementPoints: g.pm || g.movementPoints,
                    resists: {
                        neutral: g.neutralResistance,
                        earth: g.earthResistance,
                        fire: g.fireResistance,
                        water: g.waterResistance,
                        air: g.airResistance
                    },
                    carac: {
                        wisdom: carac.wisdom,
                        strength: carac.strength,
                        intelligence: carac.intelligence,
                        chance: carac.chance,
                        agility: carac.agility,
                        paDodge: carac.paDodge,
                        pmDodge: carac.pmDodge,
                        gradeXp: carac.gradeXp,
                    },
                };
            }),
            drops: monster.drops?.map((d: any) => {
                const item = itemsMap[d.objectId];
                const iconId = item?.iconId || d.objectId;

                // Fallback de taux (conditionnels, globaux ou sans grade explicite)
                const fallbackDrop = (d.minPercentDrop > 0 ? d.minPercentDrop : null)
                    ?? (d.maxPercentDrop > 0 ? d.maxPercentDrop : null)
                    ?? (d.percent > 0 ? d.percent : null);

                const rawGrades = [
                    d.percentDropForGrade1,
                    d.percentDropForGrade2,
                    d.percentDropForGrade3,
                    d.percentDropForGrade4,
                    d.percentDropForGrade5
                ];

                const gradePercents = rawGrades.map((pg) => {
                    if (typeof pg === 'number' && pg > 0) return pg;
                    if (fallbackDrop !== null && fallbackDrop !== undefined) return fallbackDrop;
                    return typeof pg === 'number' ? pg : 0;
                });

                // Choix du taux représentatif (premier grade non-nul, ou fallback)
                const firstNonZero = gradePercents.find((p) => p > 0);
                const rawPercent = firstNonZero ?? fallbackDrop ?? d.percentDropForGrade5 ?? d.percentDropForGrade1 ?? 0;

                // Formateur intelligent : DofusDB arrondit à 2 décimales si >= 0.01 (ex: 0.045% -> 0.05%), 3 décimales si < 0.01
                const formatRate = (val: number): number => {
                    if (!val || val <= 0) return 0;
                    if (val < 0.01) return parseFloat(val.toFixed(3));
                    return parseFloat(val.toFixed(2));
                };

                const formattedPercent = formatRate(rawPercent);

                return {
                    objectId: d.objectId,
                    name: item?.name?.fr || (typeof item?.name === "string" ? item.name : "Objet"),
                    nameEn: item?.name?.en || null,
                    imageUrl: item?.img || `https://static.dofusdb.fr/items/illustr/${iconId}.png`,
                    percent: formattedPercent,
                    percentByGrade: gradePercents.map(formatRate)
                };
            }) || [],
            spells: spellsArr.map(s => {
                const levelId = s.spellLevels?.length > 0 ? s.spellLevels[s.spellLevels.length - 1] : s.spellLevels?.[0];
                const level = spellLevelsMap[levelId] || {};
                const effectDesc = parseEffects(level.effects);

                // Priority for images: 
                // 1. s.img (sometimes relative)
                // 2. static.ankama.com
                // 3. dofusdb.fr/img/spells/sort_{iconId}.png (last resort usually works)
                let spellImg = s.img;
                if (!spellImg && s.iconId) {
                    spellImg = `https://api.dofusdb.fr/img/spells/sort_${s.iconId}.png`;
                }
                if (spellImg && spellImg.startsWith('/')) {
                    spellImg = `https://api.dofusdb.fr${spellImg}`;
                }

                return {
                    id: s.id,
                    name: s.name?.fr || (typeof s.name === "string" ? s.name : "Sort"),
                    nameEn: s.name?.en || null,
                    imageUrl: spellImg,
                    description: s.description?.fr || effectDesc || "",
                    descriptionEn: s.description?.en || null,
                    apCost: level.apCost || level.paCost || 0,
                    minRange: level.minRange || 0,
                    range: level.range || level.maxRange || 0,
                    castTestLos: level.castTestLos ?? true,
                    castInLine: level.castInLine ?? false,
                    castInDiagonal: level.castInDiagonal ?? false
                };
            })
        };
        monsterStatsCache.set(cacheKey, { data: resultData, expiresAt: Date.now() + MONSTER_STATS_TTL });
        // Self-healing (sync intelligente) : copie locale de la fiche pour le
        // mode local-first (prochaines lectures sans DofusDB). Jamais bloquant.
        try {
            if (process.env.VITEST !== "true") await persistMonsterStat({ ...resultData, dungeonName });
        } catch (err) {
            logger.warn("[getMonsterStats] Persist local échec:", { error: String(err) });
        }
        return { success: true, data: resultData };
    } catch (error) {
        logger.error('[getMonsterStats] Error:', { error });
        return { success: false, error: 'Erreur DofusDB' };
    }
}
