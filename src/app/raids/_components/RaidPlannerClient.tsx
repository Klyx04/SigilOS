"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import {
    Swords,
    RotateCcw,
    Share2,
    Copy,
    Heart,
    Zap,
    Users,
    Lightbulb,
    Compass,
    CheckCircle2,
    Plus,
    Trash2,
    Clock,
    Coins,
    Sparkles,
    Info,
    Crown,
    X,
    ChevronDown,
    ChevronUp,
    BookOpen,
    UserPlus,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { DOFUS_CLASSES, RAID_ROLES, RaidId, RaidSlot, RoleKey } from "../types";
import { LuminariumSolver } from "./LuminariumSolver";
import { JardinsEnigmaTracker } from "./JardinsEnigmaTracker";
import { DiscordExportModal } from "./DiscordExportModal";
import { SigilOSShowcaseSection } from "./SigilOSShowcaseSection";

const STORAGE_KEY = "sigilos_raid_studio_v3";

/* ─── Role meta (emoji + short label + colors) ─── */
const ROLE_META: Record<RoleKey, { emoji: string; label: string; bg: string; text: string; border: string }> = {
    tank:        { emoji: "🛡️", label: "Tank",      bg: "bg-blue-500/15",   text: "text-blue-400",   border: "border-blue-500/30" },
    healer:      { emoji: "💚", label: "Soin",      bg: "bg-emerald-500/15",text: "text-emerald-400",border: "border-emerald-500/30" },
    "dps-range": { emoji: "🏹", label: "DPS Dist.", bg: "bg-rose-500/15",   text: "text-rose-400",   border: "border-rose-500/30" },
    "dps-melee": { emoji: "⚔️", label: "DPS CaC",  bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/30" },
    debuff:      { emoji: "🔻", label: "Debuff",    bg: "bg-violet-500/15", text: "text-violet-400", border: "border-violet-500/30" },
    support:     { emoji: "⚡", label: "Support",   bg: "bg-teal-500/15",   text: "text-teal-400",   border: "border-teal-500/30" },
    placement:   { emoji: "🧱", label: "Placement", bg: "bg-amber-500/15",  text: "text-amber-400",  border: "border-amber-500/30" },
    control:     { emoji: "🌀", label: "Contrôle",  bg: "bg-cyan-500/15",   text: "text-cyan-400",   border: "border-cyan-500/30" },
    utility:     { emoji: "📦", label: "Mule",      bg: "bg-slate-500/15",  text: "text-slate-400",  border: "border-slate-500/30" },
};

/* ─── Static raid asset paths (images/icons/banners) ─── */
const RAID_ASSETS: Record<RaidId, { icon: string; banner: string; maxPlayers: number; wingSlotsDefault: number }> = {
    sanctuaire: {
        icon: "/assets/raids/sanctuaire.webp",
        banner: "/assets/calendar/calendar_raid_sanctuaire.jpg",
        maxPlayers: 16,
        wingSlotsDefault: 8,
    },
    gigalodon: {
        icon: "/assets/raids/gigalodon.webp",
        banner: "/assets/calendar/calendar_raid_gigalodon.jpg",
        maxPlayers: 12,
        wingSlotsDefault: 6,
    },
};

/* ─── Role codes for compact URLs ─── */
const ROLE_TO_CODE: Record<RoleKey, string> = {
    tank: "t",
    healer: "h",
    "dps-range": "r",
    "dps-melee": "m",
    debuff: "d",
    support: "s",
    placement: "p",
    control: "c",
    utility: "u",
};

const CODE_TO_ROLE: Record<string, RoleKey> = {
    t: "tank",
    h: "healer",
    r: "dps-range",
    m: "dps-melee",
    d: "debuff",
    s: "support",
    p: "placement",
    c: "control",
    u: "utility",
};

/* ─── Ultra-compact URL share format (ex: #s=1:Cra:9:r:2800:1,1:Eni:7:h) ─── */
function encodeSharePayload(raidId: RaidId, slots: RaidSlot[], captainIds: string[]): string {
    const prefix = raidId === "sanctuaire" ? "s" : "g";
    const parts = slots.map((slot) => {
        const wing = slot.wing;
        const pseudo = slot.pseudo ? encodeURIComponent(slot.pseudo.trim()) : "";
        const cls = slot.classId ? slot.classId.toString() : "";
        const role = ROLE_TO_CODE[slot.roleKey] || "r";
        const init = slot.initiative > 0 ? slot.initiative.toString() : "";
        const cap = captainIds.includes(slot.id) ? "1" : "";

        // Format compact : wing:pseudo:classId:role:init:cap
        // On tronque les éléments vides de la fin pour minimiser la longueur
        const fields = [wing.toString(), pseudo, cls, role, init, cap];
        while (fields.length > 1 && fields[fields.length - 1] === "") {
            // Si le rôle est "r" (défaut) et qu'aucun champ n'est défini avant sauf le wing
            if (fields.length === 4 && fields[3] === "r" && fields[2] === "" && fields[1] === "") {
                fields.pop(); // retire le "r"
                fields.pop(); // retire le cls
                fields.pop(); // retire le pseudo
                break;
            }
            fields.pop();
        }
        return fields.join(":");
    });
    return `${prefix}=${parts.join(",")}`;
}

function decodeSharePayload(rawHash: string): { raidId: RaidId; slots: RaidSlot[]; captainIds: string[] } | null {
    try {
        const clean = rawHash.replace(/^#/, "");
        if (!clean) return null;

        // Support rétrocompatible pour l'ancien base64 (#p=ey... ou #state=...)
        if (clean.startsWith("p=") || clean.startsWith("state=")) {
            const b64 = clean.startsWith("p=") ? clean.slice(2) : clean.slice(6);
            const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
            const json = atob(padded);
            const data = JSON.parse(json);
            if (data.r && Array.isArray(data.s)) {
                const captainIds: string[] = [];
                const slots: RaidSlot[] = data.s.map((m: { w: 1 | 2; p: string; c: number | null; r: RoleKey; i: number; cap?: number }, idx: number) => {
                    const id = `slot-${idx}`;
                    if (m.cap) captainIds.push(id);
                    return { id, wing: m.w || 1, indexInWing: idx, pseudo: m.p || "", classId: m.c || null, roleKey: m.r || "dps-range", initiative: m.i || 0, isConfirmed: true };
                });
                return { raidId: data.r as RaidId, slots, captainIds };
            }
        }

        // Nouveau format compact : s=... (Sanctuaire) ou g=... (Gigalodon)
        const match = clean.match(/^([sg])=(.*)$/);
        if (!match) return null;

        const raidId: RaidId = match[1] === "s" ? "sanctuaire" : "gigalodon";
        const playersPart = match[2];
        if (!playersPart) return { raidId, slots: [], captainIds: [] };

        const captainIds: string[] = [];
        const slots: RaidSlot[] = playersPart.split(",").map((pStr, idx) => {
            const id = `slot-${idx}`;
            const parts = pStr.split(":");
            const wing: 1 | 2 = parts[0] === "2" ? 2 : 1;
            const pseudo = parts[1] ? decodeURIComponent(parts[1]) : "";
            const classId = parts[2] ? parseInt(parts[2], 10) || null : null;
            const roleKey = (parts[3] && CODE_TO_ROLE[parts[3].toLowerCase()]) || "dps-range";
            const initiative = parts[4] ? parseInt(parts[4], 10) || 0 : 0;
            if (parts[5] === "1") captainIds.push(id);

            return {
                id,
                wing,
                indexInWing: idx,
                pseudo,
                classId,
                roleKey,
                initiative,
                isConfirmed: true,
            };
        });

        return { raidId, slots, captainIds };
    } catch {
        return null;
    }
}

let slotCounter = 0;
function nextSlotId() { return `slot-${Date.now()}-${++slotCounter}`; }

/* ═══════════════════════════════════════════════════
   CLASS PICKER BENTO GRID
═══════════════════════════════════════════════════ */
function ClassPickerPopup({
    currentClassId, onSelect, onClose, title, noneLabel,
}: {
    currentClassId: number | null;
    onSelect: (id: number | null) => void;
    onClose: () => void;
    title: string;
    noneLabel: string;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    return (
        <div ref={ref} className="absolute z-50 top-full left-0 mt-2 rounded-2xl border border-border bg-surface shadow-2xl w-80 animate-in fade-in-0 zoom-in-95 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">{title}</span>
                <button onClick={onClose} className="p-1 rounded text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
            </div>
            {/* Grid 4 cols: icon + name */}
            <div className="px-3 pb-3 grid grid-cols-4 gap-1.5 max-h-72 overflow-y-auto">
                {/* No class option */}
                <button
                    onClick={() => { onSelect(null); onClose(); }}
                    title={noneLabel}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all hover:border-accent/60 ${currentClassId === null ? "border-accent bg-accent/10" : "border-border/60 bg-background/40 hover:bg-accent/5"}`}
                >
                    <div className="w-9 h-9 flex items-center justify-center">
                        <span className="text-lg text-muted-foreground/50 font-black">—</span>
                    </div>
                    <span className="text-[9px] font-semibold text-muted-foreground leading-tight text-center truncate w-full">{noneLabel}</span>
                </button>
                {DOFUS_CLASSES.map((cls) => (
                    <button
                        key={cls.id}
                        onClick={() => { onSelect(cls.id); onClose(); }}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all hover:border-accent/60 hover:bg-accent/5 ${currentClassId === cls.id ? "border-accent bg-accent/15 ring-1 ring-accent/40" : "border-border/60 bg-background/40"}`}
                    >
                        <div className="w-9 h-9 shrink-0">
                            <Image src={cls.icon} alt={cls.name} width={36} height={36} className="w-full h-full object-contain" />
                        </div>
                        <span className="text-[9px] font-semibold text-foreground/80 leading-tight text-center truncate w-full">{cls.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   ROLE PICKER POPUP
═══════════════════════════════════════════════════ */
function RolePickerPopup({
    currentRole, onSelect, onClose, title, roleLabels,
}: {
    currentRole: RoleKey;
    onSelect: (r: RoleKey) => void;
    onClose: () => void;
    title: string;
    roleLabels: Record<RoleKey, string>;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    return (
        <div ref={ref} className="absolute z-50 top-full left-0 mt-2 p-2.5 rounded-2xl border border-border bg-surface shadow-2xl w-56 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">{title}</span>
                <button onClick={onClose} className="p-1 rounded text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="space-y-1">
                {RAID_ROLES.map((r) => {
                    const meta = ROLE_META[r.key];
                    const isSelected = currentRole === r.key;
                    return (
                        <button
                            key={r.key}
                            onClick={() => { onSelect(r.key); onClose(); }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                                isSelected ? `${meta.bg} ${meta.text} ${meta.border}` : "border-transparent hover:border-border hover:bg-background/60 text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <span className="flex items-center gap-2">
                                <span className="text-sm leading-none">{meta.emoji}</span>
                                <span>{roleLabels[r.key]}</span>
                            </span>
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   SLOT CARD
═══════════════════════════════════════════════════ */
function SlotCard({
    slot,
    isCaptain,
    onUpdate,
    onRemove,
    onToggleCaptain,
    roleLabels,
    ui,
}: {
    slot: RaidSlot;
    isCaptain: boolean;
    onUpdate: (id: string, u: Partial<RaidSlot>) => void;
    onRemove: (id: string) => void;
    onToggleCaptain: (id: string) => void;
    roleLabels: Record<RoleKey, string>;
    ui: {
        classPickerTitle: string;
        classNone: string;
        classTriggerSet: string;
        classTriggerEmpty: string;
        classLabel: string;
        rolePickerTitle: string;
        roleTrigger: string;
        captainTooltipSet: string;
        captainTooltipRemove: string;
        removeSlot: string;
        initTooltip: string;
        emptyName: string;
    };
}) {
    const [classPickerOpen, setClassPickerOpen] = useState(false);
    const [rolePickerOpen, setRolePickerOpen] = useState(false);

    const dofusClass = DOFUS_CLASSES.find((c) => c.id === slot.classId);
    const roleMeta = ROLE_META[slot.roleKey];

    return (
        <div className={`group rounded-xl border p-2.5 sm:p-3 transition-all ${
            isCaptain
                ? "border-warning/50 bg-warning/5 shadow-sm"
                : "border-border/70 bg-surface/40 hover:border-border hover:bg-surface/70"
        }`}>
            <div className="flex items-center gap-2.5">
                {/* Class picker trigger */}
                <div className="relative shrink-0">
                    <button
                        onClick={() => { setClassPickerOpen((v) => !v); setRolePickerOpen(false); }}
                        title={dofusClass ? ui.classTriggerSet.replace("{name}", dofusClass.name) : ui.classTriggerEmpty}
                        className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all overflow-hidden relative shadow-sm ${
                            dofusClass
                                ? "border-accent/40 bg-accent/10 hover:border-accent"
                                : "border-dashed border-border/80 bg-background/60 hover:border-accent/60"
                        }`}
                    >
                        {dofusClass ? (
                            <Image src={dofusClass.icon} alt={dofusClass.name} width={36} height={36} className="w-8 h-8 object-contain" />
                        ) : (
                            <span className="text-sm text-muted-foreground/60 font-black">?</span>
                        )}
                    </button>
                    {classPickerOpen && (
                        <ClassPickerPopup
                            currentClassId={slot.classId}
                            onSelect={(id) => onUpdate(slot.id, { classId: id })}
                            onClose={() => setClassPickerOpen(false)}
                            title={ui.classPickerTitle}
                            noneLabel={ui.classNone}
                        />
                    )}
                </div>

                {/* Pseudo & Class label */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 relative">
                        <input
                            type="text"
                            value={slot.pseudo}
                            onChange={(e) => onUpdate(slot.id, { pseudo: e.target.value })}
                            placeholder={ui.emptyName}
                            maxLength={24}
                            className="w-full text-sm font-bold text-foreground bg-transparent border-b border-border/50 focus:border-accent/60 pb-0.5 focus:outline-none placeholder:text-muted-foreground/40 transition-colors pr-6"
                        />
                        <button
                            onClick={() => onToggleCaptain(slot.id)}
                            title={isCaptain ? ui.captainTooltipRemove : ui.captainTooltipSet}
                            className={`absolute right-0 top-0.5 p-0.5 rounded transition-colors ${isCaptain ? "text-warning" : "text-muted-foreground/30 hover:text-warning/70"}`}
                        >
                            <Crown className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="text-[11px] text-muted-foreground/60 font-medium truncate mt-0.5">
                        {dofusClass ? dofusClass.name : <span className="italic">{ui.classLabel}</span>}
                    </div>
                </div>

                {/* Role picker trigger */}
                <div className="relative shrink-0">
                    <button
                        onClick={() => { setRolePickerOpen((v) => !v); setClassPickerOpen(false); }}
                        title={ui.roleTrigger.replace("{role}", roleLabels[slot.roleKey])}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${roleMeta.bg} ${roleMeta.text} ${roleMeta.border} hover:opacity-80`}
                    >
                        <span className="text-sm leading-none">{roleMeta.emoji}</span>
                        <span className="hidden sm:inline max-w-[75px] truncate">{roleMeta.label}</span>
                    </button>
                    {rolePickerOpen && (
                        <RolePickerPopup
                            currentRole={slot.roleKey}
                            onSelect={(r) => onUpdate(slot.id, { roleKey: r })}
                            onClose={() => setRolePickerOpen(false)}
                            title={ui.rolePickerTitle}
                            roleLabels={roleLabels}
                        />
                    )}
                </div>

                {/* Initiative */}
                <div className="flex items-center gap-1.5 bg-background/60 px-2 py-1 rounded-lg border border-border shrink-0" title={ui.initTooltip}>
                    <Zap className="w-3 h-3 text-warning shrink-0" />
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] text-muted-foreground/50 font-mono uppercase leading-none">Init.</span>
                        <input
                            type="number"
                            value={slot.initiative || ""}
                            onChange={(e) => onUpdate(slot.id, { initiative: Number(e.target.value) || 0 })}
                            placeholder="0"
                            min={0}
                            max={9999}
                            className="w-12 text-xs font-mono font-bold text-foreground bg-transparent border-none p-0 focus:outline-none text-right"
                        />
                    </div>
                </div>

                {/* Remove */}
                <button
                    onClick={() => onRemove(slot.id)}
                    title={ui.removeSlot}
                    className="p-1.5 rounded-lg text-muted-foreground/30 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════ */
export function RaidPlannerClient() {
    const { t } = useI18n();
    const l10n = t.raidStudio;

    const [selectedRaid, setSelectedRaid] = useState<RaidId>("sanctuaire");
    const [activeTab, setActiveTab] = useState<"planner" | "luminarium" | "enigmes" | "strategy">("planner");
    const [slots, setSlots] = useState<RaidSlot[]>([]);
    const [captainIds, setCaptainIds] = useState<string[]>([]);
    const [raidHp, setRaidHp] = useState(20);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [showRoleGuide, setShowRoleGuide] = useState(false);

    const assets = RAID_ASSETS[selectedRaid];
    const raidI18n = l10n.raids[selectedRaid];

    /* ─── Load from Share URL or LocalStorage ─── */
    useEffect(() => {
        if (typeof window === "undefined") return;
        const hash = window.location.hash;
        if (hash) {
            const result = decodeSharePayload(hash);
            if (result && result.slots.length > 0) {
                setSelectedRaid(result.raidId);
                setSlots(result.slots);
                setCaptainIds(result.captainIds);
                return;
            }
        }
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                if (data.raidId) setSelectedRaid(data.raidId);
                if (data.slots) setSlots(data.slots);
                if (data.captainIds) setCaptainIds(data.captainIds);
                if (data.raidHp) setRaidHp(data.raidHp);
            }
        } catch { /* ignore */ }
    }, []);

    /* ─── Persist ─── */
    useEffect(() => {
        if (typeof window === "undefined") return;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ raidId: selectedRaid, slots, captainIds, raidHp })); } catch { /* ignore */ }
    }, [selectedRaid, slots, captainIds, raidHp]);

    /* ─── Handlers ─── */
    const handleSwitchRaid = (id: RaidId) => {
        setSelectedRaid(id);
        setActiveTab("planner");
        setSlots([]);
        setCaptainIds([]);
        setRaidHp(20);
    };

    const handleReset = () => {
        setSlots([]);
        setCaptainIds([]);
        setRaidHp(20);
        showToast(l10n.resetBtn);
    };

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const handleShareUrl = () => {
        if (slots.length === 0) { showToast(l10n.ui.noPlayersShare); return; }
        try {
            const hash = encodeSharePayload(selectedRaid, slots, captainIds);
            const url = `${window.location.origin}${window.location.pathname}#${hash}`;
            navigator.clipboard.writeText(url);
            showToast(l10n.linkCopied);
        } catch { /* noop */ }
    };

    const updateSlot = useCallback((id: string, u: Partial<RaidSlot>) => setSlots((p) => p.map((s) => s.id === id ? { ...s, ...u } : s)), []);
    const removeSlot = useCallback((id: string) => { setSlots((p) => p.filter((s) => s.id !== id)); setCaptainIds((p) => p.filter((c) => c !== id)); }, []);
    const addSlot = useCallback((wing: 1 | 2) => setSlots((p) => [...p, { id: nextSlotId(), wing, indexInWing: 0, pseudo: "", classId: null, roleKey: "dps-range", initiative: 0, isConfirmed: true }]), []);

    const fillWing = useCallback((wing: 1 | 2) => {
        setSlots((prev) => {
            const currentCount = prev.filter((s) => s.wing === wing).length;
            const needed = assets.wingSlotsDefault - currentCount;
            if (needed <= 0) return prev;
            const newSlots: RaidSlot[] = Array.from({ length: needed }).map((_, idx) => ({
                id: nextSlotId(),
                wing,
                indexInWing: currentCount + idx,
                pseudo: "",
                classId: null,
                roleKey: "dps-range",
                initiative: 0,
                isConfirmed: true,
            }));
            return [...prev, ...newSlots];
        });
    }, [assets.wingSlotsDefault]);

    const clearWing = useCallback((wing: 1 | 2) => {
        setSlots((prev) => {
            const remaining = prev.filter((s) => s.wing !== wing);
            const remainingIds = new Set(remaining.map((s) => s.id));
            setCaptainIds((caps) => caps.filter((id) => remainingIds.has(id)));
            return remaining;
        });
    }, []);

    const toggleCaptain = useCallback((id: string) => {
        setSlots((prevSlots) => {
            const slot = prevSlots.find((s) => s.id === id);
            if (!slot) return prevSlots;
            const wingIds = prevSlots.filter((s) => s.wing === slot.wing).map((s) => s.id);
            setCaptainIds((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev.filter((c) => !wingIds.includes(c)), id]);
            return prevSlots;
        });
    }, []);

    /* ─── Derived calculations ─── */
    const wing1Slots = useMemo(() => slots.filter((s) => s.wing === 1), [slots]);
    const wing2Slots = useMemo(() => slots.filter((s) => s.wing === 2), [slots]);
    const averageInitiative = useMemo(() => {
        const valid = slots.filter((s) => s.initiative > 0);
        return valid.length === 0 ? 0 : Math.round(valid.reduce((acc, s) => acc + s.initiative, 0) / valid.length);
    }, [slots]);
    const isCorridorFastEnough = averageInitiative >= 2601;

    /* ─── Discord markdown ─── */
    const discordMarkdown = useMemo(() => {
        const lines: string[] = [
            `# ⚔️ RAID 3.6 : ${raidI18n.name.toUpperCase()}`,
            `**Format :** ${assets.maxPlayers} — **Objectif :** ${raidI18n.targetScore}`,
            `**Initiative :** ${averageInitiative} (${isCorridorFastEnough ? "✅ > 2601 corridor OK" : "⚠️ < 2601 Férocité"})`,
            "", `### 🛡️ ${raidI18n.wing1}`,
        ];
        wing1Slots.forEach((s) => {
            const cls = DOFUS_CLASSES.find((c) => c.id === s.classId)?.name || "—";
            const cap = captainIds.includes(s.id) ? ` ${l10n.ui.captainDiscord}` : "";
            lines.push(`- **${s.pseudo || "—"}** — ${cls} • *${l10n.roles[s.roleKey]}*${cap} (Init: ${s.initiative})`);
        });
        lines.push("", `### 🗡️ ${raidI18n.wing2}`);
        wing2Slots.forEach((s) => {
            const cls = DOFUS_CLASSES.find((c) => c.id === s.classId)?.name || "—";
            const cap = captainIds.includes(s.id) ? ` ${l10n.ui.captainDiscord}` : "";
            lines.push(`- **${s.pseudo || "—"}** — ${cls} • *${l10n.roles[s.roleKey]}*${cap} (Init: ${s.initiative})`);
        });
        lines.push("", `🔗 *Généré via SigilOS Raid Studio — ${typeof window !== "undefined" ? window.location.href : "sigilos.fr"}*`);
        return lines.join("\n");
    }, [raidI18n, assets, averageInitiative, isCorridorFastEnough, wing1Slots, wing2Slots, captainIds, l10n]);

    const slotUi = {
        classPickerTitle: l10n.ui.classPickerTitle,
        classNone: l10n.ui.classNone,
        classTriggerSet: l10n.ui.classTriggerSet,
        classTriggerEmpty: l10n.ui.classTriggerEmpty,
        classLabel: l10n.ui.classLabel,
        rolePickerTitle: l10n.ui.rolePickerTitle,
        roleTrigger: l10n.ui.roleTrigger,
        captainTooltipSet: l10n.ui.captainTooltipSet,
        captainTooltipRemove: l10n.ui.captainTooltipRemove,
        removeSlot: l10n.slot.removeSlot,
        initTooltip: l10n.ui.initTooltip,
        emptyName: l10n.slot.emptyName,
    };

    /* ─── Wing panel renderer ─── */
    const renderWingPanel = (wingSlots: RaidSlot[], wingNum: 1 | 2, wingName: string, wingDesc: string, accentBg: string, accentBorder: string) => {
        const isFull = wingSlots.length >= assets.wingSlotsDefault;
        const isEmpty = wingSlots.length === 0;

        return (
            <div className={`rounded-2xl border bg-surface/40 p-4 sm:p-5 space-y-3.5 transition-all shadow-sm ${accentBorder}`}>
                {/* Wing Header */}
                <div className="flex items-center justify-between pb-3 border-b border-border/70">
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${accentBg}`} />
                            <h3 className="text-sm font-bold text-foreground">{wingName}</h3>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-tight">{wingDesc}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold border ${
                            isFull ? "bg-accent/15 text-accent border-accent/30" : "bg-muted/50 text-muted-foreground border-border"
                        }`}>
                            {wingSlots.length} / {assets.wingSlotsDefault}
                        </span>
                        {!isEmpty && (
                            <button
                                onClick={() => clearWing(wingNum)}
                                title={l10n.ui.clearWing}
                                className="p-1 rounded text-muted-foreground/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Slots List or Empty State */}
                {isEmpty ? (
                    <div className="py-8 px-4 rounded-xl border border-dashed border-border/80 bg-background/30 text-center space-y-3">
                        <div className="w-10 h-10 rounded-full bg-muted/40 border border-border flex items-center justify-center mx-auto text-muted-foreground">
                            <Users className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs font-semibold text-foreground/80">{l10n.ui.emptyWingTitle}</p>
                            <p className="text-[11px] text-muted-foreground/60">{l10n.slot.emptyState}</p>
                        </div>
                        <div className="flex items-center justify-center gap-2 pt-1">
                            <button
                                onClick={() => addSlot(wingNum)}
                                className="px-3.5 py-1.5 rounded-xl bg-accent text-accent-foreground text-xs font-bold hover:bg-accent/90 transition-all flex items-center gap-1.5 shadow-sm"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>{l10n.slot.addSlot}</span>
                            </button>
                            <button
                                onClick={() => fillWing(wingNum)}
                                className="px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-surface/80 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all flex items-center gap-1"
                            >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>{l10n.ui.quickFill}</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {wingSlots.map((slot) => (
                            <SlotCard
                                key={slot.id}
                                slot={slot}
                                isCaptain={captainIds.includes(slot.id)}
                                onUpdate={updateSlot}
                                onRemove={removeSlot}
                                onToggleCaptain={toggleCaptain}
                                roleLabels={l10n.roles}
                                ui={slotUi}
                            />
                        ))}
                    </div>
                )}

                {/* Bottom Add Actions when not empty */}
                {!isEmpty && !isFull && (
                    <div className="flex items-center gap-2 pt-1">
                        <button
                            onClick={() => addSlot(wingNum)}
                            className="flex-1 py-2 rounded-xl border border-dashed border-border hover:border-accent/60 text-xs font-semibold text-muted-foreground hover:text-accent transition-all flex items-center justify-center gap-1.5 hover:bg-accent/5"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{l10n.slot.addSlot}</span>
                        </button>
                        <button
                            onClick={() => fillWing(wingNum)}
                            title={l10n.ui.quickFill}
                            className="px-3 py-2 rounded-xl border border-border bg-surface/50 hover:bg-surface text-xs font-semibold text-muted-foreground hover:text-foreground transition-all flex items-center gap-1"
                        >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{l10n.ui.quickFill}</span>
                        </button>
                    </div>
                )}
            </div>
        );
    };

    /* ─── Render ─── */
    return (
        <div className="space-y-5">
            {/* Toast */}
            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-xs font-bold shadow-2xl animate-in slide-in-from-bottom-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /><span>{toastMessage}</span>
                </div>
            )}

            {/* ─── BARRE D'ACTIONS RAPIDES (SANS DOUBLON DE TITRE) ─── */}
            <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">
                    {selectedRaid === "sanctuaire"
                        ? "Sanctuaire des Jardins Éternels (16 joueurs)"
                        : "Gouffre du Gigalodon (12 joueurs)"}
                </span>
                <div className="flex items-center gap-2 ml-auto shrink-0">
                    <button
                        onClick={handleReset}
                        title={l10n.ui.resetTooltip}
                        className="px-3 py-1.5 rounded-xl border border-border bg-surface/40 hover:bg-surface text-xs font-semibold text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{l10n.resetBtn}</span>
                    </button>
                    <button
                        onClick={handleShareUrl}
                        title={l10n.ui.shareTooltip}
                        className="px-3 py-1.5 rounded-xl border border-border bg-surface/40 hover:bg-surface text-xs font-semibold text-foreground transition-all flex items-center gap-1.5"
                    >
                        <Share2 className="w-3.5 h-3.5 text-accent" />
                        <span>{l10n.shareBtn}</span>
                    </button>
                    <button
                        onClick={() => setIsExportOpen(true)}
                        title={l10n.ui.exportTooltip}
                        className="px-3.5 py-1.5 rounded-xl bg-accent text-accent-foreground text-xs font-bold shadow-md hover:bg-accent/90 transition-all flex items-center gap-1.5"
                    >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{l10n.exportDiscordBtn}</span>
                    </button>
                </div>
            </div>

            {/* ─── CHOIX DU RAID (2 CARTES INTERACTIVES - ZÉRO DOUBLON) ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(["sanctuaire", "gigalodon"] as RaidId[]).map((raidId) => {
                    const a = RAID_ASSETS[raidId];
                    const ri = l10n.raids[raidId];
                    const active = selectedRaid === raidId;
                    const isSanctuaire = raidId === "sanctuaire";
                    const accentGlow = isSanctuaire ? "shadow-emerald-500/15" : "shadow-cyan-500/15";
                    const accentBorder = isSanctuaire ? "border-emerald-500/60" : "border-cyan-500/60";
                    const accentText = isSanctuaire ? "text-emerald-400" : "text-cyan-400";
                    const accentBg = isSanctuaire ? "bg-emerald-500/15" : "bg-cyan-500/15";

                    return (
                        <button
                            key={raidId}
                            onClick={() => handleSwitchRaid(raidId)}
                            className={`relative overflow-hidden rounded-2xl border p-4 text-left transition-all group ${
                                active
                                    ? `${accentBorder} shadow-lg ${accentGlow} bg-surface/80 ring-1 ${isSanctuaire ? "ring-emerald-500/40" : "ring-cyan-500/40"}`
                                    : "border-border/80 bg-surface/30 hover:border-border hover:bg-surface/50 opacity-70 hover:opacity-100"
                            }`}
                        >
                            {/* Background image subtile */}
                            <div className="absolute inset-0 z-0">
                                <Image src={a.banner} alt="" fill className="object-cover object-center" />
                                <div className={`absolute inset-0 ${
                                    active
                                        ? "bg-gradient-to-r from-background/95 via-background/85 to-background/70"
                                        : "bg-background/90"
                                }`} />
                            </div>

                            <div className="relative z-10 flex items-center gap-3.5">
                                <div className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 shrink-0 shadow-md ${
                                    active ? accentBorder : "border-border"
                                }`}>
                                    <Image src={a.icon} alt={ri.shortName} fill className="object-cover" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                                            active ? `${accentBg} ${accentText} ${accentBorder}` : "bg-muted/40 text-muted-foreground border-border"
                                        }`}>
                                            <Sparkles className="w-2.5 h-2.5" />
                                            {ri.badge}
                                        </span>
                                    </div>

                                    <div className={`text-base font-black tracking-tight truncate ${
                                        active ? "text-foreground" : "text-foreground/80"
                                    }`}>
                                        {ri.shortName}
                                    </div>

                                    <div className="flex items-center gap-2.5 mt-1 text-[11px] text-muted-foreground flex-wrap">
                                        <span className={`font-semibold ${active ? accentText : ""}`}>
                                            👥 {a.maxPlayers} {l10n.ui.maxPlayersLabel}
                                        </span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{ri.timer}</span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1 text-warning/90"><Coins className="w-3 h-3" />{ri.cost}</span>
                                    </div>
                                </div>

                                {active && (
                                    <div className={`shrink-0 w-2.5 h-2.5 rounded-full ${isSanctuaire ? "bg-emerald-400" : "bg-cyan-400"} shadow-sm`} />
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* ─── BARRE DE NAVIGATION & INDICATEURS RÉSUMÉS ─── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-2.5 rounded-2xl border border-border/80 bg-surface/50">
                {/* Onglets */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                    <button
                        onClick={() => setActiveTab("planner")}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                            activeTab === "planner"
                                ? "bg-accent text-accent-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground hover:bg-surface"
                        }`}
                    >
                        <Users className="w-4 h-4" />
                        <span>{l10n.tabs.planner}</span>
                    </button>

                    {selectedRaid === "sanctuaire" && (
                        <button
                            onClick={() => setActiveTab("enigmes")}
                            title={l10n.ui.enigmesTabTooltip}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                                activeTab === "enigmes"
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-surface"
                            }`}
                        >
                            <Compass className="w-4 h-4 text-emerald-400" />
                            <span>{l10n.tabs.enigmes}</span>
                        </button>
                    )}

                    {selectedRaid === "gigalodon" && (
                        <button
                            onClick={() => setActiveTab("luminarium")}
                            title={l10n.ui.luminariumTabTooltip}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                                activeTab === "luminarium"
                                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-surface"
                            }`}
                        >
                            <Lightbulb className="w-4 h-4 text-cyan-400" />
                            <span>{l10n.tabs.luminarium}</span>
                        </button>
                    )}

                    <button
                        onClick={() => setActiveTab("strategy")}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                            activeTab === "strategy"
                                ? "bg-accent text-accent-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground hover:bg-surface"
                        }`}
                    >
                        <BookOpen className="w-4 h-4" />
                        <span>{l10n.ui.strategyTab}</span>
                    </button>
                </div>

                {/* Métriques clés douces (Sans alarme criarde) */}
                <div className="flex items-center gap-2.5 flex-wrap text-xs font-semibold text-muted-foreground self-start md:self-auto px-1">
                    {/* Effectif */}
                    <span className="flex items-center gap-1 bg-background/60 px-2.5 py-1 rounded-lg border border-border/80">
                        <Users className="w-3.5 h-3.5 text-accent" />
                        <span className="text-foreground font-bold">{slots.length}</span> / {assets.maxPlayers}
                    </span>

                    {/* Initiative */}
                    <span
                        className="flex items-center gap-1 bg-background/60 px-2.5 py-1 rounded-lg border border-border/80 cursor-help"
                        title={l10n.ui.initAvgTooltip}
                    >
                        <Zap className="w-3.5 h-3.5 text-warning" />
                        <span>Init:</span>
                        <span className="font-mono font-bold text-foreground">{averageInitiative || "—"}</span>
                        {isCorridorFastEnough && slots.length > 0 && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 ml-0.5" title={l10n.stats.corridorOk} />
                        )}
                    </span>

                    {/* PV Raid (Sanctuaire) ou Drops (Gigalodon) */}
                    {selectedRaid === "sanctuaire" ? (
                        <div
                            className="flex items-center gap-1 bg-background/60 px-2 py-0.5 rounded-lg border border-border/80 cursor-help"
                            title={l10n.ui.raidHpTooltip}
                        >
                            <Heart className="w-3.5 h-3.5 text-rose-400" />
                            <span className="text-rose-400 font-bold">{raidHp} / 20</span>
                            <div className="flex items-center ml-1">
                                <button
                                    onClick={() => setRaidHp((h) => Math.max(0, h - 1))}
                                    title={l10n.ui.removeHpTooltip}
                                    className="w-4 h-4 rounded bg-muted/60 hover:bg-muted text-foreground text-[10px] font-bold flex items-center justify-center"
                                >
                                    -
                                </button>
                                <button
                                    onClick={() => setRaidHp((h) => Math.min(20, h + 1))}
                                    title={l10n.ui.addHpTooltip}
                                    className="w-4 h-4 rounded bg-muted/60 hover:bg-muted text-foreground text-[10px] font-bold flex items-center justify-center ml-0.5"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    ) : (
                        <span
                            className="flex items-center gap-1 bg-background/60 px-2.5 py-1 rounded-lg border border-border/80 cursor-help"
                            title="Mureine +1k · Exécrabe +5k · Willorque +10k"
                        >
                            <Coins className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-muted-foreground">Drops:</span>
                            <span className="text-foreground font-mono font-bold">+1k / +5k / +10k</span>
                        </span>
                    )}
                </div>
            </div>

            {/* ─── ONGLET 1 : COMPOSITION DU ROSTER (LES 2 AILES TOUT DE SUITE) ─── */}
            {activeTab === "planner" && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                        {renderWingPanel(wing1Slots, 1, raidI18n.wing1, raidI18n.wing1Desc, "bg-accent", "border-accent/30")}
                        {renderWingPanel(wing2Slots, 2, raidI18n.wing2, raidI18n.wing2Desc, "bg-amber-400", "border-amber-500/30")}
                    </div>

                    {/* Guide des 9 rôles repliable (Ne pollue pas l'écran) */}
                    <div className="rounded-xl border border-border/70 bg-surface/30 overflow-hidden transition-all">
                        <button
                            onClick={() => setShowRoleGuide((v) => !v)}
                            className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <span className="flex items-center gap-2">
                                <Info className="w-3.5 h-3.5 text-accent" />
                                <span>{l10n.ui.roleGuideToggle} (9 {l10n.ui.rolePickerTitle})</span>
                            </span>
                            {showRoleGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        {showRoleGuide && (
                            <div className="p-4 pt-1 border-t border-border/60">
                                <div className="flex flex-wrap gap-2">
                                    {RAID_ROLES.map((r) => {
                                        const meta = ROLE_META[r.key];
                                        return (
                                            <span
                                                key={r.key}
                                                title={l10n.roles[r.key]}
                                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${meta.bg} ${meta.text} ${meta.border}`}
                                            >
                                                <span>{meta.emoji}</span>
                                                <span>{meta.label}</span>
                                            </span>
                                        );
                                    })}
                                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-warning/30 bg-warning/10 text-warning text-[11px] font-semibold">
                                        <Crown className="w-3.5 h-3.5" />
                                        <span>{l10n.ui.captainLabel}</span>
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── ONGLET 2 : OUTILS EN RAID ─── */}
            {activeTab === "luminarium" && selectedRaid === "gigalodon" && <LuminariumSolver />}
            {activeTab === "enigmes" && selectedRaid === "sanctuaire" && <JardinsEnigmaTracker />}

            {/* ─── ONGLET 3 : STRATÉGIE & BOSS ─── */}
            {activeTab === "strategy" && (
                <div className="space-y-6 animate-in fade-in-0 duration-200">
                    {/* Briefing en 3 points clés */}
                    <div className="rounded-2xl border border-border bg-surface/50 p-5 sm:p-6 space-y-4">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-accent" />
                            <h3 className="text-sm font-bold text-foreground">Briefing & Règles Tactiques — {raidI18n.name}</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {raidI18n.briefing.map((item: string, idx: number) => (
                                <div key={idx} className="p-3.5 rounded-xl bg-background/60 border border-border flex items-start gap-3">
                                    <span className="w-6 h-6 rounded-full bg-accent/15 text-accent font-mono text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                                        {idx + 1}
                                    </span>
                                    <p className="text-xs text-foreground/90 leading-relaxed font-medium">{item}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Cartes des boss */}
                    <div className="rounded-2xl border border-border bg-surface/50 p-5 sm:p-6 space-y-4">
                        <div className="flex items-center gap-2">
                            <Swords className="w-4 h-4 text-accent" />
                            <h3 className="text-sm font-bold text-foreground">{raidI18n.bossSectionTitle}</h3>
                        </div>
                        <div className={`grid grid-cols-1 sm:grid-cols-2 ${raidI18n.bossCards.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-3`}>
                            {raidI18n.bossCards.map((boss: { name: string; img: string; tip: string }) => (
                                <div key={boss.name} className="rounded-xl border border-border bg-background/60 overflow-hidden hover:border-accent/40 transition-all">
                                    <div className="relative w-full h-32 sm:h-36">
                                        <Image src={boss.img} alt={boss.name} fill className="object-cover" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-transparent to-transparent" />
                                        <div className="absolute bottom-2.5 left-3">
                                            <span className="text-xs font-bold text-foreground drop-shadow">{boss.name}</span>
                                        </div>
                                    </div>
                                    <div className="p-3">
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">{boss.tip}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Section Guilde SigilOS & Modal Discord */}
            <SigilOSShowcaseSection />
            <DiscordExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} markdownText={discordMarkdown} />
        </div>
    );
}
