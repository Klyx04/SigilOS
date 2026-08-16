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
import { Search, Filter, X, Briefcase, Swords, Check, Shield, Users, Sparkles } from "lucide-react";
import { ALIGNMENTS, ORDERS } from "@/lib/dofus-assets";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";


interface MemberDirectoryProps {
    initialMembers: any[];
    legendaryItems: any[];
    guildId: string;
}

export function MemberDirectory({ initialMembers, legendaryItems, guildId }: MemberDirectoryProps) {
    const [members] = useState(initialMembers);
    const [isPending, startTransition] = useTransition();

    // Filters State
    const [search, setSearch] = useState("");
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const [selectedJob, setSelectedJob] = useState<string | null>(null);
    const [selectedAlignment, setSelectedAlignment] = useState<string | null>(null);
    const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
    const [selectedLegendary, setSelectedLegendary] = useState<string | null>(null);
    const [filterLegendaryPet, setFilterLegendaryPet] = useState(false);
    const [isOpenClass, setIsOpenClass] = useState(false);
    const [isOpenJob, setIsOpenJob] = useState(false);
    const [isOpenAlignment, setIsOpenAlignment] = useState(false);
    const [isOpenOrder, setIsOpenOrder] = useState(false);
    const [isOpenLegendary, setIsOpenLegendary] = useState(false);

    // Filtering Logic
    const filteredMembers = members.filter(m => {
        // 1. Search (Deep Alias Search)
        const searchTerm = search.toLowerCase();

        // Main Pseudos - Safe check
        const mainMatch =
            (typeof m.pseudoDofus === 'string' ? m.pseudoDofus : "").toLowerCase().includes(searchTerm) ||
            (typeof m.dofusPseudo === 'string' ? m.dofusPseudo : "").toLowerCase().includes(searchTerm) ||
            (typeof m.user?.name === 'string' ? m.user.name : "").toLowerCase().includes(searchTerm) ||
            (typeof m.discordNickname === 'string' ? m.discordNickname : "").toLowerCase().includes(searchTerm);

        // Alt Pseudos (stored as JSON array) - Safe check
        let altMatch = false;
        if (m.altPseudos && Array.isArray(m.altPseudos)) {
            altMatch = m.altPseudos.some((alt: any) => {
                if (typeof alt === 'string') {
                    return alt.toLowerCase().includes(searchTerm);
                } else if (alt && typeof alt === 'object' && typeof alt.pseudo === 'string') {
                    return alt.pseudo.toLowerCase().includes(searchTerm);
                }
                return false;
            });
        }

        if (!mainMatch && !altMatch) return false;

        // 2. Class Filter (Case insensitive check)
        if (selectedClass) {
            const targetClass = DOFUS_CLASSES.find(c => c.id === selectedClass);
            if (!targetClass) return false;

            const memberClass = typeof m.classe === 'string' ? m.classe.toLowerCase() : null;
            if (memberClass !== targetClass.name.toLowerCase() && memberClass !== targetClass.id) {
                return false;
            }
        }

        // 3. Job Filter
        if (selectedJob) {
            const jobs = Array.isArray(m.metiers) ? m.metiers : [];
            const hasJob = jobs.some((j: any) =>
                typeof j === 'string' && j.toLowerCase() === selectedJob.toLowerCase()
            );
            if (!hasJob) return false;
        }

        // 4. Alignment Filter
        if (selectedAlignment) {
            const mainAlignMatch = m.alignment === selectedAlignment;
            let muleAlignMatch = false;
            if (m.altPseudos && Array.isArray(m.altPseudos)) {
                muleAlignMatch = m.altPseudos.some((alt: any) =>
                    alt && typeof alt === 'object' && alt.alignment === selectedAlignment
                );
            }
            if (!mainAlignMatch && !muleAlignMatch) return false;
        }

        // 5. Order Filter
        if (selectedOrder) {
            const mainOrderMatch = m.alignmentOrder === selectedOrder;
            let muleOrderMatch = false;
            if (m.altPseudos && Array.isArray(m.altPseudos)) {
                muleOrderMatch = m.altPseudos.some((alt: any) =>
                    alt && typeof alt === 'object' && alt.alignmentOrder === selectedOrder
                );
            }
            if (!mainOrderMatch && !muleOrderMatch) return false;
        }

        // 6. Legendary Filter
        if (selectedLegendary) {
            const hasLegendary = Array.isArray(m.legendaryCrafts) && m.legendaryCrafts.some((lc: any) => lc.id === selectedLegendary);
            if (!hasLegendary) return false;
        }

        // 7. Legendary Pet Filter
        if (filterLegendaryPet) {
            if (!m.hasLegendaryPet) return false;
        }

        return true;
    });

    const resetFilters = () => {
        setSearch("");
        setSelectedClass(null);
        setSelectedJob(null);
        setSelectedAlignment(null);
        setSelectedOrder(null);
        setSelectedLegendary(null);
        setFilterLegendaryPet(false);
    };

    const activeFiltersCount = (selectedClass ? 1 : 0) + (selectedJob ? 1 : 0) + (selectedAlignment ? 1 : 0) + (selectedOrder ? 1 : 0) + (selectedLegendary ? 1 : 0) + (filterLegendaryPet ? 1 : 0);

    const getSelectedClassName = () => DOFUS_CLASSES.find(c => c.id === selectedClass)?.name;
    const getSelectedJobName = () => {
        for (const cat of Object.values(DOFUS_JOBS)) {
            const found = cat.find(j => j.id === selectedJob);
            if (found) return found.name;
        }
        return selectedJob;
    };
    const getSelectedLegendaryName = () => legendaryItems.find(i => i.id === selectedLegendary)?.name;

    return (
        <div className="w-full">
            {/* Effectif de guilde — bloc centré (module Disponibilités dédié : onglet retiré de l'annuaire) */}
            <div className="flex flex-col items-center text-center mb-10" data-tour="annuaire-grid">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-4">
                    <Users className="w-7 h-7 text-indigo-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Effectif de guilde</h2>
                <p className="text-sm text-zinc-500 mt-1.5">
                    {members.length} membre{members.length > 1 ? "s" : ""} — recherchez par pseudo, classe, métier ou alignement.
                </p>
            </div>


            {/* FILTER BAR — UI UX 2026 PREMIUM */}
            <div className="relative p-2.5 rounded-2xl flex flex-col md:flex-row gap-3 bg-zinc-950 group/filterbar border border-white/5 mb-6" data-tour="annuaire-filters">

                {/* Search Input — High Fidelity */}
                <div className="relative flex-1 group/search" data-tour="annuaire-search">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within/search:text-indigo-400 transition-colors duration-300" />
                    <Input
                        placeholder="Rechercher par pseudo, alt, discord..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-11 bg-white/[0.02] border-white/5 hover:border-white/10 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500/50 transition-all duration-300 h-11 rounded-xl text-sm font-medium placeholder:text-zinc-600"
                    />
                    {/* Inner Focus Glint */}
                    <div className="absolute inset-px rounded-[inherit] border border-white/5 pointer-events-none group-focus-within/search:border-indigo-500/20 transition-all duration-300" />

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
                                    "h-11 border-indigo-500/10 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/20 text-muted-foreground gap-2.5 px-4 font-semibold text-caption rounded-xl transition-colors duration-200 group/btn",
                                    selectedClass && "border-indigo-500/40 bg-indigo-500/20 text-indigo-400 shadow-indigo-500/10"
                                )}
                            >
                                <Swords className={cn(
                                    "w-4 h-4 transition-all duration-300 text-indigo-400/50 group-hover/btn:text-indigo-400",
                                    selectedClass && "text-indigo-400 opacity-100"
                                )} />
                                {selectedClass ? getSelectedClassName() : "Classe"}
                                {selectedClass && (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        className="ml-1 rounded-full hover:bg-indigo-400/20 p-0.5 transition-colors cursor-pointer"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            setSelectedClass(null);
                                        }}
                                        onKeyDown={(e) => e.key === 'Enter' && setSelectedClass(null)}
                                        aria-label="Supprimer le filtre classe"
                                    >
                                        <X className="w-3.5 h-3.5 text-indigo-400/60 hover:text-indigo-400" />
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[340px] p-0 glass-premium border-white/10 shadow-xl" align="end">
                            <Command className="bg-transparent">
                                <CommandInput placeholder="Chercher une classe..." className="h-11 border-none bg-transparent" />
                                <CommandList className="max-h-[400px]">
                                    <CommandEmpty>Aucune classe trouvée.</CommandEmpty>
                                    <CommandGroup heading="Classes" className="text-zinc-500 font-black uppercase text-caption tracking-widest p-2">
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
                                                            ? "bg-indigo-500/20 border-indigo-500/40 text-foreground aria-selected:bg-indigo-500/30 "
                                                            : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10 text-muted-foreground hover:text-foreground aria-selected:bg-white/[0.05]"
                                                    )}
                                                >
                                                    <ClassIcon classId={c.id} size={36} className="filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]" />
                                                    <span className="text-caption font-black truncate w-full text-center uppercase tracking-tighter opacity-80">{c.name}</span>
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
                                    "h-11 border-amber-500/10 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/20 text-muted-foreground gap-2.5 px-4 font-semibold text-caption rounded-xl transition-colors duration-200 group/btn",
                                    selectedJob && "border-amber-500/40 bg-amber-500/20 text-amber-500 shadow-amber-500/10"
                                )}
                            >
                                <Briefcase className={cn(
                                    "w-4 h-4 transition-all duration-300 text-amber-500/50 group-hover/btn:text-amber-500",
                                    selectedJob && "text-amber-500 opacity-100"
                                )} />
                                {selectedJob ? getSelectedJobName() : "Métier (200)"}
                                {selectedJob && (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        className="ml-1 rounded-full hover:bg-amber-400/20 p-0.5 transition-colors cursor-pointer"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            setSelectedJob(null);
                                        }}
                                        onKeyDown={(e) => e.key === 'Enter' && setSelectedJob(null)}
                                        aria-label="Supprimer le filtre métier"
                                    >
                                        <X className="w-3.5 h-3.5 text-amber-500/60 hover:text-amber-400" />
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[340px] p-0 glass-premium border-white/10 shadow-xl" align="end">
                            <Command className="bg-transparent">
                                <CommandInput placeholder="Chercher un métier..." className="h-11 border-none bg-transparent" />
                                <CommandList className="max-h-[400px]">
                                    <CommandEmpty>Aucun métier trouvé.</CommandEmpty>
                                    <CommandGroup className="p-0">
                                        {Object.entries(DOFUS_JOBS).map(([category, jobs]) => (
                                            <div key={category} className="mb-2">
                                                <div className="px-4 py-2 text-caption font-black text-zinc-500 bg-white/[0.03] border-y border-white/5 sticky top-0 z-10 backdrop-blur-md uppercase tracking-widest">
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
                                                                    ? "bg-amber-500/20 border-amber-500/40 text-foreground aria-selected:bg-amber-500/30 "
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
                                                            <span className="text-caption font-black truncate w-full text-center uppercase tracking-tighter opacity-80">{job.name}</span>
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

                    {/* Alignment Filter Popover */}
                    <Popover open={isOpenAlignment} onOpenChange={setIsOpenAlignment}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    "h-11 border-indigo-500/10 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/20 text-muted-foreground gap-2.5 px-4 font-semibold text-caption rounded-xl transition-colors duration-200 group/btn",
                                    selectedAlignment && "border-indigo-500/40 bg-indigo-500/20 text-indigo-400 shadow-indigo-500/10"
                                )}
                            >
                                <Shield className={cn(
                                    "w-4 h-4 transition-all duration-300 text-indigo-400/50 group-hover/btn:text-indigo-400",
                                    selectedAlignment && "text-indigo-400 opacity-100"
                                )} />
                                {selectedAlignment ? selectedAlignment : "Alignement"}
                                {selectedAlignment && (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        className="ml-1 rounded-full hover:bg-indigo-400/20 p-0.5 transition-colors cursor-pointer"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            setSelectedAlignment(null);
                                            setSelectedOrder(null);
                                        }}
                                        onKeyDown={(e) => e.key === 'Enter' && (setSelectedAlignment(null), setSelectedOrder(null))}
                                        aria-label="Supprimer le filtre alignement"
                                    >
                                        <X className="w-3.5 h-3.5 text-indigo-400/60 hover:text-indigo-400" />
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[320px] p-4 glass-premium border-white/10 shadow-xl" align="end">
                            <div className="space-y-3">
                                <h4 className="text-caption font-black uppercase text-zinc-500 tracking-[0.2em] mb-2 flex items-center gap-2">
                                    <Shield className="w-3 h-3" /> Factions
                                </h4>
                                <div className="grid grid-cols-3 gap-2">
                                    {ALIGNMENTS.map((a) => {
                                        const isSelected = selectedAlignment === a.id;
                                        return (
                                            <button
                                                key={a.id}
                                                onClick={() => {
                                                    setSelectedAlignment(isSelected ? null : a.id);
                                                    setSelectedOrder(null);
                                                    setIsOpenAlignment(false);
                                                }}
                                                className={cn(
                                                    "relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-colors",
                                                    isSelected
                                                        ? "border-indigo-500 bg-indigo-500/10 "
                                                        : "border-white/5 bg-black/20 hover:border-white/20 hover:bg-white/5"
                                                )}
                                            >
                                                <div className="relative w-10 h-10 rounded-full overflow-hidden border border-white/10">
                                                    <Image
                                                        src={a.icon}
                                                        alt={a.name}
                                                        fill
                                                        className="object-cover scale-[1.35]"
                                                    />
                                                </div>
                                                <span className={cn(
                                                    "text-caption font-semibold",
                                                    isSelected ? "text-indigo-400" : "text-zinc-400"
                                                )}>
                                                    {a.name}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Order Filter Popover */}
                    {selectedAlignment && selectedAlignment !== "neutre" && (
                        <Popover open={isOpenOrder} onOpenChange={setIsOpenOrder}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "h-11 border-amber-500/10 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/20 text-muted-foreground gap-2.5 px-4 font-semibold text-caption rounded-xl transition-colors group/btn",
                                        selectedOrder && "border-amber-500/40 bg-amber-500/20 text-amber-500"
                                    )}
                                >
                                    <Sparkles className={cn(
                                        "w-4 h-4 transition-colors text-amber-500/50 group-hover/btn:text-amber-500",
                                        selectedOrder && "text-amber-500 opacity-100"
                                    )} />
                                    {selectedOrder ? (ORDERS as any)[selectedAlignment].find((o: any) => o.id === selectedOrder)?.name || "Ordre" : "Ordre"}
                                    {selectedOrder && (
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            className="ml-1 rounded-full hover:bg-amber-400/20 p-0.5 transition-colors cursor-pointer"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                setSelectedOrder(null);
                                            }}
                                            onKeyDown={(e) => e.key === 'Enter' && setSelectedOrder(null)}
                                            aria-label="Supprimer le filtre ordre"
                                        >
                                            <X className="w-3.5 h-3.5 text-amber-500/60 hover:text-amber-400" />
                                        </span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[360px] p-4 glass-premium border-white/10 shadow-xl" align="end">
                                <div className="space-y-3">
                                    <h4 className="text-caption font-black uppercase text-zinc-500 tracking-[0.2em] mb-2 flex items-center gap-2">
                                        <Sparkles className="w-3 h-3" /> Ordres ({selectedAlignment})
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {(ORDERS as any)[selectedAlignment].map((o: any) => {
                                            const isSelected = selectedOrder === o.id;
                                            return (
                                                <button
                                                    key={o.id}
                                                    onClick={() => {
                                                        setSelectedOrder(isSelected ? null : o.id);
                                                        setIsOpenOrder(false);
                                                    }}
                                                    className={cn(
                                                        "relative flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-colors text-center h-24",
                                                        isSelected
                                                            ? "border-amber-500 bg-amber-500/10 "
                                                            : "border-white/5 bg-black/20 hover:border-white/20 hover:bg-white/5"
                                                    )}
                                                >
                                                    <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0">
                                                        <Image
                                                            src={o.icon}
                                                            alt={o.name}
                                                            fill
                                                            className="object-contain"
                                                        />
                                                    </div>
                                                    <span className={cn(
                                                        "text-caption font-black uppercase leading-tight line-clamp-2 px-1",
                                                        isSelected ? "text-amber-400" : "text-zinc-400"
                                                    )}>
                                                        {o.name}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}



                    {/* Legendary Filter Popover */}
                    <Popover open={isOpenLegendary} onOpenChange={setIsOpenLegendary}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    "h-11 border-purple-500/10 bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500/20 text-muted-foreground gap-2.5 px-4 font-semibold text-caption rounded-xl transition-colors duration-200 group/btn",
                                    selectedLegendary && "border-purple-500/40 bg-purple-500/20 text-purple-400 shadow-purple-500/10"
                                )}
                            >
                                <Sparkles className={cn(
                                    "w-4 h-4 transition-all duration-300 text-purple-400/50 group-hover/btn:text-purple-400",
                                    selectedLegendary && "scale-110 -rotate-6 text-purple-400 opacity-100"
                                )} />
                                {selectedLegendary ? getSelectedLegendaryName() : "Légendaire"}
                                {selectedLegendary && (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        className="ml-1 rounded-full hover:bg-purple-400/20 p-0.5 transition-colors cursor-pointer"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            setSelectedLegendary(null);
                                        }}
                                        onKeyDown={(e) => e.key === 'Enter' && setSelectedLegendary(null)}
                                        aria-label="Supprimer le filtre légendaire"
                                    >
                                        <X className="w-3.5 h-3.5 text-purple-400/60 hover:text-purple-400" />
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0 glass-premium border-white/10 shadow-xl" align="end">
                            <Command className="bg-transparent">
                                <CommandInput placeholder="Chercher un objet..." className="h-11 border-none bg-transparent" />
                                <CommandList className="max-h-[300px]">
                                    <CommandEmpty>Aucun objet trouvé.</CommandEmpty>
                                    <CommandGroup heading="Objets Légendaires" className="text-zinc-500 font-black uppercase text-caption tracking-widest p-2">
                                        <div className="grid grid-cols-2 gap-2 p-2">
                                            {legendaryItems.map((item) => (
                                                <CommandItem
                                                    key={item.id}
                                                    value={item.name}
                                                    onSelect={() => {
                                                        setSelectedLegendary(selectedLegendary === item.id ? null : item.id);
                                                        setIsOpenLegendary(false);
                                                    }}
                                                    className={cn(
                                                        "flex flex-col items-center justify-center gap-2 p-3 rounded-xl cursor-pointer transition-colors border text-center h-28",
                                                        selectedLegendary === item.id
                                                            ? "bg-purple-500/20 border-purple-500/40  text-white"
                                                            : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10 text-muted-foreground"
                                                    )}
                                                >
                                                    <div className="relative w-10 h-10 flex items-center justify-center bg-black/40 rounded-xl border border-white/10 overflow-hidden shadow-inner shrink-0">
                                                        {item.imageUrl ? (
                                                            <img src={item.imageUrl.startsWith("/") ? item.imageUrl : `/api/proxy-image?url=${encodeURIComponent(item.imageUrl)}`} alt={item.name} width={32} height={32} className="object-contain" />
                                                        ) : (
                                                            <Sparkles className="w-5 h-5 text-purple-500/50" />
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-center px-1">
                                                        <span className="text-caption font-black uppercase leading-tight line-clamp-2 text-center">
                                                            {item.name}
                                                        </span>
                                                        <span className="text-caption text-zinc-500 uppercase mt-1 tracking-widest">
                                                            {item.jobRequired}
                                                        </span>
                                                    </div>
                                                    {selectedLegendary === item.id && (
                                                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center ">
                                                            <Check className="w-2.5 h-2.5 text-white" />
                                                        </div>
                                                    )}
                                                </CommandItem>
                                            ))}
                                        </div>
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                    {/* Legendary Pet Filter Button */}
                    <Button
                        variant="outline"
                        onClick={() => setFilterLegendaryPet(!filterLegendaryPet)}
                        className={cn(
                            "h-11 border-amber-400/10 bg-amber-400/5 hover:bg-amber-400/10 hover:border-amber-400/20 text-muted-foreground gap-2.5 px-4 font-semibold text-caption rounded-xl transition-colors group/btn shrink-0",
                            filterLegendaryPet && "border-amber-400/40 bg-amber-400/20 text-amber-300"
                        )}
                    >
                        <Image
                            src="/assets/icons/croquette.png"
                            alt="Service légendaire familier"
                            width={18}
                            height={18}
                            className={cn(
                                "object-contain transition-colors",
                                filterLegendaryPet
                                    ? "opacity-100"
                                    : "grayscale opacity-50 group-hover/btn:opacity-80 group-hover/btn:grayscale-0"
                            )}
                        />
                        Service Familier ★
                        {filterLegendaryPet && (
                            <span
                                role="button"
                                tabIndex={0}
                                className="ml-1 rounded-full hover:bg-amber-300/20 p-0.5 transition-colors cursor-pointer"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setFilterLegendaryPet(false);
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && setFilterLegendaryPet(false)}
                                aria-label="Supprimer le filtre familier"
                            >
                                <X className="w-3.5 h-3.5 text-amber-300/60 hover:text-amber-300" />
                            </span>
                        )}
                    </Button>

                    {/* Reset Button — High Visibility */}
                    {activeFiltersCount > 0 && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={resetFilters}
                            className="h-11 w-11 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/5 transition-colors"
                            title="Réinitialiser les filtres"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    )}
                </div>
            </div>

            {/* RESULT STATS */}
            <div className="flex items-center justify-between px-1 mb-6">
                <p className="text-sm font-medium text-muted-foreground">
                    <span className="text-foreground">{filteredMembers.length}</span> membre{filteredMembers.length > 1 ? "s" : ""} trouvé{filteredMembers.length > 1 ? "s" : ""}
                </p>
            </div>

            {/* RESULTS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in duration-300">
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
