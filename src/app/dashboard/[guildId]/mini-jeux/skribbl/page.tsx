import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import SkribblGame from "@/components/skribbl/SkribblGame";

export default async function SigilSkribblPage({
    params,
    searchParams
}: {
    params: Promise<{ guildId: string }>;
    searchParams: Promise<{ room?: string; spectate?: string }>
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;
    const { room: roomId, spectate } = await searchParams;

    const user = await getUserContext(guildId);
    if (!user.canViewMiniGames) return <AccessDenied />;

    const enabled = await isModuleEnabled(guildId, "worldmap");
    if (!enabled) return <AccessDenied />;

    return (
        <div className="fixed inset-0 top-14 md:left-[280px] bg-[#1a4e9b] z-[41] overflow-hidden">
            {/* Main Game Interface - Breaks out of the 1600px container limit for true full-width */}
            <div className="h-full w-full overflow-hidden relative">
                <SkribblGame roomId={roomId} guildId={guildId} userName={user.name!} userAvatar={user.image!} />
            </div>
        </div>
    );
}
