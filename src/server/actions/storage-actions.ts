"use server";

import { logger } from "@/lib/logger";

import { isSuperAdmin } from "./super-admin-actions";
import { db } from "@/lib/prisma";
import { PrismaClient } from "@prisma/client";
import { readdir, stat, unlink } from "fs/promises";
import { join, normalize } from "path";
import { existsSync } from "fs";
import { rateLimit } from "@/lib/ratelimit";
import { redis } from "@/lib/redis";

const kamaDb = db as unknown as PrismaClient;

// ─── Cache court (60s) du scan disque ──────────────────────────────────────────
// Le scan fait des `stat` récursifs sur le disque : on évite de le refaire à
// chaque ouverture de l'onglet God (perf/stabilité). Invalidation : 60s.
let storageScanCache: { at: number; data: StorageOverview } | null = null;
const STORAGE_SCAN_CACHE_TTL_MS = 60_000;

// ─── Seuil de stockage par guilde ─────────────────────────────────────────────
const DEFAULT_GUILD_STORAGE_LIMIT = 512 * 1024 * 1024; // 512 Mo par défaut
const STORAGE_ALERT_KEY = (guildId: string) => `storage:alert:${guildId}`;
const STORAGE_ALERT_TTL_S = 24 * 60 * 60; // 1 alerte max / 24h par guilde

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

export interface DiskFile {
    filename: string;
    url: string;
    sizeBytes: number;
    modifiedAt: Date;
    isPending?: boolean;
    expiresAt?: Date | string;
}

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
    // preuves prêts & coffre
    loansProofsDir: string;
    loansProofsCount: number;
    loansProofsBytes: number;
    loansProofsFiles: DiskFile[];
    presentationDir: string;
    presentationCount: number;
    presentationBytes: number;
    presentationFiles: DiskFile[];
    activeLoanProofs: number; // nb de prêts/coffre actifs avec proofUrl en DB
    // pending
    pendingMissions: number;
    pendingKamas: number;
    pendingFiles: PendingFile[];
    // guild assets
    assets: GuildAsset[];
    // achievement stats
    achievementDir: string;
    achievementCount: number;
    achievementBytes: number;
    achievementFiles: DiskFile[];
    // seuil & utilisation
    totalBytes: number;
    limitBytes: number;
    usagePercent: number;
    overLimit: boolean;
};

export type StorageOverview = {
    guilds: StorageGuildEntry[];
    totalBytes: number;
    totalFiles: number;
    orphanFiles: DiskFile[];
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
    } catch (err) { 
        logger.error(`[StorageScan] Error readdir ${dirPath}`, { error: String(err) });
        return { count: 0, bytes: 0, files: [] }; 
    }
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
                // Missions/Achiev proofs : essaye d'abord l'ancien chemin public (post-migration),
                // puis private_uploads (F-17) — robuste quel que soit l'historique.
                const fileName = sub.proofUrl.split("/").pop();
                if (!fileName) continue;
                let physicalPath = join(cwd, "public", "uploads", "proofs", discordGuildId, fileName);
                let s = await stat(physicalPath).catch(() => null);
                if (!s) {
                    physicalPath = join(cwd, "private_uploads", "proofs", discordGuildId, fileName);
                    s = await stat(physicalPath).catch(() => null);
                }
                if (!s) continue;
                pendingFiles.push({
                    filename: fileName || sub.id,
                    url: sub.proofUrl, sizeBytes: s.size,
                    createdAt: sub.createdAt,
                    expiresAt: new Date(sub.createdAt.getTime() + EXPIRY_MS),
                    submissionId: sub.id, type: "MISSION",
                    memberName: sub.profile?.discordNickname || sub.profile?.pseudoDofus || "Membre",
                });
            } catch (err) { }
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
        for (const donation of kamaSubs) {
            if (!donation.proofUrl) continue;
            try {
                // Kamas are in /private_uploads/guilds/{id}/proofs/
                const fileName = donation.proofUrl.split("/").pop();
                const physicalPath = join(cwd, "private_uploads", "guilds", guildId, "proofs", fileName || "");
                const s = await stat(physicalPath);
                pendingFiles.push({
                    filename: fileName || donation.id,
                    url: donation.proofUrl, sizeBytes: s.size,
                    createdAt: donation.createdAt,
                    expiresAt: new Date(donation.createdAt.getTime() + EXPIRY_MS),
                    submissionId: donation.id, type: "KAMA",
                    memberName: donation.profile?.discordNickname || donation.profile?.pseudoDofus || "Membre",
                });
            } catch (err) { }
        }
    } catch { }


    return pendingFiles;
}

