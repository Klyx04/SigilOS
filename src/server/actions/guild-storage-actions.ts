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

    // 🔐 CodeQL / Uncontrolled path — le dossier missions est construit avec le
    // discordGuildId fourni par l'utilisateur : on exige un snowflake strict
    // (17-20 chiffres) et on borne chaque chemin sous private_uploads.
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

    const [missions, kamaLoans, achievements, presentation, assets] = await Promise.all([
        dirSizeBytes(buildDir("proofs", guildId)),
        dirSizeBytes(buildDir("guilds", guild.id, "proofs")),
        dirSizeBytes(buildDir("guilds", guild.id, "achievements")),
        dirSizeBytes(buildDir("guilds", guild.id, "presentation")),
        dirSizeBytes(buildDir("guilds", guild.id)), // icône/bannière/photo (fichiers directs)
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
                { key: "KAMA_LOANS", label: "Kamas, Prêts & Coffre", bytes: kamaLoans.bytes, files: kamaLoans.count },
                { key: "ACHIEVEMENT", label: "Succès", bytes: achievements.bytes, files: achievements.count },
                { key: "PRESENTATION", label: "Présentation", bytes: presentation.bytes, files: presentation.count },
                { key: "ASSETS", label: "Icône & Bannière", bytes: assets.bytes, files: assets.count },
            ],
        },
    };
}