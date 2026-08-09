"use server";

import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { isSuperAdmin } from "./super-admin-actions";
import { logger } from "@/lib/logger";
import { sanitizeHtml } from "@/lib/security";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AlmanaxItem {
    date: string;
    bonus: {
        description: string;
        type: { name: string };
    };
    tribute: {
        item: {
            name: string;
            image_urls: { icon: string; sd: string };
        };
        quantity: number;
    };
    reward_kamas?: number;
}

// ─── Almanax (7 prochains jours) ─────────────────────────────────────────────

export async function getUpcomingAlmanax(): Promise<AlmanaxItem[]> {
    const url = "https://api.dofusdu.de/dofus3/v1/fr/almanax?timezone=Europe/Paris&range%5Bsize%5D=30";

    // 1. Direct fetch
    try {
        const res = await fetch(url, {
            headers: {
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            },
            next: { revalidate: 3600 * 6 }, // Cache 6h
        });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) return data as AlmanaxItem[];
            logger.warn("Direct fetch for Almanax returned non-array data");
            return [];
        }
        logger.warn("Direct fetch for Almanax failed", { status: res.status });
    } catch (e: unknown) {
        logger.warn("Direct fetch for Almanax error", { error: (e as Error).message });
    }

    // 2. Proxy Fallback (AllOrigins)
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    try {
        const pRes = await fetch(proxyUrl, {
            headers: { "User-Agent": "SigilOS/1.0" },
            next: { revalidate: 3600 * 6 },
        });

        if (pRes.ok) {
            const text = await pRes.text();
            const json = JSON.parse(text);
            if (json.contents) {
                const parsed = JSON.parse(json.contents);
                if (Array.isArray(parsed)) return parsed as AlmanaxItem[];
            }
        }
    } catch (e: unknown) {
        logger.warn("Proxy fetch for Almanax error", { error: (e as Error).message });
    }

    return [];
}

// ─── Resources Management ───────────────────────────────────────────────────

async function getDbGuildId(id: string): Promise<string> {
    if (!id) return id;
    // If it looks like a CUID (starts with c and long), assume it's already a DB ID
    if (id.startsWith('c') && id.length >= 20) return id;

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId: id },
        select: { id: true }
    });

    if (!guild) {
        logger.error(`[Resources] Could not resolve GuildConfig CUID for Discord ID: ${id}`);
        // If it's a numeric ID but not in DB, we're in trouble for foreign keys
        return id;
    }
    return guild.id;
}

