import { GalacticHeader } from "@/components/layout/galactic-header";
import { NebulaClientWrapper } from "@/components/layout/nebula-client-wrapper";
import { getUserContext } from "@/server/actions/user-actions";
import { getGuildHeaderData } from "@/server/actions/guild-actions";
import { isGuildAllowed } from "@/server/actions/super-admin-actions";
import { AlmanaxWidget } from "@/components/layout/almanax-widget";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { Suspense } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function DashboardLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ guildId: string }>;
}) {
    const { guildId } = await params;

    // --- SECURITY: GUILD WHITELIST (Database-based) ---
    const allowed = await isGuildAllowed(guildId);
    if (!allowed) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 text-center font-sans">
                <div className="p-6 rounded-full bg-orange-500/10 mb-6 border border-orange-500/20">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                </div>
                <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Bêta Fermée</h1>
                <p className="text-zinc-400 max-w-lg text-lg mb-8">
                    L'accès à SigilOS est actuellement limité aux serveurs partenaires.<br />
                    Ce serveur n'est pas encore autorisé.
                </p>
                <div className="flex gap-4">
                    <SignOutButton />
                </div>
            </div>
        );
    }


    const [user, guildData] = await Promise.all([
        getUserContext(guildId),
        getGuildHeaderData(guildId)
    ]);

    if (!user.isMember) {
        // ... (keep restricted view)
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
                    <SignOutButton variant="ghost" />
                </div>
            </div>
        );
    }

    return (
        <NebulaClientWrapper>
            <div className="min-h-screen bg-[#020202] text-white selection:bg-primary/30 font-sans overflow-x-hidden flex flex-col relative">
                {/* 2026 Background Effects */}
                <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[160px] animate-pulse-slow" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[160px]" />
                    <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
                </div>

                <GalacticHeader
                    user={user}
                    guildId={guildId}
                    guildData={guildData}
                    almanaxWidget={
                        <Suspense fallback={<div className="h-10 w-32 bg-white/5 rounded-xl animate-pulse" />}>
                            <AlmanaxWidget />
                        </Suspense>
                    }
                />

                <div className="flex-1 flex flex-col relative z-10 w-full pt-20 sm:pt-28">
                    <main className="flex-1 w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-12 pb-20">
                        <div className="mt-4">
                            {/* Fused: GuildHeader is now part of GalacticHeader */}
                            <div className="mt-8">
                                {children}
                            </div>
                        </div>
                    </main>
                </div>

                <GalacticFooter />
            </div>
        </NebulaClientWrapper>
    );
}
