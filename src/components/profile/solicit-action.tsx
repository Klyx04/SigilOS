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
                className="bg-info hover:bg-info text-info-foreground font-bold uppercase tracking-widest text-xs h-9 px-4 gap-2 transition-colors duration-150"
            >
                <Send className="w-3.5 h-3.5" />
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
