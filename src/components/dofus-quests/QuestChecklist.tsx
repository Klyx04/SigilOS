"use client";

import React, { useState, useTransition, useMemo, useEffect } from "react";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Swords, Star, Briefcase, Wand2, ListChecks, Shield, AlertCircle, MapPin, Lock, Copy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { toggleQuestStatus } from "@/server/actions/dofus-quest-actions";
import type { DofusChainWithProgress, DofusEntryWithProgress } from "@/server/actions/dofus-quest-actions";
import { DofusQuestStatus } from "@prisma/client";
import { NpcName, ItemInline, MonsterInline, ParsedObjective, MapLink, copyWithToast, detectRealDungeons, extractObjectiveText } from "./dofus-resolvers";

// ─── Icons per quest type ────────────────────────────────────────────────────
function QuestTypeIcon({ type, className }: { type: string; className?: string }) {
    const cls = className || "w-3.5 h-3.5";
    switch (type) {
        case "DUNGEON":     return <Swords className={cls} />;
        case "ACHIEVEMENT": return <Star className={cls} />;
        case "JOB":         return <Briefcase className={cls} />;
        case "SPELL":       return <Wand2 className={cls} />;
        case "REQUIREMENT": return <AlertCircle className={cls} />;
        default:            return <ListChecks className={cls} />;
    }
}

// ─── Section type label ────────────────────────────────────────────────────────
function SectionBadge({ type }: { type: string }) {
    const map: Record<string, { label: string; color: string }> = {
        PREREQUISITE:  { label: "Prérequis",    color: "#f59e0b" },
        MAIN_CHAIN:    { label: "Les quêtes",   color: "#6366f1" },
        OPTIONAL:      { label: "Optionnel",    color: "#6b7280" },
    };
    const cfg = map[type] || { label: type, color: "#6b7280" };
    return (
        <span
            className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: `${cfg.color}22`, color: cfg.color, border: `1px solid ${cfg.color}44` }}
        >
            {cfg.label}
        </span>
    );
}

