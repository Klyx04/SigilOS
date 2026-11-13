"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { UserRequestModal } from "./user-request-modal";
import { cn } from "@/lib/utils";

interface SolicitActionProps {
    targetUserId: string;
    targetName: string;
    guildId: string;
    capabilities: {
        jobs: string[];
        alignment?: string | null;
        alignmentOrder?: string | null;
        legendaryCrafts: unknown[];
        services?: unknown[];
    };
    variant?: "default" | "outline";
    className?: string;
}

export function SolicitAction({
    targetUserId,
    targetName,
    guildId,
    capabilities,
    variant = "default",
    className,
}: SolicitActionProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <Button
                variant={variant === "outline" ? "outline" : "default"}
                size="sm"
                onClick={() => {
                    setIsOpen(true);
                }}
                className={cn(
                    "font-semibold text-xs h-9 px-4 gap-2 rounded-xl transition-all duration-150 cursor-pointer inline-flex items-center active:scale-[0.98]",
                    variant === "outline"
                        ? "bg-surface/90 hover:bg-elevated border border-border hover:border-accent/40 text-foreground"
                        : "bg-accent text-accent-foreground hover:bg-accent/90 border border-accent/80 shadow-xs hover:shadow-sm",
                    className
                )}
            >
                <Send className="w-3.5 h-3.5 shrink-0" />
                <span>Solliciter ce membre</span>
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