export async function getResourceCategories(guildId: string) {
    const targetId = await getDbGuildId(guildId);
    const categories = await db.resourceCategory.findMany({
        where: { guildId: targetId },
        include: { links: { orderBy: { order: "asc" } } },
        orderBy: { order: "asc" }
    });

    if (categories.length === 0) {
        const defaultCats = [
            {
                label: "Référence & Quêtes", color: "#10b981", order: 0,
                links: [
                    { title: "Dofus Pour Les Noobs", description: "Le wiki ultime pour toutes les quêtes et donjons", url: "https://www.dofuspourlesnoobs.com", emoji: "📖" },
                    { title: "Metamob", description: "Outil indispensable pour l'Éternelle Moisson (Ocre)", url: "https://www.metamob.fr/", emoji: "🐙" },
                    { title: "Barbofus", description: "Aides, quêtes et outils pratiques", url: "https://barbofus.com/", emoji: "🧔" },
                    { title: "Dofensive", description: "Sorts, IA et résistances précises de chaque monstre", url: "https://dofensive.com", emoji: "🛡️" },
                    { title: "Ganymède", description: "Application d'outils et gestion de personnages", url: "https://ganymede-app.com/about", emoji: "🦅" },
                ]
            },
            {
                label: "Builds & Solveurs", color: "#a855f7", order: 1,
                links: [
                    { title: "DofusRoom & Insight", description: "Calculateur de builds avancé et statistiques PvP", url: "https://www.dofusroom.com/insightroom", emoji: "📈" },
                    { title: "DofusBook", description: "Simulateur d'équipement et de stuff complet", url: "https://www.dofusbook.net", emoji: "⚔️" },
                    { title: "Comte Harebourg", description: "Solveurs tactiques et mini-jeux Dofus", url: "https://www.comteharebourg.com/", emoji: "🦉" },
                ]
            },
            {
                label: "Économie & Métiers", color: "#f59e0b", order: 2,
                links: [
                    { title: "Huzounet", description: "Outils de forgemagie, rentabilité et élevage", url: "https://huzounet.fr/", emoji: "🔨" },
                    { title: "Dofus-Map", description: "Carte interactive des nœuds de récolte par métier", url: "https://dofus-map.com", emoji: "🗺️" },
                    { title: "XP Familiers", description: "Tableau détaillé de l'expérience des familiers", url: "https://www.dofustool.com/tableau-xp-familier-dofus/", emoji: "🐾" },
                    { title: "DofusDB", description: "Base complète pour objets, monstres, recettes", url: "https://dofusdb.fr/", emoji: "📚" },
                ]
            },
            {
                label: "Officiel Ankama", color: "#ef4444", order: 3,
                links: [
                    { title: "Site Officiel Dofus", description: "Portail officiel du jeu et de la communauté", url: "https://www.dofus.com/fr", emoji: "🌐", isOfficial: true },
                    { title: "Ankama Forum (Discord)", description: "Rejoins le Discord officiel Dofus pour les annonces", url: "https://discord.gg/dofus", emoji: "💬", isOfficial: true },
                ]
            },
        ];

        for (const cat of defaultCats) {
            await db.resourceCategory.create({
                data: {
                    label: cat.label, color: cat.color, order: cat.order, guildId: targetId,
                    links: { create: cat.links.map((l: any, idx) => ({ ...l, order: idx })) }
                }
            });
        }
        return await db.resourceCategory.findMany({ where: { guildId: targetId }, include: { links: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } });
    }
    return categories;
}

export async function upsertResourceCategory(guildId: string, data: any) {
    if (!(await isSuperAdmin())) throw new Error("Unauthorized");
    const targetId = await getDbGuildId(guildId);
    const res = await db.resourceCategory.upsert({
        where: { id: data.id || "new-cat" },
        update: { label: data.label, color: data.color, order: data.order },
        create: { guildId: targetId, label: data.label, color: data.color, order: data.order }
    });
    revalidatePath(`/dashboard/${guildId}/ressources`);
    return { success: true, data: res };
}

export async function deleteResourceCategory(id: string, guildId: string) {
    if (!(await isSuperAdmin())) throw new Error("Unauthorized");
    await db.resourceCategory.delete({ where: { id } });
    revalidatePath(`/dashboard/${guildId}/ressources`);
    return { success: true };
}

export async function upsertResourceLink(guildId: string, data: any) {
    if (!(await isSuperAdmin())) throw new Error("Unauthorized");
    // SECURITY (F-11): sanitize free-text HTML fields (description) and bound/validate URL
    const description = sanitizeHtml(data.description ?? null, 2000) || null;
    const url = typeof data.url === "string" ? data.url.slice(0, 2048) : "";
    const title = typeof data.title === "string" ? data.title.slice(0, 200) : "";
    const res = await db.resourceLink.upsert({
        where: { id: data.id || "new-link" },
        update: { title, description, url, emoji: data.emoji, isOfficial: data.isOfficial, order: data.order },
        create: { categoryId: data.categoryId, title, description, url, emoji: data.emoji || "🔗", isOfficial: data.isOfficial || false, order: data.order }
    });
    revalidatePath(`/dashboard/${guildId}/ressources`);
    return { success: true, data: res };
}

export async function deleteResourceLink(id: string, guildId: string) {
    if (!(await isSuperAdmin())) throw new Error("Unauthorized");
    await db.resourceLink.delete({ where: { id } });
    revalidatePath(`/dashboard/${guildId}/ressources`);
    return { success: true };
}

// ─── Content Creators ─────────────────────────────────────────────────────────

