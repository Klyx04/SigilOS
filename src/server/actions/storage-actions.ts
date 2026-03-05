"use server";

import { isSuperAdmin } from "./super-admin-actions";
import { db } from "@/lib/prisma";
import { PrismaClient } from "@prisma/client";
import { readdir, stat, unlink } from "fs/promises";
import { join, normalize } from "path";
import { existsSync } from "fs";

const kamaDb = db as unknown as PrismaClient;

export type PendingFile = {
    filename: string;
    url: string;
    sizeBytes: number;
    createdAt: Date;
    expiresAt: Date;
    submissionId: string;
    type: "MISSION" | "KAMA" | "ACHIEVEMENT";
    memberName: string;
};

export type GuildAsset = {
    type: "ICON" | "BANNER" | "PHOTO";
    url: string;
    label: string;
    isLocal: boolean;
    dbField?: AssetDbField; // used to clear the DB field after VPS deletion
};

export type DiskFile = {
    filename: string;
    url: string;
    sizeBytes: number;
    modifiedAt: Date;
};

export type StorageGuildEntry = {
    guildId: string;
    discordGuildId: string;
    name: string;
    // disk stats
    missionsDir: string;
    missionsCount: number;
    missionsBytes: number;
    missionsFiles: DiskFile[];
    kamaDir: string;
    kamaCount: number;
    kamaBytes: number;
    kamaFiles: DiskFile[];
    achievementDir: string;
    achievementCount: number;
    achievementBytes: number;
    achievementFiles: DiskFile[];
    // pending
    pendingMissions: number;
    pendingKamas: number;
    pendingFiles: PendingFile[];
    // guild assets
    assets: GuildAsset[];
};

