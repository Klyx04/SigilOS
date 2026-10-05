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
import { Search, Filter, X } from "lucide-react";
import { ALIGNMENTS, ORDERS } from "@/lib/dofus-assets";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";


/**
 * Deslop de l'annuaire — classes du contrat « registre » (chantier `M-1`, volet `membres`).
 *
 * Baseline mesurée le 02/10/2026 : **16 rayons gonflés** (dont 2 à 16 px, 13 à 12 px),
 * **30 lignes de teinte décorative** (familles `info` / `warning` / `success`), **3 fonds noirs
 * translucides** et **1 animation** d'entrée. La couche registre demande l'inverse : rayons
 * serrés 3/4/6, ni verre ni remplissage coloré décoratif, **l'accent (vert) marque l'état
 * actif**, et le reste reste neutre.
 *
 * Une seule source pour les cinq filtres : la dérive visuelle entre filtres devient
 * mécaniquement impossible, et une garde de test interdit le retour des classes d'origine.
 */
const FILTER_TRIGGER =
    "h-11 border border-border bg-surface hover:border-border-strong text-muted-foreground gap-2.5 px-4 font-semibold text-caption rounded-md transition-colors group/btn";
const FILTER_TRIGGER_ACTIVE = "border-border-strong bg-elevated text-foreground";
const FILTER_ICON = "w-4 h-4 object-contain opacity-70 group-hover/btn:opacity-100 transition-opacity";
const FILTER_ICON_ACTIVE = "opacity-100";
const FILTER_CLEAR = "ml-1 rounded-sm hover:bg-elevated p-0.5 transition-colors cursor-pointer";
const FILTER_CLEAR_ICON = "w-3.5 h-3.5 text-muted-foreground hover:text-foreground";
/** Carte de choix (classe, métier, objet) : rayon serré, actif neutre surélevé. */
const PICKER_ITEM =
    "flex flex-col items-center justify-center gap-1.5 p-3 rounded-md cursor-pointer transition-colors border h-auto";
const PICKER_ITEM_IDLE =
    "bg-surface border-border hover:border-border-strong text-muted-foreground hover:text-foreground aria-selected:bg-surface aria-selected:text-foreground!";
const PICKER_ITEM_ACTIVE =
    "bg-elevated border-border-strong text-foreground aria-selected:bg-elevated aria-selected:text-foreground!";
/** Bouton de choix large (faction, ordre) : neutre, l'actif se lit au bord éclairci. */
const PICKER_TILE = "relative flex flex-col items-center justify-center gap-2 p-3 rounded-md border transition-colors";

/**
 * Icône de filtre : **asset Dofus réel** (`public/assets/dofus/game-icons/`), jamais un glyphe
 * générique ni un emoji — même convention que `public-header.tsx` (« l'asset qui identifie
 * l'entrée en jeu »). Décorative : `alt=""` + `aria-hidden`, le sens est porté par le libellé.
 */
function GameIcon({ src, className }: { src: string; className?: string }) {
    return (
        <Image
            src={`/assets/dofus/game-icons/${src}`}
            alt=""
            aria-hidden="true"
            width={16}
            height={16}
            className={cn("object-contain", className)}
        />
    );
}

interface MemberDirectoryProps {
    initialMembers: any[];
    legendaryItems: any[];
    guildId: string;
    /**
     * Mode **lecture seule** (page publique `/demo`) : les cartes ne sont plus des liens vers
     * `/dashboard/<guildId>/members/<pseudo>` — un anonyme tomberait sur un mur de connexion.
     * Défaut `false` : les usages existants (dashboard, administration) sont inchangés.
     */
    readOnly?: boolean;
}

