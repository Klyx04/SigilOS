import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import Script from "next/script";
import { AuroraBackground } from "@/components/ui/aurora-background";
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

    return {
        title: guide.title,
        description: guide.description,
        alternates: {
            canonical: `${getAppBaseUrl()}/guides/${guide.slug}`,
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
        <div className="relative min-h-screen w-full flex flex-col bg-zinc-950 font-sans selection:bg-teal-500/30 landing-theme">
            <AuroraBackground className="fixed inset-0 z-0 pointer-events-none opacity-30" />
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-500/10 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
            </div>

            <PublicHeader user={session?.user} activePage="guides" isMember={userContext.isMember} />

            <main className="flex-1 pt-32 pb-16 relative z-10">
                <div className="max-w-4xl mx-auto px-4 sm:px-6">
                    <Script
                        id="json-ld-guide-article"
                        type="application/ld+json"
                        nonce={nonce}
                        dangerouslySetInnerHTML={{
                            __html: JSON.stringify([
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
                            ]),
                        }}
                    />

                    <div className="mb-6">
                        <Link href="/guides" className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-zinc-100 transition-colors bg-zinc-900/60 border border-zinc-800 px-3.5 py-1.5 rounded-full backdrop-blur-md">
                            ← Tous les guides
                        </Link>
                    </div>

                    <article>
                        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900/90 via-zinc-950/80 to-zinc-900/90 border border-white/10 p-8 sm:p-10 mb-10 shadow-2xl backdrop-blur-xl">
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-amber-500/10 pointer-events-none" />
                            <div className="relative z-10">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-widest mb-4">
                                    Guide
                                </div>
                                <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                                    {meta.title}
                                </h1>
                                <div className="flex items-center gap-2 mt-4 text-xs font-medium text-zinc-500">
                                    Mis à jour le {new Date(meta.updatedAt).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}
                                </div>
                            </div>
                        </div>

                        <DocContent content={content.body} />
                    </article>
                </div>
            </main>

            <GalacticFooter isMember={userContext.isMember} />
        </div>
    );
}