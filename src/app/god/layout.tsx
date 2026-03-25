import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { GodSidebar } from "@/components/layout/god-sidebar";

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
        <div className="flex h-screen bg-[#050505] font-sans text-zinc-100 selection:bg-white/20 overflow-hidden">
            {/* Sidebar for all God pages */}
            <GodSidebar 
                className="w-72 hidden lg:flex shrink-0" 
                user={session.user} 
            />
            
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                {children}
            </div>
        </div>
    );
}
