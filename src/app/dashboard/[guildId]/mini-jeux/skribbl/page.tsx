import React from "react";
import SkribblGame from "@/components/skribbl/SkribblGame";

export default async function SigilSkribblPage({
    params,
    searchParams
}: {
    params: Promise<{ guildId: string }>;
    searchParams: Promise<{ room?: string }>
}) {
    const { guildId } = await params;
    const { room: roomId } = await searchParams;

    return (
        <div className="fixed inset-0 top-[80px] md:left-[280px] bg-[#1a4e9b] z-40 overflow-hidden">
            {/* Main Game Interface - Breaks out of the 1600px container limit for true full-width */}
            <div className="h-full w-full overflow-hidden relative">
                <SkribblGame roomId={roomId} guildId={guildId} />
            </div>
        </div>
    );
}
