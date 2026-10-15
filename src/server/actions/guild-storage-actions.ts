"use server";

import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { promises as fs } from "fs";
import path from "path";

const DEFAULT_GUILD_STORAGE_LIMIT = 512 * 1024 * 1024; // 512 Mo (aligné God)

async function dirSizeBytes(dirPath: string): Promise<{ count: number; bytes: number }> {
    let count = 0;
    let bytes = 0;
    const base = path.resolve(dirPath);
    try {
        const entries = await fs.readdir(base, { withFileTypes: true });
        for (const f of entries) {
            if (!f.isFile()) continue; // on ignore les sous-dossiers (comptés séparément)
            // 🔐 Anti-traversal (CodeQL) : readdir renvoie des noms sans séparateur,
            // on refuse quand même . / .. / tout séparateur par défense en profondeur,
            // et on re-vérifie que le fichier résolu reste bien sous le dossier scanné.
            if (f.name === "." || f.name === ".." || f.name.includes("/") || f.name.includes("\\")) continue;
            const child = path.resolve(base, f.name);
            if (!child.startsWith(base + path.sep)) continue;
            const s = await fs.stat(child);
            bytes += s.size;
            count++;
        }
    } catch { /* dossier absent — pas de capture */ }
    return { count, bytes };
}

export type StorageBreakdownKey =
    | "MISSIONS"
    | "KAMA_LOANS"
    | "ACHIEVEMENT"
    | "PRESENTATION"
    | "ASSETS"
    | "TRANSCRIPTS";

export interface StorageBreakdownItem {
    key: StorageBreakdownKey;
    label: string;
    bytes: number;
    files: number;
    earliestExpiry: string | null;
    isPermanent?: boolean;
    pendingCount?: number;
}

export interface GuildTranscriptDetail {
    id: string;
    ticketId: string;
    ticketNumber: number;
    creatorDiscordName: string;
    categoryName: string;
    kind: "SHAREABLE" | "INTERNAL";
    sizeBytes: number;
    messageCount: number;
    secretToken: string;
    createdAt: string;
    expiresAt: string | null;
    partial: boolean;
}

export interface GuildStorageUsageResponse {
    name: string;
    totalBytes: number;
    totalFiles: number;
    limitBytes: number;
    usagePercent: number;
    overLimit: boolean;
    breakdown: StorageBreakdownItem[];
    transcripts: GuildTranscriptDetail[];
    permissions: {
        canValidateMissions: boolean;
        canViewPresentation: boolean;
        canManageTickets: boolean;
    };
}

/**
 * Usage de stockage de la guilde (lecture seule, guild-isolé).
 * Visible par tout membre de la guilde : missions, kamas/prêts, succès,
 * présentation, icône/bannière, et transcripts de tickets Discord,
 * contre le seuil fixé par God.
 */
