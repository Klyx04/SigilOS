import Link from "next/link";
import { ArrowLeft, BookOpen, Clock, ChevronRight } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { auth } from "@/auth";
import { getAppBaseUrl } from "@/lib/utils";
import { publishedGuides, Guide } from "@/content/guides";
import { headers } from "next/headers";
import Script from "next/script";

export const metadata = {
    title: "Guides Dofus — Raids, Forgemagie, Élevage & Guilde",
    description: "Guides stratégiques et tutoriels complets pour Dofus 3 : Raids de guilde (Gigalodon, Sanctuaire des Jardins Éternels), forgemagie, brisage et gestion de guilde.",
    alternates: {
        canonical: `${getAppBaseUrl()}/guides`,
    },
    openGraph: {
        title: "Guides Stratégiques Dofus — SigilOS",
        description: "Toutes les mécaniques décortiquées : Raids de guilde, rentabilité de brisage, poids des runes et élevage d'enclos.",
        url: `${getAppBaseUrl()}/guides`,
        type: "website",
    },
};

function getBadgeStyle(badgeColor?: Guide["badgeColor"]) {
    switch (badgeColor) {
        case "cyan":
            return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
        case "rose":
            return "bg-rose-500/10 text-rose-400 border-rose-500/20";
        case "amber":
            return "bg-amber-500/10 text-amber-400 border-amber-500/20";
        case "purple":
            return "bg-purple-500/10 text-purple-400 border-purple-500/20";
        case "teal":
            return "bg-teal-500/10 text-teal-400 border-teal-500/20";
        case "emerald":
        default:
            return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    }
}

export default async function GuidesPage() {
    const session = await auth();
    const { getUserContext } = await import("@/server/actions/user-actions");
    const userContext = await getUserContext();

    // [AUDIT 2026] Retrieve nonce for inline scripts
    const headersList = await headers();
    const nonce = headersList.get('x-nonce') ?? '';

    return (
        <div className="relative min-h-screen w-full flex flex-col bg-zinc-950 font-sans selection:bg-teal-500/30 landing-theme">

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

                    <div className="relative rounded-3xl bg-[#101313] border border-white/10 p-8 sm:p-10 mb-8 overflow-hidden shadow-2xl">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                        <div className="relative">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-widest mb-3">
                                <BookOpen className="w-3.5 h-3.5" /> Encyclopédie & Stratégie
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                                Guides & Tutoriels Dofus
                            </h1>
                            <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mt-2 leading-relaxed">
                                Retrouvez nos dossiers complets : mécaniques de raids de guilde, optimisation de la forgemagie, brisage rentable, élevage d'enclos et administration de guilde.
                            </p>
                        </div>
                    </div>

                    <div className="relative space-y-3.5">
                        {publishedGuides.length === 0 ? (
                            <div className="text-center py-16 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl">
                                <p className="text-zinc-500 text-sm font-bold">Aucun guide publié pour le moment</p>
                            </div>
                        ) : (
                            publishedGuides.map((guide) => (
                                <Link
                                    key={guide.slug}
                                    href={`/guides/${guide.slug}`}
                                    className="group relative flex items-center gap-4 sm:gap-5 p-4 sm:p-5 bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/90 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl backdrop-blur-md transition-all duration-200"
                                >
                                    {/* Ambient hover glow */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                                    {/* Real Game Image Thumbnail */}
                                    {guide.coverImage && (
                                        <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-20 rounded-xl overflow-hidden bg-zinc-950 border border-white/10 flex items-center justify-center p-1 relative shadow-inner">
                                            <img
                                                src={guide.coverImage}
                                                alt={guide.title}
                                                className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-300"
                                                loading="lazy"
                                            />
                                        </div>
                                    )}

                                    {/* Main Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                            {guide.category && (
                                                <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${getBadgeStyle(guide.badgeColor)}`}>
                                                    {guide.category}
                                                </span>
                                            )}
                                            {guide.readingTime && (
                                                <span className="text-xs font-medium text-zinc-400 flex items-center gap-1">
                                                    <Clock className="w-3 h-3 text-zinc-500" />
                                                    {guide.readingTime}
                                                </span>
                                            )}
                                            <span className="text-xs text-zinc-600 hidden sm:inline">·</span>
                                            <span className="text-xs font-medium text-zinc-500 hidden sm:inline">
                                                {new Date(guide.updatedAt).toLocaleDateString("fr-FR", { year: "numeric", month: "short", day: "numeric" })}
                                            </span>
                                        </div>

                                        <h2 className="text-base sm:text-lg font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors tracking-tight leading-snug truncate sm:whitespace-normal">
                                            {guide.title}
                                        </h2>

                                        <p className="mt-1 text-zinc-400 text-xs sm:text-sm leading-relaxed line-clamp-1 sm:line-clamp-2">
                                            {guide.description}
                                        </p>
                                    </div>

                                    {/* Arrow indicator */}
                                    <div className="hidden sm:flex items-center text-zinc-600 group-hover:text-zinc-200 group-hover:translate-x-1 transition-all shrink-0 pr-1">
                                        <ChevronRight className="w-5 h-5" />
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