/**
 * « Capture de zone » d'une quête — la carte du monde autour de sa **map de lancement**, avec le
 * repère, dans le **détail d'un post DJ** et dans l'**embed Discord** (route PNG).
 *
 * 📏 Mesures du 16/10/2026 :
 *  · DofusDB n'expose **aucune image de quête** (`/img/quests/153.png`, `/img/npcs/813.png` → 404 ;
 *    `/img/monsters/813.png` → 200 ⇒ la collection `npcs` n'existe pas) ;
 *  · `worldmap.json` (dépôt) porte **14 703** maps `{ id, x, y, subAreaId, worldMap }` + les
 *    libellés de `subareas`, et `public/game-data/tiles/w{monde}/{échelle}/{n}.webp` sert les
 *    **15 530** tuiles ⇒ **rien à siphoner** ;
 *  · le `mapId` de lancement est **dans le chemin** écrit par le siphon
 *    (`GameQuest.imageUrl = /game-data/hd_maps/{mapId}.webp`) — aucune colonne à ajouter ;
 *  · le couple **(0, 0)** est le tas des maps sans coordonnées ⇒ jamais situé.
 *
 * Le rendu (tuiles + repère) est **le même** que l'encart de la fiche donjon (`MinimapGrid`) et
 * que la carte interactive (`resolveMinimapLandscape`), donc le repère tombe juste.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
    findWorldmapEntry,
    questMapIdFromImageUrl,
    resolveQuestMinimap,
    subAreaLabel,
    type WorldmapData,
} from "@/lib/quest-minimap";

const REPO_ROOT = path.resolve(__dirname, "../..");
const readSource = (relativePath: string) => fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");

/** Carte du monde minimale (mêmes champs que le fichier réel). */
const WORLDMAP: WorldmapData = {
    maps: [
        { id: 54169887, x: -72, y: -31, subAreaId: 45, worldMap: 1 },
        { id: 999, x: 0, y: 0, subAreaId: 45, worldMap: 1 },
        { id: 777, x: 12, y: 8, subAreaId: 7, worldMap: -1 },
        { id: 555, x: "pas un nombre", y: 3, subAreaId: 7, worldMap: 1 },
    ],
    subareas: [
        { id: 45, name: "Champs de glace" },
        { id: 7, name: "  " },
    ],
};

const WORLDS = [
    {
        id: 1,
        // Origines choisies pour que les deux positions du fixture tombent DANS la grille
        // (échelle 0,6 au zoom −2 : grille 24×20 tuiles de 250 px).
        origineX: 4000,
        origineY: 2000,
        mapWidth: 53,
        mapHeight: 40,
        totalWidth: 10000,
        totalHeight: 8000,
        zoom: [1, 0.8, 0.6, 0.4, 0.2],
        name: { fr: "Monde des Douze" },
    },
];

describe("quest-minimap — règles pures", () => {
    it("extrait le mapId du chemin que NOUS écrivons, et rien d'autre", () => {
        expect(questMapIdFromImageUrl("/game-data/hd_maps/54169887.webp")).toBe(54169887);
        expect(questMapIdFromImageUrl("  /game-data/hd_maps/42.webp  ")).toBe(42);
        expect(questMapIdFromImageUrl(null)).toBeNull();
        expect(questMapIdFromImageUrl("")).toBeNull();
        // Jamais un id inventé : un autre dossier, une autre extension ou un chemin relatif.
        expect(questMapIdFromImageUrl("/uploads/assets-dofus/maps/9.webp")).toBeNull();
        expect(questMapIdFromImageUrl("/game-data/hd_maps/9.png")).toBeNull();
        expect(questMapIdFromImageUrl("hd_maps/9.webp")).toBeNull();
    });

    it("trouve l'entrée du worldmap (tuile + monde) et refuse le non-situable", () => {
        expect(findWorldmapEntry(WORLDMAP, 54169887)).toEqual({
            id: 54169887,
            x: -72,
            y: -31,
            subAreaId: 45,
            worldMap: 1,
        });
        expect(findWorldmapEntry(WORLDMAP, 12345)).toBeNull();
        expect(findWorldmapEntry(WORLDMAP, null)).toBeNull();
        // Coordonnées non numériques ⇒ jamais une position inventée.
        expect(findWorldmapEntry(WORLDMAP, 555)).toBeNull();
    });

    it("lit le libellé de zone (et ignore un libellé vide)", () => {
        expect(subAreaLabel(WORLDMAP, 45)).toBe("Champs de glace");
        expect(subAreaLabel(WORLDMAP, 7)).toBeNull();
        expect(subAreaLabel(WORLDMAP, 999)).toBeNull();
        expect(subAreaLabel(WORLDMAP, null)).toBeNull();
    });

    it("résout la capture : grille de tuiles, repère dans le cadre, monde et zone", () => {
        const minimap = resolveQuestMinimap(WORLDMAP, WORLDS, 54169887);
        expect(minimap).not.toBeNull();
        expect(minimap!.x).toBe(-72);
        expect(minimap!.y).toBe(-31);
        expect(minimap!.worldId).toBe(1);
        expect(minimap!.worldName).toBe("Monde des Douze");
        expect(minimap!.subAreaName).toBe("Champs de glace");
        // 5×3 tuiles (paysage) : le repère reste TOUJOURS dans le cadre (jamais coupé au bord).
        expect(minimap!.grid.cols).toBe(5);
        expect(minimap!.grid.rows).toBe(3);
        expect(minimap!.grid.tiles).toHaveLength(15);
        expect(minimap!.grid.leftPct).toBeGreaterThanOrEqual(0);
        expect(minimap!.grid.leftPct).toBeLessThanOrEqual(100);
        expect(minimap!.grid.topPct).toBeGreaterThanOrEqual(0);
        expect(minimap!.grid.topPct).toBeLessThanOrEqual(100);
        // Les tuiles viennent du monde et de sa banque d'échelle (aucune URL externe).
        for (const tile of minimap!.grid.tiles) {
            expect(tile.tileUrl).toMatch(/^\/game-data\/tiles\/w1\/[\d.]+\/\d+\.webp$/);
        }
        expect(minimap!.grid.mapHref).toContain("/carte-du-monde?play=1&x=-72&y=-31");
    });

    it("refuse de situer une quête non situable (position 0,0 · monde inconnu · carte inconnue)", () => {
        // (0, 0) = le tas des maps sans coordonnées, jamais un lieu.
        expect(resolveQuestMinimap(WORLDMAP, WORLDS, 999)).toBeNull();
        // Monde absent de `worlds.json`.
        expect(resolveQuestMinimap(WORLDMAP, [], 54169887)).toBeNull();
        // Carte inconnue.
        expect(resolveQuestMinimap(WORLDMAP, WORLDS, 4242)).toBeNull();
        // `worldMap: -1` (hors monde) tombe sur la carte du Monde des Douze, comme la fiche donjon.
        expect(resolveQuestMinimap(WORLDMAP, WORLDS, 777)?.worldId).toBe(1);
    });
});

