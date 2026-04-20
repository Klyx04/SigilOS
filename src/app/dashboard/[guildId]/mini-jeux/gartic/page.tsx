import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import GarticGameWrapper from "@/components/gartic/GarticGameWrapper";

export default async function SigilGarticPage({
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
        <div className="fixed top-14 bottom-0 left-0 md:left-[280px] right-0 bg-[#c83d5a] z-[41] overflow-hidden">
            <div className="h-full w-full overflow-hidden relative">
                <GarticGameWrapper roomId={roomId} guildId={guildId} userName={user.name!} userAvatar={user.image!} />
            </div>
        </div>
    );
}
