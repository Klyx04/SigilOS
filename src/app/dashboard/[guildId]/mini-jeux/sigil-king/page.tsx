import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { SigilKingGame } from "@/components/sigil-king/SigilKingGame";

type Props = {
    params: Promise<{ guildId: string }>;
    searchParams: Promise<{ room?: string; spectate?: string }>;
};

export default async function SigilKingPage({ params, searchParams }: Props) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;
    const { room, spectate } = await searchParams;

    const user = await getUserContext(guildId);
    if (!user.canViewWorldmap) return <AccessDenied />;

    const enabled = await isModuleEnabled(guildId, "worldmap");
    if (!enabled) return <AccessDenied />;

    return (
        <SigilKingGame
            guildId={guildId}
            userId={session.user.id!}
            userName={user.name || "Joueur"}
            userAvatar={user.image || undefined}
            initialRoomId={room}
            isSpectator={spectate === "true"}
        />
    );
}
