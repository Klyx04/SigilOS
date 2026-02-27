import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { GodSidebar } from "@/components/layout/god-sidebar";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { PublicHeader } from "@/components/layout/public-header";

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
        userEmail: session.user.email || 'unknown',
        page: '/god',
        details: { environment: process.env.NODE_ENV }
    });

    return (
        <div className="flex h-screen overflow-hidden bg-zinc-950 font-sans text-zinc-100">
            {/* 1. DESKTOP SIDEBAR (Fixed) */}
            <div className="hidden md:flex w-[240px] flex-col fixed inset-y-0 left-0 z-[100]">
                <GodSidebar
                    user={session.user}
                    className="h-full border-r border-white/5"
                />
            </div>

            {/* 2. MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col md:pl-[240px] h-full overflow-hidden">

                {/* Main Content Area - Layout control */}
                <main className="flex-1 relative flex flex-col h-full overflow-y-auto overflow-x-hidden">
                    <div className="flex-1 flex flex-col">
                        {/* Public Header for shared brand identity */}
                        <div className="flex-shrink-0 z-50 h-20">
                            <PublicHeader user={session.user} isMember={true} backHref="/" backLabel="Retour Platform" />
                        </div>

                        {/* Page Content */}
                        <div className="flex-1 flex flex-col min-h-0 animate-in fade-in duration-500 slide-in-from-bottom-4">
                            {children}
                        </div>

                        {/* Standard Footer */}
                        <div className="mt-auto px-6 py-12">
                            <GalacticFooter variant="compact" isMember={true} />
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
