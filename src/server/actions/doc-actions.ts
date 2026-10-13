"use server";

import { db } from "@/lib/prisma";
import { getUserContext, ActionResponse } from "@/server/actions/user-actions";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { docSlugOrFallback } from "@/lib/doc-slug";

// --- TYPES ---

export type DocPageData = {
    id: string;
    slug: string;
    title: string;
    content: string;
    category: string;
    order: number;
    isPublished: boolean;
    accessLevel: "PUBLIC" | "MEMBER" | "ADMIN";
    guildId?: string | null;
    updatedAt: string;
    createdAt: string;
};

export type CreateDocInput = {
    slug: string;
    title: string;
    content: string;
    category: string;
    order?: number;
    isPublished?: boolean;
    accessLevel?: "PUBLIC" | "MEMBER" | "ADMIN";
    guildId?: string | null;
};

// --- PUBLIC FETCHERS ---

export async function getDocBySlug(slug: string, guildId?: string): Promise<DocPageData | null> {
    try {
        const ctx = await getUserContext(guildId);
        const doc = await (db.docPage as any).findUnique({
            where: { slug }
        });

        if (!doc || !doc.isPublished) return null;

        // RBAC Check (Admin pages)
        if ((doc as any).accessLevel === "ADMIN") {
            // Priority 1: Super Admin (God mode)
            const { isSuperAdmin } = await import("@/server/actions/super-admin-actions");
            const isGod = await isSuperAdmin();
            if (isGod) return doc as unknown as DocPageData;

            // Priority 2: Delegated Admin Access (Guild Admins or specialized roles)
            if (!ctx.canViewAdminDocs) return null;
        }

        // RBAC Check (Member pages) : exige une connexion authentifiée
        if ((doc as any).accessLevel === "MEMBER") {
            if (!ctx.isAuthenticated) return null;
        }

        // Guild Isolation Check
        if ((doc as any).guildId && (doc as any).guildId !== guildId) return null;

        return {
            id: (doc as any).id,
            slug: (doc as any).slug,
            title: (doc as any).title,
            content: (doc as any).content,
            category: (doc as any).category,
            order: (doc as any).order,
            isPublished: (doc as any).isPublished,
            accessLevel: (doc as any).accessLevel,
            guildId: (doc as any).guildId,
            updatedAt: (doc as any).updatedAt ? new Date((doc as any).updatedAt).toISOString() : new Date().toISOString(),
            createdAt: (doc as any).createdAt ? new Date((doc as any).createdAt).toISOString() : new Date().toISOString()
        };
    } catch (error) {
        logger.error("Error fetching doc:", error);
        return null;
    }
}

export async function getAllDocs(guildId?: string): Promise<Omit<DocPageData, "content" | "updatedAt" | "createdAt">[]> {
    const start = performance.now();
    try {
        const ctx = await getUserContext(guildId);

        // 🛡️ Build structural WHERE clause
        const where: any = { isPublished: true };

        // 1. RBAC Check: publics see PUBLIC ; members see PUBLIC + MEMBER ;
        //    admins/superadmins see all
        if (!ctx.canViewAdminDocs) {
            // Check if Super Admin (God mode)
            const { isSuperAdmin } = await import("@/server/actions/super-admin-actions");
            const isGod = await isSuperAdmin();
            if (!isGod) {
                // Membres connectés : PUBLIC + MEMBER ; visiteurs non connectés : PUBLIC
                where.accessLevel = ctx.isAuthenticated ? { in: ["PUBLIC", "MEMBER"] } : "PUBLIC";
            }
        }

        // 2. Guild Isolation: Global docs (null) + Current Guild
        if (guildId) {
            where.OR = [
                { guildId: null },
                { guildId: guildId }
            ];
        } else {
            where.guildId = null;
        }

        const docs = await (db.docPage as any).findMany({
            where,
            select: {
                id: true,
                slug: true,
                title: true,
                category: true,
                order: true,
                isPublished: true,
                accessLevel: true,
                guildId: true
            },
            orderBy: [
                { category: 'asc' },
                { order: 'asc' }
            ]
        });

        const end = performance.now();

        // Explicit mapping to ensure absolute serialization safety
        // Prevents any hidden internal Prisma properties from leaking to Client Components
        return docs.map((doc: any) => ({
            id: doc.id,
            slug: doc.slug,
            title: doc.title,
            category: doc.category,
            order: doc.order,
            isPublished: doc.isPublished,
            accessLevel: doc.accessLevel,
            guildId: doc.guildId
        }));
    } catch (error) {
        logger.error("Error fetching all docs", { error, guildId });
        return [];
    }
}

