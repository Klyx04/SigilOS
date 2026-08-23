"use server";

import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { isSuperAdmin } from "./super-admin-actions";
import { logger } from "@/lib/logger";
import { sanitizeHtml } from "@/lib/security";
import { auth } from "@/auth";
import { getUserContext } from "./user-actions";

// ─── Guards ────────────────────────────────────────────────────────────────────

/**
 * #127 — Délégation God → officiers : autorise la gestion des liens/catégories/
 * créateurs de la page Ressources pour les admins de guilde disposant de la
 * permission `resources:manage` (RBAC). Le God reste toujours autorisé.
 * L'isolation guilde est garantie par getUserContext(guildId).
 */
async function requireResourcesManage(guildId: string): Promise<void> {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Non authentifié");
    const superAdmin = await isSuperAdmin();
    if (superAdmin) return;
    const userCtx = await getUserContext(guildId);
    if (!userCtx.canManageResources) {
        throw new Error("Accès refusé : permission « Gérer les Ressources » requise");
    }
}

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
        // #127 — les guildes neuves reçoivent les catégories/liens officiels gérés par le
        // God dans la guilde de référence (/god/resources) au lieu du pool codé en dur.
        const referenceGuild = await db.guildConfig.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: "asc" as const },
            select: { id: true },
        });
        if (referenceGuild && referenceGuild.id !== targetId) {
            const refCats = await db.resourceCategory.findMany({
                where: { guildId: referenceGuild.id },
                include: { links: { orderBy: { order: "asc" } } },
                orderBy: { order: "asc" },
            });
            if (refCats.length > 0) {
                for (const cat of refCats) {
                    await db.resourceCategory.create({
                        data: {
                            label: cat.label, color: cat.color, order: cat.order, guildId: targetId,
                            links: {
                                create: (cat.links || []).map((l: any, idx: number) => ({
                                    title: l.title, description: l.description, url: l.url,
                                    emoji: l.emoji, isOfficial: l.isOfficial || false, order: l.order ?? idx,
                                })),
                            },
                        },
                    });
                }
                return await db.resourceCategory.findMany({
                    where: { guildId: targetId },
                    include: { links: { orderBy: { order: "asc" } } },
                    orderBy: { order: "asc" },
                });
            }
        }

        const defaultCats = [
            {
                label: "Référence & Quêtes", color: "#10b981", order: 0,
                links: [
                    { title: "Dofus Pour Les Noobs", description: "Le wiki ultime pour toutes les quêtes et donjons", url: "https://www.dofuspourlesnoobs.com", emoji: "📖" },
                    { title: "Metamob", description: "Outil indispensable pour l'Éternelle Moisson (Ocre)", url: "https://www.metamob.fr/", emoji: "🐙" },
                    { title: "Barbofus", description: "Aides, quêtes et outils pratiques", url: "https://barbofus.com/", emoji: "🧔" },
                    { title: "Dofensive", description: "Sorts, IA et résistances précises de chaque monstre", url: "https://dofensive.com", emoji: "🛡️" },
                    { title: "Ganymède", description: "Application d'outils et gestion de personnages", url: "https://ganymede-app.com/about", emoji: "🦅" },
                    { title: "Doflinks", description: "Annuaire exhaustif de tous les outils et sites Dofus", url: "https://doflinks.fr/", emoji: "🔗" },
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
                label: "Économie, FM & Élevage", color: "#f59e0b", order: 2,
                links: [
                    { title: "Dofocus", description: "Simulateur et calcul du coefficient de brisage d'items", url: "https://dofocus.fr/guide", emoji: "💥" },
                    { title: "Dofus Élevage", description: "Généalogie, cycles de gestation et gestion d'enclos", url: "https://dofuselevage.fr/guide", emoji: "🐴" },
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
    await requireResourcesManage(guildId);
    const targetId = await getDbGuildId(guildId);

    // #127 — isolation : un officier ne peut modifier/supprimer que SA guilde.
    if (data?.id) {
        const existing = await db.resourceCategory.findFirst({
            where: { id: data.id, guildId: targetId },
            select: { id: true },
        });
        if (!existing) throw new Error("Accès refusé : cette catégorie n'appartient pas à votre guilde");
    }

    const res = await db.resourceCategory.upsert({
        where: { id: data.id || "new-cat" },
        update: { label: data.label, color: data.color, order: data.order },
        create: { guildId: targetId, label: data.label, color: data.color, order: data.order }
    });
    revalidatePath(`/dashboard/${guildId}/ressources`);
    return { success: true, data: res };
}

export async function deleteResourceCategory(id: string, guildId: string) {
    await requireResourcesManage(guildId);
    const targetId = await getDbGuildId(guildId);

    // #127 — isolation : fail-closed si la catégorie n'appartient pas à la guilde.
    const existing = await db.resourceCategory.findFirst({
        where: { id, guildId: targetId },
        select: { id: true },
    });
    if (!existing) throw new Error("Accès refusé : cette catégorie n'appartient pas à votre guilde");

    await db.resourceCategory.delete({ where: { id } });
    revalidatePath(`/dashboard/${guildId}/ressources`);
    return { success: true };
}

export async function upsertResourceLink(guildId: string, data: any) {
    await requireResourcesManage(guildId);
    const targetId = await getDbGuildId(guildId);

    // #127 — la catégorie cible doit appartenir à la guilde (pas de cross-guild via categoryId).
    if (!data?.categoryId) throw new Error("Catégorie manquante");
    const category = await db.resourceCategory.findFirst({
        where: { id: data.categoryId, guildId: targetId },
        select: { id: true },
    });
    if (!category) throw new Error("Accès refusé : cette catégorie n'appartient pas à votre guilde");

    // #127 — si édition d'un lien existant, il doit appartenir à la guilde.
    if (data?.id) {
        const existingLink = await db.resourceLink.findFirst({
            where: { id: data.id, category: { guildId: targetId } },
            select: { id: true },
        });
        if (!existingLink) throw new Error("Accès refusé : ce lien n'appartient pas à votre guilde");
    }

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
    await requireResourcesManage(guildId);
    const targetId = await getDbGuildId(guildId);

    // #127 — isolation : fail-closed si le lien n'appartient pas à la guilde.
    const existing = await db.resourceLink.findFirst({
        where: { id, category: { guildId: targetId } },
        select: { id: true },
    });
    if (!existing) throw new Error("Accès refusé : ce lien n'appartient pas à votre guilde");

    await db.resourceLink.delete({ where: { id } });
    revalidatePath(`/dashboard/${guildId}/ressources`);
    return { success: true };
}

// ─── Content Creators ─────────────────────────────────────────────────────────

export async function getContentCreators(guildId: string) {
    try {
        const targetId = await getDbGuildId(guildId);

        // #127 — Source officielle : les créateurs gérés par le God dans la guilde de
        // référence (/god/resources). Ajouts / MAJ / suppressions du God propagés à
        // TOUTES les guildes (l'UI God annonce « distribués sur toutes les guildes »).
        const referenceGuild = await db.guildConfig.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: "asc" as const },
            select: { id: true },
        });

        if (!referenceGuild) {
            return await db.contentCreator.findMany({
                where: { guildId: targetId },
                orderBy: { order: "asc" },
            });
        }

        const officialCreators = await db.contentCreator.findMany({
            where: { guildId: referenceGuild.id },
            orderBy: { order: "asc" },
        });

        // La guilde de référence EST la source → retour direct.
        if (referenceGuild.id === targetId) {
            return officialCreators;
        }

        let creators = await db.contentCreator.findMany({
            where: { guildId: targetId },
            orderBy: { order: "asc" },
        });

        const officialByHandle = new Map<string, any>();
        for (const off of officialCreators) {
            const key = String(off.handle || "").toLowerCase();
            if (key) officialByHandle.set(key, off);
        }

        let changed = false;

        // 1. Ajouts + MAJ (identifiant stable = handle).
        for (const off of officialCreators) {
            const key = String(off.handle || "").toLowerCase();
            if (!key) continue;
            const local = creators.find((c: any) => String(c.handle || "").toLowerCase() === key);
            if (!local) {
                await db.contentCreator.create({
                    data: {
                        guildId: targetId,
                        name: off.name?.trim(),
                        role: off.role?.trim(),
                        youtube: off.youtube?.trim(),
                        twitch: off.twitch?.trim(),
                        handle: off.handle,
                        color: off.color || "#3b82f6",
                        order: off.order ?? 0,
                    },
                });
                changed = true;
            } else if (
                local.name !== off.name ||
                local.role !== off.role ||
                local.youtube !== off.youtube ||
                local.twitch !== off.twitch ||
                local.color !== off.color ||
                local.order !== off.order
            ) {
                await db.contentCreator.update({
                    where: { id: local.id },
                    data: {
                        name: off.name?.trim(),
                        role: off.role?.trim(),
                        youtube: off.youtube?.trim(),
                        twitch: off.twitch?.trim(),
                        color: off.color || "#3b82f6",
                        order: off.order ?? 0,
                    },
                });
                changed = true;
            }
        }

        // 2. Suppressions : un créateur local qui suivait le pool officiel (handle connu)
        // et qui n'est plus dans la liste officielle → retiré (distribution God).
        // Les créateurs sans handle (ajouts manuels d'officiers) ne sont jamais touchés.
        for (const local of creators) {
            const key = String(local.handle || "").toLowerCase();
            if (!key) continue;
            if (officialByHandle.has(key)) continue;
            await db.contentCreator.delete({ where: { id: local.id } });
            changed = true;
        }

        if (changed) {
            creators = await db.contentCreator.findMany({
                where: { guildId: targetId },
                orderBy: { order: "asc" },
            });
        }

        return creators;
    } catch (e) {
        logger.error("Failed to get content creators", { error: (e as Error).message });
        return [];
    }
}

