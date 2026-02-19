import { PublicHeader } from "@/components/layout/public-header";
import { auth } from "@/auth";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import Link from "next/link";
import { Home, Book, Terminal, FileText, Layout, ShieldCheck } from "lucide-react";
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

    // 🔒 Security: Require Auth & Guild Membership
    if (!session?.user?.id) {
        redirect("/api/auth/signin?callbackUrl=/docs");
    }

    // Fetch user's guilds to establish context for documentation
    const { getUserGuilds } = await import("@/server/actions/user-actions");
    const userGuilds = await getUserGuilds();

    // Use first guild as context (shows global docs + that guild's specific docs)
    // If user has no guilds, guildId will be undefined (shows only global docs)
    const guildId = userGuilds[0]?.id;

    const { getUserContext } = await import("@/server/actions/user-actions");
    const user = await getUserContext(guildId);

    // Check if user is authenticated and member of at least one guild
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
                        <div className="w-24 h-24 rounded-[2.5rem] bg-gradient-to-br from-red-500/20 to-rose-500/10 border border-red-500/30 flex items-center justify-center mb-10 mx-auto shadow-2xl shadow-red-500/20 group">
                            <ShieldCheck className="w-12 h-12 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)] group-hover:scale-110 transition-transform duration-500" />
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight uppercase font-heading">
                            Accès <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-rose-400 italic">Réservé</span>
                        </h1>
                        <p className="text-zinc-400 max-w-lg mx-auto text-lg leading-relaxed mb-12 font-medium">
                            Le centre de documentation est exclusivement réservé aux membres des guildes partenaires du projet SigilOS.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                            <Link
                                href="/"
                                className="inline-flex items-center gap-3 px-10 py-4 rounded-full bg-white text-black font-black uppercase text-[10px] tracking-[0.2em] hover:scale-105 transition-all shadow-2xl shadow-white/10 active:scale-95 group"
                            >
                                Retour à l'accueil
                                <Home className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                            </Link>

                            <Button
                                variant="outline"
                                className="px-10 h-14 rounded-full border-white/10 hover:border-white/20 hover:bg-white/5 text-zinc-300 font-black uppercase text-[10px] tracking-[0.2em] transition-all"
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


    const { getAllDocs } = await import("@/server/actions/doc-actions");
    const allDocs = await getAllDocs(guildId);

    // Group docs by category
    const groupedDocs: Record<string, typeof allDocs> = {};
    allDocs.forEach(doc => {
        const cat = doc.category || "Autres";
        if (!groupedDocs[cat]) groupedDocs[cat] = [];
        groupedDocs[cat].push(doc);
    });

    const categories = Object.keys(groupedDocs).sort();

    return (
        <div className="relative min-h-screen bg-zinc-950 font-sans selection:bg-accent-teal/30 flex flex-col landing-theme">
            <PublicHeader
                user={session?.user ? { ...session.user, emailVerified: null } as any : undefined}
                isMember={user.isMember}
                dashboardHref={guildId ? `/dashboard/${guildId}` : "/dashboard"}
            />

            <div className="flex-1 container max-w-7xl mx-auto px-4 sm:px-6 pt-32 pb-32 flex flex-col lg:flex-row gap-8">
                {/* Sidebar Navigation */}
                <ResizableSidebar className="hidden lg:block w-72 shrink-0">
                    <div className="sticky top-24 pr-4">
                        <div className="pb-8 border-b border-white/5 mb-8 flex flex-col gap-4">
                            <Link
                                href={guildId ? `/dashboard/${guildId}` : "/dashboard"}
                                className="flex items-center gap-3 text-sm font-black text-zinc-400 hover:text-teal-400 transition-colors group uppercase tracking-[0.15em] px-2"
                            >
                                <Layout className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                Dashboard
                            </Link>

                            {/* Dedicated Docs Search */}
                            <DocsSearch />
                        </div>

                        <nav className="space-y-12">
                            {/* Dynamic Categories */}
                            {categories.map(category => (
                                <div key={category}>
                                    <h4 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-500 mb-6 px-2 flex items-center gap-2">
                                        <div className="w-1.5 h-4 bg-teal-500/50 rounded-full" />
                                        {category}
                                    </h4>
                                    <ul className="space-y-3">
                                        {groupedDocs[category].map(doc => {
                                            const isSubPage = doc.slug.includes("/");
                                            return (
                                                <li key={doc.id}>
                                                    <Link
                                                        href={`/docs/${doc.slug}`}
                                                        className={cn(
                                                            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-zinc-300 hover:text-white hover:bg-white/5 transition-all truncate group border border-transparent hover:border-white/5",
                                                            isSubPage && "ml-4 border-l border-white/10 rounded-l-none pl-4"
                                                        )}
                                                        title={doc.title}
                                                    >
                                                        <FileText className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 transition-colors shrink-0" />
                                                        <span className="truncate tracking-tight">{doc.title}</span>
                                                    </Link>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ))}



                            {categories.length === 0 && (
                                <div className="px-2 py-4 bg-zinc-900/50 rounded border border-white/5 text-xs text-zinc-500 text-center italic">
                                    Aucune page publiée.
                                </div>
                            )}
                        </nav>
                    </div>
                </ResizableSidebar>

                {/* Mobile Fallback (Simple Stack) */}
                <aside className="lg:hidden w-full space-y-8">
                    <div className="pb-6 border-b border-white/5 mb-6">
                        <Link href="/docs" className="flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white transition-colors">
                            <Home className="w-4 h-4" />
                            Centre de Documentation
                        </Link>
                    </div>
                    {/* Shortened Nav for Mobile could go here or just full list */}
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 min-w-0">
                    {children}
                </main>
            </div>

            <GalacticFooter isMember={true} />
        </div>
    );
}
