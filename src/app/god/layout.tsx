import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { GodHeader } from "@/components/admin/GodHeader";

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
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
            <GodHeader />
            <main className="container mx-auto px-4 py-8">
                {children}
            </main>
            <footer className="border-t border-slate-800/50 py-6 mt-12">
                <div className="container mx-auto px-4 text-center text-sm text-slate-500">
                    SigilOS God Interface • Super-Admin Control Panel
                </div>
            </footer>
        </div>
    );
}