export async function upsertContentCreator(guildId: string, data: any) {
    await requireResourcesManage(guildId);

    const targetId = await getDbGuildId(guildId);

    // #127 — isolation : un officier ne modifie que les créateurs de SA guilde.
    if (data?.id) {
        const existing = await db.contentCreator.findFirst({
            where: { id: data.id, guildId: targetId },
            select: { id: true },
        });
        if (!existing) throw new Error("Accès refusé : ce créateur n'appartient pas à votre guilde");
    }

    // Limit guild creators to 50 max (#82)
    const existingCount = await db.contentCreator.count({
        where: { guildId: targetId }
    });
    if (!data.id && existingCount >= 50) {
        throw new Error("Limite atteinte : Maximum 50 créateurs autorisés par guilde.");
    }

    // Clean handles to avoid logic breaks (remove @ from handle if it's there)
    const cleanHandle = data.handle?.replace('@', '').toLowerCase().trim();

    const res = await db.contentCreator.upsert({
        where: { id: data.id || "new-creator" },
        update: { 
            name: data.name?.trim(), 
            role: data.role?.trim(), 
            youtube: data.youtube?.trim(), 
            twitch: data.twitch?.trim(), 
            handle: cleanHandle, 
            color: data.color || "#3b82f6", 
            order: data.order ?? 0 
        },
        create: { 
            guildId: targetId, 
            name: data.name?.trim(), 
            role: data.role?.trim(), 
            youtube: data.youtube?.trim(), 
            twitch: data.twitch?.trim(), 
            handle: cleanHandle, 
            color: data.color || "#3b82f6", 
            order: data.order ?? 0 
        }
    });

    revalidatePath(`/dashboard/${guildId}/ressources`);
    return { success: true, data: res };
}

