import { PublicHeader } from "@/components/layout/public-header";
import { auth } from "@/auth";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import Link from "next/link";
import { FileText } from "lucide-react";
import { redirect } from "next/navigation";
import { DocsSearch } from "@/components/doc/docs-search";
import { cn } from "@/lib/utils";
import { getDocMeta, CATEGORY_META } from "@/lib/doc-meta";

export default async function DocsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    // 🔒 Security: Require Auth
    if (!session?.user?.id) {
        redirect("/api/auth/signin?callbackUrl=/docs");
    }

    // Fetch user's guilds to establish context for documentation
    const { getUserGuilds, getUserContext } = await import("@/server/actions/user-actions");
    const userGuilds = await getUserGuilds();

    // Use first guild as context for the sidebar/navbar
    const guildId = userGuilds[0]?.id;

    const [user, allDocsResult, configRes] = await Promise.all([
        getUserContext(guildId),
        import("@/server/actions/doc-actions").then(mod => mod.getAllDocs(guildId)),
        import("@/server/actions/god-roadmap-actions").then(mod => mod.getPlatformConfig())
    ]);

    const allDocs = allDocsResult;
    const roadmapEnabled = configRes.success && configRes.data ? configRes.data.roadmapEnabled : false;

    // Check if user is member of at least one guild
    if (!user.isAuthenticated || userGuilds.length === 0) {
        return (
            <div className="registre relative min-h-screen landing-theme bg-background selection:bg-success/30 font-sans flex flex-col">
                <PublicHeader
                    user={session?.user ? { ...session.user, emailVerified: null } as any : undefined}
                />

                {/* État « accès réservé » — un panneau lisible, pas un hero centré. */}
                <main className="reg-shell flex-1 py-14 sm:py-20">
                    <div className="reg-panel max-w-2xl p-6 sm:p-8">
                        <p className="reg-eyebrow">Documentation</p>
                        <h1 className="mt-3 text-2xl font-semibold text-foreground">Accès réservé</h1>
                        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                            Le centre de documentation est réservé aux membres des guildes partenaires de SigilOS.
                        </p>
                        <div className="mt-6 flex flex-wrap gap-3">
                            <Link href="/guilds" className="reg-btn reg-btn-primary">
                                Explorer l&apos;annuaire des guildes
                            </Link>
                            <Link href="/" className="reg-btn reg-btn-secondary">
                                Retour à l&apos;accueil
                            </Link>
                        </div>
                    </div>
                </main>

                <GalacticFooter isMember={false} />
            </div>
        );
    }

    // --- DASHBOARD-LIKE WRAPPER FOR DOCS ---
    const { getGuildHeaderData } = await import("@/server/actions/guild-actions");
    const { getGuildModules } = await import("@/server/actions/module-actions");
    const { TopNav } = await import("@/components/layout/top-nav");
    const { AppSidebar } = await import("@/components/layout/app-sidebar");
    const { GalacticFooter: DashboardFooter } = await import("@/components/layout/galactic-footer");

    const [guildData, modules, events] = await Promise.all([
        getGuildHeaderData(guildId!),
        getGuildModules(guildId!),
        import("@/server/actions/event-actions").then(mod => mod.getUpcomingGuildEvents(guildId!))
    ]);

    // Group docs by category for the sidebar
    const groupedDocs: Record<string, typeof allDocs> = {};
    allDocs.forEach(doc => {
        const cat = doc.category || "Autres";
        if (!groupedDocs[cat]) groupedDocs[cat] = [];
        groupedDocs[cat].push(doc);
    });
    const categoryOrder = [
        "Progression & Objectifs",
        "Outils & Services",
        "Communauté & Guilde",
        "Administration & Staff",
        "Spécifications Techniques"
    ];

    const categories = Object.keys(groupedDocs).sort((a, b) => {
        const indexA = categoryOrder.indexOf(a);
        const indexB = categoryOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    return (
        <div className="flex h-screen h-[100dvh] overflow-hidden bg-background font-sans selection:bg-success/30 text-foreground fixed inset-0 landing-theme dashboard-layout">
            {/* 1. DESKTOP SIDEBAR */}
            <div className="hidden md:flex w-[280px] flex-col fixed inset-y-0 z-50">
                <AppSidebar
                    guildId={guildId!}
                    user={user}
                    guildData={guildData}
                    userGuilds={userGuilds}
                    modules={modules}
                    className="h-full border-r border-border"
                />
            </div>

            {/* 2. MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col md:pl-[280px] transition-all duration-300 ease-in-out h-full overflow-hidden bg-background">
                
                {/* Top Navigation */}
                <div className="flex-shrink-0 z-50">
                    <TopNav
                        userId={user.id || ""}
                        sidebarProps={{ guildId: guildId!, user, guildData, userGuilds, modules }}
                        events={events}
                        roadmapEnabled={roadmapEnabled}
                    />
                </div>

                {/* Scrollable Content */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar" id="docs-main-scroll">
                    {/* La doc est dans le scope du registre ; la coque dashboard (AppSidebar/TopNav) reste hors scope. */}
                    <div className="registre w-full max-w-[1750px] mx-auto px-4 sm:px-8 py-8 flex flex-col lg:flex-row gap-8 xl:gap-10 relative items-start">
                        
                        {/* Docs Category Sidebar (Integrated & Premium) */}
                        <aside className="hidden lg:block w-72 xl:w-80 shrink-0 sticky top-6 max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-white/5 pr-1">
                            <div className="space-y-10">
                                {/* Search Section */}
                                <div>
                                    <h4 className="mb-3 text-[11px] font-semibold text-muted-foreground">Navigation</h4>
                                    <DocsSearch />
                                </div>

                                {/* Categories Navigation */}
                                <nav className="space-y-8">
                                    {categories.map(category => {
                                        const catMeta = CATEGORY_META[category] || {
                                            icon: FileText
                                        };
                                        const CategoryIcon = catMeta.icon;

                                        return (
                                            <div key={category} className="space-y-2">
                                                <div className="flex items-center gap-2 border-b border-border pb-1.5">
                                                    <CategoryIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                                    <h4 className="truncate text-[12px] font-semibold text-muted-foreground">{category}</h4>
                                                </div>
                                                
                                                <ul className="space-y-0.5">
                                                    {groupedDocs[category].map(doc => {
                                                        const isSubPage = doc.slug.includes("/");
                                                        const docMeta = getDocMeta(doc.slug);
                                                        const DocIcon = docMeta.icon;

                                                        return (
                                                            <li key={doc.id}>
                                                                <Link
                                                                    href={`/docs/${doc.slug}`}
                                                                    className={cn(
                                                                        "flex items-start gap-2 border-l-2 border-transparent py-1.5 pl-2 pr-1 text-[12px] transition-colors",
                                                                        "text-muted-foreground hover:border-l-border-strong hover:bg-surface hover:text-foreground",
                                                                        isSubPage && "ml-3"
                                                                    )}
                                                                    title={doc.title}
                                                                >
                                                                    <DocIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                                                    <span className="min-w-0 leading-snug line-clamp-2">{doc.title}</span>
                                                                </Link>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </div>
                                        );
                                    })}
                                </nav>
                            </div>
                        </aside>

                        <div className="flex-1 min-w-0 bg-surface border border-border rounded-[6px] p-6 sm:p-8 min-h-[600px]">
                            {children}
                        </div>
                    </div>

                    <div className="mt-12 md:mt-24 pb-32">
                        <DashboardFooter variant="compact" />
                    </div>
                </main>
            </div>
        </div>
    );
}
