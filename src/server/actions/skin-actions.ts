"use server";
import { logger } from "@/lib/logger";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { ActionResponse, getUserContext } from "./user-actions";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import * as cheerio from "cheerio";
import { DOFUS_CLASSES } from "@/lib/dofus-assets";

const SkinSchema = z.object({
    guildId: z.string(),
    url: z.string().url("URL invalide"),
    name: z.string().optional(),
    existingSkinId: z.string().optional()
});

export type SkinData = {
    name: string;
    thumbnailUrl: string | null;
    provider: "BARBOFUS" | "DOFUSSKINMANGA" | "OTHER";
    equipment?: any;
    colors?: any;
    metadata?: any;
};

/**
 * Detects the provider and extracts basic metadata (thumbnail, title)
 */
export async function scrapeSkinMetadata(url: string): Promise<SkinData> {
    const lowerUrl = url.toLowerCase();
    
    // 1. Barbofus (Extraction avancée: Couleurs + Items)
    if (lowerUrl.includes("barbofus.com")) {
        const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" } });
        const html = await res.text();
        const $ = cheerio.load(html);
        
        const colors: Record<string, string> = {};
        const equipment: any[] = [];

        // Extract Colors (Alpine.js structure)
        $('button').each((_, el) => {
            const label = $(el).find('p.text-lg').text().replace(' :', '').trim();
            if (label && (label.includes('Peau') || label.includes('Cheveux') || label.includes('Vêtements'))) {
                const styleAttr = $(el).find('div[style*="background-color"], div[:style*="background-color"]').attr(':style') || "";
                const hexMatch = styleAttr.match(/#?([a-fA-F0-9]{6})/);
                if (hexMatch) {
                    colors[label] = `#${hexMatch[1]}`;
                }
            }
        });

        // Extract Equipment — all item types (Objet vivant, Objet d'apparat, Mimibiotable, etc.)
        const BARBOFUS_ITEM_TYPES = new Set([
            "Objet d'apparat",
            "Objet vivant",
            "Mimibiotable",
            "Familier",
            "Dragodinde",
            "Monture",
        ]);

        $('p').each((_, el) => {
            const text = $(el).text().trim();
            if (BARBOFUS_ITEM_TYPES.has(text)) {
                const itemDiv = $(el).closest('div').next('div');
                if (itemDiv.length) {
                    const name = itemDiv.find('p').text().trim();
                    const icon = itemDiv.find('img').attr('src');
                    if (name) {
                        equipment.push({ name, type: text, icon });
                    }
                }
            }
        });

        
        // Extract Author (Robust)
        const author = $('h2:contains("par") span').first().text().trim() || 
                       $('h2:contains("par")').text().replace('par ', '').trim();

        // Metadata extraction (Robust positional selectors)
        let characterClass = $('div.justify-self-end p.text-secondary').first().text().trim();
        let gender = $('div.justify-self-start p.text-secondary').first().text().trim();

        // --- FUZZY FALLBACK ---
        // If selectors failed, search in the whole text for Dofus keywords
        const allText = $('body').text();
        const classes = ["Feca", "Osamodas", "Enutrof", "Sram", "Xelor", "Ecaflip", "Eniripsa", "Iop", "Cra", "Sadida", "Sacrieur", "Pandawa", "Roublard", "Zobal", "Steamer", "Eliotrope", "Huppermage", "Ouginak", "Forgelance"];
        
        if (!characterClass) {
            characterClass = classes.find(c => allText.includes(c)) || "";
        }
        if (!gender) {
            if (allText.includes("Homme") || allText.includes("♂")) gender = "Homme";
            else if (allText.includes("Femme") || allText.includes("♀")) gender = "Femme";
        }

        // Extract Face/Head icon
        const headIcon = $('img[alt="Visage"]').attr('src') || 
                         $('p:contains("Visage")').next('div').find('img').attr('src');
        
        // Extract Barbofus thumbnail image safely (support relative and protocol-relative URLs)
        const rawOgImg = $('meta[property="og:image"]').attr('content')?.trim() || 
                         $('meta[name="twitter:image"]').attr('content')?.trim() || 
                         $('img[alt*="Skin"]').attr('src')?.trim() || 
                         $('img[src*="/render/"]').attr('src')?.trim() || null;
        let barbofusThumb: string | null = null;
        if (rawOgImg) {
            try {
                barbofusThumb = rawOgImg.startsWith("//") ? `https:${rawOgImg}` : new URL(rawOgImg, url).href;
            } catch {
                barbofusThumb = rawOgImg;
            }
        }
        
        return {
            name: $('meta[property="og:title"]').attr('content')?.replace(" - Barbofus", "").trim() || "Skin Barbofus",
            thumbnailUrl: barbofusThumb,
            provider: "BARBOFUS",
            colors,
            equipment,
            metadata: {
                class: characterClass || undefined,
                gender: gender || undefined,
                head: headIcon || undefined,
                author: author || undefined
            }
        };
    }

    // 2. DofusSkinManga (Nouveau standard)
    if (lowerUrl.includes("dofusskinmanga.com")) {
        const res = await fetch(url, { 
            headers: { 
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Referer": "https://dofusskinmanga.com/"
            } 
        });
        const html = await res.text();
        const $ = cheerio.load(html);
        
        const colors: Record<string, string> = {};
        const equipment: any[] = [];

        // Extract Colors (.spec-row-sp)
        $('.spec-row-sp').each((_, el) => {
            const label = $(el).find('.spec-label-sp').text().trim();
            const hex = $(el).find('.hex-code-sp').text().replace('❏', '').trim();
            if (label && hex.startsWith('#')) {
                colors[label] = hex;
            }
        });

        // Extract Equipment (.item-card-sp)
        $('.item-card-sp').each((_, el) => {
            const type = $(el).find('.item-type-sp').text().trim();
            const name = $(el).find('.item-name-sp').text().trim();
            const icon = $(el).find('.item-icon-sp').attr('src');
            
            if (name && name !== "Aucun") {
                equipment.push({ 
                    name, 
                    type: type.replace('CHAPEAU', 'Coiffe').replace('ÉPAULIÈRES', 'Épaulières'), 
                    icon: icon?.startsWith('http') ? icon : `https://dofusskinmanga.com/${icon}`
                });
            }
        });

        // Precision extraction for UX 2026
        const name = $('h1 .brand-skin').first().text().trim() || 
                    $('h1').first().text().replace(/Classe:.*|Genre:.*|Tête:.*/gi, "").trim() ||
                    "Skin Manga";

        const subSpText = $('.sub-sp').text();
        const className = subSpText.match(/Classe:\s*([^\n|]+)/i)?.[1]?.trim() || 
                         html.match(/Classe:<\/(?:span|b|strong)>\s*([^<]+)/i)?.[1]?.trim();
        const genderName = subSpText.match(/Genre:\s*([^\n|]+)/i)?.[1]?.trim() || 
                          html.match(/Genre:<\/(?:span|b|strong)>\s*([^<]+)/i)?.[1]?.trim();
        const headMatch = subSpText.match(/Tête:\s*([^\n|]+)/i) || html.match(/Tête:<\/(?:span|b|strong)>\s*([^<]+)/i);

        // Map class name to ID for filter compatibility
        const classId = DOFUS_CLASSES.find(c => 
            c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === 
            className?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        )?.icon.match(/classes\/(\d+)\.png/)?.[1];

        const rawOgManga = $('meta[property="og:image"]').attr('content')?.trim() || 
                           $('meta[name="twitter:image"]').attr('content')?.trim() || null;
        let mangaThumb: string | null = null;
        if (rawOgManga) {
            try {
                mangaThumb = rawOgManga.startsWith("//") ? `https:${rawOgManga}` : new URL(rawOgManga, url).href;
            } catch {
                mangaThumb = rawOgManga;
            }
        }

        return {
            name,
            thumbnailUrl: mangaThumb,
            provider: "DOFUSSKINMANGA",
            colors,
            equipment,
            metadata: {
                class: classId || className, // Store ID if found, fallback to name
                gender: genderName,
                head: headMatch ? (headMatch[1] || headMatch[0]).trim() : undefined,
                author: "Inconnu"
            }
        };
    }

    // Fallback Generic Scraper
    try {
        const res = await fetch(url, { headers: { "User-Agent": "SigilOS/1.0" } });
        const html = await res.text();
        const $ = cheerio.load(html);

        const rawOgOther = $('meta[property="og:image"]').attr('content')?.trim() || null;
        let genericThumb: string | null = null;
        if (rawOgOther) {
            try {
                genericThumb = rawOgOther.startsWith("//") ? `https:${rawOgOther}` : new URL(rawOgOther, url).href;
            } catch {
                genericThumb = rawOgOther;
            }
        }

        return {
            name: $('meta[property="og:title"]').attr('content')?.trim() || $('title').text() || "Nouveau Skin",
            thumbnailUrl: genericThumb,
            provider: "OTHER"
        };
    } catch {
        return { name: "Skin", thumbnailUrl: null, provider: "OTHER" };
    }
}

export async function addUserSkin(rawData: z.infer<typeof SkinSchema>): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const validation = SkinSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: validation.error.errors[0].message };
    const { guildId, url, name: manualName, existingSkinId } = validation.data;

    try {
        const ctx = await getUserContext(guildId);
        if (!ctx.profileId) return { success: false, error: "Profil introuvable" };
        
        // --- SPAM PROTECTION ---
        // Check if the user already has this skin URL on their profile
        if (!existingSkinId) {
            const alreadyOwned = await db.userSkin.findFirst({
                where: { 
                    profileId: ctx.profileId,
                    url: url
                }
            });
            if (alreadyOwned) {
                return { success: false, error: "Vous possédez déjà ce skin dans votre bibliothèque" };
            }
        }

        // --- CACHE LOGIC ---
        // 1. Check if we already have this skin in our global cache
        const existingInCache = await db.userSkin.findFirst({
            where: { url },
            orderBy: { updatedAt: 'desc' }
        });

        // 2. Decide if we need to scrape (Stale threshold: 7 days)
        // FORCE SCRAPE if existingSkinId is provided (manual sync)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const isStale = !existingInCache || existingInCache.updatedAt < sevenDaysAgo;
        const shouldScrape = isStale || !!existingSkinId; 

        let skinData: SkinData;

        if (!shouldScrape && existingInCache) {
            skinData = {
                name: existingInCache.name,
                thumbnailUrl: existingInCache.thumbnailUrl,
                provider: existingInCache.provider as any,
                equipment: existingInCache.equipment,
                colors: existingInCache.colors,
                metadata: existingInCache.metadata
            };
        } else {
            try {
                skinData = await scrapeSkinMetadata(url);
            } catch (error) {
                if (existingInCache) {
                    skinData = {
                        name: existingInCache.name,
                        thumbnailUrl: existingInCache.thumbnailUrl,
                        provider: existingInCache.provider as any,
                        equipment: existingInCache.equipment,
                        colors: existingInCache.colors,
                        metadata: existingInCache.metadata
                    };
                } else {
                    throw error;
                }
            }
        }
        
        let skin;
        if (existingSkinId) {
            skin = await db.userSkin.update({
                where: { id: existingSkinId },
                data: {
                    name: manualName || skinData.name,
                    thumbnailUrl: skinData.thumbnailUrl,
                    equipment: skinData.equipment || {},
                    colors: skinData.colors || {},
                    metadata: skinData.metadata || {}
                }
            });
        } else {
            skin = await db.userSkin.create({
                data: {
                    profileId: ctx.profileId,
                    url: url,
                    name: manualName || skinData.name,
                    provider: skinData.provider,
                    thumbnailUrl: skinData.thumbnailUrl,
                    equipment: skinData.equipment || {},
                    colors: skinData.colors || {},
                    metadata: skinData.metadata || {}
                }
            });
        }

        revalidatePath(`/dashboard/${guildId}/profile`);
        return { success: true, data: skin };
    } catch (error) {
        logger.error("[Skin Actions] Add Error:", error);
        return { success: false, error: "Impossible d'ajouter le skin" };
    }
}

