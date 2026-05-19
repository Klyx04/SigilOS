"use client";

import { useState, useMemo } from "react";
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
}

// Removed TIME_SLOT_COLORS as we use SLOT_INFO now

export function GuildAbsenceCalendar({ members, guildId }: GuildAbsenceCalendarProps) {
    const [weekOffset, setWeekOffset] = useState(0);
    const [search, setSearch] = useState("");

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
        return members.filter(m => {
            const searchTerm = search.toLowerCase();
            const match = 
                (m.pseudoDofus || "").toLowerCase().includes(searchTerm) ||
                (m.user?.name || "").toLowerCase().includes(searchTerm) ||
                (m.discordNickname || "").toLowerCase().includes(searchTerm);
            return match;
        }).sort((a, b) => {
            // Sort by who is absent this week, then alphabetically
            const aAbsent = DAYS_OF_WEEK.some(day => isVacation(a, weekDates[day]));
            const bAbsent = DAYS_OF_WEEK.some(day => isVacation(b, weekDates[day]));
            if (aAbsent && !bAbsent) return -1;
            if (!aAbsent && bAbsent) return 1;
            
            const nameA = a.pseudoDofus || a.discordNickname || a.user?.name || "";
            const nameB = b.pseudoDofus || b.discordNickname || b.user?.name || "";
            return nameA.localeCompare(nameB);
        });
    }, [members, search, weekDates]);

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
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
                            <div className="px-4 text-sm font-black text-zinc-200 min-w-[180px] text-center flex items-center justify-center gap-2 cursor-pointer hover:text-indigo-400 hover:scale-105 transition-all duration-300 group/week" title="Choisir un mois">
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
                                    <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-[0.2em]">Sauter vers un mois</h4>
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
                                                    "group/m relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-500 h-20 overflow-hidden",
                                                    isActive
                                                        ? "bg-indigo-500/20 border-indigo-500/40 shadow-[0_0_20px_rgba(79,70,229,0.2)]"
                                                        : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10"
                                                )}
                                            >
                                                <span className={cn(
                                                    "text-[9px] font-black uppercase tracking-widest transition-colors",
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
                                    className="w-full mt-4 p-2 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 hover:text-white transition-all flex items-center justify-center gap-2"
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

            {/* Calendar Grid */}
            <div className="relative rounded-[2.5rem] border border-white/5 bg-zinc-950/40 backdrop-blur-3xl overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] group/calendar">
                <div className="noise-overlay absolute inset-0 opacity-[0.02] pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.01] to-transparent pointer-events-none" />
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/[0.02]">
                                <th className="p-5 w-64 font-black text-zinc-500 text-[10px] uppercase tracking-[0.2em] italic">Membre</th>
                                {DAYS_OF_WEEK.map(day => {
                                    const date = weekDates[day];
                                    const today = isToday(date);
                                    return (
                                        <th key={day} className={cn(
                                            "p-4 text-center border-l border-white/5 relative overflow-hidden transition-all duration-500",
                                            today && "bg-indigo-500/[0.03]"
                                        )}>
                                            {today && (
                                                <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.5)]" />
                                            )}
                                            <div className="flex flex-col items-center relative z-10">
                                                <span className={cn(
                                                    "text-[9px] font-black uppercase tracking-[0.2em] mb-1 transition-colors duration-500", 
                                                    today ? "text-indigo-400 drop-shadow-[0_0_8px_rgba(79,70,229,0.3)]" : "text-zinc-500"
                                                )}>
                                                    {format(date, "EEEE", { locale: fr })}
                                                </span>
                                                <span className={cn(
                                                    "text-xl font-black transition-all duration-500 leading-none", 
                                                    today ? "text-white scale-110" : "text-zinc-300"
                                                )}>
                                                    {format(date, "d")}
                                                </span>
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredMembers.map((member) => (
                                <tr key={member.id} className="group hover:bg-white/[0.02] transition-colors">
                                    <td className="p-4">
                                        <Link 
                                            href={`/dashboard/${guildId}/members/${encodeURIComponent(member.pseudoDofus || member.id)}`}
                                            className="flex items-center gap-4 group/member outline-none"
                                        >
                                            <div className="relative">
                                                <Avatar className="w-12 h-12 border border-white/5 shadow-2xl transition-all duration-500 group-hover/member:scale-110 group-hover/member:rotate-3 group-hover/member:border-indigo-500/30">
                                                    <AvatarImage src={member.user?.image} />
                                                    <AvatarFallback className="bg-zinc-900 text-xs font-black text-zinc-500 uppercase tracking-tighter">
                                                        {(member.pseudoDofus || member.discordNickname || member.user?.name || "?").substring(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="absolute inset-0 rounded-full bg-indigo-500/0 group-hover/member:bg-indigo-500/10 blur-xl transition-all duration-500 -z-10" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-black text-zinc-200 text-[13px] uppercase tracking-wider transition-colors duration-500 group-hover/member:text-indigo-400 truncate max-w-[150px]">
                                                    {member.pseudoDofus || member.discordNickname || member.user?.name}
                                                </span>
                                                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] italic group-hover/member:text-zinc-500 transition-colors">
                                                    {member.roleName || "Membre"}
                                                </span>
                                            </div>
                                        </Link>
                                    </td>
                                    {DAYS_OF_WEEK.map(day => {
                                        const onVacation = isVacation(member, weekDates[day]);
                                        const slots = getMemberAvailabilityForDay(member, day);
                                        const hasSlots = slots && slots.length > 0;
                                        
                                        return (
                                            <td key={day} className="p-2 border-l border-white/5 align-middle">
                                                {onVacation ? (
                                                    <div className="w-full h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex flex-col items-center justify-center gap-0.5" title={member.vacationReason ? `En congés : ${member.vacationReason}` : "En congés"}>
                                                        <Plane className="w-4 h-4 text-cyan-400" />
                                                        <span className="text-[9px] font-bold text-cyan-500/80 uppercase tracking-widest">Absent</span>
                                                    </div>
                                                ) : hasSlots ? (
                                                    <div className="w-full flex flex-wrap items-center justify-center gap-1.5 p-1">
                                                        {slots.map((slot: TimeSlot) => {
                                                            const Info = SLOT_INFO[slot];
                                                            const Icon = Info.icon;
                                                            return (
                                                                <div 
                                                                    key={slot}
                                                                    className={cn(
                                                                        "flex items-center justify-center w-7 h-7 rounded-md border shadow-sm transition-transform hover:scale-110",
                                                                        Info.bg, Info.border
                                                                    )}
                                                                    title={Info.label}
                                                                >
                                                                    <Icon className={cn("w-4 h-4", Info.color)} />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="w-full h-10 rounded-lg bg-zinc-900/50 border border-dashed border-white/10 flex flex-col items-center justify-center text-zinc-600 gap-1" title="Disponibilité non définie">
                                                        <AlertCircle className="w-3.5 h-3.5 opacity-50" />
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                            {filteredMembers.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-zinc-500">
                                        Aucun membre trouvé.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
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
