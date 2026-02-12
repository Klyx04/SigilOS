"use server";

import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";

/**
 * One-time migration to update existing Kralamoure events
 * Extracts creator from description and stores in metadata
 */
export async function migrateKralamoureEvents(guildId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.isAdmin) return { success: false, error: "Admin requis" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

        // Find all Kralamoure events (stored as EVENT_GUILD with isKralamoure metadata)
        const events = await db.guildEvent.findMany({
            where: {
                guildId: guildConfig.id,
                type: "EVENT_GUILD"
            }
        });

        const kralaEvents = events.filter(e => {
            const meta = e.metadata as any;
            return meta?.isKralamoure === true;
        });

        let updated = 0;
        for (const event of kralaEvents) {
            const meta = event.metadata as any;

            // Skip if already has metamobCreator
            if (meta?.metamobCreator) continue;

            // Extract creator from description
            const match = event.description?.match(/\*\*Organisateur :\*\* (.+)/);
            const creator = match?.[1]?.split('\n')[0];

            if (creator) {
                await db.guildEvent.update({
                    where: { id: event.id },
                    data: {
                        metadata: {
                            ...meta,
                            metamobCreator: creator
                        }
                    }
                });
                updated++;
            }
        }

        return {
            success: true,
            message: `Migration terminée : ${updated} événement(s) mis à jour sur ${kralaEvents.length} trouvé(s)`
        };
    } catch (error) {
        console.error("[Migration] Error:", error);
        return { success: false, error: "Erreur lors de la migration" };
    }
}
