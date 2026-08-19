"use server";

import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import { isSuperAdmin } from "./super-admin-actions";
import { createGodAuditLog } from "./audit-actions";
import { processAndSaveImage } from "@/lib/image-downloader";
import { revalidatePath } from "next/cache";

type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

export interface PublicLandingScreen {
    id: string;
    label?: string | null;
    title?: string | null;
    description?: string | null;
    imageUrl: string;
    alt?: string | null;
    sortOrder: number;
}

const DEFAULT_PRODUCT_STORY: Omit<PublicLandingScreen, "id">[] = [
    {
        label: "Guides",
        title: "Une quête devient un rendez-vous de guilde.",
        description: "Coordonnées copiables, position de reprise, étapes validées et membres actuellement sur le même objectif : le guide devient collectif.",
        imageUrl: "/assets/screenshots/guide-complet.png",
        alt: "Guide de quête SigilOS : étapes, positions et membres présents sur le même objectif",
        sortOrder: 0,
    },
    {
        label: "Sorties & groupes",
        title: "Une sortie ne se perd plus dans un salon Discord.",
        description: "Créez le groupe, définissez les besoins, partagez les succès visés et notifiez uniquement les rôles concernés.",
        imageUrl: "/assets/screenshots/screenshot3.png",
        alt: "Calendrier de sorties SigilOS : groupes, besoins de classe et notifications",
        sortOrder: 1,
    },
    {
        label: "Progression",
        title: "Voyez ce que votre guilde accomplit vraiment.",
        description: "Missions, Dofus, Songes et services : des signaux clairs pour décider quoi faire ce soir.",
        imageUrl: "/assets/screenshots/screenshot6.png",
        alt: "Validation des missions de guilde SigilOS : progression et statistiques",
        sortOrder: 2,
    },
];

/**
 * 🖼️ #140 — Lecture PUBLIQUE des screens de la landing.
 * Sans session requise : retourne les screens actifs de la section demandée.
 * - `section="product-story"` : **merge** onglets par défaut (Guides / Sorties & groupes / Progression)
 *   + onglets créés par le God. Un screen dont le libellé correspond à un onglet par défaut
 *   REMPLACE son image ; les autres s'ajoutent à la fin. → ajouter des onglets ne supprime jamais les 3 existants.
 * - `section="hero"` : 1 seule image (la 1ʳᵉ active). Si aucune → la landing garde son image par défaut.
 */
export async function getPublicLandingScreens(section = "product-story"): Promise<ActionResponse<PublicLandingScreen[]>> {
    try {
        const screens = await db.landingScreen.findMany({
            where: { section, enabled: true },
            select: {
                id: true, label: true, title: true, description: true,
                imageUrl: true, alt: true, sortOrder: true,
            },
            orderBy: { sortOrder: "asc" },
        });

        if (section !== "product-story") {
            return { success: true, data: screens.map(s => ({ ...s })) };
        }

        // Merge : les onglets du God s'ajoutent aux défauts ; un libellé identique remplace
        // l'image par défaut (toutes les images portant ce libellé forment la galerie de l'onglet).
        const defaultLabels = new Set(DEFAULT_PRODUCT_STORY.map(d => (d.label || "").toLowerCase().trim()));
        const overrides = screens.filter(s => s.label && defaultLabels.has(s.label.toLowerCase().trim()));
        const extras = screens.filter(s => !s.label || !defaultLabels.has(s.label.toLowerCase().trim()));

        const merged: PublicLandingScreen[] = [];
        for (const def of DEFAULT_PRODUCT_STORY) {
            const key = (def.label || "").toLowerCase().trim();
            const matching = overrides.filter(o => (o.label || "").toLowerCase().trim() === key);
            if (matching.length > 0) {
                merged.push(...matching.map((o, i) => ({ ...o, sortOrder: def.sortOrder + i / 100 })));
            } else {
                merged.push({ id: `default-${def.sortOrder}`, ...def });
            }
        }
        merged.push(...extras.map(s => ({ ...s })));

        return { success: true, data: merged };
    } catch (error) {
        logger.error("[getPublicLandingScreens] Error:", error);
        if (section === "product-story") {
            return { success: true, data: DEFAULT_PRODUCT_STORY.map((d, i) => ({ id: `default-${i}`, ...d })) };
        }
        return { success: true, data: [] };
    }
}

/** 🖼️ #140 — Liste complète (God) : tous les screens, activés ou non. */
export async function getLandingScreensAdmin(section = "product-story"): Promise<ActionResponse<any[]>> {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Accès refusé" };

    try {
        const screens = await db.landingScreen.findMany({
            where: { section },
            orderBy: { sortOrder: "asc" },
        });
        return { success: true, data: screens };
    } catch (error) {
        logger.error("[getLandingScreensAdmin] Error:", error);
        return { success: false, error: "Erreur lors du chargement" };
    }
}

/**
 * 🖼️ #140 — Upload d'un screen de la landing (God).
 * Valide le type MIME + borne la taille (10 Mo, fail-closed avant lecture buffer),
 * optimise en WebP (max 1920px) vers public/uploads/landing/ et crée/enregistre la ligne.
 */
