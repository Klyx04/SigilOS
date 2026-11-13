/**
 * Bloc « Aujourd'hui » du tableau de bord — **illustration du donjon d'un événement**.
 *
 * 🛡️ Ce que ce test protège :
 * ① le **nom** est extrait du titre (le préfixe `[DJ]` est retiré) et cherché de façon
 *    **insensible à la casse** (`Dungeon.name`, patron `game-data-actions.ts`) ;
 * ② **fail-closed** : aucun donjon connu ⇒ `null` (jamais une image inventée) ;
 * ③ un titre sans nom exploitable (`"[DJ]"`, `""`, `null`) **n'interroge même pas** la base ;
 * ④ une erreur de base ne remonte jamais — le tableau de bord ne doit pas tomber pour une
 *    illustration (contrat du 15/10/2026 : le module DJ ne crée pas d'événement, donc
 *    l'agenda ne porte aucun identifiant de donjon).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const dungeonFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
    db: { dungeon: { findFirst: (...args: unknown[]) => dungeonFindFirst(...args) } },
}));

vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { resolveEventDungeonImage } from "@/server/event-dungeon-image";

const DUNGEON_IMAGE = "/game-data/dungeons/crypte-de-kardorim.webp";

beforeEach(() => {
    dungeonFindFirst.mockReset();
});

describe("resolveEventDungeonImage", () => {
    it("retire le préfixe [DJ] et cherche le donjon par nom, insensible à la casse", async () => {
        dungeonFindFirst.mockResolvedValue({ imageUrl: DUNGEON_IMAGE });

        const image = await resolveEventDungeonImage("[DJ] Crypte de Kardorim");

        expect(dungeonFindFirst).toHaveBeenCalledWith({
            where: { name: { equals: "Crypte de Kardorim", mode: "insensitive" } },
            select: { imageUrl: true },
        });
        expect(image).toBe(DUNGEON_IMAGE);
    });

    it("cherche le titre tel quel quand il ne porte aucun préfixe", async () => {
        dungeonFindFirst.mockResolvedValue({ imageUrl: DUNGEON_IMAGE });

        await resolveEventDungeonImage("Domaine des Fungus");

        expect(dungeonFindFirst).toHaveBeenCalledWith({
            where: { name: { equals: "Domaine des Fungus", mode: "insensitive" } },
            select: { imageUrl: true },
        });
    });

    it("un donjon inconnu ne rend aucune image (fail-closed)", async () => {
        dungeonFindFirst.mockResolvedValue(null);
        expect(await resolveEventDungeonImage("[DJ] Donjon imaginaire")).toBeNull();
    });

    it("un donjon connu mais sans image rend null (jamais une URL inventée)", async () => {
        dungeonFindFirst.mockResolvedValue({ imageUrl: null });
        expect(await resolveEventDungeonImage("[DJ] Crypte de Kardorim")).toBeNull();
    });

    it("sans nom exploitable, la base n'est même pas interrogée", async () => {
        expect(await resolveEventDungeonImage("[DJ]")).toBeNull();
        expect(await resolveEventDungeonImage("   ")).toBeNull();
        expect(await resolveEventDungeonImage("")).toBeNull();
        expect(await resolveEventDungeonImage(null)).toBeNull();
        expect(await resolveEventDungeonImage(undefined)).toBeNull();
        expect(dungeonFindFirst).not.toHaveBeenCalled();
    });

    it("un nom démesuré est refusé sans requête (borne d'entrée)", async () => {
        expect(await resolveEventDungeonImage("a".repeat(121))).toBeNull();
        expect(dungeonFindFirst).not.toHaveBeenCalled();
    });

    it("une erreur de base ne remonte jamais (le tableau de bord ne tombe pas)", async () => {
        dungeonFindFirst.mockRejectedValue(new Error("db down"));
        expect(await resolveEventDungeonImage("[DJ] Crypte de Kardorim")).toBeNull();
    });
});
