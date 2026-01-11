"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Crown, Palmtree } from "lucide-react";
import { cn } from "@/lib/utils";

interface IdentityCardProps {
    avatarUrl?: string | null;
    displayName: string;
    roleColor?: number;
    isTopContributor?: boolean;
    isOnVacation?: boolean;
}

export function IdentityCard({
    avatarUrl,
    displayName,
    roleColor = 0,
    isTopContributor = false,
    isOnVacation = false,
}: IdentityCardProps) {
    const borderColor = roleColor > 0
        ? `#${roleColor.toString(16).padStart(6, "0")}`
        : undefined;

    return (
        <div className="flex flex-col items-center gap-4 p-6 bg-zinc-900/60 rounded-2xl border border-white/5">
            {/* Avatar with Role Border */}
            <div className="relative">
                <Avatar
                    className={cn(
                        "w-24 h-24 border-4 transition-all",
                        borderColor ? "" : "border-white/10"
                    )}
                    style={borderColor ? { borderColor } : undefined}
                >
                    <AvatarImage src={avatarUrl || ""} alt={displayName} />
                    <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                        {displayName?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                </Avatar>

                {/* Top Contributor Crown */}
                {isTopContributor && (
                    <div className="absolute -top-2 -right-2 p-1.5 bg-amber-500/20 rounded-full border border-amber-500/30">
                        <Crown className="w-4 h-4 text-amber-400" />
                    </div>
                )}

                {/* Vacation Indicator */}
                {isOnVacation && (
                    <div className="absolute -bottom-1 -right-1 p-1.5 bg-cyan-500/20 rounded-full border border-cyan-500/30">
                        <Palmtree className="w-4 h-4 text-cyan-400" />
                    </div>
                )}
            </div>

            {/* Name */}
            <div className="text-center">
                <h2 className="text-xl font-bold text-white">{displayName}</h2>
            </div>

            {/* Status Badges */}
            <div className="flex flex-wrap gap-2 justify-center">
                {isOnVacation && (
                    <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                        <Palmtree className="w-3 h-3 mr-1" />
                        En vacances
                    </Badge>
                )}
                {isTopContributor && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                        <Crown className="w-3 h-3 mr-1" />
                        Top Contributeur
                    </Badge>
                )}
            </div>
        </div>
    );
}
