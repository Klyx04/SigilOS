import { PublicHeader } from "@/components/layout/public-header";
import { auth } from "@/auth";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import Link from "next/link";
import { Home, Book, Terminal, FileText, Layout, ShieldCheck, ArrowRight } from "lucide-react";
import { redirect } from "next/navigation";
import { ResizableSidebar } from "./_components/resizable-sidebar";
import { DocsSearch } from "@/components/doc/docs-search";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
            <div className="relative min-h-screen landing-theme bg-background selection:bg-accent-teal/30 font-sans flex flex-col overflow-hidden">
                <PublicHeader
                    user={session?.user ? { ...session.user, emailVerified: null } as any : undefined}
                />

                <main className="flex-1 flex flex-col items-center justify-center p-6 text-center relative">
                    <div className="relative z-10 max-w-2xl">
                        <div className="w-24 h-24 rounded-[2.5rem] bg-danger/10 border border-danger/30 flex items-center justify-center mb-10 mx-auto">
                            <ShieldCheck className="w-12 h-12 text-danger" />
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black text-foreground mb-6 tracking-tight uppercase font-heading">
                            Accès <span className="text-danger italic">Réservé</span>
                        </h1>
                        <p className="text-muted-foreground max-w-lg mx-auto text-lg leading-relaxed mb-12 font-medium">
                            Le centre de documentation est exclusivement réservé aux membres des guildes partenaires du projet SigilOS.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                            <Link
                                href="/"
                                className="inline-flex items-center gap-3 px-10 py-4 rounded-xl bg-background text-foreground font-black uppercase text-caption tracking-[0.2em] transition-colors active:scale-95"
                            >
                                Retour à l'accueil
                                <Home className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                            </Link>

                            <Button
                                variant="outline"
                                className="px-10 h-14 rounded-full border-border hover:border-border-strong hover:bg-surface text-foreground font-black uppercase text-caption tracking-[0.2em] transition-all"
                                asChild
                            >
                                <Link href="/guilds">Explorer l'Annuaire</Link>
                            </Button>
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
        <div className="flex h-screen h-[100dvh] overflow-hidden bg-background font-sans selection:bg-teal-500/30 text-foreground fixed inset-0 landing-theme dashboard-layout">
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
                    <div className="w-full max-w-[1750px] mx-auto px-4 sm:px-8 py-8 flex flex-col lg:flex-row gap-8 xl:gap-10 relative items-start">
                        
                        {/* Docs Category Sidebar (Integrated & Premium) */}
                        <aside className="hidden lg:block w-72 xl:w-80 shrink-0 sticky top-6 max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-white/5 pr-1">
                            <div className="space-y-10">
                                {/* Search Section */}
                                <div>
                                    <h4 className="text-caption font-black uppercase tracking-widest text-muted-foreground mb-4 px-1">Navigation</h4>
                                    <DocsSearch />
                                </div>

                                {/* Categories Navigation */}
                                <nav className="space-y-8">
                                    {categories.map(category => {
                                        const catMeta = CATEGORY_META[category] || {
                                            icon: FileText,
                                            color: "teal",
                                            badgeClass: "bg-teal-500/10 text-teal-400 border-teal-500/20"
                                        };
                                        const CategoryIcon = catMeta.icon;

                                        return (
                                            <div key={category} className="space-y-2">
                                                <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-surface/40 border border-border">
                                                    <CategoryIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                                    <h4 className="text-[11px] font-black uppercase tracking-wider text-muted-foreground truncate">
                                                        {category}
                                                    </h4>
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
                                                                        "group flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-body-sm font-bold transition-all duration-200 relative overflow-hidden",
                                                                        "text-muted-foreground hover:text-foreground hover:bg-surface/80 border border-transparent hover:border-border",
                                                                        isSubPage && "ml-3 border-l border-border rounded-l-none pl-3"
                                                                    )}
                                                                    title={doc.title}
                                                                >
                                                                    {/* Hover Accent */}
                                                                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-teal-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                    
                                                                    <DocIcon className={cn("w-3.5 h-3.5 shrink-0 transition-colors opacity-70 group-hover:opacity-100", docMeta.textClass)} />
                                                                    <span className="leading-snug text-xs line-clamp-2">{doc.title}</span>
                                                                    <ArrowRight className="w-3 h-3 ml-auto opacity-0 -translate-x-2 group-hover:opacity-40 group-hover:translate-x-0 transition-all text-muted-foreground shrink-0" />
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

                        <div className="flex-1 min-w-0 bg-surface border border-border rounded-[2.5rem] p-8 sm:p-12 min-h-[600px]">
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
