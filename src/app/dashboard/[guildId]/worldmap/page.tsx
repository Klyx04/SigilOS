import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { MapViewer } from "@/components/worldmap/map-viewer";
import { Map as MapIcon } from "lucide-react";

type Props = {
    params: Promise<{ guildId: string }>;
    searchParams: Promise<{ x?: string; y?: string; zoom?: string; world?: string }>;
};

export default async function WorldMapPage({ params, searchParams }: Props) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;
    const { x, y, zoom, world } = await searchParams;

    const user = await getUserContext(guildId);
    if (!user.canViewWorldmap) return <AccessDenied />;

    const enabled = await isModuleEnabled(guildId, "worldmap");
    if (!enabled) return <AccessDenied />;

    const xNum = x ? parseFloat(x) : undefined;
    const yNum = y ? parseFloat(y) : undefined;
    const zoomNum = zoom ? parseInt(zoom) : undefined;
    const worldIdNum = world ? parseInt(world) : undefined;

    return (
        <div className="fixed top-[64px] md:top-[88px] bottom-[76px] left-0 md:left-[280px] right-0 z-[40] bg-[#0a0d14] flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-500 rounded-b-3xl border-b border-white/5 mx-2">
            <div className="flex-shrink-0 px-4 md:px-6 pt-3 pb-1 border-b border-white/5 bg-black/20 backdrop-blur-md">
                <UnifiedModuleHeader
                    title="Carte du Monde"
                    description="Explorez le monde des Douze"
                    icon={MapIcon}
                    backHref={`/dashboard/${guildId}`}
                />
            </div>
            <div className="flex-1 w-full relative">
                <MapViewer 
                    initialTab="map" 
                    initialX={xNum}
                    initialY={yNum}
                    initialZoom={zoomNum}
                    initialWorldId={worldIdNum}
                />
            </div>
        </div>
    );
}
