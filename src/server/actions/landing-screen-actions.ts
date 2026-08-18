"use server";

import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import { isSuperAdmin } from "./super-admin-actions";
import { createGodAuditLog } from "./audit-actions";
import { processAndSaveImage } from "@/lib/image-downloader";
import { normalize } from "path";
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
 * Si aucun screen n'a encore été configuré par le God → fallback sur les captures par défaut.
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

        const data = screens.map(s => ({ ...s }));
        if (data.length === 0) {
            return { success: true, data: DEFAULT_PRODUCT_STORY.map((d, i) => ({ id: `default-${i}`, ...d })) };
        }
        return { success: true, data };
    } catch (error) {
        logger.error("[getPublicLandingScreens] Error:", error);
        return { success: true, data: DEFAULT_PRODUCT_STORY.map((d, i) => ({ id: `default-${i}`, ...d })) };
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
        const slug = (input.slug || `${Date.now()}`).toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 60);
        const destination = normalize(`${process.cwd()}/public/uploads/landing/${slug}.webp`);

        const saved = await processAndSaveImage(buffer, destination, "landing", buffer.length);
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

/** 🖼️ #140 — Suppression d'un screen (God). */
export async function deleteLandingScreen(id: string): Promise<ActionResponse> {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Accès refusé" };

    try {
        await db.landingScreen.delete({ where: { id } });
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

