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
        <div className="space-y-6 pb-12">
            <UnifiedModuleHeader
                title="Carte & Mini-Jeux"
                description="Explorez le monde des Douze et accédez aux outils cartographiques"
                icon={Map}
                backHref={`/dashboard/${guildId}`}
            />
            <div className="bg-black/40 border border-white/5 p-4 rounded-xl shadow-2xl">
                <MapViewer />
            </div>
        </div>
    );
}
