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
 * Client applicatif par défaut, résolu **paresseusement** (`import()` au lieu d'un
 * import statique) : cette règle est aussi appliquée par les **seeds**
 * (`prisma/seed-data/seed.ts`, `prisma/seed.ts`), qui construisent leur propre
 * client et passent toujours `{ client: tx }`. Un import statique de `@/lib/prisma`
 * ferait exécuter `createPrismaClient()` à l'import du module ⇒ un second pool de
 * connexions dans le processus du seed, pour rien (mesuré le 16/10/2026 : le seed
 * de déploiement sortait en `exit 1`, cf. `docs/ROADMAP.md`).
 */
async function defaultDungeonClient(): Promise<DungeonSlugClient> {
    const { db } = await import("@/lib/prisma");
    return db;
}

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
    const client = options.client ?? (await defaultDungeonClient());
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
