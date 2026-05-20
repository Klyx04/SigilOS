"use client";

import React, { useState, useMemo } from "react";
import {
    CheckCircle2, Circle, MinusCircle, Users,
    ChevronLeft, ChevronRight, Filter, Layers, Trophy, Search
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

function GuildQuestList({ data, dofusColor }: { data: GuildHeatmapData; dofusColor: string }) {
    const { entries, members } = data;
    const [search, setSearch] = useState("");
    const [selectedType, setSelectedType] = useState<string>("ALL");

    // Group entries by sectionName
    const grouped = useMemo(() => {
        const map = new Map<string, typeof entries>();
        entries.forEach(e => {
            const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase());
            const matchesType = selectedType === "ALL" || e.sectionType === selectedType;
            if (matchesSearch && matchesType) {
                if (!map.has(e.sectionName)) map.set(e.sectionName, []);
                map.get(e.sectionName)!.push(e);
            }
        });
        return Array.from(map.entries());
    }, [entries, search, selectedType]);

    return (
        <div className="space-y-6">
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-zinc-950/20 p-4 border border-white/5 rounded-2xl">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Rechercher une quête..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-xs font-bold uppercase tracking-widest bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                    />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setSelectedType("ALL")}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                            selectedType === "ALL" 
                                ? "bg-white text-black border-white" 
                                : "bg-white/5 text-zinc-400 border-white/5 hover:border-white/10"
                        }`}
                    >
                        Tous
                    </button>
                    {Object.entries(SECTION_COLORS).map(([type, color]) => (
                        <button
                            key={type}
                            onClick={() => setSelectedType(type)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                                selectedType === type 
                                    ? "text-white" 
                                    : "text-zinc-500 border-white/5 hover:border-white/10"
                            }`}
                            style={selectedType === type ? { backgroundColor: `${color}22`, borderColor: color } : { backgroundColor: "rgba(255,255,255,0.03)" }}
                        >
                            {type === "PREREQUISITE" ? "Prérequis" :
                             type === "MAIN_CHAIN" ? "Arc Principal" :
                             type === "RESOURCE_CHAIN" ? "Ressources" : "Optionnel"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Groups list */}
            {grouped.length > 0 ? (
                <div className="space-y-8">
                    {grouped.map(([sectionName, sectionQuests]) => (
                        <div key={sectionName} className="space-y-4">
                            <h4 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.3em] pl-2 border-l-2 border-indigo-500/50">
                                {sectionName}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {sectionQuests.map((quest) => {
                                    const completedMembers = members.filter(m => m.statusMap[quest.id] === 'COMPLETED');
                                    const inProgressMembers = members.filter(m => m.statusMap[quest.id] === 'IN_PROGRESS');
                                    const total = members.length;
                                    const pct = total > 0 ? Math.round((completedMembers.length / total) * 100) : 0;

                                    return (
                                        <div 
                                            key={quest.id} 
                                            className="p-5 rounded-[2rem] bg-white/[0.01] border border-white/5 hover:border-white/10 hover:bg-white/[0.02] transition-all flex flex-col gap-4 group"
                                        >
                                            {/* Top info */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <span 
                                                        className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded border mb-1.5 inline-block"
                                                        style={{ 
                                                            borderColor: `${SECTION_COLORS[quest.sectionType]}22`, 
                                                            color: SECTION_COLORS[quest.sectionType],
                                                            backgroundColor: `${SECTION_COLORS[quest.sectionType]}08`
                                                        }}
                                                    >
                                                        {quest.sectionType === "PREREQUISITE" ? "Prérequis" :
                                                         quest.sectionType === "MAIN_CHAIN" ? "Arc Principal" :
                                                         quest.sectionType === "RESOURCE_CHAIN" ? "Donjon & Ressources" : "Optionnel"}
                                                    </span>
                                                    <h5 className="text-[13px] font-black text-white italic uppercase tracking-tight truncate leading-tight group-hover:text-indigo-400 transition-colors">
                                                        {quest.name}
                                                    </h5>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <span className="text-[11px] font-black text-white italic tabular-nums">{completedMembers.length}/{total}</span>
                                                    <span className="text-[9px] font-bold text-zinc-600 block uppercase tracking-widest mt-0.5">Membres</span>
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="space-y-1.5">
                                                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
                                                    <div 
                                                        className="h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(255,255,255,0.05)]"
                                                        style={{ background: dofusColor, width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Avatar Stacks */}
                                            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/5 pt-3 mt-1 text-[10px]">
                                                {/* En cours members */}
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-zinc-500 uppercase tracking-wider text-[8px]">En cours ({inProgressMembers.length}):</span>
                                                    {inProgressMembers.length > 0 ? (
                                                        <div className="flex -space-x-1.5 overflow-hidden">
                                                            {inProgressMembers.slice(0, 6).map((m) => (
                                                                <div 
                                                                    key={m.profileId}
                                                                    title={`${m.pseudo} (En cours)`}
                                                                    className="w-5 h-5 rounded-full bg-zinc-950 border border-amber-500/40 flex items-center justify-center text-[7px] font-black text-amber-500 overflow-hidden relative group/avatar cursor-pointer"
                                                                >
                                                                    {m.image ? (
                                                                        <img src={m.image} alt={m.pseudo} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        m.pseudo[0].toUpperCase()
                                                                    )}
                                                                </div>
                                                            ))}
                                                            {inProgressMembers.length > 6 && (
                                                                <div className="w-5 h-5 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-[7px] font-black text-zinc-400">
                                                                    +{inProgressMembers.length - 6}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[9px] italic text-zinc-700">Aucun</span>
                                                    )}
                                                </div>

                                                {/* Completed members */}
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-zinc-500 uppercase tracking-wider text-[8px]">Complété ({completedMembers.length}):</span>
                                                    {completedMembers.length > 0 ? (
                                                        <div className="flex -space-x-1.5 overflow-hidden">
                                                            {completedMembers.slice(0, 6).map((m) => (
                                                                <div 
                                                                    key={m.profileId}
                                                                    title={`${m.pseudo} (Complété)`}
                                                                    className="w-5 h-5 rounded-full bg-zinc-950 border border-emerald-500/40 flex items-center justify-center text-[7px] font-black text-emerald-400 overflow-hidden relative group/avatar cursor-pointer"
                                                                >
                                                                    {m.image ? (
                                                                        <img src={m.image} alt={m.pseudo} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        m.pseudo[0].toUpperCase()
                                                                    )}
                                                                </div>
                                                            ))}
                                                            {completedMembers.length > 6 && (
                                                                <div className="w-5 h-5 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-[7px] font-black text-zinc-400">
                                                                    +{completedMembers.length - 6}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[9px] italic text-zinc-700">Aucun</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="p-12 border border-dashed border-white/10 rounded-[2rem] text-center text-zinc-600 italic text-xs">
                    Aucune quête trouvée.
                </div>
            )}
        </div>
    );
}

export function GuildDofusHeatmap({ data, dofusColor = "#6366f1", dofusName = "Dofus" }: GuildDofusHeatmapProps) {
    const [subTab, setSubTab] = useState<"list" | "heatmap">("list");
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
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: `${dofusColor}18`, border: `1px solid ${dofusColor}33` }}
                    >
                        <Users className="w-4 h-4" style={{ color: dofusColor }} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-tight">Membres de la Guilde</h3>
                        <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">
                            {members.length} membres · {visibleEntries.length} étapes · moy. {guildAvg}%
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Show optional toggle */}
                    {subTab === "heatmap" && (
                        <>
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
                        </>
                    )}
                </div>
            </div>

            {/* View Selector Tabs */}
            <div className="flex p-1 bg-zinc-950/40 border border-white/5 rounded-2xl w-fit gap-1 self-start">
                <button
                    onClick={() => setSubTab("list")}
                    className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                        subTab === "list"
                            ? "bg-white text-black font-black shadow-lg"
                            : "text-zinc-500 hover:text-white"
                    }`}
                >
                    Suivi par Quête
                </button>
                <button
                    onClick={() => setSubTab("heatmap")}
                    className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                        subTab === "heatmap"
                            ? "bg-white text-black font-black shadow-lg"
                            : "text-zinc-500 hover:text-white"
                    }`}
                >
                    Matrice (Heatmap)
                </button>
            </div>

            {subTab === "list" ? (
                <GuildQuestList data={data} dofusColor={dofusColor} />
            ) : (
                <>
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
                        <div className="flex items-center justify-between mt-4">
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
                    <div className="flex flex-wrap gap-2 pt-3">
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
                </>
            )}
        </div>
    );
}
