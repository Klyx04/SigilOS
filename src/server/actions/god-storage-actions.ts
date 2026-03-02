"use server";

import { db } from "@/lib/prisma";
import { isSuperAdmin } from "./super-admin-actions";
import { promises as fs } from "fs";
import path from "path";

async function getDirSize(dirPath: string): Promise<number> {
    try {
        let size = 0;
        const stat = await fs.stat(dirPath);
        if (stat.isDirectory()) {
            const files = await fs.readdir(dirPath);
            for (const file of files) {
                size += await getDirSize(path.join(dirPath, file));
            }
        } else {
            size = stat.size;
        }
        return size;
    } catch {
        // Ignorer si le dossier n'existe pas
        return 0;
    }
}

export async function getGuildsStorageStats() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) throw new Error("Unauthorized");

    const guilds = await db.guildConfig.findMany({
        where: { isActive: true },
        select: { id: true, name: true, _count: { select: { profiles: true } } }
    });

    const basePath = path.join(process.cwd(), "public", "uploads", "guilds");

    const statsPromises = guilds.map(async (guild) => {
        const guildDir = path.join(basePath, guild.id);
        const sizeBytes = await getDirSize(guildDir);

        // Captures en cours = Submissions with pending OCR or waitings validation
        const pendingSubmissions = await db.submission.count({
            where: {
                mission: { guildId: guild.id },
                status: "PENDING"
            }
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const submissionsToday = await db.submission.count({
            where: {
                mission: { guildId: guild.id },
                createdAt: { gte: today }
            }
        });

        return {
            id: guild.id,
            name: guild.name,
            sizeBytes,
            pendingSubmissions,
            submissionsToday,
            members: guild._count.profiles
        };
    });

    const stats = await Promise.all(statsPromises);

    // Trier par espace disque décroissant
    stats.sort((a, b) => b.sizeBytes - a.sizeBytes);

    return stats;
}
