import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { GOD_SCOPES } from "@/lib/god-scopes";
import { getActiveScopes } from "@/server/actions/super-admin-actions";
import { GodSidebar } from "@/components/layout/god-sidebar";
import { Suspense } from "react";
import { getGodUnreadCounts } from "@/server/actions/god-notif-actions";
import { MobileGodSidebarSheet } from "@/components/layout/mobile-god-sidebar-sheet";

export default async function GodLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/");
    }

    // Guard : autorise super-admin + tout sub-god avec au moins un scope actif.
    // Chaque page/action applicative vérifie ensuite son propre scope via requireGodAccess.
    const activeScopes = await getActiveScopes();
    if (activeScopes.length === 0) {
        redirect("/");
    }

    // ✅ Log access to God interface
    const { logPageAccess } = await import('@/lib/audit-log');
    logPageAccess({
        userId: session.user.id,
        userName: session.user.name || 'unknown',
        page: '/god',
        details: { environment: process.env.NODE_ENV }
    });

    // Fetch unread counts for the sidebar badges
    const unreadStats = await getGodUnreadCounts();
    const unreadCount = unreadStats.notifications;
    const ticketCount = unreadStats.tickets;

    return (
        <div className="flex h-screen bg-[#050505] font-sans text-zinc-100 selection:bg-white/20 overflow-hidden dashboard-layout">
            {/* Sidebar for all God pages */}
            <Suspense fallback={<div className="w-72 bg-black border-r border-white/5 h-full animate-pulse" />}>
                <GodSidebar 
                    className="w-72 hidden lg:flex shrink-0" 
                    user={session.user} 
                    unreadCount={unreadCount}
                    ticketCount={ticketCount}
                    activeScopes={activeScopes}
                />
            </Suspense>
            
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#0a0a0a] border-l border-white/5 relative">
                {/* Mobile Topbar & Hamburger Menu (Visible on lg:hidden) */}
                <div className="lg:hidden flex items-center justify-between p-4 px-6 border-b border-white/5 bg-[#050505] z-50 shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="text-xl font-black tracking-tight text-white leading-none font-heading flex gap-1">
                            SIGIL<span className="text-amber-500">GOD</span>
                        </span>
                    </div>
                    <Suspense fallback={<div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse" />}>
                        <MobileGodSidebarSheet user={session.user} unreadCount={unreadCount} ticketCount={ticketCount} />
                    </Suspense>
                </div>

                {/* Scrollable content view */}
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {children}
                </div>
            </div>
        </div>
    );
}
