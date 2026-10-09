"use server";

/**
 * Synchro des miroirs agenda DJ / Songes → `GuildEvent` (lot R1 §4).
 *
 * Appelée EXPLICITEMENT après chaque mutation DJ / Songes (jamais de trigger
 * Prisma, jamais de logique client) : la source reste le post / la run.
 * - daté → crée ; date ajoutée → crée ; date changée → patch ;
 * - date retirée (toujours ouvert) → le miroir sort du calendrier ;
 * - fermé / clôturé → `COMPLETED` (filigrane « Terminé », pas de suppression).
 *
 * Idempotence : UN seul miroir par source (`metadata.source`), retrouvé par
 * lecture bornée + filtre JS (même rail que `getImportedKralamoureIds`).
 * Garde d'état dans le `WHERE` (`updateMany`/`deleteMany` scopés `guildId`).
 * Fail-closed : source d'une autre guilde → refus ; best-effort : n'interrompt
 * JAMAIS l'action appelante (les embeds Discord suivent le même rail).
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
    aggregateMirrorClasses,
    djMirrorEventType,
    djMirrorRange,
    djMirrorStatus,
    djMirrorTitle,
    mirrorMessage,
    mirrorMultiEntries,
    mirrorMultiLines,
    pickMirrorAchievements,
    songesDifficultyLabel,
    songesMirrorEventType,
    songesMirrorRange,
    songesMirrorStatus,
    songesMirrorTitle,
} from "@/lib/agenda-mirror";

const IdSchema = z.string().min(1).max(64);

export type MirrorSyncResult =
    | { success: true; action: "created" | "updated" | "completed" | "removed" | "skipped" }
    | { success: false; error: string };

/** Retrouve le miroir d'une source (lecture bornée, filtre JS sur `metadata`). */
async function findMirror(internalGuildId: string, type: string, kind: "DJ" | "SONGES", sourceId: string) {
    const candidates = await db.guildEvent.findMany({
        where: { guildId: internalGuildId, type: type as never },
        select: { id: true, metadata: true },
        take: 250,
    });
    return (
        candidates.find((e) => {
            const source = (e.metadata as { source?: { kind?: unknown; djPostId?: unknown; dreamRunId?: unknown } } | null)?.source;
            if (!source || source.kind !== kind) return false;
            return kind === "DJ" ? source.djPostId === sourceId : source.dreamRunId === sourceId;
        }) ?? null
    );
}

async function resolveInternalGuildId(discordGuildId: string) {
    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: { id: true },
    });
    return guildConfig?.id ?? null;
}

function refreshAgenda(discordGuildId: string) {
    revalidatePath(`/dashboard/${discordGuildId}/calendar`);
}

// ============================================
// MIROIR DJ
// ============================================

/**
 * Synchronise le miroir d'un post DJ (tous modes : DONJON, QUETE, DEFI, TITAN).
 * `discordGuildId` = snowflake déjà validé par l'action appelante (contexte).
 */
