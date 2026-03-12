import React from "react";
import GarticGameWrapper from "@/components/gartic/GarticGameWrapper";

export default async function SigilGarticPage({
    params,
    searchParams
}: {
    params: Promise<{ guildId: string }>;
    searchParams: Promise<{ room?: string }>
}) {
    const { guildId } = await params;
    const { room: roomId } = await searchParams;

    return (
        <div className="fixed inset-0 top-[80px] md:left-[280px] bg-[#c83d5a] z-40 overflow-hidden">
            <div className="h-full w-full overflow-hidden relative">
                <GarticGameWrapper roomId={roomId} guildId={guildId} />
            </div>
        </div>
    );
}
