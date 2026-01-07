import { AppSidebar } from "@/components/layout/app-sidebar";
import { GuildHeader } from "@/components/layout/guild-header";
import { getUserContext } from "@/server/actions/user-actions";

export default async function DashboardLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: { guildId: string };
}) {
    const { guildId } = await params;
    const user = await getUserContext(guildId);

    if (!user.isMember) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 text-center font-sans">
                <div className="p-6 rounded-full bg-red-500/10 mb-6 animate-pulse-slow">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="m9 12 2 2 4-4" />
                    </svg>
                </div>
                <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Accès Restreint</h1>
                <p className="text-zinc-400 max-w-lg text-lg">
                    Vous devez être membre du serveur Discord <span className="text-white font-semibold">{user.guildName}</span> pour accéder à ce tableau de bord.
                </p>
                <div className="mt-8 flex gap-4">
                    <a href="/" className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors font-medium">
                        Retour à l'accueil
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background font-sans antialiased overflow-hidden selection:bg-primary/20 md:flex">
            {/* Background Effects */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background" />
            </div>

            <AppSidebar user={user} guildId={guildId} />

            <div className="flex-1 flex flex-col relative z-10 h-screen overflow-y-auto">
                <main className="flex-1 container mx-auto py-4 px-4 md:px-8 max-w-7xl">
                    <GuildHeader guildId={guildId} />
                    {children}
                </main>

                <div className="p-4 md:p-8">
                </div>
            </div>
        </div>
    );
}
