"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { UserRequestModal } from "./user-request-modal";

interface SolicitActionProps {
    targetUserId: string;
    targetName: string;
    guildId: string;
    capabilities: {
        jobs: string[];
        alignment?: string | null;
        alignmentOrder?: string | null;
        legendaryCrafts: any[];
    };
}

export function SolicitAction({
    targetUserId,
    targetName,
    guildId,
    capabilities,
}: SolicitActionProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <Button
                onClick={() => {

                    setIsOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-[10px] h-9 px-4 shadow-lg shadow-indigo-600/20 gap-2 group transition-all duration-300 hover:scale-105"
            >
                <Send className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                Solliciter ce membre
            </Button>

            <UserRequestModal
                isOpen={isOpen}
                onClose={() => {

                    setIsOpen(false);
                }}
                targetUserId={targetUserId}
                targetName={targetName}
                guildId={guildId}
                capabilities={capabilities}
            />
        </>
    );
}
