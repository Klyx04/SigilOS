"use client";

import { useState, useTransition } from "react";
import { MemberCard } from "./member-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { DOFUS_CLASSES, DOFUS_JOBS, JOB_CATEGORIES } from "@/lib/dofus-assets";
import { Search, Filter, X, Briefcase, Swords, Check } from "lucide-react";
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
    const [isOpenClass, setIsOpenClass] = useState(false);
    const [isOpenJob, setIsOpenJob] = useState(false);

    // Filtering Logic
    const filteredMembers = members.filter(m => {
        // 1. Search (Name or Pseudo)
        const nameMatch = (m.pseudoDofus || "").toLowerCase().includes(search.toLowerCase()) ||
            (m.user.name || "").toLowerCase().includes(search.toLowerCase());

        if (!nameMatch) return false;

        // 2. Class Filter (Case insensitive check)
        if (selectedClass) {
            // Check against name "Cra" or id "cra"
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
            // strict check on ID usually, but safe to lowercase
            const hasJob = jobs.some((j: string) => j.toLowerCase() === selectedJob.toLowerCase());
            if (!hasJob) return false;
        }

        return true;
    });

    const resetFilters = () => {
        setSearch("");
        setSelectedClass(null);
        setSelectedJob(null);
    };

    const activeFiltersCount = (selectedClass ? 1 : 0) + (selectedJob ? 1 : 0);

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

            {/* FILTER BAR */}
            <div className="bg-zinc-900/60 border border-white/5 p-2 rounded-xl flex flex-col md:flex-row gap-2 shadow-sm backdrop-blur-sm">

                {/* Search Input */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input
                        placeholder="Rechercher un membre..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 bg-zinc-950/50 border-white/5 hover:border-white/10 focus-visible:ring-primary/20 transition-all h-10"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                        >
                            <X className="w-3.5 h-3.5" />
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
                                    "h-10 border-dashed border-white/20 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 gap-2 px-3",
                                    selectedClass && "border-solid border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"
                                )}
                            >
                                <Swords className="w-4 h-4" />
                                {selectedClass ? getSelectedClassName() : "Classe"}
                                {selectedClass && (
                                    <span
                                        className="ml-1 rounded-full bg-primary/20 p-0.5 hover:bg-primary/30 text-primary"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedClass(null);
                                        }}
                                    >
                                        <X className="w-3 h-3" />
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[340px] p-0" align="end">
                            <Command>
                                <CommandInput placeholder="Chercher une classe..." />
                                <CommandList>
                                    <CommandEmpty>Aucune classe trouvée.</CommandEmpty>
                                    <CommandGroup heading="Classes">
                                        <div className="grid grid-cols-4 gap-1 p-2">
                                            {DOFUS_CLASSES.map((c) => (
                                                <div
                                                    key={c.id}
                                                    className={cn(
                                                        "flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer transition-all gap-1 border",
                                                        selectedClass === c.id
                                                            ? "bg-primary/20 border-primary/50 text-white"
                                                            : "bg-zinc-900/50 border-transparent hover:bg-zinc-800 hover:border-white/10 text-zinc-400 hover:text-zinc-200"
                                                    )}
                                                    onClick={() => {
                                                        setSelectedClass(selectedClass === c.id ? null : c.id);
                                                        setIsOpenClass(false);
                                                    }}
                                                >
                                                    <span className="text-2xl filter drop-shadow-lg">{c.icon}</span>
                                                    <span className="text-[10px] font-medium truncate w-full text-center">{c.name}</span>
                                                </div>
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
                                    "h-10 border-dashed border-white/20 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 gap-2 px-3",
                                    selectedJob && "border-solid border-amber-500/50 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                                )}
                            >
                                <Briefcase className="w-4 h-4" />
                                {selectedJob ? getSelectedJobName() : "Métier (200)"}
                                {selectedJob && (
                                    <span
                                        className="ml-1 rounded-full bg-amber-500/20 p-0.5 hover:bg-amber-500/30 text-amber-500"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedJob(null);
                                        }}
                                    >
                                        <X className="w-3 h-3" />
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[280px] p-0" align="end">
                            <Command>
                                <CommandInput placeholder="Chercher un métier..." />
                                <CommandList>
                                    <CommandEmpty>Aucun métier trouvé.</CommandEmpty>
                                    <CommandGroup>
                                        {Object.entries(DOFUS_JOBS).map(([category, jobs]) => (
                                            <div key={category}>
                                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-zinc-950/30">
                                                    {category}
                                                </div>
                                                {jobs.map(job => (
                                                    <CommandItem
                                                        key={job.id}
                                                        value={job.name}
                                                        onSelect={() => {
                                                            setSelectedJob(selectedJob === job.id ? null : job.id);
                                                            setIsOpenJob(false);
                                                        }}
                                                        className="cursor-pointer"
                                                    >
                                                        <span className="mr-2 text-lg">{job.icon}</span>
                                                        <span>{job.name}</span>
                                                        {selectedJob === job.id && (
                                                            <Check className="ml-auto w-4 h-4 opacity-100" />
                                                        )}
                                                    </CommandItem>
                                                ))}
                                            </div>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                    {/* Reset Button */}
                    {activeFiltersCount > 0 && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={resetFilters}
                            className="h-10 w-10 text-zinc-500 hover:text-red-400 hover:bg-red-400/10"
                            title="Réinitialiser les filtres"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    )}
                </div>
            </div>

            {/* RESULT STATS */}
            <div className="flex items-center justify-between px-1">
                <p className="text-sm text-zinc-500">
                    <span className="font-medium text-zinc-300">{filteredMembers.length}</span> membre{filteredMembers.length > 1 ? "s" : ""} trouvé{filteredMembers.length > 1 ? "s" : ""}
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
                <div className="text-center py-20 border border-dashed border-white/5 rounded-xl bg-zinc-900/20">
                    <Filter className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-zinc-400">Aucun résultat</h3>
                    <p className="text-zinc-600 max-w-sm mx-auto mt-2">
                        Essayez de modifier vos filtres ou votre recherche pour trouver ce que vous cherchez.
                    </p>
                    <Button variant="outline" onClick={resetFilters} className="mt-6 border-white/5 bg-zinc-800/50">
                        Tout effacer
                    </Button>
                </div>
            )}
        </div>
    );
}