export function MemberDirectory({ initialMembers, legendaryItems, guildId, readOnly = false }: MemberDirectoryProps) {
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
            <div className="mb-8 border-b border-border pb-4" data-tour="annuaire-grid">
                <p className="reg-eyebrow flex items-center gap-2">
                    <GameIcon src="party.png" className="w-3.5 h-3.5" />
                    Effectif
                </p>
                <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground">Effectif de guilde</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    {members.length} membre{members.length > 1 ? "s" : ""} — recherchez par pseudo, classe, métier ou alignement.
                </p>
            </div>


            {/* BARRE DE FILTRES — registre : séparateurs et bordures, pas de bento */}
            <div className="relative p-2.5 rounded-md flex flex-col md:flex-row gap-3 bg-surface border border-border mb-6" data-tour="annuaire-filters">

                {/* Recherche */}
                <div className="relative flex-1 group/search" data-tour="annuaire-search">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within/search:text-foreground" />
                    <Input
                        placeholder="Rechercher par pseudo, alt, discord..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-11 bg-surface border border-border hover:border-border-strong focus-visible:border-border-strong transition-colors h-11 rounded-md text-sm font-medium placeholder:text-muted-foreground"
                    />
                    {/* Inner Focus Glint */}
                    <div className="absolute inset-px rounded-[inherit] border border-border pointer-events-none" />

                    {search && (
                        <button
                            onClick={() => setSearch("")}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                                className={cn(FILTER_TRIGGER, selectedClass && FILTER_TRIGGER_ACTIVE)}
                            >
                                <GameIcon src="crossed-swords.png" className={cn(FILTER_ICON, selectedClass && FILTER_ICON_ACTIVE)} />
                                {selectedClass ? <span className="truncate min-w-0 max-w-[160px]">{getSelectedClassName()}</span> : "Classe"}
                                {selectedClass && (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        className={FILTER_CLEAR}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            setSelectedClass(null);
                                        }}
                                        onKeyDown={(e) => e.key === 'Enter' && setSelectedClass(null)}
                                        aria-label="Supprimer le filtre classe"
                                    >
                                        <X className={FILTER_CLEAR_ICON} />
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[340px] max-w-[calc(100vw-2rem)] p-0 bg-surface border-border" align="end">
                            <Command className="bg-transparent">
                                <CommandInput placeholder="Chercher une classe..." className="h-11 border-none bg-transparent" />
                                <CommandList className="max-h-[400px]">
                                    <CommandEmpty>Aucune classe trouvée.</CommandEmpty>
                                    <CommandGroup heading="Classes" className="text-muted-foreground font-black uppercase text-caption tracking-widest p-2">
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
                                                        PICKER_ITEM,
                                                        selectedClass === c.id ? PICKER_ITEM_ACTIVE : PICKER_ITEM_IDLE
                                                    )}
                                                >
                                                    <ClassIcon classId={c.id} size={36} className="filter" />
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
                                className={cn(FILTER_TRIGGER, selectedJob && FILTER_TRIGGER_ACTIVE)}
                            >
                                <GameIcon src="hammer.png" className={cn(FILTER_ICON, selectedJob && FILTER_ICON_ACTIVE)} />
                                {selectedJob ? <span className="truncate min-w-0 max-w-[160px]">{getSelectedJobName()}</span> : "Métier (200)"}
                                {selectedJob && (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        className={FILTER_CLEAR}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            setSelectedJob(null);
                                        }}
                                        onKeyDown={(e) => e.key === 'Enter' && setSelectedJob(null)}
                                        aria-label="Supprimer le filtre métier"
                                    >
                                        <X className={FILTER_CLEAR_ICON} />
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[340px] max-w-[calc(100vw-2rem)] p-0 bg-surface border-border" align="end">
                            <Command className="bg-transparent">
                                <CommandInput placeholder="Chercher un métier..." className="h-11 border-none bg-transparent" />
                                <CommandList className="max-h-[400px]">
                                    <CommandEmpty>Aucun métier trouvé.</CommandEmpty>
                                    <CommandGroup className="p-0">
                                        {Object.entries(DOFUS_JOBS).map(([category, jobs]) => (
                                            <div key={category} className="mb-2">
                                                <div className="px-4 py-2 text-caption font-black text-muted-foreground bg-surface border-y border-border sticky top-0 z-10 uppercase tracking-widest">
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
                                                                PICKER_ITEM,
                                                                selectedJob === job.id ? PICKER_ITEM_ACTIVE : PICKER_ITEM_IDLE
                                                            )}
                                                        >
                                                            <div className="relative w-9 h-9 flex items-center justify-center filter">
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
                                className={cn(FILTER_TRIGGER, selectedAlignment && FILTER_TRIGGER_ACTIVE)}
                            >
                                <GameIcon src="shield.png" className={cn(FILTER_ICON, selectedAlignment && FILTER_ICON_ACTIVE)} />
                                <span className="truncate min-w-0 max-w-[160px]">
                                    {selectedAlignment ? (ALIGNMENTS as any).find((a: any) => a.id === selectedAlignment)?.name || selectedAlignment : "Alignement"}
                                </span>
                                {selectedAlignment && (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        className={FILTER_CLEAR}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            setSelectedAlignment(null);
                                            setSelectedOrder(null);
                                        }}
                                        onKeyDown={(e) => e.key === 'Enter' && (setSelectedAlignment(null), setSelectedOrder(null))}
                                        aria-label="Supprimer le filtre alignement"
                                    >
                                        <X className={FILTER_CLEAR_ICON} />
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[320px] max-w-[calc(100vw-2rem)] p-4 bg-surface border-border" align="end">
                            <div className="space-y-3">
                                <h4 className="text-caption font-black uppercase text-muted-foreground tracking-[0.2em] mb-2 flex items-center gap-2">
                                    <GameIcon src="shield.png" className="w-3 h-3" /> Factions
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
                                                    PICKER_TILE,
                                                    isSelected
                                                        ? "border-accent/60 bg-elevated"
                                                        : "border-border bg-surface hover:border-border-strong"
                                                )}
                                            >
                                                <div className="relative w-10 h-10 rounded-full overflow-hidden border border-border">
                                                    <Image
                                                        src={a.icon}
                                                        alt={a.name}
                                                        fill
                                                        className="object-cover scale-[1.35]"
                                                    />
                                                </div>
                                                <span className={cn(
                                                    "text-caption font-semibold truncate w-full text-center px-1 min-w-0",
                                                    isSelected ? "text-accent" : "text-muted-foreground"
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
                                    className={cn(FILTER_TRIGGER, selectedOrder && FILTER_TRIGGER_ACTIVE)}
                                >
                                    <GameIcon src="crown.png" className={cn(FILTER_ICON, selectedOrder && FILTER_ICON_ACTIVE)} />
                                    <span className="truncate min-w-0 max-w-[200px]">
                                    {selectedOrder ? (ORDERS as any)[selectedAlignment].find((o: any) => o.id === selectedOrder)?.name || "Ordre" : "Ordre"}
                                </span>
                                    {selectedOrder && (
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            className={FILTER_CLEAR}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                setSelectedOrder(null);
                                            }}
                                            onKeyDown={(e) => e.key === 'Enter' && setSelectedOrder(null)}
                                            aria-label="Supprimer le filtre ordre"
                                        >
                                            <X className={FILTER_CLEAR_ICON} />
                                        </span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[360px] max-w-[calc(100vw-2rem)] p-4 bg-surface border-border" align="end">
                                <div className="space-y-3">
                                    <h4 className="text-caption font-black uppercase text-muted-foreground tracking-[0.2em] mb-2 flex items-center gap-2">
                                        <GameIcon src="crown.png" className="w-3 h-3" /> Ordres ({selectedAlignment})
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
                                                        PICKER_TILE,
                                                        "text-center h-24",
                                                        isSelected
                                                            ? "border-accent/60 bg-elevated"
                                                            : "border-border bg-surface hover:border-border-strong"
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
                                                        "text-caption font-black uppercase leading-tight line-clamp-2 px-1 w-full min-w-0 break-words",
                                                        isSelected ? "text-accent" : "text-muted-foreground"
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
                                className={cn(FILTER_TRIGGER, selectedLegendary && FILTER_TRIGGER_ACTIVE)}
                            >
                                <GameIcon src="chest.png" className={cn(FILTER_ICON, selectedLegendary && FILTER_ICON_ACTIVE)} />
                                {selectedLegendary ? <span className="truncate min-w-0 max-w-[160px]">{getSelectedLegendaryName()}</span> : "Légendaire"}
                                {selectedLegendary && (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        className={FILTER_CLEAR}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            setSelectedLegendary(null);
                                        }}
                                        onKeyDown={(e) => e.key === 'Enter' && setSelectedLegendary(null)}
                                        aria-label="Supprimer le filtre légendaire"
                                    >
                                        <X className={FILTER_CLEAR_ICON} />
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] max-w-[calc(100vw-2rem)] p-0 bg-surface border-border" align="end">
                            <Command className="bg-transparent">
                                <CommandInput placeholder="Chercher un objet..." className="h-11 border-none bg-transparent" />
                                <CommandList className="max-h-[300px]">
                                    <CommandEmpty>Aucun objet trouvé.</CommandEmpty>
                                    <CommandGroup heading="Objets Légendaires" className="text-muted-foreground font-black uppercase text-caption tracking-widest p-2">
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
                                                        PICKER_ITEM,
                                                        "text-center h-28",
                                                        selectedLegendary === item.id ? PICKER_ITEM_ACTIVE : PICKER_ITEM_IDLE
                                                    )}
                                                >
                                                    <div className="relative w-10 h-10 flex items-center justify-center bg-elevated rounded-md border border-border overflow-hidden shrink-0">
                                                        {item.imageUrl ? (
                                                            <img src={item.imageUrl.startsWith("/") ? item.imageUrl : `/api/proxy-image?url=${encodeURIComponent(item.imageUrl)}`} alt={item.name} width={32} height={32} className="object-contain" />
                                                        ) : (
                                                            <GameIcon src="chest.png" className="w-5 h-5 opacity-60" />
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-center px-1">
                                                        <span className="text-caption font-black uppercase leading-tight line-clamp-2 text-center">
                                                            {item.name}
                                                        </span>
                                                        <span className="text-caption text-muted-foreground uppercase mt-1 tracking-widest">
                                                            {item.jobRequired}
                                                        </span>
                                                    </div>
                                                    {selectedLegendary === item.id && (
                                                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                                                            <Image src="/assets/dofus/game-icons/tick.png" alt="" aria-hidden="true" width={10} height={10} className="w-2.5 h-2.5 object-contain" />
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
                        className={cn(FILTER_TRIGGER, "shrink-0", filterLegendaryPet && FILTER_TRIGGER_ACTIVE)}
                    >
                        <Image
                            src="/assets/icons/croquette.png"
                            alt=""
                            aria-hidden="true"
                            width={18}
                            height={18}
                            className={cn(
                                "object-contain",
                                filterLegendaryPet
                                    ? "opacity-100"
                                    : "grayscale opacity-50 group-hover/btn:opacity-80 group-hover/btn:grayscale-0"
                            )}
                        />
                        Service Familier
                        {filterLegendaryPet && (
                            <span
                                role="button"
                                tabIndex={0}
                                className={FILTER_CLEAR}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setFilterLegendaryPet(false);
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && setFilterLegendaryPet(false)}
                                aria-label="Supprimer le filtre familier"
                            >
                                <X className={FILTER_CLEAR_ICON} />
                            </span>
                        )}
                    </Button>

                    {/* Reset Button — High Visibility */}
                    {activeFiltersCount > 0 && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={resetFilters}
                            className="h-11 w-11 text-muted-foreground hover:text-foreground hover:bg-elevated rounded-md transition-colors"
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
                    <span className="reg-mono text-foreground">{filteredMembers.length}</span> membre{filteredMembers.length > 1 ? "s" : ""} trouvé{filteredMembers.length > 1 ? "s" : ""}
                </p>
            </div>

            {/* RESULTS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredMembers.map(member => (
                    <MemberCard key={member.id} profile={member} guildId={guildId} readOnly={readOnly} />
                ))}
            </div>

            {/* EMPTY STATE */}
            {filteredMembers.length === 0 && (
                <div className="py-12">
                    <EmptyState
                        icon={Filter}
                        title="Aucun membre trouvé"
                        description="Essayez de modifier vos filtres ou votre recherche pour trouver un compagnon de guilde."
                        variant="minimal"
                        className="rounded-lg"
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
