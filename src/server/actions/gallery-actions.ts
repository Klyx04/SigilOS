"use server";

import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { DOFUS_CLASSES } from "@/lib/dofus-assets";
import { canonicalClassId, getClassName, isUsableDofusbookRawPayload, processDofusbookRawData, type DofusbookPreviewData } from "@/lib/dofusbook-utils";
import { hasSavedVariant, normalizeSavedVariants, describeSavedVariants, type SavedVariant } from "@/lib/dofus-variant-utils";
import { applyVariantsToBuild } from "@/lib/dofus-variant-utils";
import type { VariantItemSets } from "@/lib/dofus-variant-utils";
import { normalizeItemSetTiers, type ItemSetData } from "@/lib/dofus-set-bonuses";
import { attachItemSetsToBuilds, resolveVariantItemSets, resolveVariantPreview } from "@/server/build-item-sets";
import { validateSavedVariants, effectiveSlotIds, validatePrysmaraditeLimit } from "@/lib/dofus-variant-rules";
import { evaluateDofusConditions } from "@/lib/dofus-conditions";
import type { DofusbookItem } from "@/lib/dofusbook-utils";
import { z } from "zod";
import { rateLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";
import { getGameDisplayName } from "@/lib/display-name";
import { getAppBaseUrl } from "@/lib/utils";

/**
 * Route image provider URLs through the internal proxy to bypass anti-hotlink
 * protections (Barbofus, DofusSkinManga, Dofusbook) when Discord fetches the embed image.
 * Discord's fetchers don't send browser-like headers, so these providers refuse
 * to serve the image and Discord falls back to the provider logo or broken image.
 * Returns undefined only if the URL is invalid.
 */
function resolveDiscordImage(rawImage: string, baseUrl?: string): string | undefined {
    try {
        let cleanImage = rawImage.trim();
        if (cleanImage.startsWith("//")) {
            cleanImage = `https:${cleanImage}`;
        }
        const parsedUrl = baseUrl ? new URL(cleanImage, baseUrl) : new URL(cleanImage);
        const host = parsedUrl.hostname.toLowerCase();
        const isProtectedProvider = 
            host === "barbofus.com" || host.endsWith(".barbofus.com") ||
            host === "dofusskinmanga.com" || host.endsWith(".dofusskinmanga.com") ||
            host === "dofusbook.net" || host.endsWith(".dofusbook.net") ||
            host === "d-bk.net" || host.endsWith(".d-bk.net");

        if (isProtectedProvider) {
            const appUrl = getAppBaseUrl();
            return `${appUrl}/api/proxy-image?url=${encodeURIComponent(parsedUrl.href)}`;
        }
        return parsedUrl.href;
    } catch {
        return undefined;
    }
}

const PAGE_SIZE = 24; // 24 cards per page (6 col × 4 rows)

export type GalleryBuild = {
    id: string;
    name: string;
    url: string;
    tags?: string[];
    classId?: string | number; // stored as string ("cra", "roublard") or number from legacy data
    previewData?: any; // Cached build info
    /**
     * Variante **proposée par le joueur** (JSON `dofusBookLinks[].variants`, assainie).
     * Le build Dofusbook d'origine reste intact : la variante s'applique à l'affichage.
     */
    variants?: SavedVariant;
    /**
     * Panoplies du build (paliers complets + objet → panoplie), **résolues côté serveur**.
     * Indispensables au recalcul des bonus quand une variante change une pièce : sans elles,
     * la variante n'est pas calculée (fail-closed) — voir `applyVariantsToBuild`.
     */
    itemSets?: VariantItemSets;
    source?: "dofusbook";
    author: {
        id: string;
        name: string;
        image: string | null;
    };
    votesCount: number;
    hasVoted: boolean;
    createdAt?: string | null; // Date d'ajout du stuff
    updatedAt?: string | null; // Date de dernière modification
};

export type GalleryPage = {
    builds: GalleryBuild[];
    total: number;
    hasMore: boolean;
    nextPage: number | null;
    isDiscordShareConfigured: boolean;
};

export type GallerySkin = {
    id: string;
    name: string;
    url: string;
    provider: string;
    thumbnailUrl: string | null;
    equipment?: any;
    colors?: any;
    metadata: any;
    author: {
        id: string;
        name: string;
        image: string | null;
    };
    votesCount: number;
    hasVoted: boolean;
    createdAt: Date;
};

export type GallerySkinPage = {
    skins: GallerySkin[];
    total: number;
    hasMore: boolean;
    nextPage: number | null;
    isDiscordShareConfigured: boolean;
};

type ActionResponse<T = null> = {
    success: boolean;
    error?: string;
    data?: T;
};

/**
 * Paginated stuff gallery — scales to hundreds of builds.
 * Returns PAGE_SIZE (24) builds per page, filtered server-side.
 * Security: auth + canViewStuffGallery check enforced.
 */
export async function getStuffGalleryPage(
    guildId: string,
    page: number = 1,
    searchQuery?: string,
    tags?: string[],
    classId?: string,
    sortBy?: "newest" | "votes",
    source?: "dofusbook"
): Promise<ActionResponse<GalleryPage>> {
    if (!guildId) return { success: false, error: "ID de guilde requis" };

    const user = await getUserContext(guildId);
    if (!user.isAuthenticated || !user.canViewStuffGallery) {
        return { success: false, error: "Accès refusé" };
    }

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, name: true, stuffGalleryChannelId: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const [profiles, allVotes] = await Promise.all([
            // Optimization: Fetch profiles and filter in memory
            db.userProfile.findMany({
                where: {
                    guildId: guildConfig.id,
                    status: "ACTIVE",
                },
                select: {
                    id: true,
                    pseudoDofus: true,
                    discordNickname: true,
                    dofusBookLinks: true,
                    classe: true,
                    user: { select: { name: true, image: true } }
                },
            }),
            // Fetch all votes for this guild
            db.buildVote.findMany({
                where: { guildId: guildConfig.id },
                select: { buildId: true, userId: true }
            })
        ]);



        // Create vote maps for quick access
        const votesCountMap = new Map<string, number>();
        const userVotesSet = new Set<string>(); // Set of buildIds voted by current user

        allVotes.forEach((vote: { buildId: string, userId: string }) => {
            votesCountMap.set(vote.buildId, (votesCountMap.get(vote.buildId) || 0) + 1);
            if (user.id && vote.userId === user.id) {
                userVotesSet.add(vote.buildId);
            }
        });

        // Flatten all builds from all profiles into one list
        let allBuilds: GalleryBuild[] = [];
        profiles.forEach((profile: any) => {
            // Safety check: ensure links is actually an array
            if (!profile.dofusBookLinks || !Array.isArray(profile.dofusBookLinks)) {
                return;
            }

            const links = profile.dofusBookLinks as any[];
            links.forEach((link, idx) => {
                if (link?.url && link?.name) {
                    const isDofusRoom = /dofusroom\.com/.test(link.url);
                    if (isDofusRoom) return; // Skip DofusRoom links completely

                    const buildId = link.id || `${profile.id}-${idx}`; // Prefer real id if exists
                    const buildSource = "dofusbook" as const;
                    
                    const buildIdMatch = link.url.match(/(?:equipement\/(?:[a-z]+\/)?([\d]+)|d-bk\.net\/(?:fr\/)?d\/([a-zA-Z0-9]+))/i);
                    const parsedId = buildIdMatch ? (buildIdMatch[1] || buildIdMatch[2]) : null;
                    const numericMatch = parsedId?.match(/^(\d+)/);
                    const numericId = numericMatch ? numericMatch[1] : parsedId;
                    const thumbnail = link.previewData?.thumbnail || (numericId ? `https://static.dofusbook.net/equipement/render/${numericId}.png` : null);

                    const resolvedClassId = canonicalClassId(
                        link.classId ??
                        link.previewData?.classId ??
                        link.class ??
                        profile.classe
                    ) || undefined;

                    // Variante proposée par le joueur (assainie : entrée non fiable).
                    const savedVariant = normalizeSavedVariants(link.variants);

                    allBuilds.push({
                        id: buildId,
                        name: link.name,
                        url: link.url,
                        tags: link.tags || [],
                        classId: resolvedClassId ?? link.classId,
                        source: buildSource,
                        previewData: {
                            ...link.previewData,
                            thumbnail
                        },
                        ...(hasSavedVariant(savedVariant) ? { variants: savedVariant } : {}),
                        author: {
                            id: profile.id,
                            name: getGameDisplayName(profile),
                            image: profile.user.image
                        },
                        votesCount: votesCountMap.get(buildId) || 0,
                        hasVoted: userVotesSet.has(buildId),
                        createdAt: link.createdAt || null,
                        updatedAt: link.updatedAt || null
                    });
                }
            });
        });



        // Apply sort
        if (sortBy === "votes") {
            allBuilds = allBuilds.sort((a, b) => b.votesCount - a.votesCount);
        } else {
            // Default: newest first (by updatedAt or createdAt timestamp if available)
            allBuilds = allBuilds.sort((a, b) => {
                const dateA = a.updatedAt || a.createdAt;
                const dateB = b.updatedAt || b.createdAt;
                if (dateA && dateB) {
                    return new Date(dateB).getTime() - new Date(dateA).getTime();
                }
                if (dateA) return -1;
                if (dateB) return 1;
                return 0;
            });
        }

        // Apply search filter server-side
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            allBuilds = allBuilds.filter(b =>
                b.name.toLowerCase().includes(q) ||
                b.author.name.toLowerCase().includes(q)
            );
        }

        // Apply tag filter server-side (multi-sélection : TOUS les tags sélectionnés doivent être présents)
        if (tags && tags.length > 0) {
            allBuilds = allBuilds.filter(b => tags.every(t => b.tags?.includes(t)));
        }

        // Apply class filter server-side — comparaison canonisée : les builds
        // stockent la numérotation Dofusbook (Forgelance = 19) tandis que le
        // filtre envoie l'id extrait de l'icône (breed DofusDB, Forgelance = 20).
        if (classId) {
            const wanted = canonicalClassId(classId);
            allBuilds = allBuilds.filter(b => wanted !== 0 && canonicalClassId(b.classId) === wanted);
        }

        // Apply source filter server-side
        if (source) {
            allBuilds = allBuilds.filter(b => b.source === source);
        }

        const total = allBuilds.length;
        const offset = (page - 1) * PAGE_SIZE;
        const pageBuilds = allBuilds.slice(offset, offset + PAGE_SIZE);
        const hasMore = offset + PAGE_SIZE < total;
        /**
         * 🔗 Panoplies des builds **de cette page** (celles qui portent une variante) : deux
         * requêtes bornées, aucun catalogue complet côté client. Sans contexte, la variante
         * affiche un refus explicite au lieu de garder les bonus du stuff d'origine.
         */
        const buildsWithItemSets = await attachItemSetsToBuilds(pageBuilds);

        return {
            success: true,
            data: {
                builds: buildsWithItemSets,
                total,
                hasMore,
                nextPage: hasMore ? page + 1 : null,
                isDiscordShareConfigured: !!guildConfig.stuffGalleryChannelId
            }
        };
    } catch (error: any) {
        logger.error("Get Stuff Gallery Page Error:", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Force re-fetch of Dofusbook metadata for a specific build in the gallery.
 * This updates the previewData in the user's profile.
 */
export async function refreshBuildMetadata(
    guildId: string,
    profileId: string,
    buildUrl: string
): Promise<ActionResponse> {
    if (!guildId || !profileId || !buildUrl) return { success: false, error: "Paramètres manquants" };

    const user = await getUserContext(guildId);
    if (!user.isAuthenticated || !user.isMember) return { success: false, error: "Non autorisé" };

    try {
        const galleryGuild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!galleryGuild) return { success: false, error: "Guilde introuvable" };

        const { revalidatePath } = await import("next/cache");
        const isDofusRoom = /dofusroom\.com/.test(buildUrl);
        if (isDofusRoom) {
            return { success: false, error: "L'intégration DofusRoom a été supprimée." };
        }
        let previewData = null;

        const { getDofusbookPreview } = await import("./dofusbook-actions");
        const res = await getDofusbookPreview(buildUrl, true);
        if (!res.success || !res.data) {
            return { success: false, error: res.error || "Impossible de récupérer les données" };
        }
        previewData = res.data;

        // 2. Update user profile dofusBookLinks
        const profile = await db.userProfile.findFirst({
            where: { id: profileId, guildId: galleryGuild.id },
            select: { id: true, userId: true, dofusBookLinks: true }
        });

        if (!profile) return { success: false, error: "Profil introuvable" };
        // Fail-closed : on ne rafraîchit que son propre build ou en tant qu'admin.
        if (!user.isAdmin && profile.userId !== user.id) return { success: false, error: "Non autorisé" };

        const links = (profile.dofusBookLinks as any[]) || [];
        const updatedLinks = links.map(link => {
            if (link.url === buildUrl) {
                return { ...link, previewData, source: "dofusbook" as const };
            }
            return link;
        });

        await db.userProfile.update({
            where: { id: profileId },
            data: { dofusBookLinks: updatedLinks as any }
        });

        // 3. Revalidate
        revalidatePath(`/dashboard/${guildId}/galerie-stuff`);
        // 🔗 #126 : la page membre est servie sous /members/<slug> → on revalide le pattern
        revalidatePath(`/dashboard/${guildId}/members/[slug]`);

        return { success: true };
    } catch (error) {
        logger.error("Refresh Build Metadata Error:", { error });
        return { success: false, error: "Erreur serveur lors du rafraîchissement" };
    }
}

/**
 * Enregistre un `previewData` **récupéré par le navigateur du membre** (bake côté client).
 *
 * Contexte : Dofusbook (Cloudflare) refuse désormais les appels serveur (challenge
 * anti-bot) → `getDofusbookPreview()` ne peut plus baker. Le navigateur, lui, passe :
 * il appelle le worker signé (`getDofusbookClientFetchUrl()`) et nous transmet le JSON.
 * Cette action le valide (forme + taille : entrée non fiable) puis le stocke.
 *
 * Si le build n'appartient à aucun profil de la guilde, on renvoie quand même les
 * données traitées pour l'affichage, sans persister (`persisted: false`).
 */
export async function storeClientDofusbookPreview(
    guildId: string,
    buildUrl: string,
    raw: unknown,
    options: { force?: boolean } = {},
): Promise<ActionResponse<{ data: DofusbookPreviewData; persisted: boolean; changed?: boolean }>> {
    if (!guildId || !buildUrl) return { success: false, error: "Paramètres manquants" };

    const user = await getUserContext(guildId);
    if (!user.isAuthenticated || !user.isMember) return { success: false, error: "Non autorisé" };

    const limited = await rateLimit(`dofusbook-client-bake:${user.id ?? "anon"}`, 30, 60_000);
    if (!limited.success) return { success: false, error: "Trop de rafraîchissements — réessaie dans une minute." };

    if (!isUsableDofusbookRawPayload(raw)) {
        return { success: false, error: "Données Dofusbook invalides ou trop volumineuses" };
    }

    try {
        const { getDofusbookId } = await import("./dofusbook-actions");
        const id = await getDofusbookId(buildUrl);
        if (!id) return { success: false, error: "Identifiant Dofusbook introuvable" };

        const data = processDofusbookRawData(id, raw);

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // Recherche du profil propriétaire du build dans cette guilde (tous statuts : un
        // profil archivé/inactif conserve ses builds et doit pouvoir être rafraîchi).
        const profiles = await db.userProfile.findMany({
            where: { guildId: guildConfig.id },
            select: { id: true, userId: true, dofusBookLinks: true },
        });
        const owner = profiles.find((p) =>
            ((p.dofusBookLinks as any[]) || []).some((l) => l?.url === buildUrl)
        );

        if (!owner) return { success: true, data: { data, persisted: false } };
        // Fail-closed : seul le propriétaire du build ou un admin persiste.
        if (!user.isAdmin && owner.userId !== user.id) {
            return { success: true, data: { data, persisted: false } };
        }

        const now = new Date().toISOString();
        const ownerLinks = (owner.dofusBookLinks as any[]) || [];
        const currentLink = ownerLinks.find((l) => l?.url === buildUrl);
        /**
         * ⚠️ Le worker Cloudflare peut renvoyer son **cache edge** (24 h) : dater `updatedAt`
         * sans comparer ferait croire à une mise à jour réelle alors que rien n'a bougé
         * (constat user du 25/10/2026 : un item retiré sur Dofusbook restait affiché).
         * On ne réécrit donc la ligne que si le payload produit a **vraiment** changé.
         */
        const changed = JSON.stringify(currentLink?.previewData ?? null) !== JSON.stringify(data);
        if (!changed) {
            /**
             * ⚠️ **Un rafraîchissement forcé qui rend un payload identique n'est pas une preuve
             * que rien n'a changé** : le relais peut servir son cache (24 h). Mesure du
             * 26/10/2026 : `force=1` renvoyait le **même** payload **et aucun** en-tête `X-Cache`
             * (signature d'un relais qui n'est pas la version du dépôt) ⇒ trace côté serveur.
             */
            if (options.force) {
                logger.warn("[dofusbook] rafraîchissement forcé sans changement — relais probablement en cache", {
                    buildId: id,
                    items: Object.keys((data.items ?? {}) as Record<string, unknown>).length,
                });
            }
            return { success: true, data: { data, persisted: true, changed: false } };
        }

        const updatedLinks = ownerLinks.map((link) =>
            link?.url === buildUrl
                ? { ...link, previewData: data, source: "dofusbook" as const, updatedAt: now }
                : link
        );

        await db.userProfile.update({
            where: { id: owner.id },
            data: { dofusBookLinks: updatedLinks as any },
        });

        revalidatePath(`/dashboard/${guildId}/galerie-stuff`);
        // 🔗 #126 : la page membre est servie sous /members/<slug> → on revalide le pattern
        revalidatePath(`/dashboard/${guildId}/members/[slug]`);

        return { success: true, data: { data, persisted: true, changed: true } };
    } catch (error) {
        logger.error("[Dofusbook] Client bake storage error:", { error });
        return { success: false, error: "Erreur serveur lors de l'enregistrement" };
    }
}

/**
 * Enregistre la **variante proposée par le joueur** sur un de ses builds.
 *
 * Pourquoi (demande user du 23/10/2026) : la variante (trophée/dofus/objet remplacé) doit être
 * **visible dans la galerie** par les autres membres, sans toucher au stuff Dofusbook d'origine.
 *
 * Persistance : `UserProfile.dofusBookLinks[].variants` (JSON) — **aucune migration**, et tous les
 * chemins de rafraîchissement Dofusbook font `{ ...link, previewData }`, donc la variante survit.
 *
 * Gardes : `getUserContext` (auth + membre), build **du profil courant** (isolation de la cible),
 * rate limit Redis, assainissement borné (`normalizeSavedVariants`).
 */
const SaveBuildVariantSchema = z.object({
    guildId: z.string().min(1).max(32),
    buildId: z.string().min(1).max(80),
    variants: z.unknown(),
});

/** Bornes du contexte de panoplies demandé par la miniature (16 slots d'équipement). */
const GetVariantItemSetsSchema = z.object({
    guildId: z.string().min(1).max(32),
    ankamaIds: z.array(z.number().int().positive().max(99_999_999)).min(1).max(64),
});

/**
 * 🔗 **Panoplies d'une variante**, demandées par la miniature elle-même.
 *
 * Pourquoi : la page peut être rendue **avant** la synchronisation des panoplies (cas réel du
 * 26/10/2026 : un `next dev` démarré avant le siphon servait un rendu sans référentiel). Sans
 * ce rattrapage, la variante affichait un refus alors que la donnée existait déjà en base.
 *
 * Lecture seule, bornée (64 ids), réservée aux membres de la guilde.
 */
export async function getVariantItemSets(
    rawGuildId: string,
    rawAnkamaIds: unknown,
): Promise<ActionResponse<VariantItemSets>> {
    const parsed = GetVariantItemSetsSchema.safeParse({ guildId: rawGuildId, ankamaIds: rawAnkamaIds });
    if (!parsed.success) return { success: false, error: "Données invalides" };

    const user = await getUserContext(parsed.data.guildId);
    if (!user.isAuthenticated || !user.isMember) return { success: false, error: "Non autorisé" };

    const context = await resolveVariantItemSets(parsed.data.ankamaIds);
    if (!context) return { success: false, error: "Panoplies indisponibles" };

    return { success: true, data: context };
}

export async function saveBuildVariant(
    rawGuildId: string,
    rawBuildId: string,
    rawVariants: unknown,
): Promise<ActionResponse<{ variants: SavedVariant }>> {
    const parsed = SaveBuildVariantSchema.safeParse({
        guildId: rawGuildId,
        buildId: rawBuildId,
        variants: rawVariants,
    });
    if (!parsed.success) return { success: false, error: "Données invalides" };
    const { guildId, buildId } = parsed.data;

    const user = await getUserContext(guildId);
    if (!user.isAuthenticated || !user.isMember || !user.profileId) {
        return { success: false, error: "Non autorisé" };
    }

    const limited = await rateLimit(`gallery-variant:${user.profileId}`, 30, 60_000);
    if (!limited.success) return { success: false, error: "Trop d'enregistrements — réessaie dans une minute." };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const profile = await db.userProfile.findFirst({
            where: { id: user.profileId, guildId: guildConfig.id },
            select: { id: true, dofusBookLinks: true },
        });
        if (!profile) return { success: false, error: "Profil introuvable" };

        const links = ((profile.dofusBookLinks as any[]) || []);
        const index = links.findIndex((link) => link?.id === buildId);
        if (index < 0) return { success: false, error: "Build introuvable" };

        const variants = normalizeSavedVariants(parsed.data.variants);
        /**
         * 🔒 **Légalité de la variante** (fail-closed) : slots/type d'objet, niveau ≤ build,
         * aucun doublon. Le client ne fait qu'afficher le refus — l'autorité est ici.
         * (Armes à deux mains, `criterions` et règles de panoplie : données absentes de
         * `GameItem`, lot séparé avec migration.)
         */
        const previewData = (links[index] as { previewData?: DofusbookPreviewData | null })?.previewData ?? null;
        const buildLevel = Number(previewData?.level);
        const decision = validateSavedVariants({
            baseItems: (previewData?.items ?? null) as Record<string, DofusbookItem | null> | null,
            variants,
            buildLevel: Number.isFinite(buildLevel) && buildLevel > 0 ? buildLevel : 200,
        });
        if (!decision.ok) {
            return { success: false, error: decision.violation.message };
        }

        /**
         * Règles **serveur** (fail-closed) qui exigent les données du catalogue :
         *  · une seule **Prysmaradite** (partage le 1ᵉʳ emplacement Dofus/Trophée) ;
         *  · **arme à deux mains** ⇒ pas de bouclier ;
         *  · **conditions d'objet** (`GameItem.conditions`, arbre DofusDude) évaluées sur le
         *    build effectif, sans l'apport propre de l'objet (Heaume Oplate : +1 PA mais PA < 12).
         * Les valeurs du client ne sont **jamais** utilisées : tout est relu en base par id Ankama.
         */
        const effective = effectiveSlotIds(
            (previewData?.items ?? null) as Record<string, DofusbookItem | null> | null,
            variants,
        );
        if (effective.length > 0) {
            const catalog = await db.gameItem.findMany({
                where: { ankamaId: { in: effective.map((entry) => entry.id) } },
                select: { ankamaId: true, typeName: true, conditions: true, twoHanded: true, itemSetId: true },
            });
            const byAnkamaId = new Map(catalog.map((item) => [item.ankamaId, item]));

            const prysmaradite = validatePrysmaraditeLimit(catalog.map((item) => item.typeName));
            if (!prysmaradite.ok) {
                return { success: false, error: prysmaradite.violation.message };
            }

            const weapon = effective.find((entry) => entry.slot === "ar");
            const hasShield = effective.some((entry) => entry.slot === "br");
            if (weapon && hasShield && byAnkamaId.get(weapon.id)?.twoHanded === true) {
                return {
                    success: false,
                    error: "Arme à deux mains : aucun bouclier ne peut être équipé en même temps.",
                };
            }

            // Panoplies **actives** : ≥ 2 pièces **distinctes** du même `itemSetId`.
            const piecesBySet = new Map<number, Set<number>>();
            for (const entry of effective) {
                const setId = Number(byAnkamaId.get(entry.id)?.itemSetId ?? -1);
                if (!Number.isInteger(setId) || setId <= 0) continue;
                const pieces = piecesBySet.get(setId) ?? new Set<number>();
                pieces.add(entry.id);
                piecesBySet.set(setId, pieces);
            }
            const activeSets = [...piecesBySet.values()].filter((pieces) => pieces.size >= 2).length;

            /**
             * 🔁 **Stats effectives** : les conditions sont évaluées sur le build **avec la
             * variante**, bonus de panoplie **recalculés** (jusqu'ici on évaluait sur les stats
             * du stuff d'origine — une approximation dès qu'une panoplie bougeait).
             * Fail-closed : contexte incohérent ou panoplie absente du référentiel ⇒ refus,
             * jamais une acceptation sur un total faux.
             */
            const byItem: Record<number, number> = {};
            for (const [ankamaId, info] of byAnkamaId) {
                const setId = Number(info.itemSetId ?? -1);
                if (Number.isInteger(setId) && setId > 0) byItem[ankamaId] = setId;
            }
            const setIds = [...new Set(Object.values(byItem))].slice(0, 64);
            const setRows = setIds.length > 0
                ? await db.gameItemSet.findMany({
                    where: { id: { in: setIds } },
                    select: { id: true, name: true, itemCount: true, tiers: true },
                })
                : [];
            const sets: Record<number, ItemSetData> = {};
            for (const row of setRows) {
                // Tableau **vide** = panoplie sans bonus (valide) ; pas un tableau = illisible ⇒ inconnue.
                if (!Array.isArray(row.tiers)) continue;
                sets[row.id] = { id: row.id, name: row.name, itemCount: row.itemCount, tiers: normalizeItemSetTiers(row.tiers) };
            }
            const effectiveBuild = previewData ? applyVariantsToBuild(previewData, variants, { sets, byItem }) : null;
            if (previewData && !effectiveBuild) {
                return { success: false, error: "Bonus de panoplie indisponibles pour ce build — variante refusée." };
            }

            const elements = effectiveBuild?.elements ?? previewData?.elements;
            const stats = effectiveBuild?.stats ?? previewData?.stats;
            const baseContext = {
                pa: Number(stats?.pa ?? 0),
                pm: Number(stats?.pm ?? 0),
                vit: Number(stats?.vit ?? 0),
                sa: Number(elements?.sa ?? 0),
                fo: Number(elements?.fo ?? 0),
                in: Number(elements?.in ?? 0),
                ch: Number(elements?.ch ?? 0),
                ag: Number(elements?.ag ?? 0),
                activeSets,
                level: Number.isFinite(buildLevel) && buildLevel > 0 ? buildLevel : 200,
            };

            for (const [slot, variant] of Object.entries(variants)) {
                const info = byAnkamaId.get(Number(variant.official || variant.id));
                if (!info?.conditions) continue;

                // Le candidat ne se compte pas lui-même dans PA/PM (règle du jeu).
                const own = (code: "pa" | "pm") =>
                    (variant.effects ?? [])
                        .filter((effect) => effect.code === code)
                        .reduce((sum, effect) => sum + Math.max(0, Number(effect.value ?? effect.max ?? 0)), 0);

                const evaluation = evaluateDofusConditions(info.conditions, {
                    ...baseContext,
                    pa: baseContext.pa - own("pa"),
                    pm: baseContext.pm - own("pm"),
                });

                if (!evaluation.ok) {
                    const reason = evaluation.unsupported.length > 0
                        ? `condition non vérifiable (${evaluation.unsupported.join(", ")})`
                        : `condition non remplie (${evaluation.failed.join(", ")})`;
                    return {
                        success: false,
                        error: `« ${variant.name} » (${slot}) — ${reason}.`,
                    };
                }
            }
        }

        const now = new Date().toISOString();
        const updatedLinks = links.map((link, i) =>
            i === index ? { ...link, variants, updatedAt: now } : link,
        );

        await db.userProfile.update({
            where: { id: profile.id },
            data: { dofusBookLinks: updatedLinks as any },
        });

        const { revalidatePath } = await import("next/cache");
        revalidatePath(`/dashboard/${guildId}/galerie-stuff`);
        revalidatePath(`/dashboard/${guildId}/profile`);

        return { success: true, data: { variants } };
    } catch (error) {
        logger.error("[saveBuildVariant] Erreur", { error });
        return { success: false, error: "Impossible d'enregistrer la variante" };
    }
}

