"use client";

import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Check,
    Lock,
    ChevronRight,
    ChevronDown,
    MapPin,
    Target,
    BookOpen,
    Copy,
    Sword,
    Package,
    ArrowRight,
    ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MemberOnQuest } from "@/server/actions/dofus-quest-actions";
import {
    NpcName,
    ParsedObjective,
    ItemInline,
    copyWithToast,
    detectRealDungeons,
    filterQuestItemsFromResources,
    extractObjectiveText,
} from "./dofus-resolvers";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DofusIcon } from "./DofusIcon";
import { QuestGuildStatus } from "./QuestGuildStatus";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
interface DofusNeuralTreeProps {
    guildId: string;
    dofus: any;
    chains: any[];
    synergy: Record<string, MemberOnQuest[]>;
    dofusColor: string;
    onToggleStatus: (questId: string, status: any) => void;
    completedIds: Set<string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section type metadata
// ─────────────────────────────────────────────────────────────────────────────
const SECTION_META: Record<string, { label: string; accent: string }> = {
    PREREQUISITE: { label: "Prérequis",      accent: "#f59e0b" },
    MAIN_CHAIN:   { label: "Quêtes",         accent: "#6366f1" },
    OPTIONAL:     { label: "Optionnel",      accent: "#6b7280" },
};

function sectionMeta(type: string, dofusColor: string) {
    return SECTION_META[type] || { label: type, accent: dofusColor };
}

// ─────────────────────────────────────────────────────────────────────────────
// Quest card (inline in roadmap)
// ─────────────────────────────────────────────────────────────────────────────
function QuestCard({
    entry,
    guildId,
    dofusColor,
    completedIds,
    onToggle,
    index,
}: {
    entry: any;
    guildId: string;
    dofusColor: string;
    completedIds: Set<string>;
    onToggle: (id: string, status: any) => void;
    index: number;
}) {
    const [expanded, setExpanded] = useState(false);

    const isDone = useMemo(() => 
        completedIds.has(entry.id) || (entry.dofusdbId && completedIds.has(String(entry.dofusdbId))),
    [entry.id, entry.dofusdbId, completedIds]);

    const isLocked = useMemo(() => {
        const reqs = Array.isArray(entry.requirements) ? entry.requirements : [];
        if (reqs.length === 0) return false;
        return reqs.some((r: any) => {
            if (r?.type !== "QUEST") return false;
            const rid = r.id || r.dofusdbId;
            return !completedIds.has(String(rid));
        });
    }, [entry.requirements, completedIds]);

    // V3 structured dungeons
    const structuredDungeons: any[] = entry.dungeonsRequired ?? [];
    const dungeonInfos = useMemo(
        () => detectRealDungeons(Array.isArray(entry.objectives) ? entry.objectives : []),
        [entry]
    );
    const hasDungeons = structuredDungeons.length > 0 || dungeonInfos.length > 0;

    return (
        <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.04, duration: 0.3 }}
            className={`relative rounded-2xl border transition-all duration-300 overflow-hidden ${
                isDone
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : isLocked
                    ? "bg-zinc-900/20 border-white/5 opacity-40"
                    : expanded
                    ? "bg-white/5 border-white/20 shadow-lg"
                    : "bg-white/[0.02] border-white/5 hover:border-white/15"
            }`}
        >
            {/* Header row */}
            <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
                onClick={() => !isLocked && setExpanded(!expanded)}
            >
                {/* Status bullet */}
                <button
                    className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        isDone
                            ? "bg-emerald-500 border-emerald-400"
                            : isLocked
                            ? "border-zinc-700 cursor-not-allowed"
                            : "border-white/20 hover:border-white/60"
                    }`}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (isLocked && !isDone) return;
                        onToggle(entry.id, isDone ? "NOT_STARTED" : "COMPLETED");
                    }}
                    disabled={isLocked && !isDone}
                >
                    {isDone ? (
                        <Check className="w-3 h-3 text-black" />
                    ) : isLocked ? (
                        <Lock className="w-3 h-3 text-zinc-700" />
                    ) : null}
                </button>

                {/* Quest name + meta */}
                <div className="flex-1 min-w-0">
                    <span
                        className={`text-[13px] font-black italic tracking-tight ${
                            isDone ? "text-white/30 line-through" : "text-white"
                        }`}
                    >
                        {entry.name}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                        {entry.zone && (
                            <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
                                {entry.zone}
                            </span>
                        )}
                        {entry.level != null && (
                            <span className="text-[9px] text-zinc-700 font-medium">
                                Lvl {entry.level}
                            </span>
                        )}
                    </div>
                </div>

                {/* Right badges */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {hasDungeons && (
                        <span className="text-[9px] text-rose-400/80 font-black uppercase">
                            🏰
                        </span>
                    )}
                    {entry.isLast && (
                        <span
                            className="text-[8px] font-black uppercase px-2 py-0.5 rounded-lg"
                            style={{ background: `${dofusColor}25`, color: dofusColor }}
                        >
                            🎯 Final
                        </span>
                    )}
                    {!isLocked && (
                        <ChevronDown
                            className={`w-3.5 h-3.5 text-zinc-600 transition-transform ${
                                expanded ? "rotate-180" : ""
                            }`}
                        />
                    )}
                </div>
            </div>

            {/* Expanded content */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-5 pb-5 pt-1 ml-9 border-l border-white/5 space-y-4">
                            {/* V3 Structured Dungeons */}
                            {structuredDungeons.map((d, dx) => (
                                <div
                                    key={`sd-${dx}`}
                                    className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-black/60 border border-rose-500/20 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                                        {d.img ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={d.img}
                                                alt={d.name}
                                                className="w-full h-full object-contain"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = "none";
                                                }}
                                            />
                                        ) : d.id ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={`https://static.dofusdb.fr/monsters/${d.id}.png`}
                                                alt={d.name}
                                                className="w-full h-full object-contain"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = "none";
                                                }}
                                            />
                                        ) : (
                                            <span className="text-rose-400">🏰</span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-0.5">
                                            🏰 Donjon requis
                                        </div>
                                        <div className="text-[13px] font-black text-white italic truncate">
                                            {d.name}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {d.level && d.level > 0 && (
                                                <span className="text-[9px] text-zinc-500 font-bold uppercase">
                                                    Lvl {d.level}
                                                </span>
                                            )}
                                            {d.bossName && (
                                                <span className="text-[9px] text-zinc-600 italic">
                                                    — {d.bossName}
                                                </span>
                                            )}
                                            {d.idoleName && (
                                                <span className="text-[8px] font-black text-amber-500 bg-amber-500/10 px-1 py-0.5 rounded">
                                                    {d.idoleName}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Fallback text-parsed dungeons */}
                            {structuredDungeons.length === 0 &&
                                dungeonInfos.map((di, dx) => (
                                    <div
                                        key={`di-${dx}`}
                                        className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3"
                                    >
                                        {di.mapImg && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={di.mapImg}
                                                alt={di.dungeonName}
                                                className="w-12 h-12 object-cover rounded-xl border border-rose-500/30"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = "none";
                                                }}
                                            />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-0.5">
                                                🏰 Donjon
                                            </div>
                                            <div className="text-[13px] font-black text-white italic">
                                                {di.dungeonName}
                                            </div>
                                        </div>
                                        {di.x !== undefined && (
                                            <Link
                                                href={`/dashboard/${guildId}/worldmap?x=${di.x}&y=${di.y}&zoom=4&world=${di.worldId ?? 0}`}
                                                className="h-8 w-8 rounded-xl bg-rose-500 text-black flex items-center justify-center hover:scale-110 transition-transform flex-shrink-0"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <MapPin className="w-4 h-4" />
                                            </Link>
                                        )}
                                    </div>
                                ))}

                            {/* NPC GPS */}
                            {entry.coords && (
                                <div className="p-3 bg-indigo-500/5 border border-indigo-500/15 rounded-xl flex items-center justify-between">
                                    <div
                                        className="flex items-center gap-2 cursor-pointer group/travel"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            copyWithToast(`/travel ${entry.coords.x} ${entry.coords.y}`);
                                        }}
                                    >
                                        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                            <MapPin className="w-3.5 h-3.5" />
                                        </div>
                                        <div>
                                            <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest group-hover/travel:text-indigo-400 transition-colors">
                                                PNJ OBJECTIF
                                            </div>
                                            <div className="text-[12px] font-bold text-white italic group-hover/travel:text-emerald-400 transition-colors">
                                                {(() => {
                                                    const objectives = Array.isArray(entry.objectives) ? entry.objectives : [];
                                                    const objWithNpc = objectives.find((o: any) =>
                                                        extractObjectiveText(o).includes("{npc,")
                                                    );
                                                    const match = extractObjectiveText(objWithNpc).match(/\{npc,(\d+)\}/);
                                                    return match ? (
                                                        <NpcName npcId={match[1]} />
                                                    ) : (
                                                        entry.npcName || "PNJ"
                                                    );
                                                })()}{" "}
                                                <span className="text-zinc-600 font-normal">
                                                    [{entry.coords.x}, {entry.coords.y}]
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <Link
                                        href={`/dashboard/${guildId}/worldmap?x=${entry.coords.x}&y=${entry.coords.y}&zoom=4&world=${entry.coords.worldId ?? 0}`}
                                        className="h-7 w-7 rounded-lg bg-emerald-500 text-black flex items-center justify-center hover:scale-110 transition-transform shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <MapPin className="w-3.5 h-3.5" />
                                    </Link>
                                </div>
                            )}

                            {/* Objectives */}
                            {Array.isArray(entry.objectives) && entry.objectives.length > 0 && (
                                <div className="space-y-1.5">
                                    <div className="text-[9px] font-black text-zinc-700 uppercase tracking-widest italic mb-2">
                                        Marche à suivre
                                    </div>
                                    {entry.objectives.map((obj: any, i: number) => {
                                        const text = extractObjectiveText(obj);
                                        const isReturn =
                                            text.toLowerCase().includes("retour") ||
                                            text.toLowerCase().includes("aller voir");
                                        return (
                                            <div key={i} className="flex gap-2 items-start py-0.5">
                                                <div
                                                    className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[8px] font-black ${
                                                        isReturn ? "animate-pulse" : ""
                                                    }`}
                                                    style={{
                                                        background: isReturn
                                                            ? `${dofusColor}40`
                                                            : "rgba(255,255,255,0.05)",
                                                        color: isReturn ? "#fff" : "rgba(255,255,255,0.3)",
                                                    }}
                                                >
                                                    {i + 1}
                                                </div>
                                                <div
                                                    className={`text-[12px] font-medium leading-relaxed ${
                                                        isReturn ? "text-white" : "text-zinc-500"
                                                    }`}
                                                >
                                                    <ParsedObjective
                                                        text={obj}
                                                        guildId={guildId}
                                                        zone={entry.zone ?? undefined}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Quick links */}
                            <div className="flex items-center gap-2 pt-1">
                                <a
                                    href={`https://dofusdb.fr/fr/database/quest/${entry.dofusdbId || entry.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[9px] font-black uppercase italic text-zinc-600 hover:text-white px-2.5 py-1 bg-white/5 rounded-lg border border-white/5 transition-all hover:bg-white/10 flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <Target className="w-2.5 h-2.5" /> DofusDB
                                </a>
                                <a
                                    href={`https://www.google.com/search?q=site:dofuspourlesnoobs.com+${encodeURIComponent(entry.name)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[9px] font-black uppercase italic text-zinc-600 hover:text-white px-2.5 py-1 bg-white/5 rounded-lg border border-white/5 transition-all hover:bg-white/10 flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <BookOpen className="w-2.5 h-2.5" /> Noobs
                                </a>
                                {entry.coords && (
                                    <button
                                        className="text-[9px] font-black uppercase italic text-zinc-600 hover:text-emerald-400 px-2.5 py-1 bg-white/5 rounded-lg border border-white/5 transition-all hover:bg-white/10 flex items-center gap-1"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            copyWithToast(`/travel ${entry.coords.x} ${entry.coords.y}`);
                                        }}
                                    >
                                        <Copy className="w-2.5 h-2.5" /> Travel
                                    </button>
                                )}
                            </div>

                            {/* Action terminal */}
                            <div className="flex flex-col gap-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <a 
                                        href={`https://dofusdb.fr/fr/database/quest/${entry.dofusdbId || entry.id}`} 
                                        target="_blank" 
                                        className="flex flex-col items-center justify-center gap-2 h-20 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 hover:bg-indigo-500/15 hover:border-indigo-500/30 text-[10px] font-black text-indigo-400 uppercase tracking-widest transition-all shadow-lg shadow-indigo-900/10"
                                    >
                                        <Target className="w-5 h-5" /> DofusDB
                                    </a>
                                    
                                    <a 
                                        href={`https://www.google.com/search?q=site:dofuspourlesnoobs.com+${encodeURIComponent(entry.name)}`} 
                                        target="_blank" 
                                        className="flex flex-col items-center justify-center gap-2 h-20 rounded-2xl bg-amber-500/5 border border-amber-500/10 hover:bg-amber-500/15 hover:border-amber-500/30 text-[10px] font-black text-amber-400 uppercase tracking-widest transition-all shadow-lg shadow-amber-900/10"
                                    >
                                        <BookOpen className="w-5 h-5" /> Noobs
                                    </a>

                                    {entry.coords && (
                                        <button 
                                            onClick={() => copyWithToast(`/travel ${entry.coords?.x} ${entry.coords?.y}`)}
                                            className="flex flex-col items-center justify-center gap-2 h-20 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/15 hover:border-emerald-500/30 text-[10px] font-black text-emerald-400 uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/10"
                                        >
                                            <MapPin className="w-5 h-5" /> Travel
                                        </button>
                                    )}

                                    <QuestGuildStatus 
                                        guildId={guildId} 
                                        questId={entry.id} 
                                        dofusColor={dofusColor} 
                                        variant="action"
                                    />
                                </div>
                                <Button
                                    disabled={isLocked && !isDone}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (isLocked && !isDone) return;
                                        onToggle(entry.id, isDone ? "NOT_STARTED" : "COMPLETED");
                                    }}
                                    className={`w-full h-10 rounded-xl font-black italic uppercase text-[11px] tracking-widest transition-all ${
                                        isDone
                                            ? "bg-zinc-900 border border-white/10 text-zinc-500"
                                            : isLocked
                                            ? "bg-zinc-950 text-white/10 border border-white/5 cursor-not-allowed"
                                            : "bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.08)]"
                                    }`}
                                >
                                    {isDone ? "✓ Réinitialiser" : isLocked ? "🔒 Verrouillée" : "Valider l'étape"}
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Resources panel (identical logic to DofusGlobalLogistics)
// ─────────────────────────────────────────────────────────────────────────────
function RoadmapResources({ chains, dofusColor, completedIds }: { chains: any[]; dofusColor: string; completedIds: Set<string> }) {
    const raw = useMemo(() => {
        const items = new Map<string, { id: string; amount: number; name: string; img?: string }>();
        const dungeons = new Map<string, { id?: string; name: string; bossName?: string; level?: number; img?: string; idoleName?: string }>();

        chains.forEach((chain) => {
            (chain.entries || []).forEach((quest: any) => {
                if (completedIds.has(String(quest.id))) return;
                (quest.itemsRequired || []).forEach((req: any) => {
                    const id = String(req.id);
                    if (items.has(id)) {
                        items.get(id)!.amount += req.amount || 1;
                    } else {
                        items.set(id, { id, amount: req.amount || 1, name: req.name || "Objet", img: req.img });
                    }
                });
                (quest.dungeonsRequired || []).forEach((d: any) => {
                    const key = d.name;
                    if (!dungeons.has(key)) dungeons.set(key, { id: d.id ? String(d.id) : undefined, name: d.name, level: d.level, bossName: d.bossName, img: d.img, idoleName: d.idoleName });
                });
            });
        });

        return {
            items: Array.from(items.values()).sort((a, b) => b.amount - a.amount),
            dungeons: Array.from(dungeons.values()).sort((a, b) => (a.level || 0) - (b.level || 0)),
        };
    }, [chains, completedIds]);

    const [filteredItems, setFilteredItems] = useState<typeof raw.items>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!raw.items.length) { setFilteredItems([]); setLoading(false); return; }
        let mounted = true;
        setLoading(true);
        filterQuestItemsFromResources(raw.items).then((f) => {
            if (mounted) { setFilteredItems(f.length > 0 ? f : raw.items); setLoading(false); }
        }).catch(() => { if (mounted) { setFilteredItems(raw.items); setLoading(false); } });
        return () => { mounted = false; };
    }, [raw.items]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Resources */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.4em] flex items-center gap-2">
                        <Package className="w-4 h-4" /> Ressources à prévoir
                    </h4>
                    <span className="text-[9px] font-black px-2 py-0.5 bg-white/5 rounded-full text-zinc-600">
                        {loading ? "..." : filteredItems.length} TYPES
                    </span>
                </div>
                {loading ? (
                    <div className="flex items-center gap-2 py-6 text-zinc-600 italic text-[12px]">
                        <div className="w-4 h-4 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
                        Analyse en cours…
                    </div>
                ) : filteredItems.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                        {filteredItems.map((item) => (
                            <div key={item.id} className="flex items-center gap-3 p-2.5 bg-black/40 border border-white/5 rounded-2xl hover:border-white/15 transition-all">
                                <div className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center p-1 relative shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={item.img || `https://static.dofusdb.fr/items/${item.id}.png`}
                                        alt=""
                                        className="w-full h-full object-contain"
                                        onError={(e) => ((e.currentTarget.style.display = "none"))}
                                    />
                                    <div className="absolute -bottom-1.5 -right-1.5 bg-indigo-500 text-white text-[8px] font-black px-1 py-0.5 rounded-md">
                                        x{item.amount}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <ItemInline itemId={item.id} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-8 text-center text-zinc-700 italic text-[12px]">
                        Aucune ressource listée dans ce parcours.
                    </div>
                )}
            </div>

            {/* Dungeons */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.4em] flex items-center gap-2">
                        <Sword className="w-4 h-4" /> Donjons Requis
                    </h4>
                    <span className="text-[9px] font-black px-2 py-0.5 bg-white/5 rounded-full text-zinc-600">
                        {raw.dungeons.length} BOSS
                    </span>
                </div>
                {raw.dungeons.length > 0 ? (
                    <div className="space-y-2">
                        {raw.dungeons.map((d, i) => (
                            <div key={i} className="flex items-center gap-3 p-2.5 bg-rose-500/5 border border-rose-500/10 rounded-2xl hover:border-rose-500/25 transition-all relative overflow-hidden">
                                {d.idoleName && (
                                    <div className="absolute top-0 right-0 px-2 py-0.5 bg-amber-500/20 border-b border-l border-amber-500/30 rounded-bl-lg text-[7px] font-black text-amber-500 uppercase z-10">
                                        {d.idoleName}
                                    </div>
                                )}
                                <div className="w-11 h-11 rounded-xl bg-black/60 border border-white/5 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                                    {(d.id || d.img) ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={d.img || `https://static.dofusdb.fr/monsters/${d.id}.png`}
                                            className="w-full h-full object-contain"
                                            alt={d.name}
                                            onError={(e) => ((e.currentTarget.style.display = "none"))}
                                        />
                                    ) : (
                                        <span className="text-rose-500">🏰</span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[12px] font-black text-white italic truncate">{d.name}</div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {d.level && d.level > 0 && (
                                            <span className="text-[9px] text-zinc-600 font-bold uppercase">Lvl {d.level}</span>
                                        )}
                                        {d.bossName && (
                                            <span className="text-[9px] text-zinc-700 italic">— {d.bossName}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-8 text-center text-zinc-700 italic text-[12px]">
                        Aucun donjon détecté dans ce parcours.
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export — renamed internally but keeping the export name for compatibility
// ─────────────────────────────────────────────────────────────────────────────
export function DofusNeuralTree({
    guildId,
    dofus,
    chains,
    dofusColor,
    onToggleStatus,
    completedIds,
    synergy,
}: DofusNeuralTreeProps) {
    const [activeTab, setActiveTab] = useState<"roadmap" | "resources">("roadmap");
    const [openChainId, setOpenChainId] = useState<string | null>(null);

    const stats = useMemo(() => {
        const total = chains.flatMap((c) => c.entries || []).length;
        const done = chains.flatMap((c) => c.entries || []).filter((e: any) => completedIds.has(e.id) || (e.dofusdbId && completedIds.has(String(e.dofusdbId)))).length;
        return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
    }, [chains, completedIds]);

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-zinc-950/60 border border-white/5 rounded-2xl">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center">
                        <DofusIcon name={dofus.nameShort || dofus.name} size={32} />
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] mb-0.5">
                            Feuille de Route
                        </div>
                        <div className="text-[16px] font-black text-white italic uppercase tracking-tighter">
                            {dofus.name}
                        </div>
                    </div>
                    <div className="hidden sm:flex flex-col items-end ml-4">
                        <div className="text-[11px] font-black text-zinc-500 tabular-nums">
                            {stats.done}/{stats.total} quêtes
                        </div>
                        <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden mt-1.5">
                            <motion.div
                                className="h-full rounded-full"
                                style={{ background: dofusColor }}
                                initial={{ width: 0 }}
                                animate={{ width: `${stats.pct}%` }}
                                transition={{ duration: 1 }}
                            />
                        </div>
                    </div>
                </div>

                {/* Tab switcher */}
                <div className="flex p-1 bg-zinc-950/80 rounded-xl border border-white/5">
                    {(["roadmap", "resources"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`h-8 px-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                activeTab === tab
                                    ? "bg-white text-black shadow"
                                    : "text-zinc-500 hover:text-white"
                            }`}
                        >
                            {tab === "roadmap" ? "📋 Parcours" : "📦 Ressources Totales"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Roadmap view */}
            {activeTab === "roadmap" && (
                <div className="space-y-6">
                    {chains.map((chain, ci) => {
                        const entries = chain.entries || [];
                        const done = entries.filter((e: any) => completedIds.has(e.id) || (e.dofusdbId && completedIds.has(String(e.dofusdbId)))).length;
                        const total = entries.length;
                        const allDone = done === total && total > 0;
                        const meta = sectionMeta(chain.sectionType, dofusColor);
                        const isOpen = openChainId === chain.id;

                        return (
                            <div key={chain.id} className="space-y-2">
                                {/* Chain header */}
                                <button
                                    onClick={() => setOpenChainId(isOpen ? null : chain.id)}
                                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all duration-200 group ${
                                        allDone
                                            ? "bg-emerald-500/5 border-emerald-500/20"
                                            : isOpen
                                            ? "bg-white/5 border-white/15"
                                            : "bg-white/[0.02] border-white/5 hover:border-white/15"
                                    }`}
                                >
                                    {/* Chain order indicator */}
                                    <div
                                        className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black flex-shrink-0 transition-all"
                                        style={{
                                            background: allDone ? "#10b981" : isOpen ? `${dofusColor}30` : "rgba(255,255,255,0.04)",
                                            color: allDone ? "black" : isOpen ? dofusColor : "rgba(255,255,255,0.3)",
                                            border: `1px solid ${allDone ? "#10b98140" : isOpen ? `${dofusColor}50` : "rgba(255,255,255,0.06)"}`,
                                        }}
                                    >
                                        {allDone ? <Check className="w-4 h-4" /> : ci + 1}
                                    </div>

                                    {/* Name + badge */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span
                                                className={`text-[14px] font-black italic tracking-tight ${
                                                    allDone ? "text-emerald-400" : "text-white"
                                                }`}
                                            >
                                                {chain.sectionName}
                                            </span>
                                            <span
                                                className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full"
                                                style={{
                                                    background: `${meta.accent}20`,
                                                    color: meta.accent,
                                                    border: `1px solid ${meta.accent}30`,
                                                }}
                                            >
                                                {meta.label}
                                            </span>
                                        </div>
                                        {chain.description && !isOpen && (
                                            <div className="text-[10px] text-zinc-600 mt-0.5 truncate">
                                                {chain.description}
                                            </div>
                                        )}
                                    </div>

                                    {/* Progress + chevron */}
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        <span className="text-[10px] font-black text-zinc-600 tabular-nums">
                                            {done}/{total}
                                        </span>
                                        <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden hidden sm:block">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: total > 0 ? `${Math.round((done / total) * 100)}%` : "0%",
                                                    background: allDone ? "#10b981" : dofusColor,
                                                }}
                                            />
                                        </div>
                                        <ChevronDown
                                            className={`w-4 h-4 text-zinc-600 transition-transform ${isOpen ? "rotate-180" : ""}`}
                                        />
                                    </div>
                                </button>

                                {/* Quest cards */}
                                <AnimatePresence>
                                    {isOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="ml-4 pl-4 border-l-2 border-dashed border-white/5 space-y-2 pt-2 pb-2">
                                                {entries.map((entry: any, ei: number) => (
                                                    <QuestCard
                                                        key={entry.id}
                                                        entry={entry}
                                                        guildId={guildId}
                                                        dofusColor={dofusColor}
                                                        completedIds={completedIds}
                                                        onToggle={onToggleStatus}
                                                        index={ei}
                                                    />
                                                ))}
                                                {entries.length === 0 && (
                                                    <div className="py-4 text-center text-zinc-700 italic text-[12px]">
                                                        Aucune entrée pour cette section.
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Resources view */}
            {activeTab === "resources" && (
                <div className="bg-zinc-950/40 border border-white/5 rounded-3xl p-8">
                    <RoadmapResources chains={chains} dofusColor={dofusColor} completedIds={completedIds} />
                </div>
            )}
        </div>
    );
}
