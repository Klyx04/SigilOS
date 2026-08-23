"use server";
import { logger } from "@/lib/logger";

import { db } from "@/lib/prisma";

/**
 * Retourne la liste des mapId (worldmap) des donjons marqués "Quête Ocre".
 * Utilisé par la Page Carte pour superposer l'icône Dofus Ocre sur les donjons
 * de la Quête Ocre (Éternelle Moisson).
 */
export async function getOcreDungeonMapIds(): Promise<number[]> {
    try {
        const dungeons = await db.dungeon.findMany({
            where: { isOcreQuest: true, mapId: { not: null } },
            select: { mapId: true }
        });
        return dungeons.map(d => d.mapId as number);
    } catch {
        return [];
    }
}