"use server";

/**
 * Lot 2 — sessions live de raid : chrono serveur + étape + objectifs.
 *
 * - Lancement / clôture / pilotage réservés au **créateur OU capitaine actuel**
 *   (`creatorId` / `metadata.raidCaptainId`, même règle que le transfert de
 *   capitanat) — fail-closed  sinon.
 * - Lecture ouverte aux membres de la guilde (overlay des inscrits).
 * - Chaque mutation publie sur Redis (`raid-live:<eventId>`, best-effort) pour
 *   le broadcast WebSocket ; le polling reste le repli (jamais d'écran vide).
 * - Rate-limit d'écriture (10/min) + garde d'état dans le `WHERE`.
 */

import { z } from "zod";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { rateLimit } from "@/lib/ratelimit";
import { getUserContext } from "@/server/actions/user-actions";
import {
    RAID_LIVE_DURATION_MS,
    defaultObjectivesForRaid,
    liveScoreOf,
    isValidObjective,
    raidLiveChannel,
} from "@/lib/raid-live";

type ActionResponse<T = void> = { success: boolean; data?: T; error?: string };

async function publishLiveUpdate(eventId: string, kind: string, discordGuildId: string): Promise<void> {
    try {
        await redis.publish(raidLiveChannel(eventId), JSON.stringify({ kind, at: Date.now(), guildId: discordGuildId }));
    } catch {
        // Best-effort : le polling overlay reste la source de vérité.
    }
}

interface LiveContext {
    userId: string;
    guildConfigId: string;
    profileId: string | null;
}

async function resolveCtx(discordGuildId: string): Promise<LiveContext | { error: string }> {
    try {
        const ctx = await getUserContext(discordGuildId);
        if (!ctx?.id) return { error: "Non authentifié" };
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { id: true },
        });
        if (!guildConfig) return { error: "Guilde inconnue" };
        const profile = await db.userProfile.findFirst({
            where: { userId: ctx.id, guild: { discordGuildId }, status: "ACTIVE" },
            select: { id: true },
        });
        if (!profile) return { error: "Membre inactif" };
        return { userId: ctx.id, guildConfigId: guildConfig.id, profileId: profile.id };
    } catch (error) {
        logger.warn("[raid-live] contexte indisponible", { error: String(error) });
        return { error: "Contexte indisponible" };
    }
}

async function requireLead(
    guildConfigId: string,
    userId: string,
    eventId: string
): Promise<{ event: any; meta: any } | { error: string }> {
    const event = await db.guildEvent.findFirst({
        where: { id: eventId, guildId: guildConfigId, type: "RAID_OFFICIAL", status: "PUBLISHED" },
        select: { id: true, creatorId: true, metadata: true },
    });
    if (!event) return { error: "Raid introuvable ou non ouvert" };
    const meta = (event.metadata as Record<string, unknown> | null) || {};
    const isCreator = event.creatorId === userId;
    const isCaptain = meta.raidCaptainId === userId;
    if (!isCreator && !isCaptain) return { error: "Seul l'organisateur ou le capitaine pilote la session" };
    return { event, meta };
}

function serializeSession(row: any) {
    const objectives = Array.isArray(row.objectives) ? row.objectives.filter(isValidObjective) : [];
    return {
        id: row.id as string,
        eventId: row.eventId as string,
        raidType: row.raidType as string,
        status: row.status as string,
        startedAt: (row.startedAt as Date).toISOString(),
        endsAt: (row.endsAt as Date).toISOString(),
        currentStepIndex: row.currentStepIndex as number,
        objectives,
        score: liveScoreOf(objectives),
        endedAt: row.endedAt ? (row.endedAt as Date).toISOString() : null,
    };
}

export type RaidLiveSessionView = ReturnType<typeof serializeSession>;

