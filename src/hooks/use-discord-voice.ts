
import { useEffect, useState } from "react";
// @ts-ignore
import { useSocket } from "@/hooks/use-socket"; // Assuming this exists, if not I will adapt

export interface VoiceUser {
    userId: string;
    userName: string;
    avatar: string | null;
    channelId: string;
    channelName: string;
    isMute: boolean;
    isDeaf: boolean;
    isSpeaking?: boolean;
}

export function useDiscordVoice(guildId: string | undefined, socket: any) {
    const [voiceUsers, setVoiceUsers] = useState<VoiceUser[]>([]);

    useEffect(() => {
        if (!socket || !guildId || guildId === "undefined") return;

        // Listener for voice updates
        const handleUpdate = (data: { guildId: string; users: VoiceUser[] }) => {
            if (data.guildId === guildId) {
                setVoiceUsers(data.users);
            }
        };

        socket.on("discord:voice:update", handleUpdate);
        
        // Request immediate sync now that listener is ready
        socket.emit("discord:voice:request", { guildId });

        // Optional: request initial state? 
        // For now we wait for the next push or assume the server pushes regularly.
        
        return () => {
            socket.off("discord:voice:update", handleUpdate);
        };
    }, [socket, guildId]);

    return { voiceUsers };
}
