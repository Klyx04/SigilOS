import { db } from "@/lib/prisma";
import { bossSlugWithFallback } from "@/lib/boss-slug";

/**
 * Client Prisma minimal accepté par le générateur de slug : la base (`db`) ou
 * une transaction (`tx`) — évite de dépendre du type exact `TransactionClient`.
 */
type DungeonSlugClient = {
    dungeon: {
        findFirst: (args: {
            where: Record<string, unknown>;
            select: { id: true };
        }) => Promise<{ id: string } | null>;
    };
};

/**
 * Slug unique d'un donjon (création / renommage) : `bossName` slugifié, puis
 * suffixe « -2 », « -3 »… tant que le slug est déjà pris (le backfill de
 * migration fait exactement la même chose sur les donjons existants).
 *
 * Un slug déjà publié n'est JAMAIS réattribué à un autre donjon : les anciennes
 * URL restent accessibles en 308 (cf. `src/app/boss/[dungeonId]/page.tsx`).
 */
export async function resolveUniqueDungeonSlug(
    bossName: string,
    options: { excludeId?: string; client?: DungeonSlugClient } = {}
): Promise<string> {
    const client = options.client ?? db;
    const base = bossSlugWithFallback(bossName);
    let candidate = base;
    let suffix = 2;

    // Borne de sécurité : au-delà, on préfère un slug unique moche à une boucle infinie.
    while (suffix < 200) {
        const clash = await client.dungeon.findFirst({
            where: { slug: candidate, ...(options.excludeId ? { id: { not: options.excludeId } } : {}) },
            select: { id: true },
        });
        if (!clash) return candidate;
        candidate = `${base}-${suffix++}`;
    }

    return `${base}-${Date.now()}`;
}
