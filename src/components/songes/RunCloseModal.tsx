"use client";

import { cn } from "@/lib/utils";


import { useState, useTransition, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    CheckCircle2,
    Circle,
    X,
    Loader2,
    Star,
    Sparkles,
    UserPlus,
    Search,
    ChevronDown,
    Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    getSongesGuildMembersForClose,
    closeRunWithContributions,
} from "@/server/actions/songes/dream-run-actions";
import { toast } from "sonner";
import { DIFFICULTIES, type DifficultyKey } from "@/lib/songes/types";

// ─── Types ──────────────────────────────────────────────────────────────────

type GuildMember = { id: string; userId: string; name: string; image: string | null };

interface RunCloseModalProps {
    isOpen: boolean;
    runId: string;
    guildId: string;
    difficulty: string;
    /** userIds of run members (excl. leader) — used to match against guild profiles */
    memberUserIds: string[];
    onClose: () => void;
    onClosed: () => void;
}

// ─── Points helper (mirrors server) ─────────────────────────────────────────

function getSongesPoints(difficulty: string): number {
    if (difficulty.startsWith("CAUCHEMAR")) return 3;
    if (difficulty.startsWith("PARADOXE")) return 2;
    return 1;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RunCloseModal({
    isOpen,
    runId,
    guildId,
    difficulty,
    memberUserIds,
    onClose,
    onClosed,
}: RunCloseModalProps) {
    const [isPending, startTransition] = useTransition();

    const pts = getSongesPoints(difficulty);
    const diffConfig = DIFFICULTIES[difficulty as DifficultyKey];
    const accentColor = diffConfig?.couleur ?? "#a855f7";

    // ── All guild members (profileId, userId, name, image) ──────────────────
    const [allMembers, setAllMembers] = useState<GuildMember[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);

    useEffect(() => {
        if (!isOpen || allMembers.length > 0) return;
        setLoadingMembers(true);
        getSongesGuildMembersForClose(guildId).then((res) => {
            if (res.success && res.data) setAllMembers(res.data);
            setLoadingMembers(false);
        });
    }, [isOpen, guildId, allMembers.length]);

    // ── Derive "run participants" (matches by userId → profileId) ───────────
    // This is the source-of-truth list once allMembers is loaded
    const runParticipants: GuildMember[] = allMembers.filter((m) =>
        memberUserIds.includes(m.userId)
    );

    // ── Validated set: pre-select all run participants ───────────────────────
    // Re-initialise when allMembers loads (once only)
    const [validated, setValidated] = useState<Set<string>>(new Set());
    const [validatedInitialized, setValidatedInitialized] = useState(false);

    useEffect(() => {
        if (validatedInitialized || runParticipants.length === 0) return;
        setValidated(new Set(runParticipants.map((m) => m.id)));
        setValidatedInitialized(true);
    }, [runParticipants, validatedInitialized]);

    // ── Extra members (added manually beyond the run list) ───────────────────
    const [extraMembers, setExtraMembers] = useState<GuildMember[]>([]);
    const [search, setSearch] = useState("");
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        if (!dropdownOpen) return;
        function handler(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
                setSearch("");
            }
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [dropdownOpen]);

    function toggle(profileId: string) {
        setValidated((prev) => {
            const next = new Set(prev);
            if (next.has(profileId)) next.delete(profileId);
            else next.add(profileId);
            return next;
        });
    }

    // Already-listed profileIds (avoid duplicates in dropdown)
    const alreadyListedIds = new Set([
        ...runParticipants.map((m) => m.id),
        ...extraMembers.map((m) => m.id),
    ]);

    const filteredSuggestions = allMembers.filter(
        (m) =>
            !alreadyListedIds.has(m.id) &&
            m.name.toLowerCase().includes(search.toLowerCase())
    );

    function addExtra(member: GuildMember) {
        setExtraMembers((prev) => [...prev, member]);
        setValidated((prev) => new Set([...prev, member.id]));
        setSearch("");
        setDropdownOpen(false);
    }

    function removeExtra(id: string) {
        setExtraMembers((prev) => prev.filter((m) => m.id !== id));
        setValidated((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    }

    // Reset state when modal re-opens
    useEffect(() => {
        if (!isOpen) {
            setExtraMembers([]);
            setSearch("");
            setDropdownOpen(false);
            setValidatedInitialized(false);
            setValidated(new Set());
        }
    }, [isOpen]);

    // ── Confirm ──────────────────────────────────────────────────────────────

    function handleConfirm() {
        startTransition(async () => {
            const res = await closeRunWithContributions(
                guildId,
                runId,
                Array.from(validated)
            );
            if (res.success) {
                const count = validated.size;
                const awarded = res.data?.pointsAwarded ?? pts;
                toast.success(
                    `Run clôturée ! ${count} membre${count > 1 ? "s ont" : " a"} reçu +${awarded} point${awarded > 1 ? "s" : ""} de contribution.`
                );
                onClosed();
                onClose();
            } else {
                toast.error(res.error ?? "Une erreur est survenue");
            }
        });
    }

    const validatedCount = validated.size;
    const totalListCount = runParticipants.length + extraMembers.length;
    const isLoading = loadingMembers && allMembers.length === 0;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 12 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="relative w-full max-w-md bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Top glow bar (difficulty color) */}
                        <div
                            className="absolute top-0 left-0 right-0 h-px"
                            style={{
                                background: `linear-gradient(to right, transparent, ${accentColor}80, transparent)`,
                            }}
                        />

                        {/* Header */}
                        <div className="p-6 pb-4 border-b border-white/5 bg-slate-900/30">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0"
                                        style={{
                                            backgroundColor: `${accentColor}20`,
                                            borderColor: `${accentColor}40`,
                                        }}
                                    >
                                        <Moon className="w-5 h-5" style={{ color: accentColor }} />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-black text-white">
                                            Clôturer la Run
                                        </h2>
                                        <p
                                            className="text-xs mt-0.5 font-semibold uppercase tracking-wider"
                                            style={{ color: accentColor }}
                                        >
                                            {diffConfig?.label ?? difficulty}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="text-slate-600 hover:text-white transition-colors mt-0.5"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">

                            {/* Loading state */}
                            {isLoading && (
                                <div className="flex flex-col items-center justify-center py-8 gap-3 text-slate-500">
                                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: accentColor }} />
                                    <span className="text-sm">Chargement des profils…</span>
                                </div>
                            )}

                            {!isLoading && (
                                <>
                                    {/* Info banner */}
                                    <div
                                        className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 border"
                                        style={{
                                            backgroundColor: `${accentColor}10`,
                                            borderColor: `${accentColor}30`,
                                        }}
                                    >
                                        <Sparkles
                                            className="w-4 h-4 mt-0.5 shrink-0"
                                            style={{ color: accentColor }}
                                        />
                                        <p className="text-xs text-slate-300 leading-relaxed">
                                            Valide les membres qui ont{" "}
                                            <strong className="text-white">réellement participé</strong>{" "}
                                            pour leur attribuer{" "}
                                            <strong style={{ color: accentColor }}>
                                                +{pts} point{pts > 1 ? "s" : ""} de contribution
                                            </strong>
                                            .{" "}
                                            <span className="text-slate-500">
                                                Tu ne reçois pas de point en tant que leader.
                                            </span>
                                        </p>
                                    </div>

                                    {/* Difficulty / points scale */}
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-2 h-2 rounded-full shrink-0"
                                            style={{ backgroundColor: accentColor }}
                                        />
                                        <span className="text-[11px] uppercase tracking-widest font-bold text-slate-400">
                                            Barème — {diffConfig?.label}
                                        </span>
                                        <div className="flex items-center gap-1 ml-auto">
                                            {[1, 2, 3].map((i) => (
                                                <Star
                                                    key={i}
                                                    className="w-3 h-3"
                                                    style={{
                                                        color: i <= pts ? accentColor : "#374151",
                                                        fill: i <= pts ? accentColor : "transparent",
                                                    }}
                                                />
                                            ))}
                                            <span
                                                className="text-xs font-black ml-1"
                                                style={{ color: accentColor }}
                                            >
                                                {pts} pt{pts > 1 ? "s" : ""}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Participants list */}
                                    {totalListCount > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">
                                                Membres ({runParticipants.length} dans la run
                                                {extraMembers.length > 0
                                                    ? ` + ${extraMembers.length} ajouté${extraMembers.length > 1 ? "s" : ""}`
                                                    : ""})
                                            </p>

                                            {/* Run members */}
                                            {runParticipants.map((m) => {
                                                const isVal = validated.has(m.id);
                                                return (
                                                    <button
                                                        key={m.id}
                                                        onClick={() => toggle(m.id)}
                                                        className={cn(
                                                            "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                                                            isVal 
                                                                ? "bg-black/40 border-white/10 shadow-inner" 
                                                                : "bg-slate-900/20 border-white/5 hover:bg-slate-900/40"
                                                        )}
                                                        style={{ 
                                                            borderColor: isVal ? `${accentColor}20` : undefined,
                                                            boxShadow: isVal ? `inset 0 0 15px ${accentColor}05` : undefined
                                                        }}
                                                    >
                                                        <Avatar className="w-8 h-8 shrink-0">
                                                            <AvatarImage src={m.image ?? undefined} />
                                                            <AvatarFallback className="bg-slate-800 text-white/50 text-[10px] font-black">
                                                                {m.name.charAt(0).toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-white/90 truncate">
                                                                {m.name}
                                                            </p>
                                                        </div>
                                                        {isVal && (
                                                            <span
                                                                className="flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-md border"
                                                                style={{
                                                                    color: `${accentColor}cc`,
                                                                    backgroundColor: `${accentColor}10`,
                                                                    borderColor: `${accentColor}20`,
                                                                }}
                                                            >
                                                                +{pts} pt{pts > 1 ? "s" : ""}
                                                            </span>
                                                        )}
                                                        {isVal ? (
                                                            <div className="w-5 h-5 rounded-full flex items-center justify-center bg-white/5 border border-white/10">
                                                                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: accentColor }} />
                                                            </div>
                                                        ) : (
                                                            <Circle className="w-5 h-5 text-white/5 shrink-0" />
                                                        )}
                                                    </button>
                                                );
                                            })}

                                            {/* Extra members */}
                                            {extraMembers.map((m) => {
                                                const isVal = validated.has(m.id);
                                                return (
                                                    <div
                                                        key={m.id}
                                                        className="w-full flex items-center gap-3 p-3 rounded-xl border bg-amber-500/10 border-amber-500/30"
                                                    >
                                                        <Avatar className="w-8 h-8 shrink-0">
                                                            <AvatarImage src={m.image ?? undefined} />
                                                            <AvatarFallback className="bg-slate-700 text-white text-xs font-bold">
                                                                {m.name.charAt(0).toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-white truncate">
                                                                {m.name}
                                                            </p>
                                                            <p className="text-[10px] text-amber-400/70">
                                                                Ajouté manuellement
                                                            </p>
                                                        </div>
                                                        <button onClick={() => toggle(m.id)} className="shrink-0">
                                                            {isVal ? (
                                                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                                            ) : (
                                                                <Circle className="w-5 h-5 text-slate-600" />
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={() => removeExtra(m.id)}
                                                            className="text-slate-600 hover:text-rose-400 transition-colors shrink-0"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Empty state */}
                                    {totalListCount === 0 && (
                                        <div className="text-center py-4 text-slate-600">
                                            <Circle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                            <p className="text-sm">Aucun membre dans cette run.</p>
                                            <p className="text-xs text-slate-700 mt-1">
                                                Tu peux en ajouter manuellement ci-dessous.
                                            </p>
                                        </div>
                                    )}

                                    {/* ── Add member manually ─────────────────────────────── */}
                                    <div className="pt-2 border-t border-white/5" ref={dropdownRef}>
                                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                            <UserPlus className="w-3 h-3" />
                                            Ajouter un participant hors-liste
                                        </p>
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDropdownOpen((v) => !v);
                                                    setTimeout(() => searchRef.current?.focus(), 50);
                                                }}
                                                className="w-full flex items-center gap-2 px-3 py-2.5 bg-slate-900/60 border border-white/10 rounded-xl text-sm text-slate-400 hover:border-purple-500/40 hover:text-white transition-all"
                                            >
                                                <Search className="w-4 h-4 shrink-0" />
                                                <span className="flex-1 text-left truncate">
                                                    Rechercher un membre de la guilde…
                                                </span>
                                                <ChevronDown
                                                    className={`w-4 h-4 shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                                                />
                                            </button>

                                            <AnimatePresence>
                                                {dropdownOpen && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: -4 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -4 }}
                                                        transition={{ duration: 0.15 }}
                                                        className="absolute z-10 top-full mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                                                    >
                                                        <div className="p-2 border-b border-white/5">
                                                            <div className="flex items-center gap-2 px-2">
                                                                <Search className="w-3 h-3 text-slate-500 shrink-0" />
                                                                <input
                                                                    ref={searchRef}
                                                                    type="text"
                                                                    value={search}
                                                                    onChange={(e) => setSearch(e.target.value)}
                                                                    placeholder="Nom du membre…"
                                                                    className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 outline-none py-1"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="max-h-48 overflow-y-auto">
                                                            {filteredSuggestions.length === 0 ? (
                                                                <p className="text-center text-xs text-slate-600 py-4 italic">
                                                                    {search ? "Aucun résultat" : "Tous les membres sont déjà listés"}
                                                                </p>
                                                            ) : (
                                                                filteredSuggestions.map((m) => (
                                                                    <button
                                                                        key={m.id}
                                                                        type="button"
                                                                        onClick={() => addExtra(m)}
                                                                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                                                                    >
                                                                        <Avatar className="w-7 h-7 shrink-0">
                                                                            <AvatarImage src={m.image ?? undefined} />
                                                                            <AvatarFallback className="bg-slate-700 text-white text-xs">
                                                                                {m.name.charAt(0).toUpperCase()}
                                                                            </AvatarFallback>
                                                                        </Avatar>
                                                                        <span className="text-sm text-white font-medium truncate">
                                                                            {m.name}
                                                                        </span>
                                                                    </button>
                                                                ))
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>

                                    {/* Summary */}
                                    {validatedCount > 0 && (
                                        <p className="text-[11px] text-slate-500 text-center">
                                            <strong className="text-slate-300">{validatedCount}</strong>{" "}
                                            membre{validatedCount > 1 ? "s" : ""}{" "}
                                            recevra{validatedCount > 1 ? "ont" : ""}{" "}
                                            <strong style={{ color: accentColor }}>
                                                +{pts} point{pts > 1 ? "s" : ""} de contribution
                                            </strong>
                                        </p>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 pb-6 pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 border-t border-white/5">
                            <Button
                                variant="ghost"
                                onClick={onClose}
                                disabled={isPending}
                                className="flex-1 h-12 border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 font-bold rounded-xl transition-all order-2 sm:order-1"
                            >
                                Annuler
                            </Button>
                            <Button
                                onClick={handleConfirm}
                                disabled={isPending || isLoading}
                                className="flex-1 h-12 text-white font-black uppercase tracking-[0.15em] text-[10px] rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] border shadow-xl order-1 sm:order-2"
                                style={{ 
                                    backgroundColor: "#0d0d12",
                                    borderColor: `${accentColor}30`,
                                    boxShadow: `0 0 25px ${accentColor}10, inset 0 0 8px ${accentColor}05`
                                }}
                            >
                                {isPending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Clôture…
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4 mr-2" style={{ color: accentColor }} />
                                        Confirmer & Distribuer
                                    </>
                                )}
                            </Button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