/**
 * Paginated skin gallery.
 * Returns PAGE_SIZE (24) skins per page, filtered server-side.
 */
export async function getSkinGalleryPage(
    guildId: string,
    page: number = 1,
    searchQuery?: string,
    classFilter?: string,
    genderFilter?: string,
    sortBy: "newest" | "votes" = "newest"
): Promise<ActionResponse<GallerySkinPage>> {
    if (!guildId) return { success: false, error: "ID de guilde requis" };

    const user = await getUserContext(guildId);
    if (!user.isAuthenticated || !user.canViewStuffGallery) {
        return { success: false, error: "Accès refusé" };
    }

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, skinGalleryChannelId: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const offset = (page - 1) * PAGE_SIZE;

        // Build filtering conditions
        const where: Prisma.UserSkinWhereInput = {
            profile: {
                guildId: guildConfig.id,
                status: "ACTIVE"
            }
        };

        if (searchQuery) {
            where.OR = [
                { name: { contains: searchQuery, mode: 'insensitive' } },
                { profile: { pseudoDofus: { contains: searchQuery, mode: 'insensitive' } } },
                { profile: { discordNickname: { contains: searchQuery, mode: 'insensitive' } } }
            ];
        }

        // Advanced filter for Barbofus skins (metadata-based)
        if (classFilter || genderFilter) {
            // Note: Handle legacy values (Homme, Femme, symbols) for robust filtering
            const genderValues = genderFilter === "M" 
                ? ["M", "Homme", "♂", "Mâle"]
                : ["F", "Femme", "♀", "Femelle"];

            const conditions: Prisma.UserSkinWhereInput[] = [];

            if (classFilter) {
                const targetClass = DOFUS_CLASSES.find(c => c.icon.includes(`/${classFilter}.png`));
                const classValues = [classFilter];
                if (targetClass) classValues.push(targetClass.name);

                conditions.push({ 
                    OR: classValues.map(v => ({ metadata: { path: ["class"], equals: v } }))
                });
            }

            if (genderFilter) {
                conditions.push({ 
                    OR: genderValues.map(v => ({ metadata: { path: ["gender"], equals: v } }))
                });
            }

            if (conditions.length > 0) {
                where.AND = conditions;
            }
        }


        const [skins, total] = await Promise.all([
            db.userSkin.findMany({
                where,
                include: {
                    profile: {
                        select: {
                            id: true,
                            pseudoDofus: true,
                            discordNickname: true,
                            user: { select: { name: true, image: true } }
                        }
                    },
                    _count: {
                        select: { votes: true }
                    },
                    votes: {
                        where: { userId: user.id },
                        take: 1
                    }
                },
                orderBy: sortBy === "votes" ? { votes: { _count: 'desc' } } : { createdAt: 'desc' },
                skip: offset,
                take: PAGE_SIZE
            }),
            db.userSkin.count({ where })
        ]);

        const mappedSkins: GallerySkin[] = skins.map(s => ({
            id: s.id,
            name: s.name,
            url: s.url,
            provider: s.provider,
            thumbnailUrl: s.thumbnailUrl,
            equipment: s.equipment,
            colors: s.colors,
            metadata: s.metadata,
            author: {
                id: s.profile.id,
                name: getGameDisplayName(s.profile),
                image: s.profile.user.image
            },
            votesCount: s._count.votes,
            hasVoted: s.votes.length > 0,
            createdAt: s.createdAt
        }));

        const hasMore = offset + PAGE_SIZE < total;

        return {
            success: true,
            data: {
                skins: mappedSkins,
                total,
                hasMore,
                nextPage: hasMore ? page + 1 : null,
                isDiscordShareConfigured: !!guildConfig.skinGalleryChannelId
            }
        };
    } catch (error) {
        logger.error("Get Skin Gallery Page Error:", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Toggle vote for a skin in the gallery.
 */
export async function toggleSkinVote(guildId: string, skinId: string): Promise<ActionResponse<{ voted: boolean }>> {
    if (!guildId || !skinId) return { success: false, error: "Paramètres invalides" };

    const user = await getUserContext(guildId);
    if (!user.isAuthenticated || !user.id) {
        return { success: false, error: "Vous devez être connecté pour voter" };
    }

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const existingVote = await db.skinVote.findUnique({
            where: {
                skinId_userId: {
                    skinId,
                    userId: user.id
                }
            }
        });

        if (existingVote) {
            await db.skinVote.delete({ where: { id: existingVote.id } });
            return { success: true, data: { voted: false } };
        } else {
            await db.skinVote.create({
                data: {
                    skinId,
                    userId: user.id,
                    guildId: guildConfig.id
                }
            });
            return { success: true, data: { voted: true } };
        }
    } catch (error) {
        logger.error("Toggle Skin Vote Error:", { error });
        return { success: false, error: "Erreur serveur lors du vote" };
    }
}

/**
 * Share a gallery item (Stuff or Skin) to Discord.
 * Enforces rate limiting and handles Forum vs Text channels.
 */
export async function shareGalleryItemOnDiscord(
    guildId: string,
    itemId: string,
    type: "STUFF" | "SKIN",
    authorProfileId?: string
): Promise<ActionResponse> {
    if (!guildId || !itemId) return { success: false, error: "Paramètres invalides" };

    const user = await getUserContext(guildId);
    if (!user.isAuthenticated || !user.id || !user.profileId) {
        return { success: false, error: "Vous devez être connecté pour partager" };
    }

    let embedImage: string | undefined = undefined;
    const appUrl = getAppBaseUrl();
    try {
        const { fetchChannel, sendChannelMessage, createForumPost } = await import("@/server/discord");

        // 1. Fetch SHARER Profile and check Rate Limit
        const sharerProfile = await db.userProfile.findUnique({
            where: { id: user.profileId },
            select: { id: true, lastGalleryShareAt: true, pseudoDofus: true, discordNickname: true }
        });

        if (!sharerProfile) return { success: false, error: "Profil introuvable" };

        const COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
        if (sharerProfile.lastGalleryShareAt) {
            const elapsed = Date.now() - sharerProfile.lastGalleryShareAt.getTime();
            if (elapsed < COOLDOWN_MS) {
                const remainingSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
                const minutes = Math.floor(remainingSeconds / 60);
                const seconds = remainingSeconds % 60;
                return { 
                    success: false, 
                    error: `Anti-spam : veuillez patienter ${minutes > 0 ? `${minutes}m ` : ""}${seconds}s.` 
                };
            }
        }

        // 2. Fetch Guild Config for Channels
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { skinGalleryChannelId: true, stuffGalleryChannelId: true, id: true }
        });

        const channelId = type === "STUFF" ? guildConfig?.stuffGalleryChannelId : guildConfig?.skinGalleryChannelId;
        if (!channelId) return { success: false, error: "Le salon de partage n'est pas configuré pour cette guilde." };

        // 3. Fetch Item Details
        let embedTitle = "";
        let embedDescription = "";
        let embedThumbnail = "";
        let embedUrl = "";
        const fields: any[] = [];
        let itemName = "";
        let authorName = "Un membre";

        if (type === "STUFF") {
            // Find build globally in the guild if authorProfileId is known
            let build: any = null;
            let targetProfileId = authorProfileId;
            let authorClasse: string | null = null;

            if (authorProfileId) {
                const profile = await db.userProfile.findUnique({
                    where: { id: authorProfileId },
                    select: { dofusBookLinks: true, pseudoDofus: true, discordNickname: true, classe: true }
                });
                build = (profile?.dofusBookLinks as any[])?.find(b => b.id === itemId);
                authorName = profile?.pseudoDofus || profile?.discordNickname || authorName;
                authorClasse = profile?.classe || null;
            } else {
                // Fallback search in all guild profiles (Active)
                const profiles = await db.userProfile.findMany({
                    where: { guildId: guildConfig?.id, status: 'ACTIVE' },
                    select: { id: true, dofusBookLinks: true, pseudoDofus: true, discordNickname: true, classe: true }
                });
                for (const p of profiles) {
                    const b = (p.dofusBookLinks as any[])?.find(x => x.id === itemId);
                    if (b) {
                        build = b;
                        authorName = p.pseudoDofus || p.discordNickname || authorName;
                        authorClasse = p.classe || null;
                        targetProfileId = p.id;
                        break;
                    }
                }
            }
            if (!build) return { success: false, error: "Build introuvable" };

            // Opportunistic Auto-Bake: If previewData is missing or empty, fetch it live before sending to Discord
            if (!build.previewData || !build.previewData.stats) {
                try {
                    const { getDofusbookPreview } = await import("./dofusbook-actions");
                    const previewRes = await getDofusbookPreview(build.url);
                    if (previewRes.success && previewRes.data) {
                        build.previewData = previewRes.data;

                        // Save updated previewData back to user profile asynchronously
                        if (targetProfileId) {
                            const profileObj = await db.userProfile.findUnique({
                                where: { id: targetProfileId },
                                select: { dofusBookLinks: true }
                            });
                            const updatedLinks = ((profileObj?.dofusBookLinks as any[]) || []).map(l =>
                                l.id === build.id ? { ...l, previewData: previewRes.data, source: "dofusbook" } : l
                            );
                            await db.userProfile.update({
                                where: { id: targetProfileId },
                                data: { dofusBookLinks: updatedLinks as any }
                            }).catch(() => {});
                        }
                    }
                } catch {
                    // Ignore error, fallback to stored build info
                }
            }

            itemName = build.name;
            /**
             * 🟡 **Variante** (arbitrage du 23/10/2026) : l'embed montre les stats **effectives** et
             * un tag explicite. Une seule règle (`resolveVariantPreview`) avec l'image OG — et pas
             * de tag si le calcul a échoué (fail-closed).
             */
            const variantView = await resolveVariantPreview(build.previewData, build.variants);
            const pd = variantView.preview;
            const resolvedClassNum = canonicalClassId(
                pd?.classId ??
                build.classId ??
                build.class ??
                authorClasse
            ) || undefined;
            const className = pd?.className || (resolvedClassNum ? getClassName(resolvedClassNum) : "");
            const levelStr = pd?.level ? ` · Niv. ${pd.level}` : "";
            
            embedTitle = `🛡️ Build : ${build.name}${className ? ` (${className}${levelStr})` : ""}${variantView.variantApplied ? " · 🟡 Variante" : ""}`;
            embedUrl = build.url;
            const classNum = resolvedClassNum;
            embedThumbnail = classNum 
                ? `${appUrl}/assets/dofus/classes/${classNum === 19 ? 20 : classNum}.png`
                : `${appUrl}/assets/ui/logo-v2.png`;

            // Dynamic visual render of the inventory ring generated by SigilOS
            embedImage = `${appUrl}/api/og/build/${build.id}`;

            /**
             * 🟡 Tag **explicite** de la variante (arbitrage du 23/10/2026) : l'embed dit ce qui a
             * changé et pourquoi les stats ne sont pas celles de Dofusbook. Borné à 6 lignes.
             */
            if (variantView.variantApplied) {
                const replaced = describeSavedVariants(variantView.variants, build.previewData?.items);
                const lines = replaced
                    .slice(0, 6)
                    .map((entry) => `• **${entry.slotLabel}** : ${entry.originalName ?? "—"} → ${entry.name}`);
                if (replaced.length > 6) lines.push(`… et ${replaced.length - 6} autre(s)`);
                fields.push({
                    name: "🟡 Variante proposée",
                    value: lines.length > 0 ? lines.join("\n") : "Aucun objet remplacé",
                    inline: false,
                });
            }

            // 1. ⚔️ Caractéristiques principales
            if (pd?.stats) {
                const { pa = 6, pm = 3, po = 0, vit = 0, ini = 0, cc = 0, invo = 1 } = pd.stats;
                fields.push({
                    name: "⚔️ Caractéristiques",
                    value: `**${pa}** PA · **${pm}** PM · **${po}** PO\n💖 **${vit.toLocaleString("fr-FR")}** Vitalité\n⚡ **${ini.toLocaleString("fr-FR")}** Ini · **${invo}** Invo · **${cc}%** Crit`,
                    inline: true,
                });
            }

            // 2. 🌀 Éléments & Puissance
            if (pd?.elements) {
                const elNames: Record<string, string> = {
                    fo: "Terre",
                    in: "Feu",
                    ch: "Eau",
                    ag: "Air",
                    pu: "Puissance",
                    sa: "Sagesse",
                };
                const activeElements: string[] = [];
                Object.entries(pd.elements).forEach(([key, val]) => {
                    if (val && Number(val) > 0) {
                        const label = elNames[key] || key;
                        activeElements.push(`**+${val}** ${label}`);
                    }
                });
                if (activeElements.length > 0) {
                    fields.push({
                        name: "🌀 Éléments principaux",
                        value: activeElements.join("\n"),
                        inline: true,
                    });
                }
            }

            // 3. 🛡️ Résistances %
            if (pd?.resists) {
                const r = pd.resists;
                fields.push({
                    name: "🛡️ Résistances %",
                    value: `⚪ **${r.neutre || 0}%** N  |  🟤 **${r.terre || 0}%** T  |  🔴 **${r.feu || 0}%** F\n🔵 **${r.eau || 0}%** E  |  🟢 **${r.air || 0}%** A`,
                    inline: false,
                });
            }

            // 4. 🎒 Équipements équipés
            if (pd?.items && typeof pd.items === "object") {
                const itemNames: string[] = [];
                Object.values(pd.items).forEach((it: any) => {
                    if (it && it.name) {
                        itemNames.push(`• ${it.name}`);
                    }
                });
                if (itemNames.length > 0) {
                    let itemsStr = itemNames.join("\n");
                    if (itemsStr.length > 1000) {
                        itemsStr = itemsStr.slice(0, 980) + "\n• ... et autres équipements";
                    }
                    fields.push({
                        name: `🎒 Équipements (${itemNames.length})`,
                        value: itemsStr,
                        inline: false,
                    });
                }
            }

            // 5. ✨ Panoplies actives
            if (Array.isArray(pd?.cloths) && pd.cloths.length > 0) {
                const clothStr = pd.cloths.map((c: any) => `• **${c.name}** (${c.count}/${c.total})`).join("\n");
                if (clothStr.length <= 1024) {
                    fields.push({
                        name: "✨ Panoplies actives",
                        value: clothStr,
                        inline: false,
                    });
                }
            }

            // 6. 🏷️ Tags
            if (build.tags && build.tags.length > 0) {
                fields.push({
                    name: "🏷️ Tags",
                    value: build.tags.map((t: string) => `\`${t}\``).join(" "),
                    inline: true,
                });
            }
        } else {
            // Fetch skin from DB with Guild isolation
            const skin = await db.userSkin.findFirst({
                where: { 
                    id: itemId,
                    profile: { guildId: guildConfig?.id }
                },
                include: { profile: { select: { pseudoDofus: true, discordNickname: true } } }
            });
            if (!skin) return { success: false, error: "Skin introuvable" };

            // --- OPPORTUNISTIC RE-SCRAPE ---
            // If thumbnailUrl is missing, empty or relative, try to re-scrape the skin metadata
            // to fetch the image before sending to Discord.
            if (!skin.thumbnailUrl || !skin.thumbnailUrl.trim() || (!skin.thumbnailUrl.startsWith("http://") && !skin.thumbnailUrl.startsWith("https://") && !skin.thumbnailUrl.startsWith("//"))) {
                try {
                    const { scrapeSkinMetadata } = await import("./skin-actions");
                    const freshData = await scrapeSkinMetadata(skin.url);
                    if (freshData.thumbnailUrl) {
                        // Update DB cache for future shares
                        await db.userSkin.update({
                            where: { id: skin.id },
                            data: { thumbnailUrl: freshData.thumbnailUrl }
                        }).catch(() => {});
                        skin.thumbnailUrl = freshData.thumbnailUrl;
                    }
                } catch {
                    // Scrape failed, continue with no image
                }
            }

            itemName = skin.name;
            authorName = skin.profile.pseudoDofus || skin.profile.discordNickname || authorName;
            embedTitle = `✨ Skin : ${skin.name}`;
            embedUrl = skin.url;
            embedDescription = `Look partagé par **${authorName}**.`;
            
            // Premium UI 2026: Large image for the skin + Provider icon as thumbnail
            let rawImage = skin.thumbnailUrl?.trim();
            if (rawImage) {
                embedImage = resolveDiscordImage(rawImage, skin.url);
            } else {
                embedImage = undefined;
            }

            // Set valid thumbnail: class icon if available, otherwise SigilOS logo
            const skinClassId = (skin.metadata as any)?.class;
            const skinClassNum = skinClassId ? Number(skinClassId) : null;
            embedThumbnail = skinClassNum 
                ? `${appUrl}/assets/dofus/classes/${skinClassNum === 19 ? 20 : skinClassNum}.png`
                : `${appUrl}/assets/ui/logo-v2.png`;
            
            if ((skin.metadata as any)?.class) {
                const classData = DOFUS_CLASSES.find(c => {
                    const match = c.icon.match(/\/(\d+)\.png$/);
                    return match && match[1] === String((skin.metadata as any).class);
                });
                fields.push({ name: "Classe", value: classData ? classData.name : String((skin.metadata as any).class), inline: true });
            }
            if ((skin.metadata as any)?.gender) {
                fields.push({ name: "Sexe", value: String((skin.metadata as any).gender), inline: true });
            }
            if (Array.isArray(skin.equipment) && skin.equipment.length > 0) {
                const itemsList = skin.equipment.map((eq: any) => `• ${eq.name}${eq.type ? ` *(${eq.type})*` : ''}`).join("\n");
                if (itemsList.length <= 1024) {
                    fields.push({ name: "Équipements", value: itemsList, inline: false });
                }
            }

        }

        // 4. Determine Channel Type and Send
        const channelInfo = await fetchChannel(channelId);
        if (!channelInfo) return { success: false, error: "Impossible de joindre le salon Discord." };

        const embedOptions = {
            embedTitle,
            embedDescription,
            embedUrl,
            embedThumbnail,
            embedImage, // Large image added
            embedColor: type === "STUFF" ? 0x10b981 : 0xec4899,
            fields,
            embedFooter: `Partagé depuis SigilOS · ${new Date().toLocaleDateString()}`
        };

        let shareResult: any = null;
        try {
            if (channelInfo.type === 15) {
                // FORUM
                shareResult = await createForumPost(channelId, itemName, `Nouveau partage de ${type.toLowerCase()}`, embedOptions);
            } else {
                // TEXT CHANNEL
                shareResult = await sendChannelMessage(channelId, "", embedOptions);
            }
            logger.info(`[Gallery Share] Success: ${type} ${itemId} shared on channel ${channelId}. Result ID: ${channelInfo.type === 15 ? shareResult?.messageId : shareResult}`);
        } catch (discordError) {
            logger.error("[Gallery Share] Discord API Error:", { discordError });
            return { success: false, error: "Le salon Discord a refusé le message ou est mal configuré." };
        }

        // 5. Update last share time and SAVE discordMessageId
        const messageId = channelInfo.type === 15 ? shareResult?.messageId : shareResult;
        
        // Safety check to avoid Prisma errors if messageId is somehow weird
        if (!messageId || typeof messageId !== 'string') {
            logger.warn("[Gallery Share] No valid messageId returned from Discord, skipped DB link save.");
        }
        
        if (type === "STUFF") {
            // Find and update the JSON entry
            const profile = await db.userProfile.findUnique({
                where: { id: user.profileId },
                select: { dofusBookLinks: true }
            });
            const links = (profile?.dofusBookLinks as any[]) || [];
            const updatedLinks = links.map(l => l.id === itemId ? { ...l, discordMessageId: messageId } : l);
            
            await db.userProfile.update({
                where: { id: user.profileId },
                data: { 
                    dofusBookLinks: updatedLinks as any,
                    lastGalleryShareAt: new Date() 
                }
            });
        } else {
            // Update the column in UserSkin
            await db.userSkin.update({
                where: { id: itemId },
                data: { discordMessageId: messageId }
            });
            
            await db.userProfile.update({
                where: { id: user.profileId },
                data: { lastGalleryShareAt: new Date() }
            });
        }

        revalidatePath(`/dashboard/${guildId}/galerie-stuff`);

        return { success: true };
    } catch (error) {
        logger.error("Share Gallery Item Error:", { error });
        return { success: false, error: "Erreur lors du partage sur Discord" };
    }
}

