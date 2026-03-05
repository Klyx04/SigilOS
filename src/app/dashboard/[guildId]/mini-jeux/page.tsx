import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { MapViewer } from "@/components/worldmap/map-viewer";
import { Map } from "lucide-react";

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

    return (
        <div className="fixed top-[64px] md:top-[88px] bottom-0 left-0 md:left-[280px] right-0 z-[40] bg-[#0a0d14] flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-500">
            <div className="flex-shrink-0 px-4 md:px-6 pt-4 pb-2 border-b border-white/5 bg-black/40 backdrop-blur-md">
                <UnifiedModuleHeader
                    title="Carte & Mini-Jeux"
                    description="Explorez le monde des Douze et accédez aux outils cartographiques"
                    icon={Map}
                    backHref={`/dashboard/${guildId}`}
                />
            </div>
            <div className="flex-1 w-full h-full relative">
                <MapViewer />
            </div>
        </div>
    );
}
