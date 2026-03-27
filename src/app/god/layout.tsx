import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { GodSidebar } from "@/components/layout/god-sidebar";
import { Suspense } from "react";
import { getGodNotifications } from "@/server/actions/god-notif-actions";

export default async function GodLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/");
    }

    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
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

    // Fetch unread notifications for the sidebar badge
    const notifs = await getGodNotifications(100);
    const unreadCount = notifs.success ? notifs.data.filter((n: any) => !n.isRead).length : 0;

    return (
        <div className="flex h-screen bg-[#050505] font-sans text-zinc-100 selection:bg-white/20 overflow-hidden">
            {/* Sidebar for all God pages */}
            <Suspense fallback={<div className="w-72 bg-black border-r border-white/5 h-full animate-pulse" />}>
                <GodSidebar 
                    className="w-72 hidden lg:flex shrink-0" 
                    user={session.user} 
                    unreadCount={unreadCount}
                />
            </Suspense>
            
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#0a0a0a] border-l border-white/5 relative">
                {children}
            </div>
        </div>
    );
}
