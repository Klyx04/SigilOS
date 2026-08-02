import Link from "next/link";
import { ArrowLeft, BookOpen, Clock } from "lucide-react";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { auth } from "@/auth";
import { getAppBaseUrl } from "@/lib/utils";
import { publishedGuides } from "@/content/guides";
import { headers } from "next/headers";
import Script from "next/script";

export const metadata = {
    title: "Guides",
    description: "Les guides Dofus de SigilOS : créer et gérer sa guilde, comprendre les mécaniques après les mises à jour 3.4 et 3.6.",
    alternates: {
        canonical: `${getAppBaseUrl()}/guides`,
    },
};

export default async function GuidesPage() {
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
                        id="json-ld-guides"
                        type="application/ld+json"
                        nonce={nonce}
                        dangerouslySetInnerHTML={{
                            __html: JSON.stringify({
                                "@context": "https://schema.org",
                                "@type": "BreadcrumbList",
                                "itemListElement": [
                                    { "@type": "ListItem", "position": 1, "name": "Accueil", "item": getAppBaseUrl() },
                                    { "@type": "ListItem", "position": 2, "name": "Guides", "item": `${getAppBaseUrl()}/guides` },
                                ],
                            }),
                        }}
                    />

                    <div className="mb-6">
                        <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-zinc-100 transition-colors bg-zinc-900/60 border border-zinc-800 px-3.5 py-1.5 rounded-full backdrop-blur-md">
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Retour à l'accueil
                        </Link>
                    </div>

                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900/90 via-zinc-950/80 to-zinc-900/90 border border-white/10 p-8 sm:p-10 mb-12 shadow-2xl backdrop-blur-xl">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-amber-500/10 pointer-events-none" />
                        <div className="relative z-10">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-widest mb-3">
                                <BookOpen className="w-3.5 h-3.5" /> Guides
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                                Guides Dofus
                            </h1>
                            <p className="text-sm sm:text-base text-zinc-400 max-w-xl mt-2 leading-relaxed">
                                Comprendre les mécaniques de guilde et mieux organiser votre communauté du Monde des Douze.
                            </p>
                        </div>
                    </div>

                    <div className="relative space-y-8">
                        {publishedGuides.length === 0 ? (
                            <div className="text-center py-16 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl">
                                <p className="text-zinc-500 text-sm font-bold">Aucun guide publié pour le moment</p>
                            </div>
                        ) : (
                            publishedGuides.map((guide) => (
                                <Link
                                    key={guide.slug}
                                    href={`/guides/${guide.slug}`}
                                    className="block bg-zinc-900/60 border border-zinc-800/80 rounded-2xl overflow-hidden hover:border-zinc-700/90 shadow-xl backdrop-blur-md transition-all group"
                                >
                                    <div className="p-6">
                                        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                            <span className="text-xs font-medium text-zinc-500 flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5 text-zinc-600" />
                                                {new Date(guide.updatedAt).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}
                                            </span>
                                        </div>
                                        <h2 className="text-xl sm:text-2xl font-black text-zinc-100 tracking-tight leading-snug group-hover:text-emerald-400 transition-colors">
                                            {guide.title}
                                        </h2>
                                        <p className="mt-2 text-zinc-400 text-sm leading-relaxed">
                                            {guide.description}
                                        </p>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </div>
            </main>

            <GalacticFooter isMember={userContext.isMember} />
        </div>
    );
}