export async function getContentCreators(guildId: string) {
    try {
        const targetId = await getDbGuildId(guildId);
        let creators = await db.contentCreator.findMany({
            where: { guildId: targetId },
            orderBy: { order: "asc" }
        });

        const defaultCreators = [
            { name: "Huz", role: "Forgemagie & Économie", youtube: "https://www.youtube.com/@Huzounet", twitch: "https://www.twitch.tv/huzounet", handle: "huzounet", color: "#fb923c", order: 0 },
            { name: "Skyzio", role: "PvM & Astuces", youtube: "https://www.youtube.com/@Skyzio", twitch: "https://www.twitch.tv/skyzio_", handle: "skyzio", color: "#3b82f6", order: 1 },
            { name: "Lanyelle", role: "Lore & Quêtes", youtube: "https://www.youtube.com/@Laniyelle", twitch: "https://www.twitch.tv/laniyelle", handle: "laniyelle", color: "#a855f7", order: 2 },
            { name: "Barbofus", role: "Guides & Aventure", youtube: "https://www.youtube.com/@BarbeDouce-YT", twitch: "https://www.twitch.tv/barbe___douce", handle: "barbe", color: "#10b981", order: 3 },
            { name: "Sapeuh", role: "PvP & E-sport", youtube: "https://www.youtube.com/@SAPEUH1", twitch: "https://www.twitch.tv/sapeuh", handle: "sapeuh", color: "#ef4444", order: 4 },
            { name: "Liche", role: "Solotage & Succès", youtube: "https://www.youtube.com/@Liche_fr", twitch: "https://www.twitch.tv/lichefr", handle: "liche", color: "#facc15", order: 5 },
            { name: "Volcasaurus", role: "Défis & Solotages", youtube: "https://www.youtube.com/@volcasaurus4500", twitch: "https://www.twitch.tv/volcatwitch", handle: "volcatwitch", color: "#22d3ee", order: 6 },
            { name: "Humility", role: "Guides & Actualités", youtube: "https://www.youtube.com/@humilityfr", twitch: "https://www.twitch.tv/humility", handle: "humility", color: "#f59e0b", order: 7 },
        ];

        // 1. If empty, full population
        if (creators.length === 0) {
            for (const c of defaultCreators) {
                await db.contentCreator.create({ data: { ...c, guildId: targetId } });
            }
            creators = await db.contentCreator.findMany({ where: { guildId: targetId }, orderBy: { order: "asc" } });
        } else {
            // 2. If already exists, check if new ones (Volca/Humility) are missing
            const currentNames = creators.map(c => c.name);
            const missing = defaultCreators.filter(dc => !currentNames.includes(dc.name));

            if (missing.length > 0) {
                for (const m of missing) {
                    await db.contentCreator.create({ data: { ...m, guildId: targetId } });
                }
                creators = await db.contentCreator.findMany({ where: { guildId: targetId }, orderBy: { order: "asc" } });
            }
        }
        return creators;
    } catch (e) {
        logger.error("Failed to get content creators", { error: (e as Error).message });
        return [];
    }
}

export async function upsertContentCreator(guildId: string, data: any) {
    if (!(await isSuperAdmin())) throw new Error("Unauthorized");
    const targetId = await getDbGuildId(guildId);

    // Clean handles to avoid logic breaks (remove @ from handle if it's there)
    const cleanHandle = data.handle?.replace('@', '').toLowerCase();

    const res = await db.contentCreator.upsert({
        where: { id: data.id || "new-creator" },
        update: { name: data.name, role: data.role, youtube: data.youtube, twitch: data.twitch, handle: cleanHandle, color: data.color, order: data.order },
        create: { guildId: targetId, name: data.name, role: data.role, youtube: data.youtube, twitch: data.twitch, handle: cleanHandle, color: data.color, order: data.order }
    });

    revalidatePath(`/dashboard/${guildId}/ressources`);
    return { success: true, data: res };
}

export async function deleteContentCreator(id: string, guildId: string) {
    if (!(await isSuperAdmin())) throw new Error("Unauthorized");
    await db.contentCreator.delete({ where: { id } });
    revalidatePath(`/dashboard/${guildId}/ressources`);
    return { success: true };
}
