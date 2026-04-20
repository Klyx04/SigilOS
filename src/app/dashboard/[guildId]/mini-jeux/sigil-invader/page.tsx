import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { getInvaderRoom, createInvaderRoom } from "@/server/actions/sigil-invader-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import InvaderClient from "./invader-client";
import { Rocket } from "lucide-react";

type Props = {
    params: Promise<{ guildId: string }>;
    searchParams: Promise<{ room?: string; spectate?: string }>;
};

export default async function SigilInvaderPage({ params, searchParams }: Props) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;
    const { room: roomId, spectate } = await searchParams;

    const user = await getUserContext(guildId);
    if (!user.isMember) redirect(`/dashboard/${guildId}`);

    let room = null;
    if (roomId) {
        room = await getInvaderRoom(roomId);
    }

    return (
        <div className="fixed top-[64px] md:top-[88px] bottom-[76px] left-0 md:left-[280px] right-0 z-[40] bg-[#0a0d14] flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-500 rounded-b-3xl border-b border-white/5 mx-2">
            {/* Note: UnifiedModuleHeader was removed to maximize vertical space for the canvas. The game component has its own header. */}

            <div className="flex-1 overflow-hidden relative">
                <InvaderClient 
                    initialRoom={room} 
                    guildId={guildId} 
                    user={user}
                />
            </div>
        </div>
    );
}