export async function uploadLandingScreen(input: {
    file: File;
    section?: string;
    label?: string;
    title?: string;
    description?: string;
    alt?: string;
    slug?: string;
}): Promise<ActionResponse<any>> {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Accès refusé" };

    const { file, section = "product-story" } = input;

    if (!file || file.size === 0) return { success: false, error: "Fichier manquant" };
    if (!file.type.startsWith("image/")) return { success: false, error: "Le fichier doit être une image" };

    const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_UPLOAD_BYTES) {
        return { success: false, error: `Fichier trop volumineux (max 10 Mo, reçu ${Math.round((file.size / 1024 / 1024) * 10) / 10} Mo)` };
    }

    try {
        const buffer = Buffer.from(await file.arrayBuffer());
        // 🔑 Slug UNIQUE par upload : le slug du client est dérivé du libellé → deux uploads
        // avec le même libellé écraseraient le même fichier (vignettes identiques dans la galerie).
        const baseSlug = (input.slug || "screen").toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 50) || "screen";
        const slug = `${baseSlug}-${Date.now()}`;
        // 📁 Le répertoire de destination (`private_uploads/landing/`) est une CONSTANTE gérée
        // dans image-downloader.ts (destDirFor("landing")) — on ne passe ici que le nom de
        // fichier. Le middleware proxy réécrit `/uploads/*` → `/api/storage/*` (qui sert depuis
        // `private_uploads/`) : l'URL publique reste `/uploads/landing/{slug}.webp`.
        const saved = await processAndSaveImage(buffer, `${slug}.webp`, "landing", buffer.length);
        if (!saved.success || !saved.path) {
            return { success: false, error: saved.error || "Échec du traitement de l'image" };
        }

        const publicUrl = `/uploads/landing/${slug}.webp`;

        const last = await db.landingScreen.findFirst({
            where: { section },
            orderBy: { sortOrder: "desc" },
            select: { sortOrder: true },
        });

        const screen = await db.landingScreen.create({
            data: {
                section,
                label: input.label || "",
                title: input.title || "",
                description: input.description || "",
                alt: input.alt || input.title || input.label || "Capture d'écran SigilOS",
                imageUrl: publicUrl,
                sortOrder: (last?.sortOrder ?? -1) + 1,
            },
        });

        await createGodAuditLog({
            action: "GOD_GAME_DATA_UPDATE",
            targetType: "DATA_SYNC",
            metadata: { op: "LANDING_SCREEN_UPLOAD", section, imageUrl: publicUrl },
        }).catch(() => null);

        revalidatePath("/");
        return { success: true, data: screen };
    } catch (error: any) {
        logger.error("[uploadLandingScreen] Error:", error);
        return { success: false, error: "Erreur lors de l'upload" };
    }
}

/** 🖼️ #140 — Mise à jour des métadonnées / visibilité d'un screen (God). */
export async function updateLandingScreen(id: string, data: {
    label?: string;
    title?: string;
    description?: string;
    alt?: string;
    enabled?: boolean;
}): Promise<ActionResponse> {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Accès refusé" };

    try {
        await db.landingScreen.update({
            where: { id },
            data: {
                label: data.label,
                title: data.title,
                description: data.description,
                alt: data.alt,
                enabled: data.enabled,
            },
        });
        revalidatePath("/");
        return { success: true };
    } catch (error) {
        logger.error("[updateLandingScreen] Error:", error);
        return { success: false, error: "Erreur lors de la mise à jour" };
    }
}

/** 🖼️ #140 — Suppression d'un screen (God) + suppression du fichier associé (anti-orphelins). */
export async function deleteLandingScreen(id: string): Promise<ActionResponse> {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Accès refusé" };

    try {
        const existing = await db.landingScreen.findUnique({ where: { id }, select: { imageUrl: true } });

        await db.landingScreen.delete({ where: { id } });

        // Supprime aussi le fichier local si l'image vit dans nos uploads (best-effort, non bloquant).
        if (existing?.imageUrl?.startsWith("/uploads/landing/")) {
            const { unlink } = await import("fs/promises");
            const { join } = await import("path");
            const filePath = join(process.cwd(), "private_uploads", "landing", existing.imageUrl.replace("/uploads/landing/", ""));
            await unlink(filePath).catch(() => null);
        }

        await createGodAuditLog({
            action: "GOD_GAME_DATA_UPDATE",
            targetType: "DATA_SYNC",
            metadata: { op: "LANDING_SCREEN_DELETE", id },
        }).catch(() => null);
        revalidatePath("/");
        return { success: true };
    } catch (error) {
        logger.error("[deleteLandingScreen] Error:", error);
        return { success: false, error: "Erreur lors de la suppression" };
    }
}

/** 🖼️ #140 — Réordonnancement (God) : tableau d'ids dans l'ordre souhaité. */
export async function reorderLandingScreens(orderedIds: string[]): Promise<ActionResponse> {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Accès refusé" };

    try {
        await db.$transaction(
            orderedIds.map((id, index) =>
                db.landingScreen.update({ where: { id }, data: { sortOrder: index } })
            )
        );
        revalidatePath("/");
        return { success: true };
    } catch (error) {
        logger.error("[reorderLandingScreens] Error:", error);
        return { success: false, error: "Erreur lors du réordonnancement" };
    }
}

