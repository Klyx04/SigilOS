"use client";

import { useMemo } from "react";
import { TreePine, CheckCircle2, Circle, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { DofusItemWithProgress } from "@/server/actions/dofus-quest-actions";

interface SylvestreDonutProps {
    sylvestre: DofusItemWithProgress;
    allDofus: DofusItemWithProgress[];
    guildId: string;
}

// Each segment of the donut — matches the 3 categories in the Sylvestre spec
type Segment = {
    id: string;
    label: string;
    color: string;
    bgColor: string;
    percent: number;       // personal completion for this segment
    guildPercent: number;  // guild average (passed-in or estimated)
    icon: string;
    description: string;
};

const SYLVESTRE_COLOR = "#22c55e";
const DASH_TOTAL = 283; // 2π × 45 (SVG circle circumference)

// A single animated donut arc
function DonutArc({
    percent,
    color,
    strokeWidth,
    radius,
    rotation,
    totalArcFraction,
}: {
    percent: number;
    color: string;
    strokeWidth: number;
    radius: number;
    rotation: number;
    totalArcFraction: number; // how much of the circle this arc occupies (0-1)
}) {
    const circumference = 2 * Math.PI * radius;
    const arcLength = circumference * totalArcFraction;
    const filled = arcLength * (percent / 100);
    const gap = 4; // gap between segments in px

    return (
        <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${Math.max(0, filled - gap)} ${circumference - Math.max(0, filled - gap)}`}
            strokeDashoffset={-circumference * (rotation) + gap / 2}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 1s ease, opacity 0.3s ease" }}
        />
    );
}

export function SylvestreDonut({ sylvestre, allDofus, guildId }: SylvestreDonutProps) {
    // Build the 3 segment data from what we know about the Sylvestre
    const sylvestreReqDofus = useMemo(() => allDofus.filter(d => d.isSylvestreReq && !d.isMeta), [allDofus]);

    const segments: Segment[] = useMemo(() => {
        // Segment 1 — Dofus requis (35% of weight)
        const dofusReqTotal = sylvestreReqDofus.length;
        const dofusReqDone = sylvestreReqDofus.filter(d => d.isObtained).length;
        const dofusReqPercent = dofusReqTotal > 0 ? Math.round((dofusReqDone / dofusReqTotal) * 100) : 0;

        // Segment 2 — Arc quêtes (from Sylvestre own stages)
        const questPercent = sylvestre.totalQuests > 0 
            ? Math.round((sylvestre.completedQuests / sylvestre.totalQuests) * 100) 
            : 0;

        return [
            {
                id: "dofus-requis",
                label: "Dofus requis",
                color: "#a78bfa",
                bgColor: "rgba(167,139,250,0.15)",
                percent: dofusReqPercent,
                guildPercent: dofusReqPercent,
                icon: "💎",
                description: `${dofusReqDone}/${dofusReqTotal} Dofus obtenus`,
            },
            {
                id: "arc-quetes",
                label: "Arc de quêtes",
                color: "#34d399",
                bgColor: "rgba(52,211,153,0.15)",
                percent: questPercent,
                guildPercent: questPercent,
                icon: "📜",
                description: `${sylvestre.completedQuests}/${sylvestre.totalQuests} quêtes complétées`,
            },
        ];
    }, [sylvestreReqDofus, sylvestre]);

    // Weighted overall: 50% Required Dofus, 50% Own Questline
    const weights = [0.5, 0.5];
    const overallPercent = Math.round(
        segments.reduce((sum, seg, i) => sum + seg.percent * weights[i], 0)
    );

    const isObtained = sylvestre.isObtained;
    const radius = 45;
    const circumference = 2 * Math.PI * radius;

    // Each segment occupies 1/2 of the circle
    const arcFraction = 1 / 2;

    return (
        <div
            className="relative rounded-2xl p-5 overflow-hidden"
            style={{
                background: "linear-gradient(135deg, rgba(34,197,94,0.06) 0%, rgba(16,185,129,0.03) 100%)",
                border: "1px solid rgba(34,197,94,0.2)",
                boxShadow: "0 8px 32px rgba(34,197,94,0.06)",
            }}
        >
            {/* Top accent */}
            <div
                className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background: "linear-gradient(90deg, transparent, rgba(34,197,94,0.6), transparent)" }}
            />

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}
                    >
                        <TreePine className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-emerald-400/70">Méta-Dofus</p>
                        <h2 className="text-sm font-bold text-white">Dofus Sylvestre</h2>
                    </div>
                </div>
                {isObtained ? (
                    <span className="flex items-center gap-1 text-xs font-black text-emerald-400 uppercase tracking-wider px-2 py-1 rounded-lg"
                        style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}>
                        <CheckCircle2 className="w-3 h-3" /> Obtenu
                    </span>
                ) : (
                    <Link
                        href={`/dashboard/${guildId}/quetes-dofus/sylvestre`}
                        className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
                    >
                        Détails <ExternalLink className="w-3 h-3" />
                    </Link>
                )}
            </div>

            {/* Main layout: Donut + Segments */}
            <div className="flex flex-col sm:flex-row gap-5 items-center">
                {/* SVG Donut */}
                <div className="relative flex-shrink-0 w-32 h-32">
                    <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                        {/* Track */}
                        <circle
                            cx="60" cy="60" r={radius}
                            fill="none"
                            stroke="rgba(255,255,255,0.04)"
                            strokeWidth={10}
                        />
                        {/* Segment arcs */}
                        {segments.map((seg, i) => (
                            <DonutArc
                                key={seg.id}
                                percent={seg.percent}
                                color={seg.color}
                                strokeWidth={10}
                                radius={radius}
                                rotation={i * arcFraction}
                                totalArcFraction={arcFraction}
                            />
                        ))}
                        {/* Obtained glow ring */}
                        {isObtained && (
                            <circle
                                cx="60" cy="60" r={radius + 6}
                                fill="none"
                                stroke="rgba(34,197,94,0.4)"
                                strokeWidth={2}
                            />
                        )}
                    </svg>
                    {/* Center text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-black tabular-nums" style={{ color: SYLVESTRE_COLOR }}>
                            {overallPercent}%
                        </span>
                        <span className="text-caption text-white/30 uppercase tracking-widest font-bold leading-tight mt-0.5">
                            Perso
                        </span>
                    </div>
                </div>

                {/* Segment breakdown */}
                <div className="flex-1 grid gap-2 w-full">
                    {segments.map((seg) => (
                        <div
                            key={seg.id}
                            className="flex items-center gap-3 px-3 py-2 rounded-xl"
                            style={{ background: seg.bgColor, border: `1px solid ${seg.color}22` }}
                        >
                            <span className="text-base flex-shrink-0">{seg.icon}</span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold text-white/80 truncate">{seg.label}</span>
                                    <span className="text-xs font-black tabular-nums ml-2 flex-shrink-0" style={{ color: seg.color }}>
                                        {seg.percent}%
                                    </span>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                                    <div
                                        className="h-full rounded-full transition-all duration-300"
                                        style={{
                                            width: `${seg.percent}%`,
                                            background: seg.color,
                                            boxShadow: `0 0 6px ${seg.color}88`,
                                        }}
                                    />
                                </div>
                                <p className="text-caption text-white/25 mt-0.5 truncate">{seg.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>


        </div>
    );
}
