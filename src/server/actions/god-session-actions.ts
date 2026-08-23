"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// ============================================================================
// R4 — Session active God (GodSessionLog)
// Ouvre/ferme une ligne active par utilisateur + heartbeat lastSeenAt.
// Fail-closed : si la BDD échoue, on ne bloque jamais le layout (best-effort).
// ============================================================================

/** Ouvre (ou réutilise) la session active du sous-god connecté. */
export async function openGodSession(): Promise<{ sessionId?: string }> {
    try {
        const session = await auth();
        if (!session?.user?.id) return {};

        const active = await db.godSessionLog.findFirst({
            where: { userId: session.user.id, active: true },
            select: { id: true },
            orderBy: { startedAt: "desc" },
        });

        if (active) {
            // Réutilise la session en cours, met à jour lastSeenAt.
            await db.godSessionLog.update({
                where: { id: active.id },
                data: { lastSeenAt: new Date() },
            });
            return { sessionId: active.id };
        }

        const created = await db.godSessionLog.create({
            data: {
                userId: session.user.id,
                startedAt: new Date(),
                lastSeenAt: new Date(),
                active: true,
            },
        });
        return { sessionId: created.id };
    } catch (e) {
        logger.warn("[R4] openGodSession failed (best-effort)", { error: e });
        return {};
    }
}

/** Heartbeat : met à jour lastSeenAt de la session active. */
export async function updateGodSessionHeartbeat(): Promise<void> {
    try {
        const session = await auth();
        if (!session?.user?.id) return;

        const active = await db.godSessionLog.findFirst({
            where: { userId: session.user.id, active: true },
            select: { id: true },
            orderBy: { startedAt: "desc" },
        });

        if (active) {
            await db.godSessionLog.update({
                where: { id: active.id },
                data: { lastSeenAt: new Date() },
            });
        }
    } catch (e) {
        // Silencieux (best-effort) — ne jamais bloquer le rendu.
        logger.debug("[R4] updateGodSessionHeartbeat skipped", { error: e });
    }
}

/** Ferme la session active de l'utilisateur (endedAt + active=false). */
export async function closeGodSession(): Promise<void> {
    try {
        const session = await auth();
        if (!session?.user?.id) return;

        await db.godSessionLog.updateMany({
            where: { userId: session.user.id, active: true },
            data: { active: false, endedAt: new Date() },
        });
    } catch (e) {
        // Silencieux (best-effort).
        logger.debug("[R4] closeGodSession skipped", { error: e });
    }
}