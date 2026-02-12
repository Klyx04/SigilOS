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
};

// --- PUBLIC FETCHERS ---

export async function getDocBySlug(slug: string): Promise<DocPageData | null> {
    try {
        const doc = await db.docPage.findUnique({
            where: { slug }
        });
        if (!doc || !doc.isPublished) return null;
        return doc;
    } catch (error) {
        console.error("Error fetching doc:", error);
        return null;
    }
}

export async function getAllDocs(): Promise<Omit<DocPageData, "content" | "updatedAt" | "createdAt">[]> {
    const start = performance.now();
    try {
        const docs = await db.docPage.findMany({
            where: { isPublished: true },
            select: {
                id: true,
                slug: true,
                title: true,
                category: true,
                order: true,
                isPublished: true
            },
            orderBy: [
                { category: 'asc' },
                { order: 'asc' }
            ]
        });
        const end = performance.now();
        console.log(`[getAllDocs] Fetched ${docs.length} docs in ${end - start}ms`);
        return docs;
    } catch (error) {
        console.error("Error fetching all docs:", error);
        return [];
    }
}

// Optimized for search (lightweight but deep)
export async function getSearchableDocs() {
    try {
        const docs = await db.docPage.findMany({
            where: { isPublished: true },
            select: { title: true, slug: true, category: true, content: true },
            orderBy: { title: 'asc' }
        });

        // Process content to create lightweight text excerpts
        return docs.map(doc => {
            // Strip markdown chars roughly
            const plainText = doc.content
                ?.replace(/#{1,6}\s/g, '') // Headers
                .replace(/(\*\*|__)(.*?)\1/g, '$2') // Bold
                .replace(/(\*|_)(.*?)\1/g, '$2') // Italic
                .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
                .replace(/`{1,3}[^`]*`{1,3}/g, '') // Code blocks (remove entirely or keep content? removing for noise)
                .replace(/\n/g, ' ') // Newlines to spaces
                .slice(0, 300) || ""; // Limit to 300 chars

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
        let doc;
        if (data.id) {
            // Update
            doc = await db.docPage.update({
                where: { id: data.id },
                data: {
                    slug: data.slug,
                    title: data.title,
                    content: sanitizedContent,
                    category: data.category,
                    order: data.order ?? 0,
                    isPublished: data.isPublished ?? true
                }
            });
        } else {
            // Create
            // Check slug uniqueness
            const existing = await db.docPage.findUnique({ where: { slug: data.slug } });
            if (existing) return { success: false, error: "Slug already exists" };

            doc = await db.docPage.create({
                data: {
                    slug: data.slug,
                    title: data.title,
                    content: sanitizedContent,
                    category: data.category,
                    order: data.order ?? 0,
                    isPublished: data.isPublished ?? true
                }
            });
        }

        revalidatePath("/docs");
        revalidatePath(`/docs/${doc.slug}`);
        return { success: true, data: doc };

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

    return await db.docPage.findMany({
        orderBy: [
            { category: 'asc' },
            { order: 'asc' }
        ]
    });
}