export async function deleteContentCreator(id: string, guildId: string) {
    await requireResourcesManage(guildId);
    const targetId = await getDbGuildId(guildId);

    // #127 — isolation : fail-closed si le créateur n'appartient pas à la guilde.
    const existing = await db.contentCreator.findFirst({
        where: { id, guildId: targetId },
        select: { id: true },
    });
    if (!existing) throw new Error("Accès refusé : ce créateur n'appartient pas à votre guilde");

    await db.contentCreator.delete({ where: { id } });
    revalidatePath(`/dashboard/${guildId}/ressources`);
    return { success: true };
}

/**
 * Diagnostic de santé des liens externes de ressources (#82)
 */
export async function checkResourceLinksHealth(guildId: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const superAdmin = await isSuperAdmin();
    if (!superAdmin) return { success: false, error: "Réservé au SuperAdmin / God" };

    const categories = await getResourceCategories(guildId);
    const brokenLinks: { name: string; url: string; status: number | string }[] = [];

    const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

    for (const cat of categories) {
        for (const link of cat.links) {
            try {
                // Essai GET avec user-agent navigateur standard et suivi des redirections
                const res = await fetch(link.url, { 
                    method: "GET", 
                    signal: AbortSignal.timeout(8000),
                    redirect: "follow",
                    headers: { 
                        "User-Agent": BROWSER_UA,
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
                    }
                });

                // Si le site renvoie 2xx, 3xx ou 403/401 (Cloudflare WAF / protection bot), il est en ligne
                if (!res.ok && res.status !== 403 && res.status !== 401) {
                    brokenLinks.push({ name: link.title, url: link.url, status: res.status });
                }
            } catch (err: any) {
                brokenLinks.push({ name: link.title, url: link.url, status: "TIMEOUT_OR_UNREACHABLE" });
            }
        }
    }

    return { 
        success: true, 
        data: { 
            totalChecked: categories.reduce((acc, c) => acc + c.links.length, 0),
            brokenLinks 
        } 
    };
}
