/**
 * La **quête liée** d'un post DJ montre sa **carte de lancement** — et jamais une image cassée.
 *
 * 📏 Mesures du 16/10/2026 :
 *  · DofusDB n'expose **aucune image de quête** (`/quests/{id}`) — il expose `startPosition[].
 *    mapId` (+ `npcId`) et, par objectif, la carte complète (`posX/posY`, `subAreaId`, `worldMap`
 *    et ses images). C'est donc **notre** donnée qui doit porter le visuel ;
 *  · elle le porte déjà : le siphon écrit la carte du jeu dans `GameQuest.imageUrl`
 *    (`/game-data/hd_maps/{mapId}.webp`) — mesuré en base : **1 765 / 1 976** quêtes ;
 *  · le post, lui, ne stocke que `questId` (id DofusDB) + `questName`/`questUrl` : la carte est
 *    donc résolue **côté serveur**, en un seul lot, à partir de `questId` ;
 *  · `public/game-data/npcs/` est **VIDE** (0 fichier) : le portrait du PNJ donneur n'existe pas
 *    encore côté dépôt (DofusDB ne le sert pas non plus) — le nom seul est disponible, et
 *    seulement pour les entrées du guide (`DofusQuestEntry.npcName`), pas pour `GameQuest`.
 *
 * 🔒 Verrouillé ici :
 *  ① `getDjPosts` enrichit le payload avec `questImageUrl` résolu par **un seul** `findMany` ;
 *  ② le détail du post monte la vignette de la quête liée (la règle reste `questThumbnail`) ;
 *  ③ la vignette est **partagée** (création + détail) et replie sur l'icône de quête sur `onError`,
 *    sans boucle (un repli qui échoue ne se rejoue pas).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const readSource = (relativePath: string) => fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");

describe("quête liée d'un post DJ — carte de lancement (asset du jeu)", () => {
    it("① `getDjPosts` résout la carte par un SEUL lot, à partir de `questId`", () => {
        const src = readSource("src/server/actions/dungeon-finder-actions.ts");

        // La carte vient de notre table : `GameQuest.imageUrl` (écrite par le siphon).
        expect(src).toContain("dofusDbId: { in: questDbIds }");
        expect(src).toContain("select: { dofusDbId: true, imageUrl: true }");
        // Un lot, pas une requête par post.
        expect(src).toContain("const questDbIds: number[] = [...new Set<number>(");
        // Le payload porte la carte (le type public la déclare).
        expect(src).toContain("questImageUrl: questMapById.get(Number(p.questId)) ?? null");
        expect(src).toContain("questImageUrl?: string | null");
    });

    it("② le détail du post affiche la quête liée avec sa carte", () => {
        const src = readSource("src/components/dungeon-finder/DjPostDetailModal.tsx");

        expect(src).toContain("{post.questName && (");
        expect(src).toContain("<QuestThumbnail quest={{ imageUrl: post.questImageUrl }} />");
        // Aucune requête côté navigateur : la carte arrive dans le payload.
        expect(src).not.toMatch(/fetch\([^)]*hd_maps/);
    });

    it("③ la vignette est partagée et ne boucle jamais sur le repli", () => {
        // Création de post : plus de `<img>` + `onError` recopiés à la main.
        const create = readSource("src/components/dungeon-finder/DjPostCreateModal.tsx");
        expect(create).toContain("<QuestThumbnail quest={q} />");
        expect(create).not.toContain("QUEST_ICON_FALLBACK");

        const component = readSource("src/components/dungeon-finder/quest-thumbnail.tsx");
        // La règle du chemin reste `questThumbnail` (source unique).
        expect(component).toContain("questThumbnail(quest)");
        expect(component).toContain("QUEST_ICON_FALLBACK");
        // Repli idempotent : si le repli échoue lui aussi, on ne le rejoue pas (pas de boucle).
        expect(component).toMatch(/current === QUEST_ICON_FALLBACK \? current : QUEST_ICON_FALLBACK/);
    });
});
