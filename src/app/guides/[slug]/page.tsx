import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { JsonLd } from "@/components/shared/json-ld";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { auth } from "@/auth";
import { getAppBaseUrl } from "@/lib/utils";
import { getGuideBySlug, getGuideContent } from "@/content/guides";
import { DocContent } from "@/components/doc/doc-content";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const guide = getGuideBySlug(slug);

    if (!guide) {
        return {
            title: "Guide introuvable",
            robots: { index: false, follow: false },
        };
    }

    const ogImageUrl = `${getAppBaseUrl()}/api/og?title=${encodeURIComponent(guide.title)}&subtitle=Guide%20Officiel%20SigilOS`;

    return {
        title: guide.title,
        description: guide.description,
        alternates: {
            canonical: `${getAppBaseUrl()}/guides/${guide.slug}`,
        },
        openGraph: {
            type: "article",
            title: guide.title,
            description: guide.description,
            url: `${getAppBaseUrl()}/guides/${guide.slug}`,
            images: [
                {
                    url: ogImageUrl,
                    width: 1200,
                    height: 630,
                    alt: guide.title,
                    type: "image/png",
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: guide.title,
            description: guide.description,
            images: [ogImageUrl],
        },
        // Les brouillons ne doivent jamais être indexés
        robots: guide.draft
            ? { index: false, follow: false, googleBot: { index: false, follow: false } }
            : { index: true, follow: true },
    };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const meta = getGuideBySlug(slug);
    const content = await getGuideContent(slug);

    if (!meta || !content) {
        notFound();
    }

    const session = await auth();
    const { getUserContext } = await import("@/server/actions/user-actions");
    const userContext = await getUserContext();

    // [AUDIT 2026] Retrieve nonce for inline scripts
    const headersList = await headers();
    const nonce = headersList.get('x-nonce') ?? '';

    return (
        <div className="registre min-h-screen w-full flex flex-col bg-background text-foreground">
            <PublicHeader user={session?.user} activePage="guides" isMember={userContext.isMember} />

            <main className="flex-1">
                <div className="reg-shell py-10 lg:py-14">
                    <JsonLd
                        id="json-ld-guide-article"
                        nonce={nonce}
                        data={[
                            {
                                "@context": "https://schema.org",
                                "@type": "BreadcrumbList",
                                "itemListElement": [
                                    { "@type": "ListItem", "position": 1, "name": "Accueil", "item": getAppBaseUrl() },
                                    { "@type": "ListItem", "position": 2, "name": "Guides", "item": `${getAppBaseUrl()}/guides` },
                                    { "@type": "ListItem", "position": 3, "name": meta.title, "item": `${getAppBaseUrl()}/guides/${meta.slug}` },
                                ],
                            },
                            {
                                "@context": "https://schema.org",
                                "@type": "Article",
                                "headline": meta.title,
                                "description": meta.description,
                                "datePublished": new Date(meta.publishedAt).toISOString(),
                                "dateModified": new Date(meta.updatedAt).toISOString(),
                                "author": { "@type": "Organization", "name": "SigilOS", "url": getAppBaseUrl() },
                                "publisher": { "@type": "Organization", "name": "SigilOS", "url": getAppBaseUrl() },
                                "inLanguage": "fr-FR",
                            },
                        ]}
                    />

                    <nav aria-label="Fil d'Ariane" className="mb-6">
                        <Link href="/guides" className="reg-link-quiet text-sm">
                            ← Tous les guides
                        </Link>
                    </nav>

                    <article>
                        <header>
                            <p className="reg-eyebrow">{meta.category ?? "Guide"}</p>
                            <h1 className="mt-3 max-w-[38ch] text-[clamp(1.75rem,3.2vw,2.4rem)] font-bold leading-[1.12] tracking-tight text-foreground">
                                {meta.title}
                            </h1>
                            <p className="reg-mono mt-3 text-xs text-muted-foreground">
                                {meta.readingTime ? `${meta.readingTime} de lecture · ` : ""}
                                Mis à jour le{" "}
                                {new Date(meta.updatedAt).toLocaleDateString("fr-FR", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                })}
                            </p>
                            {meta.description && (
                                <p className="mt-4 max-w-[68ch] text-sm text-muted-foreground leading-relaxed">
                                    {meta.description}
                                </p>
                            )}
                        </header>

                        <div className="mt-10 max-w-[74ch]">
                            <DocContent content={content.body} />
                        </div>
                    </article>
                </div>
            </main>

            <GalacticFooter isMember={userContext.isMember} />
        </div>
    );
}