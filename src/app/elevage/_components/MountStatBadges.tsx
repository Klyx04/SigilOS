"use client";

import React from "react";

// Official Dofus stat icons from public/assets/dofus/stats/
export const STAT_ICON_MAP: Record<string, string> = {
    "Vitalité": "/assets/dofus/stats/pv.png",
    "PA": "/assets/dofus/stats/pa.png",
    "PM": "/assets/dofus/stats/pm.png",
    "Portée": "/assets/dofus/stats/po.png",
    "Invocations": "/assets/dofus/stats/invocation.png",
    "Force": "/assets/dofus/stats/terre.png",
    "Intelligence": "/assets/dofus/stats/feu.png",
    "Chance": "/assets/dofus/stats/eau.png",
    "Agilité": "/assets/dofus/stats/air.png",
    "Puissance": "/assets/dofus/stats/puissance.png",
    "Initiative": "/assets/dofus/stats/initiative.png",
    "Prospection": "/assets/dofus/stats/pp.png",
    "Soins": "/assets/dofus/stats/soin.png",
    "Chance critique": "/assets/dofus/stats/critique.png",
    "Dommages critiques": "/assets/dofus/stats/dmgCritique.png",
    "Résistance critique": "/assets/dofus/stats/resCritique.png",
    "Fuite": "/assets/dofus/stats/fuite.png",
    "Tacle": "/assets/dofus/stats/tacle.png",
    "Esquive PA": "/assets/dofus/stats/esquivePA.png",
    "Esquive PM": "/assets/dofus/stats/esquivePM.png",
    "Retrait PA": "/assets/dofus/stats/retraitPA.png",
    "Retrait PM": "/assets/dofus/stats/retraitPM.png",
    "Dommages Terre": "/assets/dofus/stats/terre.png",
    "Dommages Feu": "/assets/dofus/stats/feu.png",
    "Dommages Eau": "/assets/dofus/stats/eau.png",
    "Dommages Air": "/assets/dofus/stats/air.png",
    "Dommages Poussée": "/assets/dofus/stats/dommages.png",
    "Résistance Poussée": "/assets/dofus/stats/resPoussee.png",
    "Résistance Terre": "/assets/dofus/stats/resTerre.png",
    "Résistance Feu": "/assets/dofus/stats/resFeu.png",
    "Résistance Eau": "/assets/dofus/stats/resEau.png",
    "Résistance Air": "/assets/dofus/stats/resAir.png",
};

export interface ParsedStat {
    raw: string;
    label: string;
    value: string;
    iconUrl: string | null;
}

export function parseMountStats(statsStr: string): ParsedStat[] {
    if (!statsStr) return [];
    const parts = statsStr.split(",").map((s) => s.trim()).filter(Boolean);

    return parts.map((part) => {
        // Find best match in STAT_ICON_MAP
        // e.g. "400 Vitalité", "1 PM", "10% Résistance Air", "14% Chance critique"
        let matchedIcon: string | null = null;
        let matchedLabel = part;

        // Longest match first to avoid "Résistance" matching before "Résistance Air"
        const sortedKeys = Object.keys(STAT_ICON_MAP).sort((a, b) => b.length - a.length);
        for (const key of sortedKeys) {
            if (part.includes(key)) {
                matchedIcon = STAT_ICON_MAP[key];
                matchedLabel = key;
                break;
            }
        }

        return {
            raw: part,
            label: matchedLabel,
            value: part,
            iconUrl: matchedIcon,
        };
    });
}

export interface MountStatBadgesProps {
    stats: string;
    variant?: "inline" | "badges" | "compact";
    className?: string;
}

export function MountStatBadges({
    stats,
    variant = "badges",
    className = "",
}: MountStatBadgesProps) {
    const parsed = parseMountStats(stats);
    if (parsed.length === 0) return null;

    if (variant === "inline") {
        return (
            <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-mono text-muted-foreground ${className}`}>
                {parsed.map((stat, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 shrink-0">
                        {stat.iconUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={stat.iconUrl}
                                alt={stat.label}
                                className="w-3.5 h-3.5 object-contain inline-block shrink-0"
                                loading="lazy"
                            />
                        )}
                        <span>{stat.raw}</span>
                    </span>
                ))}
            </span>
        );
    }

    if (variant === "compact") {
        return (
            <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
                {parsed.map((stat, idx) => (
                    <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface/70 border border-border/80 text-[10px] font-mono text-foreground/90 shrink-0"
                    >
                        {stat.iconUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={stat.iconUrl}
                                alt={stat.label}
                                className="w-3 h-3 object-contain inline-block shrink-0"
                                loading="lazy"
                            />
                        )}
                        <span>{stat.raw}</span>
                    </span>
                ))}
            </div>
        );
    }

    // Default: "badges" (for cards)
    return (
        <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
            {parsed.map((stat, idx) => (
                <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface/80 border border-border text-[11px] font-mono text-foreground shrink-0 shadow-2xs"
                >
                    {stat.iconUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={stat.iconUrl}
                            alt={stat.label}
                            className="w-3.5 h-3.5 object-contain inline-block shrink-0"
                            loading="lazy"
                        />
                    )}
                    <span className="font-medium">{stat.raw}</span>
                </span>
            ))}
        </div>
    );
}
