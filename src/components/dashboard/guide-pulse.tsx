"use client";

import React from "react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface GuidePulseProps {
    description: string;
    className?: string;
    side?: "top" | "bottom" | "left" | "right";
}

export function GuidePulse({ description, className, side = "top" }: GuidePulseProps) {
    return (
        <TooltipProvider delayDuration={0}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={cn("relative flex h-3 w-3 cursor-help", className)}>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-info opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-info "></span>
                    </div>
                </TooltipTrigger>
                <TooltipContent
                    side={side}
                    className="bg-info text-info-foreground border-none font-bold text-caption px-3 py-2 shadow-[0_4px_12px_rgba(0,0,0,0.5)] max-w-[200px]"
                >
                    <div className="flex flex-col gap-1">
                        <span className="uppercase tracking-widest text-caption opacity-70">Aide</span>
                        <p>{description}</p>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
