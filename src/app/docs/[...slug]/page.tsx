import { getDocBySlug } from "@/server/actions/doc-actions";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { DocViewer } from "./_components/doc-viewer";

type Props = {
    params: Promise<{ slug: string[] }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const docSlug = slug.join("/");
    const doc = await getDocBySlug(docSlug);

    if (!doc) return { title: "404 - Document non trouvé" };

    return {
        title: `${doc.title} - Documentation SigilOS`,
    };
}

export default async function DocPage({ params }: Props) {
    const { slug } = await params;
    const docSlug = slug.join("/");

    const { getUserContext } = await import("@/server/actions/user-actions");
    const { getAllDocs, getDocBySlug } = await import("@/server/actions/doc-actions");

    const [doc, allDocs, ctx] = await Promise.all([
        getDocBySlug(docSlug),
        getAllDocs(),
        getUserContext()
    ]);

    if (!doc) {
        notFound();
    }

    // Calculate Pagination (Sequential Navigation)
    const currentIndex = allDocs.findIndex(d => d.slug === docSlug);
    const prevDoc = currentIndex > 0 ? allDocs[currentIndex - 1] : null;
    const nextDoc = currentIndex < allDocs.length - 1 ? allDocs[currentIndex + 1] : null;

    // Generate Breadcrumbs (Hierarchy: Docs > Category > Title)
    const breadcrumbs = [
        { label: doc.category, href: `/docs` }, // Categories point to docs home for now
        { label: doc.title, href: `/docs/${doc.slug}` }
    ];

    return <DocViewer
        content={doc.content}
        title={doc.title}
        lastUpdate={doc.updatedAt.toISOString()}
        canEdit={ctx.isAdmin}
        editUrl={`/god/docs/${doc.id}`}
        prev={prevDoc}
        next={nextDoc}
        breadcrumbs={breadcrumbs}
        guildId={ctx.guildId}
    />;
}

// Client Component for Rendering

