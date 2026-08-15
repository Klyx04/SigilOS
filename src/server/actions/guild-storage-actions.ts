"use server";

import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { promises as fs } from "fs";
import path from "path";

const DEFAULT_GUILD_STORAGE_LIMIT = 512 * 1024 * 1024; // 512 Mo (aligné God)

async function dirSizeBytes(dirPath: string): Promise<{ count: number; bytes: number }> {
    let count = 0;
    let bytes = 0;
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const f of entries) {
            if (!f.isFile()) continue; // on ignore les sous-dossiers (comptés séparément)
            const s = await fs.stat(path.join(dirPath, f.name));
            bytes += s.size;
            count++;
        }
    } catch { /* dossier absent — pas de capture */ }
    return { count, bytes };
}

/**
 * Usage de stockage de la guilde (lecture seule, guild-isolé).
 * Visible par tout membre de la guilde : missions, kamas/prêts, succès,
 * présentation + icône/bannière, contre le seuil fixé par God.
 */
export async function getGuildStorageUsage(guildId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated || !ctx.isMember) return { success: false, error: "Accès refusé" };

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true, name: true, storageLimitBytes: true },
    });
    if (!guild) return { success: false, error: "Guilde introuvable" };

    const cwd = process.cwd();
    const [missions, kamaLoans, achievements, presentation, assets] = await Promise.all([
        dirSizeBytes(path.join(cwd, "private_uploads", "proofs", guildId)),
        dirSizeBytes(path.join(cwd, "private_uploads", "guilds", guild.id, "proofs")),
        dirSizeBytes(path.join(cwd, "private_uploads", "guilds", guild.id, "achievements")),
        dirSizeBytes(path.join(cwd, "private_uploads", "guilds", guild.id, "presentation")),
        dirSizeBytes(path.join(cwd, "private_uploads", "guilds", guild.id)), // icône/bannière/photo (fichiers directs)
    ]);

    const totalBytes = missions.bytes + kamaLoans.bytes + achievements.bytes + presentation.bytes + assets.bytes;
    const totalFiles = missions.count + kamaLoans.count + achievements.count + presentation.count + assets.count;
    const limitBytes = guild.storageLimitBytes != null ? Number(guild.storageLimitBytes) : DEFAULT_GUILD_STORAGE_LIMIT;
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
                { key: "MISSIONS", label: "Missions", bytes: missions.bytes, files: missions.count },
                { key: "KAMA_LOANS", label: "Kamas & Prêts", bytes: kamaLoans.bytes, files: kamaLoans.count },
                { key: "ACHIEVEMENT", label: "Succès", bytes: achievements.bytes, files: achievements.count },
                { key: "PRESENTATION", label: "Présentation", bytes: presentation.bytes, files: presentation.count },
                { key: "ASSETS", label: "Icône & Bannière", bytes: assets.bytes, files: assets.count },
            ],
        },
    };
}