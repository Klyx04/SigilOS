"use client";

import { cn } from "@/lib/utils";
import type { MultiDungeonItem } from "@/lib/dungeon-finder-utils";
import { Swords } from "lucide-react";

interface DjMultiBossAvatarsProps {
    dungeons: MultiDungeonItem[];
    size?: "sm" | "md" | "lg";
    className?: string;
}

export function DjMultiBossAvatars({ dungeons, size = "md", className }: DjMultiBossAvatarsProps) {
    if (!dungeons || dungeons.length === 0) {
        return (
            <div className={cn("w-full h-full flex items-center justify-center bg-surface", className)}>
                <Swords className="w-6 h-6 text-muted-foreground" />
            </div>
        );
    }

    if (dungeons.length === 1) {
        const d = dungeons[0];
        return d.imageUrl ? (
            <img
                src={d.imageUrl}
                alt={d.bossName || d.name}
                title={`${d.name} (${d.bossName})`}
                className={cn("w-full h-full object-cover", className)}
            />
        ) : (
            <div className={cn("w-full h-full flex items-center justify-center bg-surface", className)}>
                <Swords className="w-6 h-6 text-muted-foreground" />
            </div>
        );
    }

    // Multi-boss : 2 à 5 boss
    const maxDisplayed = 4;
    const displayed = dungeons.slice(0, maxDisplayed);
    const extraCount = dungeons.length - maxDisplayed;

    return (
        <div className={cn("w-full h-full grid grid-cols-2 grid-rows-2 gap-0.5 p-0.5 bg-background/90 rounded-inherit overflow-hidden", className)}>
            {displayed.map((d, idx) => {
                // If it's the 4th item and there are more than 4 dungeons, show "+N" badge
                if (idx === 3 && extraCount > 0) {
                    return (
                        <div
                            key="extra"
                            title={dungeons.slice(3).map(extra => extra.name).join(", ")}
                            className="w-full h-full bg-surface flex items-center justify-center rounded-[3px] text-[10px] font-black text-muted-foreground border border-border"
                        >
                            +{extraCount + 1}
                        </div>
                    );
                }

                return (
                    <div
                        key={d.dungeonId || idx}
                        title={`${d.name} — ${d.bossName} (Niv. ${d.level})`}
                        className="w-full h-full relative rounded-[3px] overflow-hidden bg-background border border-border/50 flex items-center justify-center"
                    >
                        {d.imageUrl ? (
                            <img
                                src={d.imageUrl}
                                alt={d.bossName || d.name}
                                className="w-full h-full object-cover scale-105 hover:scale-125 transition-transform duration-150"
                            />
                        ) : (
                            <span className="text-[9px] font-black text-muted-foreground uppercase truncate px-0.5">
                                {(d.name || "?").slice(0, 2)}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
