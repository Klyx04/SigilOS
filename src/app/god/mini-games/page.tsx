import { Suspense } from "react";
import { getMiniGamesStatus, getPlatformConfig } from "@/server/actions/god-mini-games-actions";
import MiniGamesGodClient from "./mini-games-god-client";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { redirect } from "next/navigation";
export const dynamic = 'force-dynamic';

export default async function GodMiniGamesPage() {
    // Fail-closed : réservé aux super-admins (le layout accepte désormais les sub-gods)
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) redirect("/");
    const [statuses, platformConfig] = await Promise.all([
        getMiniGamesStatus(),
        getPlatformConfig()
    ]);

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-background">
            <Suspense fallback={
                <div className="flex-1 flex flex-col items-center justify-center p-20 gap-4">
                    <div className="w-12 h-12 border-4 border-warning/20 border-t-amber-500 rounded-full animate-spin" />
                    <span className="text-caption font-semibold text-muted-foreground uppercase tracking-wide animate-pulse">Chargement Interface...</span>
                </div>
            }>
                <MiniGamesGodClient 
                    initialStatuses={statuses} 
                    initialPlatformConfig={platformConfig}
                />
            </Suspense>
        </div>
    );
}