export async function syncDjMirror(discordGuildId: string, postId: string): Promise<MirrorSyncResult> {
    try {
        if (!IdSchema.safeParse(discordGuildId).success || !IdSchema.safeParse(postId).success) {
            return { success: false, error: "Identifiants invalides" };
        }
        const internalGuildId = await resolveInternalGuildId(discordGuildId);
        if (!internalGuildId) return { success: false, error: "Guilde introuvable" };

        const post = await (db as never as {
            djSearchPost: {
                findFirst: (args: unknown) => Promise<never | null>;
            };
        }).djSearchPost.findFirst({
            where: { id: postId, guildId: internalGuildId },
            include: {
                dungeon: {
                    select: {
                        name: true,
                        achievements: { select: { challenge: { select: { name: true } } } },
                    },
                },
                defi: { select: { name: true } },
                titan: { select: { name: true } },
                profile: { select: { userId: true, classe: true } },
                participants: {
                    where: { status: "ACCEPTED" },
                    select: { classe: true, profile: { select: { classe: true } } },
                },
            },
        } as never) as unknown as {
            id: string;
            guildId: string;
            mode: string;
            status: string;
            targetDate: Date | null;
            dungeonsJson: unknown;
            message: string | null;
            maxMembers: number | null;
            questName: string | null;
            wantedAchievementIds: string[];
            dungeon: { name: string; achievements: { challenge: { name: string } | null }[] } | null;
            defi: { name: string } | null;
            titan: { name: string } | null;
            profile: { userId: string; classe: string | null } | null;
            participants: { classe: string | null; profile: { classe: string | null } | null }[];
        } | null;

        const mirror = await findMirror(internalGuildId, djMirrorEventType(), "DJ", postId);

        // Post supprimé / hors guilde → le miroir sort (fail-closed : rien d'autre).
        if (!post || post.guildId !== internalGuildId) {
            if (mirror) {
                await db.guildEvent.deleteMany({ where: { id: mirror.id, guildId: internalGuildId } });
                refreshAgenda(discordGuildId);
                return { success: true, action: "removed" };
            }
            return { success: true, action: "skipped" };
        }

        const range = djMirrorRange({ targetDate: post.targetDate, dungeonsJson: post.dungeonsJson });
        const endStatus = djMirrorStatus(post.status);

        // Ouvert mais sans date (jamais mise ou retirée) → sortie du calendrier.
        if (!range && endStatus === "PUBLISHED") {
            if (mirror) {
                await db.guildEvent.deleteMany({ where: { id: mirror.id, guildId: internalGuildId } });
                refreshAgenda(discordGuildId);
                return { success: true, action: "removed" };
            }
            return { success: true, action: "skipped" };
        }

        const entries = mirrorMultiEntries(post.dungeonsJson);
        const isMulti = entries.length > 0;
        const achievementNames = isMulti
            ? entries.flatMap((e) =>
                  Array.isArray((e as { achievements?: { name?: unknown }[] }).achievements)
                      ? (e as { achievements: { name?: unknown }[] }).achievements.map((a) => String(a?.name ?? ""))
                      : []
              )
            : (post.dungeon?.achievements ?? []).map((a) => a.challenge?.name ?? "");
        const classes = aggregateMirrorClasses([
            post.profile?.classe,
            ...post.participants.flatMap((p) => [p.classe, p.profile?.classe]),
        ]);
        const title = djMirrorTitle({
            mode: post.mode,
            dungeonName: post.dungeon?.name,
            questName: post.questName,
            defiName: post.defi?.name,
            titanName: post.titan?.name,
            multiNames: isMulti ? entries.map((e) => e?.name) : undefined,
        });
        const label =
            post.mode === "QUETE" ? "Quête" : post.mode === "DEFI" ? "Défi" : post.mode === "TITAN" ? "Titan" : "DJ";
        const names = isMulti
            ? entries.map((e) => String(e?.name ?? "").trim().slice(0, 80) || "Donjon").slice(0, 5)
            : [
                  (post.mode === "QUETE"
                      ? post.questName
                      : post.mode === "DEFI"
                        ? post.defi?.name
                        : post.mode === "TITAN"
                          ? post.titan?.name
                          : post.dungeon?.name) ?? "",
              ]
                  .map((n) => String(n).trim().slice(0, 80))
                  .filter(Boolean);

        const metadata = {
            source: { kind: "DJ", djPostId: post.id, mode: post.mode },
            mirror: {
                label,
                names,
                message: mirrorMessage(post.message),
                achievements: pickMirrorAchievements(achievementNames),
                classes,
                memberCount: post.participants.length + 1,
                maxMembers: typeof post.maxMembers === "number" && post.maxMembers >= 1 ? post.maxMembers : null,
                multiLines: isMulti ? mirrorMultiLines(entries) : [],
                href: `/dashboard/${discordGuildId}/donjons-et-quetes`,
                objectives: [],
            },
        };

        if (!range) {
            // Fermé sans date : on garde le miroir existant en COMPLETED (filigrane).
            if (mirror) {
                await db.guildEvent.updateMany({
                    where: { id: mirror.id, guildId: internalGuildId, status: { not: "COMPLETED" } },
                    data: { status: "COMPLETED", metadata: metadata as never },
                });
                refreshAgenda(discordGuildId);
                return { success: true, action: "completed" };
            }
            return { success: true, action: "skipped" };
        }

        if (mirror) {
            await db.guildEvent.updateMany({
                where: { id: mirror.id, guildId: internalGuildId },
                data: {
                    title,
                    description: mirrorMessage(post.message),
                    startDate: range.start,
                    endDate: range.end,
                    status: endStatus,
                    maxParticipants:
                        typeof post.maxMembers === "number" && post.maxMembers >= 1 ? post.maxMembers : null,
                    metadata: metadata as never,
                },
            });
            refreshAgenda(discordGuildId);
            return { success: true, action: endStatus === "COMPLETED" ? "completed" : "updated" };
        }

        if (!post.profile?.userId) return { success: false, error: "Créateur introuvable" };
        await db.guildEvent.create({
            data: {
                guildId: internalGuildId,
                creatorId: post.profile.userId,
                title,
                description: mirrorMessage(post.message),
                type: djMirrorEventType() as never,
                status: endStatus,
                startDate: range.start,
                endDate: range.end,
                recurrence: "UNIQUE",
                maxParticipants:
                    typeof post.maxMembers === "number" && post.maxMembers >= 1 ? post.maxMembers : null,
                metadata: metadata as never,
            },
        });
        refreshAgenda(discordGuildId);
        return { success: true, action: "created" };
    } catch (error) {
        logger.warn("[agenda-mirror] syncDjMirror non bloquant", { error });
        return { success: false, error: "Miroir non synchronisé" };
    }
}

