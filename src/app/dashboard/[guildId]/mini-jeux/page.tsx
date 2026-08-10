import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { MapViewer } from "@/components/worldmap/map-viewer";
import { getGeoguesserLadder } from "@/server/actions/geoguesser-actions";
import { getBombLadder } from "@/server/actions/bomb-actions";
import { getMiniGamesStatus } from "@/server/actions/god-mini-games-actions";
import { MiniGamesImmersive } from "@/components/games/mini-games-immersive";
import { Trophy } from "lucide-react";
import { ModuleTourReplayButton } from "@/components/tour/module-tour-replay-button";

type Props = {
    params: Promise<{ guildId: string }>;
};

export default async function MiniJeuxPage({ params }: Props) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.canViewMiniGames) return <AccessDenied />;

    const enabled = await isModuleEnabled(guildId, "worldmap");
    if (!enabled) return <AccessDenied />;

    const [ladder, bombLadder, gameStatuses] = await Promise.all([
        getGeoguesserLadder(guildId),
        getBombLadder(guildId),
        getMiniGamesStatus()
    ]);

    return (
        <MiniGamesImmersive>
        <div className="w-full h-[calc(100vh-80px)] bg-[#080b12] flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-500 rounded-xl border border-white/10">
            <div className="flex-shrink-0 px-3 md:px-5 py-2 border-b border-white/5 bg-black/20 backdrop-blur-md" data-tour="minijeu-header">
                <UnifiedModuleHeader
                    title="Mini-Jeux"
                    description="Sigil-Guesser & Sigil-Bomb : Défiez vos alliés !"
                    icon={Trophy}
                    backHref={`/dashboard/${guildId}`}
                    middleContent={<div id="sigil-geoguesser-header-hud" className="w-full flex justify-center" />}
                    actions={<div id="sigil-geoguesser-header-actions" className="flex items-center gap-4"><ModuleTourReplayButton phase="minijeu" /></div>}
                    compact={true}
                    className="mb-0"
                />
            </div>
            <div className="flex-1 w-full relative" data-tour="minijeu-board">
                <MapViewer 
                    initialLadder={JSON.parse(JSON.stringify(ladder))} 
                    initialTab="games" 
                    gameStatuses={JSON.parse(JSON.stringify(gameStatuses))}
                    userName={user.name!}
                    userAvatar={user.image!}
                    isAdmin={user.isAdmin}
                />
            </div>
        </div>
        </MiniGamesImmersive>
    );
}