// Optimized for search (lightweight but deep)
export async function getSearchableDocs(guildId?: string) {
    try {
        const ctx = await getUserContext(guildId);
        const where: any = { isPublished: true };

        if (!ctx.canViewAdminDocs) {
            // Double check if Super Admin for search
            const { isSuperAdmin } = await import("@/server/actions/super-admin-actions");
            const isGod = await isSuperAdmin();
            if (!isGod) {
                where.accessLevel = "PUBLIC";
            }
        }
        if (guildId) {
            where.OR = [{ guildId: null }, { guildId: guildId }];
        } else {
            where.guildId = null;
        }

        const docs = await (db.docPage as any).findMany({
            where,
            select: { title: true, slug: true, category: true, content: true },
            orderBy: { title: 'asc' }
        });

        return docs.map((doc: any) => {
            const plainText = doc.content
                ?.replace(/<[^>]*>/g, " ") // Strip HTML tags
                .replace(/#{1,6}\s/g, "")
                .replace(/(\*\*|__)(.*?)\1/g, "$2")
                .replace(/(\*|_)(.*?)\1/g, "$2")
                .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
                .replace(/`{1,3}[^`]*`{1,3}/g, "")
                .replace(/\n/g, " ")
                .replace(/\s+/g, " ") // Clean up spaces
                .trim()
                .slice(0, 200) || "";

            return {
                title: doc.title,
                slug: doc.slug,
                category: doc.category,
                excerpt: plainText
            };
        });
    } catch (error) {
        logger.error("Error fetching searchable docs:", error);
        return [];
    }
}

// --- ADMIN ACTIONS ---

export async function saveDoc(data: CreateDocInput & { id?: string }): Promise<ActionResponse<DocPageData>> {
    const { isSuperAdmin, canAccessBrick } = await import("@/server/actions/super-admin-actions");
    const isAdmin = await isSuperAdmin();
    const isBrick = await canAccessBrick("docs");
    if (!isAdmin && !isBrick) return { success: false, error: "Unauthorized: Admins only" };
    const isSubGod = !isAdmin && isBrick;

    const { sanitizeHtml } = await import("@/lib/security");

    // Sanitize content (allow rich HTML but strip scripts)
    // No length limit specified in original (database likely text/varchar)
    // Default limit in lib is 20000 chars, let's bump it for docs or leave undefined
    const sanitizedContent = sanitizeHtml(data.content, 5000000, false) || "";

    try {
        let doc: any;
        if (data.id) {
            // Update
            doc = await (db.docPage as any).update({
                where: { id: data.id },
                data: {
                    slug: data.slug,
                    title: data.title,
                    content: sanitizedContent,
                    category: data.category,
                    order: data.order ?? 0,
                    isPublished: data.isPublished ?? true,
                    // 🔒 Défaut **MEMBER**, pas PUBLIC (10/12/2026) : la doc est réservée aux
                    // membres de guildes — `/docs` exige une session *et* une guilde. Une fiche
                    // créée sans niveau explicite ne doit pas atterrir sur le niveau le plus large.
                    accessLevel: data.accessLevel || "MEMBER",
                    guildId: data.guildId
                }
            });
        } else {
            // Create
            // 🔑 Le slug n'est plus un champ à gérer (demande user du 10/12/2026) : il se déduit
            // du titre. Une collision n'est pas une erreur pour l'auteur — c'est un doublon de
            // titre — donc on suffixe (`-2`, `-3`…) au lieu de renvoyer « Slug already exists ».
            const desired = docSlugOrFallback((data.slug ?? "").trim() || data.title);
            let slug = desired;
            let suffix = 1;
            while (await db.docPage.findUnique({ where: { slug }, select: { id: true } })) {
                suffix += 1;
                slug = `${desired}-${suffix}`;
            }

            doc = await (db.docPage as any).create({
                data: {
                    slug,
                    title: data.title,
                    content: sanitizedContent,
                    category: data.category,
                    order: data.order ?? 0,
                    isPublished: data.isPublished ?? true,
                    accessLevel: data.accessLevel || "MEMBER",
                    guildId: data.guildId
                }
            });
        }

        if (isSubGod) {
            const { createGodAuditLog } = await import("@/server/actions/audit-actions");
            await createGodAuditLog({
                action: "GOD_DOC_UPDATE",
                targetType: "DATA_SYNC",
                targetId: String(doc?.id ?? ""),
                metadata: { op: data.id ? "update-doc" : "create-doc", slug: doc?.slug },
            });
        }
        revalidatePath("/docs");
        revalidatePath(`/docs/${doc.slug}`);
        return { success: true, data: doc as unknown as DocPageData };

    } catch (error) {
        logger.error("Error saving doc:", error);
        return { success: false, error: "Database error" };
    }
}

export async function deleteDoc(id: string): Promise<ActionResponse<void>> {
    const { isSuperAdmin, canAccessBrick } = await import("@/server/actions/super-admin-actions");
    const isAdmin = await isSuperAdmin();
    const isBrick = await canAccessBrick("docs");
    if (!isAdmin && !isBrick) return { success: false, error: "Unauthorized" };

    try {
        await db.docPage.delete({ where: { id } });
        if (!isAdmin) {
            const { createGodAuditLog } = await import("@/server/actions/audit-actions");
            await createGodAuditLog({
                action: "GOD_DOC_UPDATE",
                targetType: "DATA_SYNC",
                targetId: id,
                metadata: { op: "delete-doc" },
            });
        }
        revalidatePath("/docs");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to delete" };
    }
}

// Admin Fetcher (Gets unpublished too)
export async function getAdminDocs(): Promise<DocPageData[]> {
    const { isSuperAdmin, canAccessBrick } = await import("@/server/actions/super-admin-actions");
    const isAdmin = await isSuperAdmin();
    // P2 — même gate que la page /god/docs : un sous-god avec la brique "docs" liste aussi.
    if (!isAdmin && !(await canAccessBrick("docs"))) return [];

    const docs = await (db.docPage as any).findMany({
        orderBy: [
            { category: 'asc' },
            { order: 'asc' }
        ]
    });

    return docs as DocPageData[];
}

/**
 * Crée les pages de couverture manquantes « un module = une fiche »
 * (`MODULE_DOC_COVERAGE`) — création **seule** : un slug existant n'est
 * jamais touché (ni écrasé, ni republié). Idempotente : rejouable sans effet.
 */
export async function createMissingModuleDocsAction(): Promise<ActionResponse<{ created: string[] }>> {
    const { isSuperAdmin, canAccessBrick } = await import("@/server/actions/super-admin-actions");
    const isAdmin = await isSuperAdmin();
    const isBrick = await canAccessBrick("docs");
    if (!isAdmin && !isBrick) return { success: false, error: "Non autorisé" };

    try {
        const { missingModuleDocSlugs, missingDocStarterContent } = await import("@/lib/docs-modules");
        const { moduleLabel } = await import("@/lib/module-catalog");
        const { sanitizeHtml } = await import("@/lib/security");

        const existing = await (db.docPage as any).findMany({ select: { slug: true } });
        const missing = missingModuleDocSlugs(existing.map((d: any) => d.slug));

        const created: string[] = [];
        for (const page of missing) {
            const already = await (db.docPage as any).findUnique({
                where: { slug: page.slug },
                select: { id: true },
            });
            if (already) continue;
            await (db.docPage as any).create({
                data: {
                    slug: page.slug,
                    title: page.title,
                    content: sanitizeHtml(
                        missingDocStarterContent(page.title, moduleLabel(page.moduleKey), page.scope),
                        5000000,
                        false
                    ) || "",
                    category: page.category,
                    order: 0,
                    isPublished: true,
                    accessLevel: page.accessLevel,
                    guildId: null,
                },
            });
            created.push(page.slug);
        }

        if (!isAdmin) {
            const { createGodAuditLog } = await import("@/server/actions/audit-actions");
            await createGodAuditLog({
                action: "GOD_DOC_UPDATE",
                targetType: "DATA_SYNC",
                targetId: "missing-module-docs",
                metadata: { op: "create-missing-docs", created },
            });
        }
        revalidatePath("/docs");
        revalidatePath("/god/docs");
        logger.info(`[DOCS] Pages de couverture créées : ${created.length}`, { created });

        return { success: true, data: { created } };
    } catch (error) {
        logger.error("Error creating missing module docs:", error);
        return { success: false, error: "Erreur lors de la création des pages manquantes" };
    }
}