/**
 * Sync deletion from Discord to Dashboard
 * Triggered by MESSAGE_DELETE webhook
 */
export async function handleDiscordGalleryDelete(discordGuildId: string, discordMessageId: string): Promise<void> {
    try {
        // 🔒 Scopé guilde : résout d'abord la guilde interne, puis ne touche que ses rows.
        const deleteGuild = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { id: true },
        });
        if (!deleteGuild) return;

        // 1. Try to find and delete in UserSkin
        const skin = await db.userSkin.findFirst({
            where: { discordMessageId, profile: { guildId: deleteGuild.id } },
            select: { id: true }
        });

        if (skin) {
            await db.userSkin.delete({ where: { id: skin.id } });
            logger.info(`[Gallery Sync] Deleted skin ${skin.id} after Discord message deletion`);
            revalidatePath(`/dashboard/${discordGuildId}/galerie-stuff`);
            return;
        }

        // 2. Try to find in UserProfile (JSON dofusBookLinks)
        // Guild déjà résolue en `deleteGuild` (scopé, fail-closed).
        const guild = deleteGuild;

        // Fetch all active profiles in the guild
        const profiles = await db.userProfile.findMany({
            where: { guildId: guild.id },
            select: { id: true, dofusBookLinks: true }
        });

        for (const profile of profiles) {
            const links = (profile.dofusBookLinks as any[]) || [];
            const found = links.find(l => l.discordMessageId === discordMessageId);
            if (found) {
                const updatedLinks = links.filter(l => l.discordMessageId !== discordMessageId);
                await db.userProfile.update({
                    where: { id: profile.id },
                    data: { dofusBookLinks: updatedLinks as any }
                });
                logger.info(`[Gallery Sync] Removed stuff link from profile ${profile.id} after Discord message deletion`);
                revalidatePath(`/dashboard/${discordGuildId}/galerie-stuff`);
                return;
            }
        }
    } catch (error) {
        logger.error("[Gallery Sync] Deletion sync error:", { error });
    }
}
