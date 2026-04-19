"use client";

import React, { useState, useMemo } from "react";
import {
    CheckCircle2, Circle, MinusCircle, Users,
    ChevronLeft, ChevronRight, Filter, Layers, Trophy,
} from "lucide-react";
import type { GuildHeatmapData } from "@/server/actions/dofus-quest-actions";

interface GuildDofusHeatmapProps {
    data: GuildHeatmapData;
    dofusColor?: string;
    dofusName?: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ElementType; label: string }> = {
    COMPLETED: { bg: "#22c55e", text: "#fff", icon: CheckCircle2, label: "Complété" },
    IN_PROGRESS: { bg: "#f59e0b", text: "#fff", icon: MinusCircle, label: "En cours" },
    NOT_STARTED: { bg: "transparent", text: "rgba(255,255,255,0.12)", icon: Circle, label: "À faire" },
};

const PAGE_SIZE = 8; // members per page
const COLS_PER_PAGE = 12; // entries per page

// Section type badges
const SECTION_COLORS: Record<string, string> = {
    PREREQUISITE: "#a78bfa",
    MAIN_CHAIN: "#34d399",
    RESOURCE_CHAIN: "#fb923c",
    OPTIONAL: "#6b7280",
};

export function GuildDofusHeatmap({ data, dofusColor = "#6366f1", dofusName = "Dofus" }: GuildDofusHeatmapProps) {
    const [memberPage, setMemberPage] = useState(0);
    const [colPage, setColPage] = useState(0);
    const [showOptional, setShowOptional] = useState(false);

    const { entries, members } = data;

    const visibleEntries = useMemo(
        () => entries.filter(e => showOptional || !e.isOptional),
        [entries, showOptional]
    );

    // Pagination
    const memberStart = memberPage * PAGE_SIZE;
    const visibleMembers = members.slice(memberStart, memberStart + PAGE_SIZE);
    const memberPageCount = Math.ceil(members.length / PAGE_SIZE);

    const colStart = colPage * COLS_PER_PAGE;
    const visibleCols = visibleEntries.slice(colStart, colStart + COLS_PER_PAGE);
    const colPageCount = Math.ceil(visibleEntries.length / COLS_PER_PAGE);

    // Overall guild progress
    const guildAvg = members.length > 0
        ? Math.round(members.reduce((s, m) => s + m.completionPercent, 0) / members.length)
        : 0;

    if (entries.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Layers className="w-10 h-10 text-white/10" />
                <p className="text-white/25 text-sm font-bold uppercase tracking-widest">Aucune étape disponible</p>
                <p className="text-white/15 text-xs">Lance le seed pour charger les données.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: `${dofusColor}18`, border: `1px solid ${dofusColor}33` }}
                    >
                        <Users className="w-4 h-4" style={{ color: dofusColor }} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-tight">Heatmap Guilde</h3>
                        <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">
                            {members.length} membres · {visibleEntries.length} étapes · moy. {guildAvg}%
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Show optional toggle */}
                    <button
                        onClick={() => setShowOptional(v => !v)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                        style={{
                            background: showOptional ? `${dofusColor}22` : "rgba(255,255,255,0.04)",
                            color: showOptional ? dofusColor : "rgba(255,255,255,0.35)",
                            border: `1px solid ${showOptional ? dofusColor + "44" : "rgba(255,255,255,0.08)"}`,
                        }}
                    >
                        <Filter className="w-3 h-3" />
                        Optionnelles
                    </button>
                    {/* Legend */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                        {Object.entries(STATUS_STYLES).map(([k, v]) => (
                            <div key={k} className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-sm" style={{ background: v.bg || "rgba(255,255,255,0.08)" }} />
                                <span className="text-[9px] text-white/25 font-bold uppercase">{v.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Heatmap table */}
            <div
                className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)" }}
            >
                {/* Column headers */}
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                {/* Member column */}
                                <th className="sticky left-0 z-20 px-3 py-2 text-left min-w-[140px]"
                                    style={{ background: "rgba(0,0,0,0.4)", borderRight: "1px solid rgba(255,255,255,0.05)" }}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] text-white/25 font-black uppercase tracking-widest">
                                            Membre
                                        </span>
                                        <Trophy className="w-3 h-3 text-white/15" />
                                    </div>
                                </th>
                                {/* Progress column */}
                                <th className="sticky left-[140px] z-20 px-2 py-2 min-w-[56px]"
                                    style={{ background: "rgba(0,0,0,0.4)", borderRight: "1px solid rgba(255,255,255,0.08)" }}>
                                    <span className="text-[9px] text-white/20 font-black uppercase tracking-widest">%</span>
                                </th>
                                {/* Step columns */}
                                {visibleCols.map((entry, i) => (
                                    <th
                                        key={entry.id}
                                        className="px-1 py-2 text-center min-w-[32px] w-8"
                                        style={{ borderLeft: "1px solid rgba(255,255,255,0.03)" }}
                                        title={`${entry.name} (${entry.sectionName})`}
                                    >
                                        <div className="flex flex-col items-center gap-0.5">
                                            <div
                                                className="w-1 h-1 rounded-full mx-auto"
                                                style={{ background: SECTION_COLORS[entry.sectionType] || dofusColor }}
                                            />
                                            <span className="text-[7px] text-white/20 font-bold tabular-nums">
                                                {colStart + i + 1}
                                            </span>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {visibleMembers.map((member) => (
                                <tr
                                    key={member.profileId}
                                    className="group/row transition-colors hover:bg-white/[0.02]"
                                    style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
                                >
                                    {/* Member name */}
                                    <td
                                        className="sticky left-0 z-10 px-3 py-1.5"
                                        style={{ background: "rgba(10,10,12,0.85)", borderRight: "1px solid rgba(255,255,255,0.05)" }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden text-[8px] font-black"
                                                style={{ background: `${dofusColor}22`, color: dofusColor }}
                                            >
                                                {member.image
                                                    ? <img src={member.image} alt={member.pseudo} className="w-full h-full object-cover" />
                                                    : member.pseudo.charAt(0).toUpperCase()
                                                }
                                            </div>
                                            <span className="text-[11px] font-bold text-white/70 truncate max-w-[80px]">{member.pseudo}</span>
                                        </div>
                                    </td>
                                    {/* Progress bar */}
                                    <td
                                        className="sticky left-[140px] z-10 px-2 py-1.5 text-center"
                                        style={{ background: "rgba(10,10,12,0.85)", borderRight: "1px solid rgba(255,255,255,0.08)" }}
                                    >
                                        <span
                                            className="text-[10px] font-black tabular-nums"
                                            style={{ color: member.completionPercent > 0 ? dofusColor : "rgba(255,255,255,0.2)" }}
                                        >
                                            {member.completionPercent}%
                                        </span>
                                    </td>
                                    {/* Step cells */}
                                    {visibleCols.map((entry) => {
                                        const status = member.statusMap[entry.id] ?? "NOT_STARTED";
                                        const style = STATUS_STYLES[status] || STATUS_STYLES.NOT_STARTED;
                                        const Icon = style.icon;
                                        return (
                                            <td
                                                key={entry.id}
                                                className="text-center py-1.5 px-1"
                                                title={`${member.pseudo} — ${entry.name}: ${style.label}`}
                                                style={{ borderLeft: "1px solid rgba(255,255,255,0.03)" }}
                                            >
                                                <div className="flex items-center justify-center">
                                                    <div
                                                        className="w-7 h-7 rounded-md flex items-center justify-center transition-all duration-200 group-hover/row:scale-110 shadow-lg"
                                                        style={{
                                                            background: status === "COMPLETED"
                                                                ? `${style.bg}22`
                                                                : status === "IN_PROGRESS"
                                                                    ? `${style.bg}18`
                                                                    : "rgba(255,255,255,0.03)",
                                                            border: `1px solid ${status === "NOT_STARTED" ? "rgba(255,255,255,0.05)" : style.bg + "44"}`,
                                                        }}
                                                    >
                                                        <Icon
                                                            className="w-4 h-4"
                                                            style={{ color: status === "NOT_STARTED" ? "rgba(255,255,255,0.08)" : style.bg }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Column pagination */}
                {colPageCount > 1 && (
                    <div
                        className="flex items-center justify-between px-4 py-2"
                        style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
                    >
                        <div className="flex gap-1">
                            {Array.from({ length: colPageCount }).map((_, i) => (
                                <div
                                    key={i}
                                    className="h-1 rounded-full cursor-pointer transition-all"
                                    style={{
                                        width: colPage === i ? "24px" : "6px",
                                        background: colPage === i ? dofusColor : "rgba(255,255,255,0.1)",
                                    }}
                                    onClick={() => setColPage(i)}
                                />
                            ))}
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setColPage(p => Math.max(0, p - 1))}
                                disabled={colPage === 0}
                                className="p-1 rounded-lg hover:bg-white/5 disabled:opacity-20 transition-all"
                            >
                                <ChevronLeft className="w-3.5 h-3.5 text-white/40" />
                            </button>
                            <span className="text-[9px] text-white/20 font-bold uppercase px-1">
                                Étapes {colStart + 1}–{Math.min(colStart + COLS_PER_PAGE, visibleEntries.length)} / {visibleEntries.length}
                            </span>
                            <button
                                onClick={() => setColPage(p => Math.min(colPageCount - 1, p + 1))}
                                disabled={colPage >= colPageCount - 1}
                                className="p-1 rounded-lg hover:bg-white/5 disabled:opacity-20 transition-all"
                            >
                                <ChevronRight className="w-3.5 h-3.5 text-white/40" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Member pagination */}
            {memberPageCount > 1 && (
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => setMemberPage(p => Math.max(0, p - 1))}
                        disabled={memberPage === 0}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white/40 hover:text-white/70 hover:bg-white/5 disabled:opacity-20 transition-all"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" /> Précédent
                    </button>
                    <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">
                        {memberStart + 1}–{Math.min(memberStart + PAGE_SIZE, members.length)} / {members.length} membres
                    </span>
                    <button
                        onClick={() => setMemberPage(p => Math.min(memberPageCount - 1, p + 1))}
                        disabled={memberPage >= memberPageCount - 1}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white/40 hover:text-white/70 hover:bg-white/5 disabled:opacity-20 transition-all"
                    >
                        Suivant <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Section legend */}
            <div className="flex flex-wrap gap-2 pt-1">
                {Object.entries(SECTION_COLORS).map(([type, color]) => (
                    <div key={type} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-sm" style={{ background: color }} />
                        <span className="text-[9px] font-bold text-white/25 uppercase tracking-wider">
                            {type === "PREREQUISITE" ? "Prérequis" :
                             type === "MAIN_CHAIN" ? "Arc Principal" :
                             type === "RESOURCE_CHAIN" ? "Ressources" : "Optionnel"}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