export async function getGuildStorageUsage(guildId: string): Promise<{
    success: boolean;
    data?: GuildStorageUsageResponse;
    error?: string;
}> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated || !ctx.isMember) return { success: false, error: "Accès refusé" };

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true, name: true, storageLimitBytes: true },
    });
    if (!guild) return { success: false, error: "Guilde introuvable" };

    // 🔐 CodeQL / Uncontrolled path — snowflake strict (17-20 chiffres)
    if (!/^\d{17,20}$/.test(guildId)) return { success: false, error: "Guilde invalide" };

    const cwd = process.cwd();
    const privateRoot = path.resolve(cwd, "private_uploads");
    const buildDir = (...parts: string[]) => {
        const p = path.resolve(privateRoot, ...parts);
        if (p !== privateRoot && !p.startsWith(privateRoot + path.sep)) {
            throw new Error("Invalid storage path");
        }
        return p;
    };

    const [
        missions,
        kamaLoans,
        achievements,
        presentation,
        assets,
        transcriptsRows,
        pendingMission,
        pendingKama,
        pendingAchiev,
        pendingMissionCount,
        pendingKamaCount,
        pendingAchievCount
    ] = await Promise.all([
        dirSizeBytes(buildDir("proofs", guildId)),
        dirSizeBytes(buildDir("guilds", guild.id, "proofs")),
        dirSizeBytes(buildDir("guilds", guild.id, "achievements")),
        dirSizeBytes(buildDir("guilds", guild.id, "presentation")),
        dirSizeBytes(buildDir("guilds", guild.id)), // icône/bannière/photo (fichiers directs)
        db.ticketTranscript.findMany({
            where: { guildId: guild.id },
            include: {
                ticket: {
                    select: {
                        ticketNumber: true,
                        creatorDiscordName: true,
                        category: { select: { name: true } },
                        journey: { select: { name: true } },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        }),
        db.submission.findFirst({
            where: { mission: { guildId: guild.id }, status: "PENDING", proofUrl: { not: "" } },
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
        }),
        db.kamaDonation.findFirst({
            where: { guildId: guild.id, status: "PENDING", proofUrl: { not: null } },
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
        }).catch(() => null),
        db.achievementSubmission.findFirst({
            where: { guildId: guild.id, status: "PENDING", proofUrl: { not: "" } },
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
        }).catch(() => null),
        db.submission.count({
            where: { mission: { guildId: guild.id }, status: "PENDING", proofUrl: { not: "" } },
        }),
        db.kamaDonation.count({
            where: { guildId: guild.id, status: "PENDING", proofUrl: { not: null } },
        }).catch(() => 0),
        db.achievementSubmission.count({
            where: { guildId: guild.id, status: "PENDING", proofUrl: { not: "" } },
        }).catch(() => 0),
    ]);

    // Format transcripts
    let transcriptsBytes = 0;
    const transcripts: GuildTranscriptDetail[] = transcriptsRows.map((t) => {
        const bytes = t.sizeBytes || 0;
        transcriptsBytes += bytes;
        return {
            id: t.id,
            ticketId: t.ticketId,
            ticketNumber: t.ticket?.ticketNumber ?? 0,
            creatorDiscordName: t.ticket?.creatorDiscordName || "Membre",
            categoryName: t.ticket?.journey?.name || t.ticket?.category?.name || "Support",
            kind: t.kind as "SHAREABLE" | "INTERNAL",
            sizeBytes: bytes,
            messageCount: t.messageCount,
            secretToken: t.secretToken,
            createdAt: t.createdAt.toISOString(),
            expiresAt: t.expiresAt ? t.expiresAt.toISOString() : null,
            partial: t.partial,
        };
    });

    // Expirations estimées pour les preuves en attente (24h après soumission)
    const missionEarliestExpiry = pendingMission
        ? new Date(pendingMission.createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString()
        : null;

    const kamaEarliestExpiry = pendingKama
        ? new Date(pendingKama.createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString()
        : null;

    const achievEarliestExpiry = pendingAchiev
        ? new Date(pendingAchiev.createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString()
        : null;

    // Prochaine expiration pour les transcripts (parmi ceux avec date dans le futur)
    const nowMs = Date.now();
    const activeExpiringTranscripts = transcriptsRows
        .filter((t) => t.expiresAt && t.expiresAt.getTime() > nowMs)
        .sort((a, b) => a.expiresAt!.getTime() - b.expiresAt!.getTime());

    const transcriptEarliestExpiry = activeExpiringTranscripts[0]?.expiresAt
        ? activeExpiringTranscripts[0].expiresAt.toISOString()
        : null;

    const totalBytes =
        missions.bytes +
        kamaLoans.bytes +
        achievements.bytes +
        presentation.bytes +
        assets.bytes +
        transcriptsBytes;

    const totalFiles =
        missions.count +
        kamaLoans.count +
        achievements.count +
        presentation.count +
        assets.count +
        transcripts.length;

    const limitBytes =
        guild.storageLimitBytes != null ? Number(guild.storageLimitBytes) : DEFAULT_GUILD_STORAGE_LIMIT;
    const usagePercent = limitBytes > 0 ? Math.round((totalBytes / limitBytes) * 100) : 0;
    const overLimit = totalBytes > limitBytes;

    return {
        success: true,
        data: {
            name: guild.name,
            totalBytes,
            totalFiles,
            limitBytes,
            usagePercent,
            overLimit,
            breakdown: [
                {
                    key: "MISSIONS",
                    label: "Missions",
                    bytes: missions.bytes,
                    files: missions.count,
                    earliestExpiry: missionEarliestExpiry,
                    pendingCount: pendingMissionCount,
                },
                {
                    key: "KAMA_LOANS",
                    label: "Kamas, Prêts & Coffre",
                    bytes: kamaLoans.bytes,
                    files: kamaLoans.count,
                    earliestExpiry: kamaEarliestExpiry,
                    pendingCount: pendingKamaCount,
                },
                {
                    key: "ACHIEVEMENT",
                    label: "Succès",
                    bytes: achievements.bytes,
                    files: achievements.count,
                    earliestExpiry: achievEarliestExpiry,
                    pendingCount: pendingAchievCount,
                },
                {
                    key: "PRESENTATION",
                    label: "Présentation Guilde",
                    bytes: presentation.bytes,
                    files: presentation.count,
                    earliestExpiry: null,
                    isPermanent: true,
                },
                {
                    key: "ASSETS",
                    label: "Icône & Bannière",
                    bytes: assets.bytes,
                    files: assets.count,
                    earliestExpiry: null,
                    isPermanent: true,
                },
                {
                    key: "TRANSCRIPTS",
                    label: "Transcripts Tickets Discord",
                    bytes: transcriptsBytes,
                    files: transcripts.length,
                    earliestExpiry: transcriptEarliestExpiry,
                },
            ],
            transcripts,
            permissions: {
                canValidateMissions: Boolean(ctx.canValidateMissions || ctx.isAdmin),
                canViewPresentation: Boolean(ctx.canViewPresentation),
                canManageTickets: Boolean(ctx.canManageTickets),
            },
        },
    };
}