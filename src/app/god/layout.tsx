import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { GodSidebar } from "@/components/layout/god-sidebar";
import { GalacticFooter } from "@/components/layout/galactic-footer";

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
            <div className="hidden md:flex w-[280px] flex-col fixed inset-y-0 z-50">
                <GodSidebar
                    user={session.user}
                    className="h-full border-r border-white/5"
                />
            </div>

            {/* 2. MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col md:pl-[280px] transition-all duration-300 ease-in-out h-full">

                {/* Scrollable Main Content */}
                <main className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    <div className="container max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)] flex flex-col">

                        {/* Page Content */}
                        <div className="flex-1 animate-in fade-in duration-500 slide-in-from-bottom-4">
                            {children}
                        </div>



                        {/* Footer at bottom of content */}
                        <div className="mt-12 md:mt-24 border-t border-white/5 pt-6">
                            <GalacticFooter />
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