// ─── Main action ──────────────────────────────────────────────────────────────

export async function getStorageOverview(force = false): Promise<{ success: boolean; data?: StorageOverview; error?: string }> {
    if (!(await isSuperAdmin())) return { success: false, error: "Super admin requis" };

    // `force=true` → invalide le cache court (60s) pour un re-scan immédiat.
    if (force) storageScanCache = null;

    // Cache court (60s) — évite le re-scan récursif du disque à chaque ouverture.
    if (storageScanCache && Date.now() - storageScanCache.at < STORAGE_SCAN_CACHE_TTL_MS) {
        return { success: true, data: storageScanCache.data };
    }

    try {
        const guilds = await db.guildConfig.findMany({
            select: {
                id: true, discordGuildId: true, name: true,
                iconUrl: true,
                presentationBannerUrl: true,
                presentationBannerType: true,
                presentationPhotoUrl: true,
                storageLimitBytes: true,
            } as any,
            orderBy: { name: "asc" },
        });

        const cwd = process.cwd();

        const entries: StorageGuildEntry[] = await Promise.all(
            guilds.map(async (g: any) => {
                const missionsDir = join(cwd, "private_uploads", "proofs", g.discordGuildId);
                const kamaDir = join(cwd, "private_uploads", "guilds", g.id, "proofs");
                const presentationDir = join(cwd, "private_uploads", "guilds", g.id, "presentation");

                const achievementDir = join(cwd, "private_uploads", "guilds", g.id, "achievements");

                const missionsUrlBase = `/api/storage/proofs/${g.discordGuildId}`;
                const kamaUrlBase = `/api/storage/guilds/${g.id}/proofs`;
                const presentationUrlBase = `/api/storage/guilds/${g.id}/presentation`;
                const achievementUrlBase = `/api/storage/guilds/${g.id}/achievements`;

                const [missionsList, kamaList, presentationList, achievementList, pendingFiles] = await Promise.all([
                    dirList(missionsDir, missionsUrlBase),
                    dirList(kamaDir, kamaUrlBase),
                    dirList(presentationDir, presentationUrlBase),
                    dirList(achievementDir, achievementUrlBase),
                    getPendingFilesForGuild(g.id, g.discordGuildId, cwd),
                ]);

                // Enrich disk files with pending status and expiry info
                const enrich = (files: DiskFile[]) => {
                    return files.map(df => {
                        const pending = (pendingFiles || []).find(pf => pf.filename === df.filename);
                        if (pending) {
                            return { ...df, isPending: true, expiresAt: pending.expiresAt };
                        }
                        return df;
                    });
                };

                // Les fichiers du dossier /proofs/ sont partagés entre Kama Donations et Prêts/Coffre
                const activeLoanProofs = await Promise.all([
                    db.guildLoan.count({ where: { guildId: g.id, proofUrl: { not: null } } }),
                    db.vaultEntry.count({ where: { guildId: g.id, proofUrl: { not: null } } }),
                ]).then(([loans, vault]) => loans + vault);

                const [pendingMissions, pendingKamas] = await Promise.all([
                    db.submission.count({ where: { mission: { guildId: g.id }, status: "PENDING" } }),
                    (kamaDb as any).kamaDonation
                        ? (kamaDb as any).kamaDonation.count({ where: { guildId: g.id, status: "PENDING" } }).catch(() => 0)
                        : Promise.resolve(0),
                ]);

                // Seuil & utilisation (défaut global si non surchargé par guilde)
                const totalBytes = missionsList.bytes + kamaList.bytes + achievementList.bytes + presentationList.bytes;
                const limitBytes = g.storageLimitBytes != null ? Number(g.storageLimitBytes) : DEFAULT_GUILD_STORAGE_LIMIT;
                const usagePercent = limitBytes > 0 ? Math.round((totalBytes / limitBytes) * 100) : 0;
                const overLimit = totalBytes > limitBytes;

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
                    missionsFiles: enrich(missionsList.files),
                    kamaDir: normalize(kamaDir).replace(cwd, "").replace(/\\/g, "/"),
                    kamaCount: kamaList.count,
                    kamaBytes: kamaList.bytes,
                    kamaFiles: enrich(kamaList.files),
                    achievementDir: normalize(achievementDir).replace(cwd, "").replace(/\\/g, "/"),
                    achievementCount: achievementList.count,
                    achievementBytes: achievementList.bytes,
                    achievementFiles: enrich(achievementList.files),
                    presentationDir: normalize(presentationDir).replace(cwd, "").replace(/\\/g, "/"),
                    presentationCount: presentationList.count,
                    presentationBytes: presentationList.bytes,
                    presentationFiles: enrich(presentationList.files),
                    loansProofsDir: normalize(kamaDir).replace(cwd, "").replace(/\\/g, "/"),
                    loansProofsCount: kamaList.count,
                    loansProofsBytes: kamaList.bytes,
                    loansProofsFiles: enrich(kamaList.files),
                    activeLoanProofs,
                    pendingMissions,
                    pendingKamas,
                    pendingFiles: pendingFiles || [],
                    assets,
                    totalBytes,
                    limitBytes,
                    usagePercent,
                    overLimit,
                };
            })
        );

        // ─── Alertes seuil de stockage (God, dedup 24h par guilde) ──────────────
        for (const e of entries) {
            if (!e.overLimit) continue;
            try {
                const alerted = await redis.get(STORAGE_ALERT_KEY(e.guildId));
                if (alerted) continue;
                const { notifyGod } = await import("@/server/actions/god-notif-actions");
                await notifyGod({
                    title: `⚠️ Stockage dépassé : ${e.name}`,
                    message: `${e.name} consomme ${(e.totalBytes / 1024 / 1024).toFixed(1)} Mo pour un seuil de ${(e.limitBytes / 1024 / 1024).toFixed(0)} Mo (${e.usagePercent}%). Nettoyage automatique des captures après 7 jours — pensez à ajuster la limite si nécessaire.`,
                    type: "SYSTEM",
                    success: false,
                    metadata: { guildId: e.guildId, totalMo: Math.round(e.totalBytes / 1024 / 1024), limitMo: Math.round(e.limitBytes / 1024 / 1024), usage: `${e.usagePercent}%` },
                });
                await redis.set(STORAGE_ALERT_KEY(e.guildId), "1", "EX", STORAGE_ALERT_TTL_S);
            } catch (err) {
                logger.warn("[StorageAlert] failed", { error: String(err), guildId: e.guildId });
            }
        }


        // Calculate true orphan files
        // First get all valid DB references
        const dbProofsArray = await Promise.all([
            db.submission.findMany({ where: { proofUrl: { not: "" } }, select: { proofUrl: true } }),
            (kamaDb as any).kamaDonation ? (kamaDb as any).kamaDonation.findMany({ where: { proofUrl: { not: "" } }, select: { proofUrl: true } }).catch(() => []) : Promise.resolve([]),
            db.guildLoan.findMany({ where: { proofUrl: { not: null } }, select: { proofUrl: true } }),
            db.vaultEntry.findMany({ where: { proofUrl: { not: null } }, select: { proofUrl: true } })
        ]);

        const allValidUrls = new Set<string>();
        dbProofsArray.flat().forEach((entry: any) => {
            if (entry.proofUrl) {
                // Keep only the filename for easy cross-referencing to avoid path discrepancies
                const filename = entry.proofUrl.split(/[/\\]/).pop();
                if (filename) allValidUrls.add(filename);
            }
        });

        // Totaux globaux : inclure aussi présentation + succès (pas seulement missions/kamas).
        const totalBytes = entries.reduce((s, e) => s + e.missionsBytes + e.kamaBytes + e.presentationBytes + e.achievementBytes, 0);
        const totalFiles = entries.reduce((s, e) => s + e.missionsCount + e.kamaCount + e.presentationCount + e.achievementCount, 0);
        
        const orphanFiles: DiskFile[] = [];
        const now = Date.now();
        const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

        entries.forEach(e => {
            const diskFiles = [...e.missionsFiles, ...e.kamaFiles];
            diskFiles.forEach(df => {
                const isPending = e.pendingFiles.some(pf => pf.filename === df.filename);
                // ONLY count as orphans if no DB reference, not pending, AND older than 4 hours (safety margin)
                if (!allValidUrls.has(df.filename) && !isPending) {
                    if (now - df.modifiedAt.getTime() > FOUR_HOURS_MS) {
                        orphanFiles.push(df);
                    }
                }
            });
        });

        const result = { success: true as const, data: { guilds: entries, totalBytes, totalFiles, orphanFiles } };
        storageScanCache = { at: Date.now(), data: result.data };
        return result;
    } catch (error) {
        logger.error("[getStorageOverview]", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

// ─── Auto-Deletion / Garbage Collection ──────────────────────────────────────

/**
 * Triggers a global garbage collection of all uploaded files.
 * Scans the physical disk and safely removes any files older than 4 hours 
 * that have no corresponding record in the database.
 */
export async function cleanOrphanStorage(): Promise<{ success: boolean; deletedCount?: number; freedBytes?: number; error?: string }> {
    if (!(await isSuperAdmin())) return { success: false, error: "Super admin requis" };

    // #55 — rate-limit action destructive (purge globale).
    const rl = await rateLimit("god:storage:clean-orphans", 5, 60_000);
    if (!rl.success) return { success: false, error: "Trop de purges. Réessayez dans une minute." };

    try {
        const overviewRes = await getStorageOverview();
        if (!overviewRes.success || !overviewRes.data) throw new Error("Could not fetch storage overview");

        const data = overviewRes.data;

        // Fetch valid DB references again to be 100% sure before deletion
        const dbProofsArray = await Promise.all([
            db.submission.findMany({ where: { proofUrl: { not: "" } }, select: { proofUrl: true } }),
            (kamaDb as any).kamaDonation ? (kamaDb as any).kamaDonation.findMany({ where: { proofUrl: { not: "" } }, select: { proofUrl: true } }).catch(() => []) : Promise.resolve([]),
            db.guildLoan.findMany({ where: { proofUrl: { not: null } }, select: { proofUrl: true } }),
            db.vaultEntry.findMany({ where: { proofUrl: { not: null } }, select: { proofUrl: true } })
        ]);

        const validFilenames = new Set<string>();
        dbProofsArray.flat().forEach((entry: any) => {
            if (entry.proofUrl) validFilenames.add(entry.proofUrl.split(/[/\\]/).pop());
        });

        let deletedCount = 0;
        let freedBytes = 0;
        const now = Date.now();
        const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

        for (const guild of data.guilds) {
            const allDiskFiles = [...guild.missionsFiles, ...guild.kamaFiles];
            const pendingFilenames = new Set(guild.pendingFiles.map(f => f.filename));

            for (const file of allDiskFiles) {
                // Ensure the file is not actively attached to a DB record and not pending
                if (!validFilenames.has(file.filename) && !pendingFilenames.has(file.filename)) {
                    // Safety check: Only delete if older than 4 hours (grace period for uploads in progress)
                    if (now - file.modifiedAt.getTime() > FOUR_HOURS_MS) {
                        // Normalize path join to avoid any leading slash issues
                        const relativeFileUrl = file.url.replace(/^\/uploads\//, "").replace(/^\/api\/storage\//, "");
                        const physicalPath = normalize(join(process.cwd(), "private_uploads", relativeFileUrl));
                        
                        try {
                            if (existsSync(physicalPath)) {
                                await unlink(physicalPath);
                                deletedCount++;
                                freedBytes += file.sizeBytes;
                            }
                        } catch (err) {
                            logger.error(`[StorageCleanup] Failed to unlink ${physicalPath}`, { error: String(err) });
                        }
                    }
                }
            }
        }

        if (deletedCount > 0) {
            logger.info(`[StorageCleanup] Cleaned ${deletedCount} orphan files (${(freedBytes/1024/1024).toFixed(2)} MB freed).`);
        }

        return { success: true, deletedCount, freedBytes };
    } catch (error) {
        logger.error("[cleanOrphanStorage]", { error: String(error) });
        return { success: false, error: "Erreur lors du nettoyage" };
    }
}

// ─── God-only: delete a file directly from VPS + clear DB field ──────────────

export type AssetDbField = "iconUrl" | "presentationBannerUrl" | "presentationPhotoUrl";

/**
 * Après une suppression God, purge les références DB pointant vers ce fichier
 * (preuves de prêts/coffre/kamas/missions/succès) pour éviter les images cassées
 * et les références mortes. Best-effort : chaque table est traitée en try/catch.
 */
async function clearProofDbReferences(fileUrl: string): Promise<void> {
    if (!fileUrl) return;
    const tasks: Promise<unknown>[] = [];
    try {
        tasks.push(db.guildLoan.updateMany({ where: { proofUrl: fileUrl }, data: { proofUrl: null } }));
        tasks.push(db.guildLoan.updateMany({ where: { returnProofUrl: fileUrl }, data: { returnProofUrl: null } }));
    } catch { /* best-effort */ }
    try {
        tasks.push(db.vaultEntry.updateMany({ where: { proofUrl: fileUrl }, data: { proofUrl: null } }));
    } catch { /* best-effort */ }
    try {
        tasks.push((kamaDb as any).kamaDonation.updateMany({ where: { proofUrl: fileUrl }, data: { proofUrl: null } }).catch(() => {}));
    } catch { /* best-effort */ }
    try {
        tasks.push(db.submission.updateMany({ where: { proofUrl: fileUrl }, data: { proofUrl: "" } }));
        tasks.push((db as any).achievementSubmission.updateMany({ where: { proofUrl: fileUrl }, data: { proofUrl: "" } }).catch(() => {}));
    } catch { /* best-effort */ }
    await Promise.all(tasks.map((t) => t.catch(() => {})));
}

export async function godDeleteFile(
    fileUrl: string,
    dbClear?: { guildId: string; field: AssetDbField }
): Promise<{ success: boolean; error?: string; message?: string; deletedPath?: string }> {
    if (!(await isSuperAdmin())) return { success: false, error: "Super admin requis" };

    // #55 — rate-limit suppression de fichier (action destructive).
    const rl = await rateLimit("god:storage:delete-file", 20, 60_000);
    if (!rl.success) return { success: false, error: "Trop de suppressions. Réessayez dans une minute." };

    if (!fileUrl.startsWith("/uploads/") && !fileUrl.startsWith("/api/storage/")) {
        return { success: false, error: "Chemin non autorisé (doit commencer par /uploads/ ou /api/storage/)" };
    }

    const physicalPath = fileUrl.replace(/^\/uploads\//, "").replace(/^\/api\/storage\//, "");
    const absolutePath = normalize(join(process.cwd(), "private_uploads", physicalPath));
    const storageRoot = normalize(join(process.cwd(), "private_uploads"));

    if (!absolutePath.startsWith(storageRoot)) {
        return { success: false, error: "Path traversal détecté — opération refusée." };
    }

    try {
        await unlink(absolutePath);
        logger.info(`[God] Superadmin deleted file: ${fileUrl} (target: ${absolutePath})`);
    } catch (error: any) {
        if (error.code !== "ENOENT") {
            logger.error(`[God] Failed to delete file: ${absolutePath}`, { error });
            return { success: false, error: `Erreur suppression physique (${error.code}) sur : ${absolutePath}` };
        }
        // ENOENT = already gone
        logger.warn(`[God] File already missing on disk: ${absolutePath}`);
    }

    // Clear the DB field so the asset disappears from the panel immediately
    const allowedFields: AssetDbField[] = ["iconUrl", "presentationBannerUrl", "presentationPhotoUrl"];
    if (dbClear?.guildId && dbClear?.field && allowedFields.includes(dbClear.field)) {
        try {
            await (db as any).guildConfig.update({
                where: { id: dbClear.guildId },
                data: { [dbClear.field]: null },
            });
            logger.info(`[God] Cleared DB field ${dbClear.field} for guild ${dbClear.guildId}`);
        } catch (dbErr) {
            logger.error("[God] Failed to clear DB field:", { error: dbErr });
        }
    }

    // 🔗 Purge des références de preuves (prêts/coffre/kamas/missions/succès) pour
    // ne jamais laisser d'image cassée ni de référence morte après suppression.
    await clearProofDbReferences(fileUrl);

    return { 
        success: true, 
        message: "Opération terminée", 
        deletedPath: absolutePath 
    };
}

/**
 * Seuil de stockage personnalisé par guilde (octets).
 * NULL → seuil global par défaut (512 Mo). Réservé super-admin.
 */
export async function setGuildStorageLimit(
    guildId: string,
    limitBytes: number | null
): Promise<{ success: boolean; error?: string }> {
    if (!(await isSuperAdmin())) return { success: false, error: "Super admin requis" };
    if (limitBytes !== null && (!Number.isFinite(limitBytes) || limitBytes < 0)) {
        return { success: false, error: "Limite invalide (doit être un entier ≥ 0)" };
    }
    const rl = await rateLimit("god:storage:set-limit", 30, 60_000);
    if (!rl.success) return { success: false, error: "Trop de modifications. Réessayez dans une minute." };

    try {
        await (db as any).guildConfig.update({
            where: { id: guildId },
            data: { storageLimitBytes: limitBytes === null ? null : BigInt(limitBytes) },
        });
        // Invalide le cache du scan pour refléter la nouvelle limite immédiatement.
        storageScanCache = null;
        return { success: true };
    } catch (error) {
        logger.error("[setGuildStorageLimit]", { error: String(error), guildId });
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Volume de logs par guilde (30 derniers jours) + totaux globaux.
 * - ServiceActivityLog (logs d'activité services/modules par guilde)
 * - AuditLog (logs d'audit sécurité par guilde, isGodLog=false)
 * Réservé super-admin.
 */
export async function getGuildLogsStats(): Promise<{
    success: boolean;
    data?: { rows: { guildId: string; name: string; serviceLogs: number; auditLogs: number; total: number }[]; totals: { serviceLogs: number; auditLogs: number; total: number } };
    error?: string;
}> {
    if (!(await isSuperAdmin())) return { success: false, error: "Super admin requis" };

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const guilds = await db.guildConfig.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
    });

    const rows = await Promise.all(
        guilds.map(async (g) => {
            const [serviceLogs, auditLogs] = await Promise.all([
                db.serviceActivityLog.count({ where: { guildId: g.id, createdAt: { gte: since } } }),
                db.auditLog.count({ where: { guildId: g.id, isGodLog: false, createdAt: { gte: since } } }).catch(() => 0),
            ]);
            return { guildId: g.id, name: g.name, serviceLogs, auditLogs, total: serviceLogs + auditLogs };
        })
    );

    rows.sort((a, b) => b.total - a.total);
    const totals = rows.reduce(
        (acc, r) => ({ serviceLogs: acc.serviceLogs + r.serviceLogs, auditLogs: acc.auditLogs + r.auditLogs, total: acc.total + r.total }),
        { serviceLogs: 0, auditLogs: 0, total: 0 }
    );

    return { success: true, data: { rows, totals } };
}
