import { PublicHeader } from "@/components/layout/public-header";
import { auth } from "@/auth";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import Link from "next/link";
import { Home, Book, Terminal, FileText, Layout, ShieldCheck, ArrowRight } from "lucide-react";
import { redirect } from "next/navigation";
import { ResizableSidebar } from "./_components/resizable-sidebar";
import { DocsSearch } from "@/components/doc/docs-search";
import { cn } from "@/lib/utils";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { Button } from "@/components/ui/button";

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
                    <AuroraBackground className="absolute inset-0 z-0 pointer-events-none opacity-40" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.1),transparent_50%)] pointer-events-none" />

                    <div className="relative z-10 max-w-2xl">
                        <div className="w-24 h-24 rounded-[2.5rem] bg-gradient-to-br from-danger/20 to-danger/10 border border-danger/30 flex items-center justify-center mb-10 mx-auto shadow-2xl shadow-red-500/20 group">
                            <ShieldCheck className="w-12 h-12 text-danger drop-shadow-[0_0_15px_rgba(239,68,68,0.5)] group- transition-transform duration-300" />
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black text-foreground mb-6 tracking-tight uppercase font-heading">
                            Accès <span className="text-transparent bg-clip-text bg-gradient-to-r from-danger to-danger italic">Réservé</span>
                        </h1>
                        <p className="text-muted-foreground max-w-lg mx-auto text-lg leading-relaxed mb-12 font-medium">
                            Le centre de documentation est exclusivement réservé aux membres des guildes partenaires du projet SigilOS.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                            <Link
                                href="/"
                                className="inline-flex items-center gap-3 px-10 py-4 rounded-full bg-background text-foreground font-black uppercase text-caption tracking-[0.2em]  transition-all shadow-2xl shadow-white/10 active:scale-95 group"
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
    const categories = Object.keys(groupedDocs).sort();

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
            <div className="flex-1 flex flex-col md:pl-[280px] transition-all duration-300 ease-in-out h-full overflow-hidden bg-background/40 backdrop-blur-3xl">
                
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
                <main className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar">
                    <div className="container max-w-7xl mx-auto px-4 sm:px-8 py-12 flex flex-col lg:flex-row gap-16 relative items-start">
                        
                        {/* Docs Category Sidebar (Integrated & Premium) */}
                        <aside className="hidden lg:block w-64 shrink-0 sticky top-6">
                            <div className="space-y-10">
                                {/* Search Section */}
                                <div>
                                    <h4 className="text-caption font-black uppercase tracking-widest text-muted-foreground mb-4 px-1">Navigation</h4>
                                    <DocsSearch />
                                </div>

                                {/* Categories Navigation */}
                                <nav className="space-y-10">
                                    {categories.map(category => (
                                        <div key={category} className="space-y-4">
                                            <div className="flex items-center gap-3 px-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-teal-500 " />
                                                <h4 className="text-caption font-black uppercase tracking-widest text-muted-foreground">
                                                    {category}
                                                </h4>
                                            </div>
                                            
                                            <ul className="space-y-1">
                                                {groupedDocs[category].map(doc => {
                                                    const isSubPage = doc.slug.includes("/");
                                                    return (
                                                        <li key={doc.id}>
                                                            <Link
                                                                href={`/docs/${doc.slug}`}
                                                                className={cn(
                                                                    "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-body-sm font-bold transition-all duration-300 relative overflow-hidden",
                                                                    "text-muted-foreground hover:text-foreground hover:bg-background/[0.03] border border-transparent hover:border-border",
                                                                    isSubPage && "ml-4 border-l border-border rounded-l-none pl-4"
                                                                )}
                                                                title={doc.title}
                                                            >
                                                                {/* Hover Accent */}
                                                                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-teal-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                
                                                                <FileText className="w-4 h-4 text-muted-foreground group-hover:text-teal-400 transition-colors shrink-0" />
                                                                <span className="truncate">{doc.title}</span>
                                                                <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-0 -translate-x-2 group-hover:opacity-40 group-hover:translate-x-0 transition-all text-muted-foreground" />
                                                            </Link>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    ))}
                                </nav>
                            </div>
                        </aside>

                        <div className="flex-1 min-w-0 bg-surface/20 border border-border rounded-[2.5rem] p-8 sm:p-12 shadow-2xl backdrop-blur-xl min-h-[600px]">
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
