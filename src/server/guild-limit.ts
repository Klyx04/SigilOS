import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { countGuildsForUser, isAtGuildLimit, resolveGuildLimit } from "@/lib/guild-limit";

/**
 * Limite de guildes par utilisateur — **la seule lecture en base** de la règle.
 *
 * 📌 `docs/plans/PLAN-LIMITE-GUILDES.md` (LG-1/LG-2) : 2 guildes maximum, God exempté,
 * seuil `PlatformConfig.maxGuildsPerUser` borné 1..10 (`resolveGuildLimit`).
 *
 * 🔒 **Fail-closed** : toute erreur de lecture renvoie `true` (refus). Un compteur qu'on ne sait
 * pas établir ne doit jamais ouvrir un droit.
 *
 * ⚠️ Le comptage n'a lieu **que sur les chemins d'arrivée** (création de profil, déploiement,
 * réactivation) — jamais en haut de `_getUserContext` : ce serait un N+1 sur tout le dashboard
 * pour une règle qui ne concerne que les entrées (§8 du plan).
 */

/** Seuil courant, borné et jamais nul. */
export async function readGuildLimit(): Promise<number> {
    const config = await db.platformConfig.findFirst({ select: { maxGuildsPerUser: true } });
    return resolveGuildLimit(config?.maxGuildsPerUser);
}

/**
 * Nombre de guildes **qui comptent** pour un utilisateur : profils `ACTIVE` **∪** guildes dont il
 * est propriétaire (dédoublonné — un owner avec profil dans sa propre guilde compte une fois).
 */
export async function countUserGuilds(userId: string): Promise<number> {
    const [profiles, account] = await Promise.all([
        db.userProfile.findMany({ where: { userId, status: "ACTIVE" }, select: { guildId: true } }),
        // `GuildConfig.ownerId` est un **snowflake Discord**, pas un `User.id` : sans compte
        // Discord lié, on ne compte que les profils.
        db.account.findFirst({
            where: { userId, provider: "discord" },
            select: { providerAccountId: true },
        }),
    ]);

    const owned = account?.providerAccountId
        ? await db.guildConfig.findMany({
              where: { ownerId: account.providerAccountId },
              select: { id: true },
          })
        : [];

    return countGuildsForUser({
        profileGuildIds: profiles.map((profile) => profile.guildId),
        ownedGuildIds: owned.map((guild) => guild.id),
    });
}

/**
 * L'utilisateur cible a-t-il déjà atteint la limite ? **Sans** exemption : c'est la question posée
 * pour un **membre** (réactivation par un admin, batch de redéploiement).
 */
export async function wouldExceedGuildLimit(userId: string): Promise<boolean> {
    try {
        const [count, limit] = await Promise.all([countUserGuilds(userId), readGuildLimit()]);
        return isAtGuildLimit(count, limit);
    } catch (error) {
        logger.error("[guild-limit] comptage impossible — refus par défaut (fail-closed)", {
            err: error instanceof Error ? error.message : String(error),
        });
        return true;
    }
}

/**
 * L'**utilisateur connecté** a-t-il atteint la limite ? God exempté (décision du 31/10/2026, pour
 * ses propres tests). À réserver aux chemins où l'utilisateur agit **pour lui-même** : accès à un
 * dashboard (G1), déploiement d'une guilde (G2).
 */
export async function isGuildLimitReached(userId: string): Promise<boolean> {
    // Import dynamique : `super-admin-actions` est une couche « actions » (`"use server"`), on ne
    // la charge pas statiquement depuis un module de règles serveur.
    const { isSuperAdmin } = await import("./actions/super-admin-actions");
    if (await isSuperAdmin()) return false;

    return wouldExceedGuildLimit(userId);
}

