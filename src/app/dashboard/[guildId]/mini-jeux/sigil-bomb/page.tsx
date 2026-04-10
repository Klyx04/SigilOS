
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import BombGame from "@/components/bomb/BombGame";

type Props = {
    params: Promise<{ guildId: string }>;
    searchParams: Promise<{ room?: string }>;
};

export default async function SigilBombPage({ params, searchParams }: Props) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;
    const { room: roomId } = await searchParams;

    const user = await getUserContext(guildId);
    if (!user.isMember) redirect(`/dashboard/${guildId}`);

    return (
        <div className="fixed top-[64px] md:top-[88px] bottom-[76px] left-0 md:left-[280px] right-0 z-[40] bg-[#0a0614] flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-500 rounded-b-3xl border-b border-white/5 mx-2">
            <BombGame 
                roomId={roomId} 
                guildId={guildId} 
            />
        </div>
    );
}
