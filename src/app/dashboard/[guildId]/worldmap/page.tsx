import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { MapViewer } from "@/components/worldmap/map-viewer";

import { ModuleHelpActions } from "@/components/doc/module-help-actions";

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
        // isolate + contain : la carte Leaflet est une énorme surface GPU qui se
        // repeint en continu (tuiles + canvas). Sans isolation, le compositeur
        // Chromium/Opera GX re-peint aussi la navbar voisine → clignotements.
        // Pas d'animate-in ici : animer l'entrée d'une telle surface force un
        // repaint plein écran à chaque frame de l'animation.
        <div id="worldmap-page" className="fixed top-[64px] md:top-[88px] bottom-[76px] left-0 md:left-[280px] right-0 z-[40] bg-[#0a0d14] flex flex-col shadow-2xl overflow-hidden rounded-b-3xl border-b border-border mx-2 isolate" style={{ contain: 'layout paint' }}>
            <div className="worldmap-header flex-shrink-0 px-3 md:px-5 py-2 border-b border-border bg-black/20 backdrop-blur-md">
                <UnifiedModuleHeader
                    title="Carte du Monde"
                    description="Explorez le monde des Douze"
                    imageSrc="/assets/nav/world.png"
                    backHref={`/dashboard/${guildId}`}
                    compact={true}
                    className="mb-0"
                    actions={<ModuleHelpActions docSlug="worldmap" docTitle="Carte Interactive Dofus HD" />}
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
