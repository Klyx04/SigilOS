"use client";

import React, { useState, useEffect, useTransition, useMemo, useCallback } from "react";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Swords, Star, Briefcase, Wand2, ListChecks, Shield, AlertCircle, MapPin, Lock, Copy, BookOpen, Users, Target, Navigation } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toggleQuestStatus, getOtherMembersOnQuest, type MemberOnQuest } from "@/server/actions/dofus-quest-actions";
import type { DofusChainWithProgress, DofusEntryWithProgress } from "@/server/actions/dofus-quest-actions";
import { DofusQuestStatus } from "@prisma/client";
import { NpcName, ItemInline, ParsedObjective, copyWithToast, detectRealDungeons, extractObjectiveText } from "./dofus-resolvers";
import { internalDofusDbImageUrl } from "@/lib/dofus-image-url";
import { QuestGuildStatus } from "./QuestGuildStatus";
import { QuestActionsBlock } from "./QuestActionsBlock";


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
            className="text-caption font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
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
    completedIds,   // ← reactive set from the parent (includes local toggles)
    onToggle,       // ← callback to notify parent of status change
}: {
    entry: DofusEntryWithProgress;
    guildId: string;
    dofusColor: string;
    completedIds: Set<string>;
    onToggle: (id: string, newStatus: DofusQuestStatus) => void;
}) {
    // Mirror the initial status — parent drives it via completedIds
    const isCompleted = completedIds.has(entry.id);
    const [isPending, startTransition] = useTransition();
    const [showDetail, setShowDetail] = useState(false);

    const [members, setMembers] = useState<MemberOnQuest[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);

    useEffect(() => {
        if (showDetail) {
            setLoadingMembers(true);
            getOtherMembersOnQuest(guildId, entry.id).then((res) => {
                if (res.success && res.data) {
                    setMembers(res.data);
                }
                setLoadingMembers(false);
            });
        }
    }, [showDetail, guildId, entry.id]);

    // Lock if any QUEST requirement is not yet in completedIds
    const isLocked = useMemo(() => {
        const reqs = Array.isArray(entry.requirements) ? entry.requirements : [];
        if (reqs.length === 0) return false;
        return reqs.some((req: any) => {
            if (!req || typeof req !== "object" || req.type !== "QUEST") return false;
            const rid = req.id || req.dofusdbId;
            return !completedIds.has(String(rid));
        });
    }, [entry.requirements, completedIds]);

    // V3 structured dungeons
    const structuredDungeons: { id?: string; name: string; bossName?: string; level?: number; img?: string; idoleName?: string }[] =
        useMemo(() => (entry as any).dungeonsRequired ?? [], [entry]);

    // Fallback: text-parsed dungeons
    const dungeonInfos = useMemo(() => detectRealDungeons((entry as any).objectives ?? []), [entry]);
    const hasDungeons = structuredDungeons.length > 0 || dungeonInfos.length > 0;

    function handleToggle() {
        if (isLocked && !isCompleted) return;
        const newStatus: DofusQuestStatus = isCompleted ? "NOT_STARTED" : "COMPLETED";
        
        // Auto-collapse detail on completion
        if (newStatus === "COMPLETED") setShowDetail(false);
        
        // Optimistic: notify parent immediately so completedIds updates for siblings
        onToggle(entry.id, newStatus);
        startTransition(async () => {
            const res = await toggleQuestStatus(guildId, entry.id, newStatus);
            // On failure, revert
            if (!res.success) onToggle(entry.id, isCompleted ? "COMPLETED" : "NOT_STARTED");
        });
    }

    return (
        <div
            className={`group flex flex-col rounded-2xl transition-all duration-300 border ${
                isCompleted ? "bg-success/10 border-success/25" : "bg-muted/50 border-border hover:border-border"
            } ${entry.isOptional ? "opacity-60" : ""} ${isPending ? "opacity-50 pointer-events-none" : ""}`}
        >
            {/* ── Header row ── */}
            <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
                onClick={() => setShowDetail(!showDetail)}
            >
                {/* Checkbox */}
                <button
                    disabled={isPending || (!!isLocked && !isCompleted)}
                    onClick={(e) => { e.stopPropagation(); handleToggle(); }}
                    className={`flex-shrink-0 transition-all duration-150 z-10 ${
                        isLocked && !isCompleted ? "cursor-not-allowed opacity-20 grayscale" : ""
                    }`}
                >
                    {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5" style={{ color: dofusColor, filter: `drop-shadow(0 0 8px ${dofusColor}44)` }} />
                    ) : isLocked ? (
                        <Lock className="w-5 h-5 text-muted-foreground" />
                    ) : (
                        <Circle className="w-5 h-5 text-foreground/10 group-hover:text-foreground/30 transition-colors" />
                    )}
                </button>

                {/* Type icon */}
                <span className={`flex-shrink-0 ${isCompleted ? "" : "text-foreground/20"}`} style={{ color: isCompleted ? dofusColor : undefined }}>
                    <QuestTypeIcon type={entry.questType} />
                </span>

                {/* Name */}
                <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-x-2">
                        <span className={`text-body font-black italic tracking-tight transition-colors ${
                            isCompleted ? "text-foreground/30 line-through" : "text-foreground"
                        }`}>
                            {entry.name}
                        </span>
                        <div className="flex items-center gap-2">
                            {entry.zone && <span className="text-caption text-muted-foreground font-bold uppercase tracking-widest">{entry.zone}</span>}
                            {(entry as any).level != null && <span className="text-caption text-muted-foreground font-medium">Lvl {(entry as any).level}</span>}
                        </div>
                    </div>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {hasDungeons && <span className="text-caption text-danger/80 font-black uppercase">🏰 DJ</span>}
                    {entry.isLast && (
                        <span className="text-caption font-black uppercase tracking-wider px-2 py-0.5 rounded-md" style={{ background: `${dofusColor}20`, color: dofusColor }}>
                            🎯 Final
                        </span>
                    )}
                    <div className={`text-foreground/10 group-hover:text-foreground/40 transition-all ${showDetail ? "rotate-180" : ""}`}>
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
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-5 pb-5 pt-2 ml-[10px] sm:ml-[42px] border-l border-border space-y-4">

                            {/* V3 Structured Dungeons */}
                            {structuredDungeons.map((d, dx) => (
                                <div key={`sd-${dx}`} className="p-3 bg-danger/10 border border-danger/20 rounded-2xl flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-black/60 border border-danger/20 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                                        {d.img ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={internalDofusDbImageUrl(d.img) ?? d.img} alt={d.name} className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                        ) : d.id ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={`/api/assets-dofus/monsters/${d.id}`} alt={d.name} className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                        ) : (
                                            <span className="text-danger">🏰</span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-caption font-black text-danger uppercase tracking-widest mb-0.5">🏰 Donjon requis</div>
                                        <div className="text-body-sm font-black text-foreground italic truncate">{d.name}</div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {d.level && d.level > 0 && <span className="text-caption text-muted-foreground font-bold">Lvl {d.level}</span>}
                                            {d.bossName && <span className="text-caption text-muted-foreground italic">— {d.bossName}</span>}
                                            {d.idoleName && <span className="text-caption font-black text-warning bg-warning/10 px-1 py-0.5 rounded">{d.idoleName}</span>}
                                        </div>
                                    </div>
                                    {(d as any).dplnUrl && (
                                        <Button
                                            asChild
                                            variant="sigil"
                                            className="h-10 px-4"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <a href={(d as any).dplnUrl} target="_blank" rel="noopener noreferrer">
                                                <BookOpen className="w-4 h-4 mr-2" />
                                                <span className="text-caption font-black uppercase tracking-widest">Stratégie</span>
                                            </a>
                                        </Button>
                                    )}
                                </div>
                            ))}

                            {/* Fallback text-parsed dungeons */}
                            {structuredDungeons.length === 0 && dungeonInfos.map((di, dx) => (
                                <div key={`di-${dx}`} className="p-3 bg-danger/10 border border-danger/20 rounded-2xl flex items-center gap-3">
                                    {di.mapImg && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={di.mapImg} alt={di.dungeonName} className="w-12 h-12 object-cover rounded-xl border border-danger/30" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                    )}
                                    <div className="flex-1">
                                        <div className="text-caption font-black text-danger uppercase tracking-widest mb-0.5">🏰 Donjon</div>
                                        <div className="text-body-sm font-black text-foreground italic">{di.dungeonName}</div>
                                    </div>
                                    {di.x !== undefined && (
                                        <Link href={`/dashboard/${guildId}/worldmap?x=${di.x}&y=${di.y}&zoom=4&world=${di.worldId ?? 0}`}
                                            className="h-8 w-8 rounded-xl bg-danger text-danger-foreground flex items-center justify-center  transition-transform flex-shrink-0"
                                            onClick={(e) => e.stopPropagation()}>
                                            <MapPin className="w-4 h-4" />
                                        </Link>
                                    )}
                                </div>
                            ))}

                            {/* NPC GPS */}
                            {(entry as any).coords && (
                                <div className="p-3 bg-surface/50 rounded-2xl border border-border flex items-center justify-between hover:bg-surface transition-all">
                                    <div className="flex items-center gap-3 cursor-pointer group/travel"
                                        onClick={(e) => { e.stopPropagation(); copyWithToast(`/travel ${(entry as any).coords.x} ${(entry as any).coords.y}`); }}>
                                        <div className="w-8 h-8 rounded-xl bg-info/10 flex items-center justify-center text-info">
                                            <Wand2 className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="text-caption font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                                PNJ OBJECTIF
                                                <span className="text-caption bg-surface px-1 py-0.5 rounded opacity-0 group-hover/travel:opacity-100 transition-opacity flex items-center gap-0.5">
                                                    <Copy className="w-2.5 h-2.5" /> COPIER
                                                </span>
                                            </div>
                                            <div className="text-label font-bold text-foreground italic group-hover/travel:text-success transition-colors">
                                                {(() => {
                                                    const objectives = Array.isArray((entry as any).objectives) ? (entry as any).objectives : [];
                                                    const objWithNpc = objectives.find((o: any) => extractObjectiveText(o).includes("{npc,"));
                                                    const match = extractObjectiveText(objWithNpc).match(/\{npc,(\d+)\}/);
                                                    return match ? <NpcName npcId={match[1]} /> : ((entry as any).npcName || "PNJ");
                                                })()} <span className="text-muted-foreground font-normal">[{(entry as any).coords.x}, {(entry as any).coords.y}]</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Link
                                        href={`/dashboard/${guildId}/worldmap?x=${(entry as any).coords.x}&y=${(entry as any).coords.y}&zoom=4&world=${(entry as any).coords.worldId ?? 0}`}
                                        className="h-8 w-8 rounded-lg bg-success text-success-foreground flex items-center justify-center  transition-transform "
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <MapPin className="w-4 h-4" />
                                    </Link>
                                </div>
                            )}

                            {/* Positions de lancement */}
                            {Array.isArray((entry as any).positions) && (entry as any).positions.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-caption font-black text-success/80 uppercase tracking-widest italic mb-1 flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Positions de lancement</div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {(entry as any).positions.map((p: any, i: number) => (
                                            <button key={i} onClick={(e) => { e.stopPropagation(); copyWithToast(`/travel ${p.x} ${p.y}`); }} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-success/10 border border-success/20 text-success text-caption font-bold font-mono hover:bg-success/20 transition-colors">
                                                <MapPin className="w-2.5 h-2.5" />
                                                {p.x}, {p.y}
                                                <Copy className="w-2.5 h-2.5 text-success/50" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Objectives */}
                            {Array.isArray((entry as any).objectives) && (entry as any).objectives.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-caption font-black text-muted-foreground uppercase tracking-widest italic mb-2">Marche à suivre</div>
                                    {(entry as any).objectives.map((obj: any, i: number) => {
                                        const text = extractObjectiveText(obj);
                                        const isReturn = text.toLowerCase().includes("retour") || text.toLowerCase().includes("aller voir");
                                        return (
                                            <div key={i} className="flex gap-2 items-start py-0.5">
                                                <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-caption font-black mt-0.5 ${isReturn ? "animate-pulse" : ""}`}
                                                    style={{ background: isReturn ? `${dofusColor}40` : "rgba(255,255,255,0.05)", color: isReturn ? "#fff" : "rgba(255,255,255,0.4)" }}>
                                                    {i + 1}
                                                </div>
                                                <div className={`text-label font-medium leading-relaxed ${isReturn ? "text-foreground" : "text-muted-foreground"}`}>
                                                    <ParsedObjective text={obj} guildId={guildId} zone={entry.zone ?? undefined} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <QuestActionsBlock
                                entry={entry}
                                guildId={guildId}
                                dofusColor={dofusColor}
                                initialMembers={members}
                                lock={isLocked}
                                done={isCompleted}
                                onToggle={handleToggle}
                            />
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
    onToggle,
}: {
    chain: DofusChainWithProgress;
    guildId: string;
    dofusColor: string;
    completedIds: Set<string>;
    onToggle: (id: string, newStatus: DofusQuestStatus) => void;
}) {
    const [collapsed, setCollapsed] = useState(false);
    const completedCount = (chain.entries || []).filter((e) => completedIds.has(e.id)).length;
    const total = (chain.entries || []).length;
    const allDone = completedCount === total && total > 0;

    return (
        <div className="flex flex-col gap-2">
            <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-3 w-full text-left group">
                <SectionBadge type={chain.sectionType} />
                {(chain as any).sectionIcon && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={`/assets/icons/${(chain as any).sectionIcon}.png`} alt="" className="w-5 h-5 object-contain shrink-0" />
                )}
                <span className="text-sm font-semibold text-foreground/80 flex-1">{chain.sectionName}</span>
                {chain.description && (
                    <span className="text-xs text-foreground/30 hidden sm:block truncate max-w-[180px]">{chain.description}</span>
                )}
                <span className="text-xs text-foreground/30 tabular-nums">{completedCount}/{total}</span>
                {allDone && <span style={{ color: dofusColor }}>✓</span>}
                {collapsed ? <ChevronDown className="w-4 h-4 text-foreground/30" /> : <ChevronUp className="w-4 h-4 text-foreground/30" />}
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
                            onToggle={onToggle}
                        />
                    ))}
                    {total === 0 && (
                        <p className="text-sm text-foreground/20 text-center py-4">Aucune entrée pour cette section</p>
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
    completedIds: Set<string>;
    onToggle: (id: string, newStatus: DofusQuestStatus) => void;
}

export function QuestChecklist({ chains, guildId, dofusColor, completedIds, onToggle }: QuestChecklistProps) {
    if (chains.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
                <ListChecks className="w-10 h-10 text-foreground/15" />
                <p className="text-foreground/30 text-sm">Guide de quêtes à venir — données en cours d&apos;intégration</p>
            </div>
        );
    }

    return (
        <div className="space-y-12">
            {(chains || []).map((chain) => (
                <div key={chain.id} className="space-y-6">
                    <ChainSection
                        chain={chain}
                        guildId={guildId}
                        dofusColor={dofusColor}
                        completedIds={completedIds}
                        onToggle={onToggle}
                    />
                </div>
            ))}
        </div>
    );
}
