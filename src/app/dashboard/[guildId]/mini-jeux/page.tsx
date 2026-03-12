import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { MapViewer } from "@/components/worldmap/map-viewer";
import { getGeoguesserLadder } from "@/server/actions/geoguesser-actions";
import { getSigilKingLadder } from "@/server/actions/sigil-king-actions";
import { getMiniGamesStatus } from "@/server/actions/god-mini-games-actions";
import { Trophy } from "lucide-react";

type Props = {
    params: Promise<{ guildId: string }>;
};

export default async function MiniJeuxPage({ params }: Props) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.canViewWorldmap) return <AccessDenied />;

    const enabled = await isModuleEnabled(guildId, "worldmap");
    if (!enabled) return <AccessDenied />;

    const ladder = await getGeoguesserLadder(guildId);
    const kingLadder = await getSigilKingLadder(guildId);
    const gameStatuses = await getMiniGamesStatus();

    return (
        <div className="fixed top-[64px] md:top-[88px] bottom-[76px] left-0 md:left-[280px] right-0 z-[40] bg-[#0a0d14] flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-500 rounded-b-3xl border-b border-white/5 mx-2">
            <div className="flex-shrink-0 px-4 md:px-6 pt-3 pb-1 border-b border-white/5 bg-black/20 backdrop-blur-md">
                <UnifiedModuleHeader
                    title="Mini-Jeux"
                    description="Défiez vos amis sur SigilGuesser, Sigil-Draw et Sigil-Phone"
                    icon={Trophy}
                    backHref={`/dashboard/${guildId}`}
                />
            </div>
            <div className="flex-1 w-full relative">
                <MapViewer 
                    initialLadder={JSON.parse(JSON.stringify(ladder))} 
                    initialKingLadder={JSON.parse(JSON.stringify(kingLadder))}
                    initialTab="games" 
                    gameStatuses={JSON.parse(JSON.stringify(gameStatuses))}
                />
            </div>
        </div>
    );
}