export async function deleteUserSkin(guildId: string, skinId: string): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    try {
        // Verify ownership
        const ctx = await getUserContext(guildId);
        const skin = await db.userSkin.findUnique({
            where: { id: skinId },
            select: { profileId: true }
        });

        if (!skin || skin.profileId !== ctx.profileId) {
            return { success: false, error: "Vous ne possédez pas ce skin" };
        }

        await db.userSkin.delete({ where: { id: skinId } });

        revalidatePath(`/dashboard/${guildId}/profile`);
        return { success: true };
    } catch (error) {
        logger.error("[Skin Actions] Delete Error:", error);
        return { success: false, error: "Impossible de supprimer le skin" };
    }
}

export async function getUserSkins(guildId: string, profileId?: string): Promise<ActionResponse<any[]>> {
    try {
        const ctx = await getUserContext(guildId);
        const targetProfileId = profileId || ctx.profileId;

        const skins = await db.userSkin.findMany({
            where: { profileId: targetProfileId },
            orderBy: { createdAt: "desc" }
        });

        return { success: true, data: skins };
    } catch (error) {
        logger.error("[Skin Actions] Get Error:", error);
        return { success: false, error: "Impossible de récupérer les skins" };
    }
}

export async function getSkinPreview(url: string): Promise<ActionResponse<SkinData>> {
    try {
        // 1. Check Cache
        const existingInCache = await db.userSkin.findFirst({
            where: { url },
            orderBy: { updatedAt: 'desc' }
        });

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const isStale = !existingInCache || existingInCache.updatedAt < sevenDaysAgo;

        if (!isStale && existingInCache) {
            return { 
                success: true, 
                data: {
                    name: existingInCache.name,
                    thumbnailUrl: existingInCache.thumbnailUrl,
                    provider: existingInCache.provider as any,
                    equipment: existingInCache.equipment,
                    colors: existingInCache.colors,
                    metadata: existingInCache.metadata
                } 
            };
        }

        // 2. Scrape if not in cache or stale
        const metadata = await scrapeSkinMetadata(url);
        return { success: true, data: metadata };
    } catch (error) {
        return { success: false, error: "Impossible de prévisualiser le skin" };
    }
}

