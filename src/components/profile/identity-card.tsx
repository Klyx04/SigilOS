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
    joinedAt?: Date | null;
}

export function IdentityCard({
    avatarUrl,
    displayName,
    roleColor = 0,
    isTopContributor = false,
    isOnVacation = false,
    joinedAt,
}: IdentityCardProps) {
    const borderColor = roleColor > 0
        ? `#${roleColor.toString(16).padStart(6, "0")}`
        : undefined;

    return (
        <div className="relative overflow-hidden p-6 bg-surface/60 rounded-2xl border border-border h-full flex flex-col items-center justify-between group">

            {/* Background Gradient Effect */}
            <div
                className="absolute inset-x-0 -top-24 h-48 bg-gradient-to-b from-primary/10 to-transparent blur-3xl opacity-50 pointer-events-none group-hover:opacity-75 transition-opacity duration-300"
                style={borderColor ? { background: `linear-gradient(to bottom, ${borderColor}20, transparent)` } : undefined}
            />

            <div className="flex flex-col items-center w-full z-10">
                {/* Avatar with Role Border and Badges */}
                <div className="relative mb-4 ring-offset-[3px] ring-offset-zinc-950/0 rounded-full transition-all duration-300 ">
                    {/* Glow behind Avatar */}
                    <div
                        className="absolute inset-0 rounded-full blur-[20px] opacity-20 transition-opacity duration-300 group-hover:opacity-40"
                        style={{ backgroundColor: borderColor || "#ffffff" }}
                    />

                    <Avatar
                        className="w-28 h-28 border-[3px] shadow-2xl relative z-10"
                        style={{ borderColor: borderColor || "rgba(255,255,255,0.1)" }}
                    >
                        <AvatarImage src={avatarUrl || ""} alt={displayName} className="object-cover" />
                        <AvatarFallback className="text-4xl font-bold bg-surface text-foreground">
                            {displayName?.[0]?.toUpperCase() ?? "?"}
                        </AvatarFallback>
                    </Avatar>

                    {/* Top Contributor Crown Badge */}
                    {isTopContributor && (
                        <div className="absolute -top-1 -right-1 z-20 p-1.5 bg-surface rounded-full border border-warning/30 shadow-lg shadow-amber-500/20" title="Top Contributeur">
                            <Crown className="w-5 h-5 text-warning fill-amber-500/20" />
                        </div>
                    )}

                    {/* Vacation Badge */}
                    {isOnVacation && (
                        <div className="absolute -bottom-1 -right-1 z-20 p-1.5 bg-surface rounded-full border border-info/30 shadow-lg shadow-cyan-500/20" title="En Vacances">
                            <Palmtree className="w-5 h-5 text-info fill-cyan-400/20" />
                        </div>
                    )}
                </div>

                {/* Name */}
                <h2 className="text-2xl font-bold text-foreground tracking-tight text-center mb-1">
                    {displayName}
                </h2>

                {roleColor > 0 && (
                    <div className="h-1 w-12 rounded-full mb-4 opacity-50" style={{ backgroundColor: borderColor }} />
                )}

                {/* Badges Row - Only if badges exist */}
                {(isTopContributor || isOnVacation) && (
                    <div className="flex flex-wrap gap-2 justify-center mb-2">
                        {isTopContributor && (
                            <Badge variant="secondary" className="bg-warning/10 text-warning hover:bg-warning/20 border-warning/20">
                                Top Contributeur
                            </Badge>
                        )}
                        {isOnVacation && (
                            <Badge variant="secondary" className="bg-info/10 text-info hover:bg-info/20 border-info/20">
                                En Congés
                            </Badge>
                        )}
                    </div>
                )}
            </div>

            {/* Footer: Member Since */}
            {joinedAt && (
                <div className="w-full mt-6 pt-6 border-t border-border flex flex-col items-center gap-1 z-10">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                        Membre depuis
                    </p>
                    <p className="text-foreground font-medium">
                        {new Date(joinedAt).toLocaleDateString("fr-FR", { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
            )}

            {!joinedAt && (
                <div className="flex-1" /> // Spacer if no date
            )}
        </div>
    );
}