describe("quest-minimap — câblage (post DJ + embed Discord)", () => {
    it("① `getDjPosts` résout la capture côté serveur et la publie", () => {
        const src = readSource("src/server/actions/dungeon-finder-actions.ts");
        expect(src).toContain("import { questMapIdFromImageUrl, resolveQuestMinimap, type QuestMinimap }");
        expect(src).toContain("questMinimap?: QuestMinimap | null");
        expect(src).toContain("questMinimap: resolveQuestMinimap(");
        // Un seul chargement (cache process), pas une lecture de 1,5 Mo par post.
        expect(src).toContain("const worldmapData = getWorldmapData();");
        expect(src).toContain("const worldsData = getWorldsData();");
    });

    it("② le détail du post rend la capture avec le MÊME composant que la fiche donjon", () => {
        const detail = readSource("src/components/dungeon-finder/DjPostDetailModal.tsx");
        expect(detail).toContain("<MinimapGridView");
        expect(detail).toContain("post.questMinimap.grid.mapHref");
        expect(detail).toContain("post.questMinimap.x");

        // Une seule source du rendu de tuiles : l'encart donjon ne redessine plus la grille.
        const card = readSource("src/app/boss/[dungeonId]/_components/DungeonMinimapCard.tsx");
        expect(card).toContain("<MinimapGridView");
        expect(card).not.toContain("state.grid.tiles.map(");
        const shared = readSource("src/components/worldmap/minimap-grid.tsx");
        expect(shared).toContain("grid.tiles.map(");
        expect(shared).toContain("onError");
    });

    it("③ l'embed de quête porte l'image de notre route (Discord ne lit pas de HTML)", () => {
        const src = readSource("src/server/actions/dungeon-finder-actions.ts");
        expect(src).toContain('image: post.mode === "QUETE" && post.questId && post.questId > 0');
        expect(src).toContain("`${appUrl}/api/dj/minimap?quest=${post.questId}`");
    });

    it("④ la route PNG est publique, bornée, cachée et sans doublon de règle", () => {
        const route = readSource("src/app/api/dj/minimap/route.ts");
        // Aucune authentification : Discord charge l'image en anonyme (comme /api/og/*).
        expect(route).not.toContain("getUserContext");
        expect(route).not.toContain("auth()");
        // Entrée bornée : un id DofusDB entier positif, sinon 400.
        expect(route).toContain("!Number.isSafeInteger(dofusDbId) || dofusDbId <= 0");
        expect(route).toContain("status: 400");
        // Cache long (la zone d'une quête ne bouge pas) + composition par `sharp`.
        expect(route).toContain("Cache-Control");
        expect(route).toContain("sharp(");
        // MÊME règle que le dashboard : la capture n'est pas réimplémentée dans la route.
        expect(route).toContain("resolveQuestMinimap(getWorldmapData(), getWorldsData()");
    });
});