/** Lecture : session live d'un event (null = aucune). Membres uniquement. */
export async function getRaidLiveSession(
    discordGuildId: string,
    eventId: string
): Promise<ActionResponse<RaidLiveSessionView | null>> {
    const ctx = await resolveCtx(discordGuildId);
    if ("error" in ctx) return { success: false, error: ctx.error };
    try {
        const row = await db.raidLiveSession.findFirst({
            where: { eventId, guildId: ctx.guildConfigId },
        });
        if (!row) return { success: true, data: null };
        return { success: true, data: serializeSession(row) };
    } catch (error) {
        logger.warn("[raid-live] lecture impossible", { error: String(error) });
        return { success: false, error: "Session indisponible" };
    }
}

/** Lancement : créateur/capitaine, raid PUBLISHED, sans session active. */
export async function startRaidLiveSession(
    discordGuildId: string,
    eventId: string
): Promise<ActionResponse<RaidLiveSessionView>> {
    const ctx = await resolveCtx(discordGuildId);
    if ("error" in ctx) return { success: false, error: ctx.error };

    const rl = await rateLimit(`raid-live:${ctx.userId}:${eventId}`, 10, 60_000);
    if (!rl.success) return { success: false, error: "Trop de tentatives, réessaie dans une minute" };

    const lead = await requireLead(ctx.guildConfigId, ctx.userId, eventId);
    if ("error" in lead) return { success: false, error: lead.error };
    const raidType = typeof lead.meta.raidType === "string" ? lead.meta.raidType : "gigalodon";

    try {
        const existing = await db.raidLiveSession.findUnique({ where: { eventId } });
        if (existing && existing.status === "LIVE") {
            return { success: true, data: serializeSession(existing) };
        }
        const now = new Date();
        const row = await db.raidLiveSession.upsert({
            where: { eventId },
            create: {
                guildId: ctx.guildConfigId,
                eventId,
                raidType,
                createdByUserId: ctx.userId,
                startedAt: now,
                endsAt: new Date(now.getTime() + RAID_LIVE_DURATION_MS),
                status: "LIVE",
                currentStepIndex: 0,
                objectives: defaultObjectivesForRaid(raidType) as unknown as object,
            },
            update: {
                // Relance après clôture : nouveau chrono, objectifs remis à zéro.
                status: "LIVE",
                startedAt: now,
                endsAt: new Date(now.getTime() + RAID_LIVE_DURATION_MS),
                currentStepIndex: 0,
                objectives: defaultObjectivesForRaid(raidType) as unknown as object,
                endedAt: null,
                createdByUserId: ctx.userId,
            },
        });
        await publishLiveUpdate(eventId, "started", discordGuildId);
        return { success: true, data: serializeSession(row) };
    } catch (error) {
        logger.error("[raid-live] lancement impossible", { error: String(error) });
        return { success: false, error: "Lancement impossible" };
    }
}

/** Clôture manuelle du lead (le verrou auto à 60 min se fait côté lecture). */
export async function endRaidLiveSession(
    discordGuildId: string,
    eventId: string
): Promise<ActionResponse<RaidLiveSessionView>> {
    const ctx = await resolveCtx(discordGuildId);
    if ("error" in ctx) return { success: false, error: ctx.error };

    const rl = await rateLimit(`raid-live:${ctx.userId}:${eventId}`, 10, 60_000);
    if (!rl.success) return { success: false, error: "Trop de tentatives, réessaie dans une minute" };

    const lead = await requireLead(ctx.guildConfigId, ctx.userId, eventId);
    if ("error" in lead) return { success: false, error: lead.error };

    try {
        // Garde d'état dans le WHERE : seule une session LIVE se clôt.
        const row = await db.raidLiveSession.updateMany({
            where: { eventId, guildId: ctx.guildConfigId, status: "LIVE" },
            data: { status: "ENDED", endedAt: new Date() },
        });
        if (row.count === 0) return { success: false, error: "Aucune session en cours" };
        const updated = await db.raidLiveSession.findUnique({ where: { eventId } });
        await publishLiveUpdate(eventId, "ended", discordGuildId);
        return { success: true, data: updated ? serializeSession(updated) : undefined };
    } catch (error) {
        logger.error("[raid-live] clôture impossible", { error: String(error) });
        return { success: false, error: "Clôture impossible" };
    }
}

