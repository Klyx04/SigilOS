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
    const doc = await getDocBySlug(docSlug);

    if (!doc) {
        // Fallback for hardcoded pages if they still exist in file system?
        // Actually, if we use Catch-all segments, they override file system if they match?
        // No, specific files 'intro/page.tsx' take precedence over '[...slug]'.
        // So this will only trigger for non-existant files.
        notFound();
    }

    // We use a simple server-side Markdown processor here?
    // Or just render raw if we don't want to add server-side logic?
    // User asked for "GUI based", so we store Markdown.
    // For Viewer, we need to render it. 
    // Since 'react-markdown' is client-side usually (or universal), we can use it here too if we make this a client component, 
    // OR we use a server-friendly way.
    // Making it a client component for rendering is fine for docs.

    const { getUserContext } = await import("@/server/actions/user-actions");
    const ctx = await getUserContext();

    return <DocViewer
        content={doc.content}
        title={doc.title}
        lastUpdate={doc.updatedAt}
        canEdit={ctx.isAdmin}
        editUrl={`/god/docs/${doc.id}`}
    />;
}

// Client Component for Rendering

