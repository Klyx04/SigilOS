import { getMiniGamesStatus, getPlatformConfig } from "@/server/actions/god-mini-games-actions";
import MiniGamesGodClient from "./mini-games-god-client";
export const dynamic = 'force-dynamic';

export default async function GodMiniGamesPage() {
    const [statuses, platformConfig] = await Promise.all([
        getMiniGamesStatus(),
        getPlatformConfig()
    ]);

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            <MiniGamesGodClient 
                initialStatuses={statuses} 
                initialPlatformConfig={platformConfig}
            />
        </div>
    );
}