// ─── Single quest entry row ──────────────────────────────────────────────────
function QuestEntryRow({
    entry,
    guildId,
    dofusColor,
    completedIds,
}: {
    entry: DofusEntryWithProgress;
    guildId: string;
    dofusColor: string;
    completedIds: Set<string>;
}) {
    const [status, setStatus] = useState<DofusQuestStatus>(entry.status);
    const [isPending, startTransition] = useTransition();
    const [showDetail, setShowDetail] = useState(false);

    const isCompleted = status === "COMPLETED";
    const isLocked = entry.requirements &&
        Array.isArray(entry.requirements) &&
        entry.requirements.length > 0 &&
        entry.requirements.some((req: any) => req && typeof req === 'object' && req.type === "QUEST" && !completedIds?.has(req.id));

    // Real dungeon detection
    const dungeonInfos = useMemo(() => detectRealDungeons((entry as any).objectives ?? []), [entry]);

    function handleToggle() {
        const newStatus: DofusQuestStatus = isCompleted ? "NOT_STARTED" : "COMPLETED";
        setStatus(newStatus);
        startTransition(async () => {
            const res = await toggleQuestStatus(guildId, entry.id, newStatus);
            if (!res.success) setStatus(status);
        });
    }

    return (
        <div
            className={`group flex flex-col rounded-2xl transition-all duration-300 border ${
                isCompleted ? "bg-[#10b98108] border-[#10b98125]" : "bg-[#ffffff03] border-white/5 hover:border-white/10"
            } ${entry.isOptional ? "opacity-60" : ""} ${isPending ? "opacity-40" : ""}`}
        >
            {/* ── Header row — click to expand ── */}
            <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
                onClick={() => setShowDetail(!showDetail)}
            >
                {/* Checkbox */}
                <button
                    disabled={isPending || (!!isLocked && !isCompleted)}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (isLocked && !isCompleted) return;
                        handleToggle();
                    }}
                    className={`flex-shrink-0 transition-all duration-150 z-10 ${
                        isLocked && !isCompleted ? "cursor-not-allowed opacity-20 grayscale" : "hover:scale-110"
                    }`}
                >
                    {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5" style={{ color: dofusColor, filter: `drop-shadow(0 0 8px ${dofusColor}44)` }} />
                    ) : isLocked ? (
                        <Lock className="w-5 h-5 text-zinc-700" />
                    ) : (
                        <Circle className="w-5 h-5 text-white/10 group-hover:text-white/30 transition-colors" />
                    )}
                </button>

                {/* Type icon */}
                <span className={`flex-shrink-0 ${isCompleted ? "" : "text-white/20"}`} style={{ color: isCompleted ? dofusColor : undefined }}>
                    <QuestTypeIcon type={entry.questType} />
                </span>

                {/* Name */}
                <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-x-2">
                        <span className={`text-[14px] font-black italic tracking-tight transition-colors ${
                            isCompleted ? "text-white/30 line-through" : "text-white"
                        }`}>
                            {entry.name}
                        </span>
                        <div className="flex items-center gap-2">
                            {entry.zone && <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{entry.zone}</span>}
                            {(entry as any).level != null && <span className="text-[10px] text-zinc-600 font-medium">Lvl {(entry as any).level}</span>}
                        </div>
                    </div>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {dungeonInfos.length > 0 && <span className="text-[9px] text-amber-500/80 font-black uppercase italic">🏰 Donjon</span>}
                    {entry.isLast && (
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md" style={{ background: `${dofusColor}20`, color: dofusColor }}>
                            🎯 Final
                        </span>
                    )}
                    <div className={`text-white/10 group-hover:text-white/40 transition-all ${showDetail ? "rotate-180" : ""}`}>
                        <ChevronDown className="w-4 h-4" />
                    </div>
                </div>
            </div>

            {/* ── Expanded detail ── */}
            <AnimatePresence>
                {showDetail && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                        onClick={(e) => e.stopPropagation()} // ← FIX: prevent collapse on internal click
                    >
                        <div className="px-5 pb-5 pt-2 ml-[10px] sm:ml-[42px] border-l border-white/5 space-y-5">

                            {/* Dungeon HUD */}
                            {dungeonInfos.map((dungeonInfo, dx) => (
                                <div key={dx} className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-4 mb-2">
                                    {dungeonInfo.mapImg && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={dungeonInfo.mapImg}
                                            alt={dungeonInfo.dungeonName}
                                            className="w-16 h-16 object-cover rounded-xl border border-rose-500/30"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                        />
                                    )}
                                    <div className="flex-1">
                                        <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">🏰 Donjon</div>
                                        <div className="text-[15px] font-black text-white italic">{dungeonInfo.dungeonName}</div>
                                    </div>
                                    {dungeonInfo.x !== undefined && (
                                        <Link
                                            href={`/dashboard/${guildId}/worldmap?x=${dungeonInfo.x}&y=${dungeonInfo.y}&zoom=4&world=${dungeonInfo.worldId ?? 0}`}
                                            className="h-9 w-9 rounded-xl bg-rose-500 text-black flex items-center justify-center hover:scale-110 transition-transform flex-shrink-0"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <MapPin className="w-4 h-4" />
                                        </Link>
                                    )}
                                </div>
                            ))}

                            {/* NPC GPS block */}
                            {(entry as any).coords && (
                                <div className="p-3 bg-zinc-900/50 rounded-2xl border border-white/5 flex items-center justify-between hover:bg-zinc-900 transition-all">
                                    <div
                                        className="flex items-center gap-3 cursor-pointer group/travel"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            copyWithToast(`/travel ${(entry as any).coords.x} ${(entry as any).coords.y}`);
                                        }}
                                    >
                                        <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                            <Wand2 className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                                                PNJ OBJECTIF
                                                <span className="text-[8px] bg-white/5 px-1 py-0.5 rounded opacity-0 group-hover/travel:opacity-100 transition-opacity flex items-center gap-0.5">
                                                    <Copy className="w-2.5 h-2.5" /> COPIER /TRAVEL
                                                </span>
                                            </div>
                                            <div className="text-[12px] font-bold text-white italic group-hover/travel:text-emerald-400 transition-colors">
                                                {(() => {
                                                    const objectives = Array.isArray((entry as any).objectives) ? (entry as any).objectives : [];
                                                    const objWithNpc = objectives.find((o: any) => extractObjectiveText(o).includes("{npc,"));
                                                    const match = extractObjectiveText(objWithNpc).match(/\{npc,(\d+)\}/);
                                                    return match ? <NpcName npcId={match[1]} /> : ((entry as any).npcName || "PNJ");
                                                })()} <span className="text-zinc-500 font-normal">en</span> [{(entry as any).coords.x}, {(entry as any).coords.y}]
                                            </div>
                                        </div>
                                    </div>
                                    <Link
                                        href={`/dashboard/${guildId}/worldmap?x=${(entry as any).coords.x}&y=${(entry as any).coords.y}&zoom=4&world=${
                                            (entry as any).coords.worldId ?? (((entry as any).zone || "").toLowerCase().includes("incarnam") ? 1 : 0)
                                        }`}
                                        className="h-8 w-8 rounded-lg bg-emerald-500 text-black flex items-center justify-center hover:scale-110 transition-transform shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <MapPin className="w-4 h-4" />
                                    </Link>
                                </div>
                            )}

                            {/* Objectives with real resolution */}
                            {Array.isArray((entry as any).objectives) && (entry as any).objectives.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest italic mb-2">Marche à suivre</div>
                                    {(entry as any).objectives.map((obj: any, i: number) => {
                                        const text = extractObjectiveText(obj);
                                        const isReturn = text.toLowerCase().includes("retour") || text.toLowerCase().includes("aller voir");
                                        return (
                                            <div key={i} className="flex gap-2 items-start py-1">
                                                <div
                                                    className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[8px] font-black mt-1 ${isReturn ? "animate-pulse" : ""}`}
                                                    style={{
                                                        background: isReturn ? `${dofusColor}40` : "rgba(255,255,255,0.05)",
                                                        color: isReturn ? "#fff" : "rgba(255,255,255,0.4)",
                                                    }}
                                                >
                                                    {i + 1}
                                                </div>
                                                <div className={`text-[12.5px] font-medium leading-relaxed ${isReturn ? "text-white" : "text-zinc-400"}`}>
                                                    <ParsedObjective text={obj} guildId={guildId} zone={entry.zone ?? undefined} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Quick Links */}
                            <div className="flex items-center gap-3 pt-2">
                                <a
                                    href={`https://dofusdb.fr/fr/database/quest/${entry.dofusdbId || entry.id}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="text-[9px] font-black uppercase italic text-zinc-500 hover:text-white px-3 py-1.5 bg-white/5 rounded-lg border border-white/5"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    DofusDB
                                </a>
                                <a
                                    href={`https://www.google.com/search?q=site:dofuspourlesnoobs.com+${encodeURIComponent(entry.name)}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="text-[9px] font-black uppercase italic text-zinc-500 hover:text-white px-3 py-1.5 bg-white/5 rounded-lg border border-white/5"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    Noobs
                                </a>
                                {(entry as any).coords && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const c = (entry as any).coords;
                                            copyWithToast(`/travel ${c.x} ${c.y}`);
                                        }}
                                        className="text-[9px] font-black uppercase italic text-zinc-500 hover:text-emerald-400 px-3 py-1.5 bg-white/5 rounded-lg border border-white/5 flex items-center gap-1"
                                    >
                                        <Copy className="w-2.5 h-2.5" /> Travel
                                    </button>
                                )}
                                {entry.notes && (
                                    <p className="text-[10px] text-emerald-500/50 italic flex-1 text-right truncate">"{entry.notes}"</p>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Chain section ─────────────────────────────────────────────────────────────
function ChainSection({
    chain,
    guildId,
    dofusColor,
    completedIds,
}: {
    chain: DofusChainWithProgress;
    guildId: string;
    dofusColor: string;
    completedIds: Set<string>;
}) {
    const [collapsed, setCollapsed] = useState(false);
    const completedCount = chain.entries.filter((e) => e.status === "COMPLETED").length;
    const allDone = completedCount === chain.entries.length && chain.entries.length > 0;

    return (
        <div className="flex flex-col gap-2">
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="flex items-center gap-3 w-full text-left group"
            >
                <SectionBadge type={chain.sectionType} />
                <span className="text-sm font-semibold text-white/80 flex-1">{chain.sectionName}</span>
                {chain.description && (
                    <span className="text-xs text-white/30 hidden sm:block truncate max-w-[180px]">{chain.description}</span>
                )}
                <span className="text-xs text-white/30 tabular-nums">{completedCount}/{chain.entries.length}</span>
                {allDone && <span style={{ color: dofusColor }}>✓</span>}
                {collapsed ? <ChevronDown className="w-4 h-4 text-white/30" /> : <ChevronUp className="w-4 h-4 text-white/30" />}
            </button>

            {!collapsed && (
                <div className="flex flex-col gap-1.5 ml-0 sm:ml-2">
                    {(chain.entries || []).map((entry: any) => (
                        <QuestEntryRow
                            key={entry.id}
                            entry={entry}
                            guildId={guildId}
                            dofusColor={dofusColor}
                            completedIds={completedIds}
                        />
                    ))}
                    {chain.entries.length === 0 && (
                        <p className="text-sm text-white/20 text-center py-4">Aucune entrée pour cette section</p>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main export ───────────────────────────────────────────────────────────────
interface QuestChecklistProps {
    chains: DofusChainWithProgress[];
    guildId: string;
    dofusColor: string;
}

export function QuestChecklist({ chains, guildId, dofusColor }: QuestChecklistProps) {
    if (chains.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
                <ListChecks className="w-10 h-10 text-white/15" />
                <p className="text-white/30 text-sm">Guide de quêtes à venir — données en cours d'intégration</p>
            </div>
        );
    }

    const completedIds = useMemo(() => {
        if (!Array.isArray(chains)) return new Set<string>();
        const ids = chains.flatMap(c => c?.entries || []).filter(e => e?.status === "COMPLETED").map(e => e?.id);
        return new Set(ids);
    }, [chains]);

    return (
        <div className="space-y-12">
            {(chains || []).map((chain) => (
                <div key={chain.id} className="space-y-6">
                    <ChainSection
                        key={chain.id}
                        chain={chain}
                        guildId={guildId}
                        dofusColor={dofusColor}
                        completedIds={completedIds}
                    />
                </div>
            ))}
        </div>
    );
}