export type StorageOverview = {
    guilds: StorageGuildEntry[];
    totalBytes: number;
    totalFiles: number;
    orphanFiles: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function dirList(dirPath: string, urlBase: string): Promise<{ count: number; bytes: number; files: DiskFile[] }> {
    if (!existsSync(dirPath)) return { count: 0, bytes: 0, files: [] };
    try {
        const entries = await readdir(dirPath, { withFileTypes: true });
        const files: DiskFile[] = [];
        let bytes = 0;
        for (const f of entries) {
            if (!f.isFile()) continue;
            const s = await stat(join(dirPath, f.name));
            bytes += s.size;
            files.push({
                filename: f.name,
                url: `${urlBase}/${f.name}`,
                sizeBytes: s.size,
                modifiedAt: s.mtime,
            });
        }
        // Sort newest first
        files.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
        return { count: files.length, bytes, files };
    } catch { return { count: 0, bytes: 0, files: [] }; }
}

async function getPendingFilesForGuild(
    guildId: string,
    discordGuildId: string,
    cwd: string
): Promise<PendingFile[]> {
    const EXPIRY_MS = 24 * 60 * 60 * 1000;
    const pendingFiles: PendingFile[] = [];

    try {
        const missionSubs = await db.submission.findMany({
            where: { mission: { guildId }, status: "PENDING", proofUrl: { not: "" } },
            select: {
                id: true, proofUrl: true, createdAt: true,
                profile: { select: { discordNickname: true, pseudoDofus: true } },
            },
            orderBy: { createdAt: "asc" },
        });
        for (const sub of missionSubs) {
            if (!sub.proofUrl) continue;
            try {
                const s = await stat(join(cwd, "public", sub.proofUrl.replace(/^\//, "")));
                pendingFiles.push({
                    filename: sub.proofUrl.split(/[/\\]/).pop() || sub.id,
                    url: sub.proofUrl, sizeBytes: s.size,
                    createdAt: sub.createdAt,
                    expiresAt: new Date(sub.createdAt.getTime() + EXPIRY_MS),
                    submissionId: sub.id, type: "MISSION",
                    memberName: sub.profile?.discordNickname || sub.profile?.pseudoDofus || "Membre",
                });
            } catch { }
        }
    } catch { }

    try {
        const kamaSubs = await (kamaDb as any).kamaDonation.findMany({
            where: { guildId, status: "PENDING", proofUrl: { not: "" } },
            select: {
                id: true, proofUrl: true, createdAt: true,
                profile: { select: { discordNickname: true, pseudoDofus: true } },
            },
            orderBy: { createdAt: "asc" },
        });
        for (const sub of kamaSubs) {
            if (!sub.proofUrl) continue;
            try {
                const s = await stat(join(cwd, "public", sub.proofUrl.replace(/^\//, "")));
                pendingFiles.push({
                    filename: sub.proofUrl.split(/[/\\]/).pop() || sub.id,
                    url: sub.proofUrl, sizeBytes: s.size,
                    createdAt: sub.createdAt,
                    expiresAt: new Date(sub.createdAt.getTime() + EXPIRY_MS),
                    submissionId: sub.id, type: "KAMA",
                    memberName: sub.profile?.discordNickname || sub.profile?.pseudoDofus || "Membre",
                });
            } catch { }
        }
    } catch { }

    try {
        const achSubs = await (db as any).achievementSubmission.findMany({
            where: { guildId, status: "PENDING", proofUrl: { not: "" } },
            select: {
                id: true, proofUrl: true, createdAt: true,
                profile: { select: { discordNickname: true, pseudoDofus: true } },
            },
            orderBy: { createdAt: "asc" },
        });
        for (const sub of achSubs) {
            if (!sub.proofUrl) continue;
            try {
                const s = await stat(join(cwd, "public", sub.proofUrl.replace(/^\//, "")));
                pendingFiles.push({
                    filename: sub.proofUrl.split(/[/\\]/).pop() || sub.id,
                    url: sub.proofUrl, sizeBytes: s.size,
                    createdAt: sub.createdAt,
                    expiresAt: new Date(sub.createdAt.getTime() + EXPIRY_MS),
                    submissionId: sub.id, type: "ACHIEVEMENT",
                    memberName: sub.profile?.discordNickname || sub.profile?.pseudoDofus || "Membre",
                });
            } catch { }
        }
    } catch { }

    return pendingFiles;
}

// ─── Main action ──────────────────────────────────────────────────────────────

export async function getStorageOverview(): Promise<{ success: boolean; data?: StorageOverview; error?: string }> {
    if (!(await isSuperAdmin())) return { success: false, error: "Super admin requis" };

    try {
        const guilds = await db.guildConfig.findMany({
            select: {
                id: true, discordGuildId: true, name: true,
                iconUrl: true,
                presentationBannerUrl: true,
                presentationBannerType: true,
                presentationPhotoUrl: true,
            } as any,
            orderBy: { name: "asc" },
        });

        const cwd = process.cwd();

        const entries: StorageGuildEntry[] = await Promise.all(
            guilds.map(async (g: any) => {
                const missionsDir = join(cwd, "public", "uploads", "proofs", g.discordGuildId);
                const kamaDir = join(cwd, "public", "uploads", "guilds", g.id, "proofs");
                const achievementDir = join(cwd, "public", "uploads", "guilds", g.id, "achievements");

                const missionsUrlBase = `/uploads/proofs/${g.discordGuildId}`;
                const kamaUrlBase = `/uploads/guilds/${g.id}/proofs`;
                const achievementUrlBase = `/uploads/guilds/${g.id}/achievements`;

                const [missionsList, kamaList, achievementList, pendingFiles] = await Promise.all([
                    dirList(missionsDir, missionsUrlBase),
                    dirList(kamaDir, kamaUrlBase),
                    dirList(achievementDir, achievementUrlBase),
                    getPendingFilesForGuild(g.id, g.discordGuildId, cwd),
                ]);

                const [pendingMissions, pendingKamas] = await Promise.all([
                    db.submission.count({ where: { mission: { guildId: g.id }, status: "PENDING" } }),
                    (kamaDb as any).kamaDonation
                        ? (kamaDb as any).kamaDonation.count({ where: { guildId: g.id, status: "PENDING" } }).catch(() => 0)
                        : Promise.resolve(0),
                ]);

                // Collect guild assets (icon, banner, photo)
                const assets: GuildAsset[] = [];
                if (g.iconUrl) assets.push({
                    type: "ICON", url: g.iconUrl, label: "Icône",
                    isLocal: g.iconUrl.startsWith("/"),
                    dbField: "iconUrl",
                });
                if (g.presentationBannerUrl) assets.push({
                    type: "BANNER", url: g.presentationBannerUrl,
                    label: "Bannière de guilde",
                    isLocal: g.presentationBannerUrl.startsWith("/") || g.presentationBannerType === "local",
                    dbField: "presentationBannerUrl",
                });
                if (g.presentationPhotoUrl) assets.push({
                    type: "PHOTO", url: g.presentationPhotoUrl,
                    label: "Photo de guilde",
                    isLocal: g.presentationPhotoUrl.startsWith("/"),
                    dbField: "presentationPhotoUrl",
                });

                return {
                    guildId: g.id,
                    discordGuildId: g.discordGuildId,
                    name: g.name || g.discordGuildId,
                    missionsDir: `${missionsUrlBase}/`,
                    missionsCount: missionsList.count,
                    missionsBytes: missionsList.bytes,
                    missionsFiles: missionsList.files,
                    kamaDir: `${kamaUrlBase}/`,
                    kamaCount: kamaList.count,
                    kamaBytes: kamaList.bytes,
                    kamaFiles: kamaList.files,
                    achievementDir: `${achievementUrlBase}/`,
                    achievementCount: achievementList.count,
                    achievementBytes: achievementList.bytes,
                    achievementFiles: achievementList.files,
                    pendingMissions,
                    pendingKamas,
                    pendingFiles,
                    assets,
                };
            })
        );


        const totalBytes = entries.reduce((s, e) => s + e.missionsBytes + e.kamaBytes + e.achievementBytes, 0);
        const totalFiles = entries.reduce((s, e) => s + e.missionsCount + e.kamaCount + e.achievementCount, 0);
        const dbProofFiles = await db.submission.count({ where: { proofUrl: { not: "" } } });
        const diskMissionFiles = entries.reduce((s, e) => s + e.missionsCount, 0);
        const orphanFiles = Math.max(0, diskMissionFiles - dbProofFiles);

        return { success: true, data: { guilds: entries, totalBytes, totalFiles, orphanFiles } };
    } catch (error) {
        console.error("[getStorageOverview]", error);
        return { success: false, error: "Erreur serveur" };
    }
}

// ─── God-only: delete a file directly from VPS + clear DB field ──────────────

export type AssetDbField = "iconUrl" | "presentationBannerUrl" | "presentationPhotoUrl";

export async function godDeleteFile(
    fileUrl: string,
    dbClear?: { guildId: string; field: AssetDbField }
): Promise<{ success: boolean; error?: string }> {
    if (!(await isSuperAdmin())) return { success: false, error: "Super admin requis" };

    if (!fileUrl.startsWith("/uploads/")) {
        return { success: false, error: "Chemin non autorisé (doit commencer par /uploads/)" };
    }

    const relativePath = fileUrl.replace(/^\//, "");
    const absolutePath = normalize(join(process.cwd(), "public", relativePath));
    const uploadsRoot = normalize(join(process.cwd(), "public", "uploads"));

    if (!absolutePath.startsWith(uploadsRoot)) {
        return { success: false, error: "Path traversal détecté — opération refusée." };
    }

    try {
        await unlink(absolutePath);
        console.log(`[God] Superadmin deleted file: ${fileUrl}`);
    } catch (error: any) {
        if (error.code !== "ENOENT") {
            return { success: false, error: `Erreur suppression fichier: ${error.message}` };
        }
        // ENOENT = already gone — still clear the DB field
        console.warn(`[God] File already missing on disk: ${fileUrl}`);
    }

    // Clear the DB field so the asset disappears from the panel immediately
    const allowedFields: AssetDbField[] = ["iconUrl", "presentationBannerUrl", "presentationPhotoUrl"];
    if (dbClear?.guildId && dbClear?.field && allowedFields.includes(dbClear.field)) {
        try {
            await (db as any).guildConfig.update({
                where: { id: dbClear.guildId },
                data: { [dbClear.field]: null },
            });
            console.log(`[God] Cleared DB field ${dbClear.field} for guild ${dbClear.guildId}`);
        } catch (dbErr) {
            console.error("[God] Failed to clear DB field:", dbErr);
        }
    }

    return { success: true };
}
