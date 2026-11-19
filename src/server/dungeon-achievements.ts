import { db } from "@/lib/prisma";
import type { DungeonAchievementView } from "@/lib/rush-dungeon-achievements";

/**
 * Catalogue public des succès d'un donjon — **une seule** requête, partagée par la
 * fiche boss publique et le panneau du guide. Aucune donnée de membre.
 *
 * Même doctrine que la fiche boss : le texte **propre au donjon** (mécanique du succès
 * « Spécial ») prime sur la description du challenge partagé.
 */
export async function loadDungeonAchievementCatalogue(
    dungeonId: string
): Promise<DungeonAchievementView[]> {
    const rows = await db.dungeonAchievement.findMany({
        where: { dungeonId },
        select: {
            id: true,
            points: true,
            imageUrl: true,
            description: true,
            challenge: {
                select: { name: true, slug: true, iconUrl: true, description: true },
            },
        },
        orderBy: { points: "desc" },
        take: 100,
    });

    return rows.map((row) => ({
        id: row.id,
        name: row.challenge.name,
        slug: row.challenge.slug,
        iconUrl: row.challenge.iconUrl ?? null,
        imageUrl: row.imageUrl ?? null,
        points: row.points ?? 0,
        description: row.description ?? row.challenge.description ?? null,
    }));
}