// ============================================
// MIROIR SONGES
// ============================================

/**
 * Synchronise le miroir d'une run Songes.
 * `discordGuildId` = snowflake déjà validé par l'action appelante (contexte).
 */
export async function syncSongesMirror(discordGuildId: string, runId: string): Promise<MirrorSyncResult> {
    try {
        if (!IdSchema.safeParse(discordGuildId).success || !IdSchema.safeParse(runId).success) {
            return { success: false, error: "Identifiants invalides" };
        }
        const internalGuildId = await resolveInternalGuildId(discordGuildId);
        if (!internalGuildId) return { success: false, error: "Guilde introuvable" };

        const run = await db.dreamRun.findFirst({
            where: { id: runId, guildId: internalGuildId },
            include: {
                members: { select: { userId: true } },
                joinRequests: {
                    where: { status: "ACCEPTED" },
                    select: { classe: true, message: true, userId: true },
                },
            },
        });

        const mirror = await findMirror(internalGuildId, songesMirrorEventType(), "SONGES", runId);

        if (!run || run.guildId !== internalGuildId) {
            if (mirror) {
                await db.guildEvent.deleteMany({ where: { id: mirror.id, guildId: internalGuildId } });
                refreshAgenda(discordGuildId);
                return { success: true, action: "removed" };
            }
            return { success: true, action: "skipped" };
        }

        const range = songesMirrorRange(run.scheduledAt);
        const endStatus = songesMirrorStatus(run.status);

        // Toujours en recrutement mais sans date → sortie du calendrier.
        if (!range && endStatus === "PUBLISHED") {
            if (mirror) {
                await db.guildEvent.deleteMany({ where: { id: mirror.id, guildId: internalGuildId } });
                refreshAgenda(discordGuildId);
                return { success: true, action: "removed" };
            }
            return { success: true, action: "skipped" };
        }

        const leaderMessage =
            run.joinRequests.find((j) => j.userId === run.leaderId && j.message !== "Meneur de la run")?.message ??
            null;
        const metadata = {
            source: { kind: "SONGES", dreamRunId: run.id, difficulty: run.difficulty },
            mirror: {
                label: songesDifficultyLabel(run.difficulty),
                names: [songesDifficultyLabel(run.difficulty)],
                message: mirrorMessage(leaderMessage),
                achievements: [],
                classes: aggregateMirrorClasses(run.joinRequests.map((j) => j.classe)),
                memberCount: run.members.length,
                maxMembers: 4,
                multiLines: [],
                href: `/dashboard/${discordGuildId}/songes`,
                objectives: Array.isArray(run.objectives) ? run.objectives.slice(0, 5) : [],
            },
        };

        if (!range) {
            if (mirror) {
                await db.guildEvent.updateMany({
                    where: { id: mirror.id, guildId: internalGuildId, status: { not: endStatus as never } },
                    data: { status: endStatus as never, metadata: metadata as never },
                });
                refreshAgenda(discordGuildId);
                return { success: true, action: endStatus === "CANCELLED" ? "updated" : "completed" };
            }
            return { success: true, action: "skipped" };
        }

        const title = songesMirrorTitle(run.difficulty);
        if (mirror) {
            await db.guildEvent.updateMany({
                where: { id: mirror.id, guildId: internalGuildId },
                data: {
                    title,
                    description: mirrorMessage(leaderMessage),
                    startDate: range.start,
                    endDate: range.end,
                    status: endStatus as never,
                    maxParticipants: 4,
                    metadata: metadata as never,
                },
            });
            refreshAgenda(discordGuildId);
            return {
                success: true,
                action: endStatus === "PUBLISHED" ? "updated" : endStatus === "CANCELLED" ? "updated" : "completed",
            };
        }

        await db.guildEvent.create({
            data: {
                guildId: internalGuildId,
                creatorId: run.leaderId,
                title,
                description: mirrorMessage(leaderMessage),
                type: songesMirrorEventType() as never,
                status: endStatus as never,
                startDate: range.start,
                endDate: range.end,
                recurrence: "UNIQUE",
                maxParticipants: 4,
                metadata: metadata as never,
            },
        });
        refreshAgenda(discordGuildId);
        return { success: true, action: "created" };
    } catch (error) {
        logger.warn("[agenda-mirror] syncSongesMirror non bloquant", { error });
        return { success: false, error: "Miroir non synchronisé" };
    }
}
