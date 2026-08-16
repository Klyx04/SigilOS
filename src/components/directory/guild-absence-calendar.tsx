"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { DAYS_OF_WEEK, TIME_SLOTS, type GlobalAvailability, type DayOfWeek, type TimeSlot } from "@/lib/dofus-assets";
import { format, addWeeks, startOfWeek, endOfWeek, getISOWeek, getYear } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CalendarDays, Plane, Sunrise, Sun, Moon, AlertCircle, Search, Sunset, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { startOfMonth, differenceInWeeks, addMonths, isSameMonth } from "date-fns";

const SLOT_INFO: Record<TimeSlot, { icon: any, label: string, color: string, bg: string, border: string }> = {
    matin: { icon: Sunrise, label: "Matin", color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" },
    midi: { icon: Sun, label: "Midi", color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20" },
    soir: { icon: Sunset, label: "Soir", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
    nuit: { icon: Moon, label: "Nuit", color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
};

interface GuildAbsenceCalendarProps {
    members: any[];
    guildId: string;
    /** #91 — met en évidence la ligne de ce membre (l'utilisateur courant). */
    highlightProfileId?: string;
}

// Removed TIME_SLOT_COLORS as we use SLOT_INFO now

export function GuildAbsenceCalendar({ members, guildId, highlightProfileId }: GuildAbsenceCalendarProps) {
    const [weekOffset, setWeekOffset] = useState(0);
    const [search, setSearch] = useState("");

    // ── Virtualisation (chantier #98) : seules les lignes visibles sont rendues ──
    // Avec des centaines de membres, une table complète = des milliers de nœuds DOM
    // → lag au scroll. On fixe une hauteur de ligne constante et on ne monte que
    // les lignes du viewport (+ overscan), dans un conteneur à défilement propre.
    const ROW_HEIGHT = 88;
    const OVERSCAN = 6;
    const [scrollTop, setScrollTop] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(600);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Observe la hauteur du conteneur de scroll (responsive).
    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const update = () => setViewportHeight(el.clientHeight || 600);
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const currentMonday = useMemo(() => {
        const now = new Date();
        const start = startOfWeek(now, { weekStartsOn: 1 });
        return addWeeks(start, weekOffset);
    }, [weekOffset]);

    const currentWeekKey = useMemo(() => {
        const year = getYear(currentMonday);
        const week = getISOWeek(currentMonday);
        return `${year}-W${week}`;
    }, [currentMonday]);

    const weekDates = useMemo(() => {
        const dates: Record<DayOfWeek, Date> = {} as any;
        DAYS_OF_WEEK.forEach((day, idx) => {
            const date = new Date(currentMonday);
            date.setDate(currentMonday.getDate() + idx);
            dates[day] = date;
        });
        return dates;
    }, [currentMonday]);

    const isToday = (date: Date) => {
        const today = new Date();
        return today.getDate() === date.getDate() &&
            today.getMonth() === date.getMonth() &&
            today.getFullYear() === date.getFullYear();
    };

    const isVacation = (member: any, date: Date) => {
        if (!member.vacationStart || !member.vacationEnd) return false;
        const d = new Date(date); d.setHours(12, 0, 0, 0);
        const start = new Date(member.vacationStart); start.setHours(0, 0, 0, 0);
        const end = new Date(member.vacationEnd); end.setHours(23, 59, 59, 999);
        return d >= start && d <= end;
    };

    const getMemberAvailabilityForDay = (member: any, day: DayOfWeek) => {
        const availability = member.availability as GlobalAvailability | undefined;
        if (!availability) return null;
        
        // Handle both new GlobalAvailability and legacy format
        const isLegacy = Object.keys(availability).some(k => DAYS_OF_WEEK.includes(k as any));
        const template = isLegacy ? availability : (availability.template || {});
        const weekData = (!isLegacy && availability.weeks) ? availability.weeks[currentWeekKey] : null;
        
        const effectiveData = weekData || template;
        return effectiveData[day] || [];
    };

    const filteredMembers = useMemo(() => {
        const searchTerm = search.toLowerCase();
        
        // 1. Filter members first
        const matched = members.filter(m => {
            const match = 
                (m.pseudoDofus || "").toLowerCase().includes(searchTerm) ||
                (m.user?.name || "").toLowerCase().includes(searchTerm) ||
                (m.discordNickname || "").toLowerCase().includes(searchTerm);
            return match;
        });

        // 2. Precompute vacation status for the current week to avoid overhead in the sort loop
        const membersWithVacationStatus = matched.map(m => {
            const hasVacationThisWeek = DAYS_OF_WEEK.some(day => isVacation(m, weekDates[day]));
            return {
                member: m,
                hasVacationThisWeek,
                name: (m.pseudoDofus || m.discordNickname || m.user?.name || "").toLowerCase()
            };
        });

        // 3. Sort on precomputed values
        membersWithVacationStatus.sort((a, b) => {
            if (a.hasVacationThisWeek && !b.hasVacationThisWeek) return -1;
            if (!a.hasVacationThisWeek && b.hasVacationThisWeek) return 1;
            return a.name.localeCompare(b.name);
        });

        // 4. Return original objects
        return membersWithVacationStatus.map(x => x.member);
    }, [members, search, weekDates]);

    // #91 — recentre la vue sur la ligne de l'utilisateur courant (avec virtualisation).
    useEffect(() => {
        if (!highlightProfileId) return;
        const t = setTimeout(() => {
            const idx = filteredMembers.findIndex(m => m.id === highlightProfileId);
            if (idx >= 0) {
                scrollContainerRef.current?.scrollTo({
                    top: Math.max(0, idx * ROW_HEIGHT - 180),
                    behavior: "smooth"
                });
            }
        }, 250);
        return () => clearTimeout(t);
    }, [highlightProfileId, filteredMembers]);

    // Fenêtre de lignes visibles (virtualisation).
    const totalRows = filteredMembers.length;
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const endIndex = Math.min(totalRows, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
    const visibleMembers = filteredMembers.slice(startIndex, endIndex);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Toolbar */}
            <div className="relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4 p-5 rounded-[2rem] bg-zinc-950/40 border border-white/5 shadow-2xl backdrop-blur-3xl group/toolbar">
                <div className="noise-overlay absolute inset-0 opacity-[0.03] pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                
                <div className="relative w-full md:w-72 group/search">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within/search:text-indigo-400 transition-colors" />
                    <Input
                        placeholder="Chercher un membre..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10 bg-white/5 border-white/10 hover:border-white/20 focus-visible:ring-indigo-500/30 rounded-xl"
                    />
                </div>

                <div className="flex items-center gap-1 bg-zinc-900 p-1.5 rounded-xl border border-white/10 shadow-inner">
                    <button
                        onClick={() => setWeekOffset(prev => prev - 4)}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-all"
                        title="-1 Mois"
                    >
                        <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setWeekOffset(prev => prev - 1)}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all"
                        title="-1 Semaine"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <Popover>
                        <PopoverTrigger asChild>
                            <div className="px-4 text-sm font-black text-zinc-200 min-w-[180px] text-center flex items-center justify-center gap-2 cursor-pointer hover:text-indigo-400  transition-all duration-300 group/week" title="Choisir un mois">
                                <CalendarDays className={cn(
                                    "w-4 h-4 transition-colors",
                                    weekOffset === 0 ? "text-indigo-400" : "text-zinc-500 group-hover:text-indigo-400"
                                )} />
                                <span className="uppercase tracking-widest italic">
                                    {weekOffset === 0 ? "Cette semaine" : format(currentMonday, "d MMM", { locale: fr }) + " - " + format(endOfWeek(currentMonday, { weekStartsOn: 1 }), "d MMM yyyy", { locale: fr })}
                                </span>
                            </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-[320px] p-4 glass-premium border-white/10 shadow-2xl overflow-hidden" align="center">
                            <div className="noise-overlay absolute inset-0 opacity-[0.03] pointer-events-none" />
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                                        <Sparkles className="w-4 h-4 text-indigo-400" />
                                    </div>
                                    <h4 className="text-caption font-black uppercase text-zinc-400 tracking-[0.2em]">Sauter vers un mois</h4>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2">
                                    {[0, 1, 2, 3, 4, 5].map((monthAdd) => {
                                        const targetMonth = addMonths(new Date(), monthAdd);
                                        const isActive = isSameMonth(targetMonth, currentMonday);
                                        
                                        return (
                                            <button
                                                key={monthAdd}
                                                onClick={() => {
                                                    const now = new Date();
                                                    const startOfTarget = startOfMonth(targetMonth);
                                                    const mondayOfTarget = startOfWeek(startOfTarget, { weekStartsOn: 1 });
                                                    const mondayOfNow = startOfWeek(now, { weekStartsOn: 1 });
                                                    const offset = differenceInWeeks(mondayOfTarget, mondayOfNow);
                                                    setWeekOffset(offset);
                                                }}
                                                className={cn(
                                                    "group/m relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-300 h-20 overflow-hidden",
                                                    isActive
                                                        ? "bg-indigo-500/20 border-indigo-500/40 "
                                                        : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10"
                                                )}
                                            >
                                                <span className={cn(
                                                    "text-caption font-black uppercase tracking-widest transition-colors",
                                                    isActive ? "text-indigo-400" : "text-zinc-500 group-hover/m:text-zinc-300"
                                                )}>
                                                    {format(targetMonth, "yyyy")}
                                                </span>
                                                <span className={cn(
                                                    "text-sm font-black uppercase transition-all",
                                                    isActive ? "text-white scale-110" : "text-zinc-400 group-hover/m:text-white"
                                                )}>
                                                    {format(targetMonth, "MMMM", { locale: fr })}
                                                </span>
                                                {isActive && (
                                                    <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-indigo-500/20 blur-xl rounded-full" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button 
                                    onClick={() => setWeekOffset(0)}
                                    className="w-full mt-4 p-2 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] text-caption font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-all flex items-center justify-center gap-2"
                                >
                                    <ChevronsLeft className="w-3 h-3" />
                                    Retour au présent
                                </button>
                            </div>
                        </PopoverContent>
                    </Popover>
                    <button
                        onClick={() => setWeekOffset(prev => prev + 1)}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all"
                        title="+1 Semaine"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setWeekOffset(prev => prev + 4)}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-all"
                        title="+1 Mois"
                    >
                        <ChevronsRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Calendar Grid — virtualisé (#98) : seule la fenêtre visible est rendue */}
            <div className="relative rounded-2xl border border-white/5 bg-zinc-950/40 overflow-hidden">
                <div
                    ref={scrollContainerRef}
                    onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
                    className="max-h-[68vh] overflow-auto premium-scrollbar"
                >
                    <div className="min-w-[800px]">
                        {/* En-tête sticky */}
                        <div className="sticky top-0 z-20 grid grid-cols-[16rem_repeat(7,1fr)] border-b border-white/10 bg-zinc-900/95 backdrop-blur">
                            <div className="px-5 py-3 flex items-center">
                                <span className="text-caption font-bold text-zinc-400 uppercase tracking-wider">Membre</span>
                            </div>
                            {DAYS_OF_WEEK.map(day => {
                                const date = weekDates[day];
                                const today = isToday(date);
                                return (
                                    <div key={day} className={cn("px-2 py-3 text-center border-l border-white/5", today && "bg-indigo-500/[0.05]")}>
                                        <div className="flex flex-col items-center gap-0.5">
                                            <span className={cn("text-caption font-semibold uppercase leading-none", today ? "text-indigo-400" : "text-zinc-500")}>
                                                {format(date, "EEE", { locale: fr })}
                                            </span>
                                            <span className={cn("text-lg font-bold leading-none", today ? "text-white" : "text-zinc-300")}>
                                                {format(date, "d")}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Corps virtualisé : seules les lignes visibles (+ overscan) sont montées */}
                        <div className="relative" style={{ height: totalRows * ROW_HEIGHT }}>
                            {visibleMembers.map((member, i) => {
                                const rowIndex = startIndex + i;
                                const isHighlighted = !!highlightProfileId && member.id === highlightProfileId;
                                return (
                                    <div
                                        key={member.id}
                                        className={cn(
                                            "absolute left-0 right-0 grid grid-cols-[16rem_repeat(7,1fr)] border-b border-white/5 transition-colors",
                                            isHighlighted
                                                ? "bg-emerald-500/[0.06] ring-1 ring-inset ring-emerald-500/40"
                                                : "hover:bg-white/[0.02]"
                                        )}
                                        style={{ top: rowIndex * ROW_HEIGHT, height: ROW_HEIGHT }}
                                    >
                                        <div className="px-4 flex items-center overflow-hidden">
                                            <Link
                                                href={`/dashboard/${guildId}/members/${encodeURIComponent(member.pseudoDofus || member.id)}`}
                                                className="flex items-center gap-3 min-w-0 w-full group/member outline-none"
                                            >
                                                <Avatar className="w-10 h-10 shrink-0 border border-white/5">
                                                    <AvatarImage src={member.user?.image} />
                                                    <AvatarFallback className="bg-zinc-900 text-xs font-bold text-zinc-500">
                                                        {(member.pseudoDofus || member.discordNickname || member.user?.name || "?").substring(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col min-w-0">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <span className="font-semibold text-zinc-200 text-body-sm truncate group-hover/member:text-indigo-400 transition-colors">
                                                            {member.pseudoDofus || member.discordNickname || member.user?.name}
                                                        </span>
                                                        {isHighlighted && (
                                                            <span className="shrink-0 text-caption font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-1.5 py-0.5">Vous</span>
                                                        )}
                                                    </div>
                                                    <span className="text-caption text-zinc-600 truncate">{member.roleName || "Membre"}</span>
                                                </div>
                                            </Link>
                                        </div>
                                        {DAYS_OF_WEEK.map(day => {
                                            const onVacation = isVacation(member, weekDates[day]);
                                            const slots = getMemberAvailabilityForDay(member, day);
                                            const hasSlots = slots && slots.length > 0;
                                            return (
                                                <div key={day} className="px-1.5 py-1.5 border-l border-white/5 flex items-center justify-center">
                                                    {onVacation ? (
                                                        <div className="w-full h-full min-h-[60px] rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex flex-col items-center justify-center gap-0.5" title={member.vacationReason ? `En congés : ${member.vacationReason}` : "En congés"}>
                                                            <Plane className="w-4 h-4 text-cyan-400" />
                                                            <span className="text-caption font-bold text-cyan-500/80">Absent</span>
                                                        </div>
                                                    ) : hasSlots ? (
                                                        <div className="grid grid-cols-2 gap-1">
                                                            {slots.slice(0, 4).map((slot: TimeSlot) => {
                                                                const Info = SLOT_INFO[slot];
                                                                const Icon = Info.icon;
                                                                return (
                                                                    <div
                                                                        key={slot}
                                                                        className={cn("flex items-center justify-center w-6 h-6 rounded-md border", Info.bg, Info.border)}
                                                                        title={Info.label}
                                                                    >
                                                                        <Icon className={cn("w-3.5 h-3.5", Info.color)} />
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-lg bg-zinc-900/50 border border-dashed border-white/10 flex items-center justify-center" title="Disponibilité non définie">
                                                            <AlertCircle className="w-3.5 h-3.5 opacity-50" />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                            {totalRows === 0 && (
                                <div className="absolute inset-x-0 top-0 p-8 text-center text-zinc-500">
                                    Aucun membre trouvé.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-6 px-4 py-3 bg-zinc-950 border border-white/10 rounded-xl text-xs font-medium text-zinc-400 shadow-2xl">
                {TIME_SLOTS.map(slot => {
                    const Info = SLOT_INFO[slot];
                    const Icon = Info.icon;
                    return (
                        <div key={slot} className="flex items-center gap-2">
                            <div className={cn("flex items-center justify-center w-6 h-6 rounded-md border", Info.bg, Info.border)}>
                                <Icon className={cn("w-3.5 h-3.5", Info.color)} />
                            </div>
                            <span className="capitalize">{Info.label}</span>
                        </div>
                    );
                })}
                <div className="h-4 w-px bg-white/10 mx-2 hidden sm:block" />
                <div className="flex items-center gap-2 text-cyan-400">
                    <Plane className="w-4 h-4" />
                    <span>Absent</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-500">
                    <AlertCircle className="w-4 h-4 opacity-50" />
                    <span>Non défini</span>
                </div>
            </div>
        </div>
    );
}
