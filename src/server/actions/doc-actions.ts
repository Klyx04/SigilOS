"use server";

import { db } from "@/lib/prisma";
import { getUserContext, ActionResponse } from "@/server/actions/user-actions";
import { revalidatePath } from "next/cache";

// --- TYPES ---

export type DocPageData = {
    id: string;
    slug: string;
    title: string;
    content: string;
    category: string;
    order: number;
    isPublished: boolean;
    accessLevel: "PUBLIC" | "ADMIN";
    guildId?: string | null;
    updatedAt: Date;
    createdAt: Date;
};

export type CreateDocInput = {
    slug: string;
    title: string;
    content: string;
    category: string;
    order?: number;
    isPublished?: boolean;
    accessLevel?: "PUBLIC" | "ADMIN";
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

        // RBAC Check
        if ((doc as any).accessLevel === "ADMIN") {
            if (!ctx.isAdmin) return null;
        }

        // Guild Isolation Check
        if ((doc as any).guildId && (doc as any).guildId !== guildId) return null;

        return doc as unknown as DocPageData;
    } catch (error) {
        console.error("Error fetching doc:", error);
        return null;
    }
}

export async function getAllDocs(guildId?: string): Promise<Omit<DocPageData, "content" | "updatedAt" | "createdAt">[]> {
    const start = performance.now();
    try {
        const ctx = await getUserContext(guildId);

        // 🛡️ Build structural WHERE clause
        const where: any = { isPublished: true };

        // 1. RBAC Check: Members only see PUBLIC docs
        if (!ctx.isAdmin) {
            where.accessLevel = "PUBLIC";
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
        console.log(`[getAllDocs] Fetched ${docs.length} docs in ${end - start}ms`);
        return docs as any;
    } catch (error) {
        console.error("Error fetching all docs:", error);
        return [];
    }
}

// Optimized for search (lightweight but deep)
export async function getSearchableDocs(guildId?: string) {
    try {
        const ctx = await getUserContext(guildId);
        const where: any = { isPublished: true };

        if (!ctx.isAdmin) where.accessLevel = "PUBLIC";
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
        console.error("Error fetching searchable docs:", error);
        return [];
    }
}

// --- ADMIN ACTIONS ---

export async function saveDoc(data: CreateDocInput & { id?: string }): Promise<ActionResponse<DocPageData>> {
    const ctx = await getUserContext();
    if (!ctx.isAdmin) return { success: false, error: "Unauthorized: Admins only" };

    const { sanitizeHtml } = await import("@/lib/security");

    // Sanitize content (allow rich HTML but strip scripts)
    // No length limit specified in original (database likely text/varchar)
    // Default limit in lib is 20000 chars, let's bump it for docs or leave undefined
    const sanitizedContent = sanitizeHtml(data.content, 100000, false) || "";

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
                    accessLevel: data.accessLevel || "PUBLIC",
                    guildId: data.guildId
                }
            });
        } else {
            // Create
            // Check slug uniqueness
            const existing = await db.docPage.findUnique({ where: { slug: data.slug } });
            if (existing) return { success: false, error: "Slug already exists" };

            doc = await (db.docPage as any).create({
                data: {
                    slug: data.slug,
                    title: data.title,
                    content: sanitizedContent,
                    category: data.category,
                    order: data.order ?? 0,
                    isPublished: data.isPublished ?? true,
                    accessLevel: data.accessLevel || "PUBLIC",
                    guildId: data.guildId
                }
            });
        }

        revalidatePath("/docs");
        revalidatePath(`/docs/${doc.slug}`);
        return { success: true, data: doc as unknown as DocPageData };

    } catch (error) {
        console.error("Error saving doc:", error);
        return { success: false, error: "Database error" };
    }
}

export async function deleteDoc(id: string): Promise<ActionResponse<void>> {
    const ctx = await getUserContext();
    if (!ctx.isAdmin) return { success: false, error: "Unauthorized" };

    try {
        await db.docPage.delete({ where: { id } });
        revalidatePath("/docs");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to delete" };
    }
}

// Admin Fetcher (Gets unpublished too)
export async function getAdminDocs(): Promise<DocPageData[]> {
    const ctx = await getUserContext();
    if (!ctx.isAdmin) return [];

    const docs = await (db.docPage as any).findMany({
        orderBy: [
            { category: 'asc' },
            { order: 'asc' }
        ]
    });

    return docs as DocPageData[];
}