export async function updateUserSkin(guildId: string, skinId: string, data: { name: string, url?: string }): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    try {
        const ctx = await getUserContext(guildId);
        
        // Verify ownership
        const skin = await db.userSkin.findFirst({
            where: { 
                id: skinId,
                profileId: ctx.profileId
            }
        });

        if (!skin) {
            return { success: false, error: "Skin introuvable ou vous n'êtes pas le propriétaire" };
        }

        const updateData: any = { name: data.name };

        // If URL changed, we MUST re-scrape everything
        if (data.url && data.url.trim() !== skin.url) {
            try {
                const scraped = await scrapeSkinMetadata(data.url.trim());
                updateData.url = data.url.trim();
                updateData.thumbnailUrl = scraped.thumbnailUrl;
                updateData.provider = scraped.provider;
                updateData.equipment = scraped.equipment;
                updateData.colors = scraped.colors;
                updateData.metadata = scraped.metadata;
                // Note: We use the manual name provided in 'data.name' even if URL changed
            } catch (scrapeError) {
                return { success: false, error: "Impossible de valider le nouveau lien" };
            }
        }

        const updatedSkin = await db.userSkin.update({
            where: { id: skinId },
            data: updateData
        });

        revalidatePath(`/dashboard/${guildId}/profile`);
        revalidatePath(`/dashboard/${guildId}/galerie-stuff`);
        
        return { success: true, data: updatedSkin };
    } catch (error) {
        logger.error("[Skin Actions] Update Error:", error);
        return { success: false, error: "Impossible de mettre à jour le skin" };
    }
}