const stepSchema = z.object({
    eventId: z.string().min(6).max(40),
    stepIndex: z.number().int().min(0).max(32),
});

/** Le lead fait avancer l'étape (tous les overlays suivent). */
export async function setRaidLiveStep(
    discordGuildId: string,
    input: z.infer<typeof stepSchema>
): Promise<ActionResponse<RaidLiveSessionView>> {
    const parsed = stepSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Étape invalide" };
    const ctx = await resolveCtx(discordGuildId);
    if ("error" in ctx) return { success: false, error: ctx.error };

    const rl = await rateLimit(`raid-live:${ctx.userId}:${parsed.data.eventId}`, 10, 60_000);
    if (!rl.success) return { success: false, error: "Trop de tentatives, réessaie dans une minute" };

    const lead = await requireLead(ctx.guildConfigId, ctx.userId, parsed.data.eventId);
    if ("error" in lead) return { success: false, error: lead.error };

    try {
        const row = await db.raidLiveSession.updateMany({
            where: { eventId: parsed.data.eventId, guildId: ctx.guildConfigId, status: "LIVE" },
            data: { currentStepIndex: parsed.data.stepIndex },
        });
        if (row.count === 0) return { success: false, error: "Aucune session en cours" };
        const updated = await db.raidLiveSession.findUnique({ where: { eventId: parsed.data.eventId } });
        await publishLiveUpdate(parsed.data.eventId, "step", discordGuildId);
        return { success: true, data: updated ? serializeSession(updated) : undefined };
    } catch (error) {
        logger.error("[raid-live] étape impossible", { error: String(error) });
        return { success: false, error: "Mise à jour impossible" };
    }
}

const objectiveSchema = z.object({
    eventId: z.string().min(6).max(40),
    objectiveId: z.string().min(1).max(64),
    done: z.boolean(),
});

/**
 * Le lead coche/décoche UN objectif (écriture conditionnelle : l'objectif
 * doit exister dans la liste — jamais d'injection d'objectif libre).
 */
export async function setRaidLiveObjective(
    discordGuildId: string,
    input: z.infer<typeof objectiveSchema>
): Promise<ActionResponse<RaidLiveSessionView>> {
    const parsed = objectiveSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Objectif invalide" };
    const ctx = await resolveCtx(discordGuildId);
    if ("error" in ctx) return { success: false, error: ctx.error };

    const rl = await rateLimit(`raid-live:${ctx.userId}:${parsed.data.eventId}`, 10, 60_000);
    if (!rl.success) return { success: false, error: "Trop de tentatives, réessaie dans une minute" };

    const lead = await requireLead(ctx.guildConfigId, ctx.userId, parsed.data.eventId);
    if ("error" in lead) return { success: false, error: lead.error };

    try {
        const current = await db.raidLiveSession.findFirst({
            where: { eventId: parsed.data.eventId, guildId: ctx.guildConfigId, status: "LIVE" },
            select: { id: true, objectives: true },
        });
        if (!current) return { success: false, error: "Aucune session en cours" };
        const rawObjectives: unknown[] = Array.isArray(current.objectives) ? current.objectives : [];
        const objectives = rawObjectives.filter(isValidObjective);
        const target = objectives.find((o) => o.id === parsed.data.objectiveId);
        if (!target) return { success: false, error: "Objectif inconnu" };
        const next = objectives.map((o) =>
            o.id === parsed.data.objectiveId ? { ...o, done: parsed.data.done } : o
        );
        const updated = await db.raidLiveSession.update({
            where: { id: current.id },
            data: { objectives: next as unknown as object },
        });
        await publishLiveUpdate(parsed.data.eventId, "objectives", discordGuildId);
        return { success: true, data: serializeSession(updated) };
    } catch (error) {
        logger.error("[raid-live] objectif impossible", { error: String(error) });
        return { success: false, error: "Mise à jour impossible" };
    }
}
