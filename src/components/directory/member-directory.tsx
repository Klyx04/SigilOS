"use client";

import { useState, useTransition } from "react";
import { MemberCard } from "./member-card";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { DOFUS_CLASSES, DOFUS_JOBS, JOB_CATEGORIES } from "@/lib/dofus-assets";
import { ClassIcon } from "@/components/shared/class-icon";
import { Search, Filter, X, Briefcase, Swords, Check, Palmtree } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

interface MemberDirectoryProps {
    initialMembers: any[];
    guildId: string;
}

export function MemberDirectory({ initialMembers, guildId }: MemberDirectoryProps) {
    const [members] = useState(initialMembers);
    const [isPending, startTransition] = useTransition();

    // Filters State
    const [search, setSearch] = useState("");
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const [selectedJob, setSelectedJob] = useState<string | null>(null);
    const [showAbsent, setShowAbsent] = useState(false);
    const [isOpenClass, setIsOpenClass] = useState(false);
    const [isOpenJob, setIsOpenJob] = useState(false);

    // Filtering Logic
    const filteredMembers = members.filter(m => {
        // 1. Search (Deep Alias Search)
        const searchTerm = search.toLowerCase();
        
        // Main Pseudos
        const mainMatch = (m.pseudoDofus || "").toLowerCase().includes(searchTerm) ||
            (m.dofusPseudo || "").toLowerCase().includes(searchTerm) ||
            (m.user.name || "").toLowerCase().includes(searchTerm) ||
            (m.discordNickname || "").toLowerCase().includes(searchTerm);

        // Alt Pseudos (stored as JSON array)
        let altMatch = false;
        if (m.altPseudos && Array.isArray(m.altPseudos)) {
            altMatch = m.altPseudos.some((alt: string) => alt.toLowerCase().includes(searchTerm));
        }

        if (!mainMatch && !altMatch) return false;

        // 2. Class Filter (Case insensitive check)
        if (selectedClass) {
            const targetClass = DOFUS_CLASSES.find(c => c.id === selectedClass);
            if (!targetClass) return false;

            const memberClass = m.classe?.toLowerCase();
            if (memberClass !== targetClass.name.toLowerCase() && memberClass !== targetClass.id) {
                return false;
            }
        }

        // 3. Job Filter
        if (selectedJob) {
            const jobs = Array.isArray(m.metiers) ? m.metiers : [];
            const hasJob = jobs.some((j: string) => j.toLowerCase() === selectedJob.toLowerCase());
            if (!hasJob) return false;
        }

        // 4. Absence Filter
        if (showAbsent) {
            const now = new Date();
            const vacationStart = m.vacationStart ? new Date(m.vacationStart) : null;
            const vacationEnd = m.vacationEnd ? new Date(m.vacationEnd) : null;
            const isOnVacation = vacationStart && vacationStart <= now && (!vacationEnd || vacationEnd >= now);
            if (!isOnVacation) return false;
        }

        return true;
    });

    const resetFilters = () => {
        setSearch("");
        setSelectedClass(null);
        setSelectedJob(null);
        setShowAbsent(false);
    };

    const activeFiltersCount = (selectedClass ? 1 : 0) + (selectedJob ? 1 : 0) + (showAbsent ? 1 : 0);

    const getSelectedClassName = () => DOFUS_CLASSES.find(c => c.id === selectedClass)?.name;
    const getSelectedJobName = () => {
        for (const cat of Object.values(DOFUS_JOBS)) {
            const found = cat.find(j => j.id === selectedJob);
            if (found) return found.name;
        }
        return selectedJob;
    };

    return (
        <div className="space-y-6">

            {/* FILTER BAR — UI UX 2026 PREMIUM */}
            <div className="glass-premium relative overflow-hidden p-2.5 rounded-2xl flex flex-col md:flex-row gap-3 shadow-2xl backdrop-blur-3xl group/filterbar border border-white/5">
                <div className="noise-overlay absolute inset-0 opacity-10" />
                
                {/* Search Input — High Fidelity */}
                <div className="relative flex-1 group/search">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within/search:text-indigo-400 transition-colors duration-500" />
                    <Input
                        placeholder="Rechercher par pseudo, alt, discord..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-11 bg-white/[0.02] border-white/5 hover:border-white/10 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500/50 transition-all duration-500 h-11 rounded-xl text-sm font-medium placeholder:text-zinc-600"
                    />
                    {/* Inner Focus Glint */}
                    <div className="absolute inset-px rounded-[inherit] border border-white/5 pointer-events-none group-focus-within/search:border-indigo-500/20 transition-all duration-500" />
                    
                    {search && (
                        <button
                            onClick={() => setSearch("")}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-indigo-400 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                    {/* Class Filter Popover */}
                    <Popover open={isOpenClass} onOpenChange={setIsOpenClass}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    "h-11 border-indigo-500/10 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/20 text-muted-foreground gap-2.5 px-4 font-black uppercase italic tracking-widest text-[11px] rounded-xl transition-all duration-500 shadow-xl group/btn",
                                    selectedClass && "border-indigo-500/40 bg-indigo-500/20 text-indigo-400 shadow-indigo-500/10"
                                )}
                            >
                                <Swords className={cn(
                                    "w-4 h-4 transition-all duration-500 text-indigo-400/50 group-hover/btn:text-indigo-400 group-hover/btn:scale-110", 
                                    selectedClass && "rotate-12 scale-110 text-indigo-400 opacity-100"
                                )} />
                                {selectedClass ? getSelectedClassName() : "Classe"}
                                {selectedClass && (
                                    <X 
                                        className="ml-1 w-3.5 h-3.5 text-indigo-400/60 hover:text-indigo-400 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedClass(null);
                                        }}
                                    />
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[340px] p-0 glass-premium border-white/10 shadow-2xl" align="end">
                            <Command className="bg-transparent">
                                <CommandInput placeholder="Chercher une classe..." className="h-11 border-none bg-transparent" />
                                <CommandList className="max-h-[400px]">
                                    <CommandEmpty>Aucune classe trouvée.</CommandEmpty>
                                    <CommandGroup heading="Classes" className="text-zinc-500 font-black uppercase text-[10px] tracking-widest p-2">
                                        <div className="grid grid-cols-4 gap-2">
                                            {DOFUS_CLASSES.map((c) => (
                                                <CommandItem
                                                    key={c.id}
                                                    value={c.name}
                                                    onSelect={() => {
                                                        setSelectedClass(selectedClass === c.id ? null : c.id);
                                                        setIsOpenClass(false);
                                                    }}
                                                     className={cn(
                                                        "flex flex-col items-center justify-center p-3 rounded-xl cursor-pointer transition-all gap-1.5 border h-auto",
                                                        selectedClass === c.id
                                                            ? "bg-indigo-500/20 border-indigo-500/40 text-foreground aria-selected:bg-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                                                            : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10 text-muted-foreground hover:text-foreground aria-selected:bg-white/[0.05]"
                                                    )}
                                                >
                                                    <ClassIcon classId={c.id} size={36} className="filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]" />
                                                    <span className="text-[10px] font-black truncate w-full text-center uppercase tracking-tighter opacity-80">{c.name}</span>
                                                </CommandItem>
                                            ))}
                                        </div>
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                    {/* Job Filter Popover */}
                    <Popover open={isOpenJob} onOpenChange={setIsOpenJob}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    "h-11 border-amber-500/10 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/20 text-muted-foreground gap-2.5 px-4 font-black uppercase italic tracking-widest text-[11px] rounded-xl transition-all duration-500 shadow-xl group/btn",
                                    selectedJob && "border-amber-500/40 bg-amber-500/20 text-amber-500 shadow-amber-500/10"
                                )}
                            >
                                <Briefcase className={cn(
                                    "w-4 h-4 transition-all duration-500 text-amber-500/50 group-hover/btn:text-amber-500 group-hover/btn:scale-110", 
                                    selectedJob && "scale-110 -rotate-6 text-amber-500 opacity-100"
                                )} />
                                {selectedJob ? getSelectedJobName() : "Métier (200)"}
                                {selectedJob && (
                                    <X 
                                        className="ml-1 w-3.5 h-3.5 text-amber-500/60 hover:text-amber-400 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedJob(null);
                                        }}
                                    />
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[340px] p-0 glass-premium border-white/10 shadow-2xl" align="end">
                            <Command className="bg-transparent">
                                <CommandInput placeholder="Chercher un métier..." className="h-11 border-none bg-transparent" />
                                <CommandList className="max-h-[400px]">
                                    <CommandEmpty>Aucun métier trouvé.</CommandEmpty>
                                    <CommandGroup className="p-0">
                                        {Object.entries(DOFUS_JOBS).map(([category, jobs]) => (
                                            <div key={category} className="mb-2">
                                                <div className="px-4 py-2 text-[10px] font-black text-zinc-500 bg-white/[0.03] border-y border-white/5 sticky top-0 z-10 backdrop-blur-md uppercase tracking-widest">
                                                    {category}
                                                </div>
                                                <div className="grid grid-cols-4 gap-2 p-3">
                                                    {jobs.map(job => (
                                                        <CommandItem
                                                            key={job.id}
                                                            value={job.name}
                                                            onSelect={() => {
                                                                setSelectedJob(selectedJob === job.id ? null : job.id);
                                                                setIsOpenJob(false);
                                                            }}
                                                            className={cn(
                                                                "flex flex-col items-center justify-center p-3 rounded-xl cursor-pointer transition-all gap-1.5 border h-auto",
                                                                selectedJob === job.id
                                                                    ? "bg-amber-500/20 border-amber-500/40 text-foreground aria-selected:bg-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                                                                    : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10 text-muted-foreground hover:text-foreground aria-selected:bg-white/[0.05]"
                                                            )}
                                                        >
                                                            <div className="relative w-9 h-9 flex items-center justify-center filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]">
                                                                {job.icon.startsWith("/") ? (
                                                                    <Image
                                                                        src={job.icon}
                                                                        alt={job.name}
                                                                        fill
                                                                        className="object-contain"
                                                                        sizes="36px"
                                                                    />
                                                                ) : (
                                                                    <span className="text-2xl">{job.icon}</span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] font-black truncate w-full text-center uppercase tracking-tighter opacity-80">{job.name}</span>
                                                        </CommandItem>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                    {/* Absence Filter Toggle — Cyan Glow */}
                    <Button
                        variant="outline"
                        onClick={() => setShowAbsent(!showAbsent)}
                        className={cn(
                            "h-11 border-cyan-500/10 bg-cyan-500/5 hover:bg-cyan-500/10 hover:border-cyan-500/20 text-muted-foreground gap-2.5 px-4 shrink-0 font-black uppercase italic tracking-widest text-[11px] rounded-xl transition-all duration-500 shadow-xl group/btn",
                            showAbsent && "border-cyan-500/40 bg-cyan-500/20 text-cyan-400 shadow-[0_0_25px_-5px_rgba(6,182,212,0.3)]"
                        )}
                    >
                        <Palmtree className={cn(
                            "w-4 h-4 transition-all duration-500 text-cyan-400/50 group-hover/btn:text-cyan-400 group-hover/btn:scale-110", 
                            showAbsent && "animate-bounce-subtle text-cyan-400 scale-110 opacity-100"
                        )} />
                        <span className="hidden sm:inline">Absents</span>
                    </Button>

                    {/* Reset Button — High Visibility */}
                    {activeFiltersCount > 0 && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={resetFilters}
                            className="h-11 w-11 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/5 transition-all duration-500 group/reset"
                            title="Réinitialiser les filtres"
                        >
                            <X className="w-5 h-5 transition-transform group-hover:rotate-90 group-active:scale-90" />
                        </Button>
                    )}
                </div>
            </div>

            {/* RESULT STATS */}
            <div className="flex items-center justify-between px-1">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest italic">
                    <span className="text-foreground">{filteredMembers.length}</span> membre{filteredMembers.length > 1 ? "s" : ""} trouvé{filteredMembers.length > 1 ? "s" : ""}
                </p>
            </div>

            {/* RESULTS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in duration-500">
                {filteredMembers.map(member => (
                    <MemberCard key={member.id} profile={member} guildId={guildId} />
                ))}
            </div>

            {/* EMPTY STATE */}
            {filteredMembers.length === 0 && (
                <div className="py-12">
                    <EmptyState
                        icon={Filter}
                        title="Aucun membre trouvé"
                        description="Essayez de modifier vos filtres ou votre recherche pour trouver un compagnon de guilde."
                        variant="premium"
                        action={{
                            label: "Réinitialiser les filtres",
                            onClick: resetFilters
                        }}
                    />
                </div>
            )}
        </div>
    );
}
