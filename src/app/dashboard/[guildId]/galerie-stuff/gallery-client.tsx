"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Check, Search, ShieldCheck, ExternalLink, ChevronDown, Loader2, RefreshCw, ChevronRight, Copy, Star, Sword, Sparkles, Info, Mars, Venus, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DofusbookPreview } from "@/components/dofus/dofusbook-preview";
import type { DofusbookPreviewData } from "@/lib/dofusbook-utils";
import { DO_TAGS } from "@/lib/dofus-tags";
import { DOFUS_CLASSES } from "@/lib/dofus-assets";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getStuffGalleryPage, getSkinGalleryPage, refreshBuildMetadata, toggleSkinVote, type GalleryBuild, type GallerySkin } from "@/server/actions/gallery-actions";
import { toggleBuildVote } from "@/server/actions/vote-actions";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import NextImage from "next/image";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { shareGalleryItemOnDiscord } from "@/server/actions/gallery-actions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ClassFilter, GenderFilter, AdvancedTagFilter, getNumericClassId } from "@/components/gallery/gallery-filters";

interface GalleryClientProps {
    initialBuilds: GalleryBuild[];
    initialTotal: number;
    initialHasMore: boolean;
    initialStuffShareConfigured: boolean;
    initialSkinTotal: number;
    guildId: string;
    currentProfileId?: string;
}

export function GalleryClient({ 
    initialBuilds, 
    initialTotal, 
    initialHasMore, 
    initialStuffShareConfigured,
    initialSkinTotal,
    guildId,
    currentProfileId
}: GalleryClientProps) {
    // Current Gallery State
    const [activeTab, setActiveTab] = useState<"STUFF" | "SKIN">("STUFF");
    
    // Stuff Tab State
    const [stuffBuilds, setStuffBuilds] = useState<GalleryBuild[]>(initialBuilds);
    const [stuffTotal, setStuffTotal] = useState(initialTotal);
    const [stuffHasMore, setStuffHasMore] = useState(initialHasMore);
    const [stuffShareConfigured, setStuffShareConfigured] = useState(initialStuffShareConfigured);
    const [stuffPage, setStuffPage] = useState(1);
    
    // Skin Tab State
    const [skinBuilds, setSkinBuilds] = useState<GallerySkin[]>([]);
    const [skinTotal, setSkinTotal] = useState(initialSkinTotal);
    const [skinHasMore, setSkinHasMore] = useState(false);
    const [skinShareConfigured, setSkinShareConfigured] = useState(false);
    const [skinPage, setSkinPage] = useState(1);
    
    // Global Filter State
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedElement, setSelectedElement] = useState<string | null>(null);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const [selectedGender, setSelectedGender] = useState<string | null>(null);
    const [selectedSource, setSelectedSource] = useState<"dofusbook" | null>(null);
    const [sortBy, setSortBy] = useState<"newest" | "votes">("newest");
    
    const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
    const [votingIds, setVotingIds] = useState<Set<string>>(new Set());
    const [sharingIds, setSharingIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [selectedSkin, setSelectedSkin] = useState<GallerySkin | null>(null);

    // Tags actifs combinés : élément (sélection unique) + tags avancés (multi-sélection).
    const activeTags = useMemo(
        () => (selectedElement ? [selectedElement, ...selectedTags] : selectedTags),
        [selectedElement, selectedTags]
    );
    // Nombre de filtres actifs (pour le compteur de réinitialisation).
    const activeFilterCount =
        (searchQuery ? 1 : 0) +
        (selectedElement ? 1 : 0) +
        selectedTags.length +
        (selectedClass ? 1 : 0) +
        (selectedGender ? 1 : 0) +
        (selectedSource ? 1 : 0);

    // Debounced search - triggers server-side re-fetch after 300ms
    const debouncedSearch = useDebounce(searchQuery, 300);
    // Evite un refetch redondant au montage : la page 1 est deja rendue par le serveur.
    const didMountRef = useRef(false);

    // Reset and re-fetch from page 1 when filters change
    const applyFilters = useCallback((
        query: string,
        tags: string[],
        classId: string | null,
        gender: string | null,
        sortKey: "newest" | "votes",
        tab: "STUFF" | "SKIN",
        source: "dofusbook" | null
    ) => {
        const runFilters = async () => {
            setIsLoading(true);
            setLoadError(null);
            try {
                if (tab === "STUFF") {
                    const res = await getStuffGalleryPage(guildId, 1, query || undefined, tags.length > 0 ? tags : undefined, classId || undefined, sortKey, source || undefined);
                    if (res.success && res.data) {
                        setStuffBuilds(res.data.builds);
                        setStuffTotal(res.data.total);
                        setStuffHasMore(res.data.hasMore);
                        setStuffShareConfigured(res.data.isDiscordShareConfigured);
                        setStuffPage(1);
                    } else {
                        setLoadError(res.error || "Erreur lors du chargement de la galerie");
                    }
                } else {
                    const res = await getSkinGalleryPage(guildId, 1, query || undefined, classId || undefined, gender || undefined, sortKey);
                    if (res.success && res.data) {
                        setSkinBuilds(res.data.skins);
                        setSkinTotal(res.data.total);
                        setSkinHasMore(res.data.hasMore);
                        setSkinShareConfigured(res.data.isDiscordShareConfigured);
                        setSkinPage(1);
                    } else {
                        setLoadError(res.error || "Erreur lors du chargement de la galerie");
                    }
                }
            } catch {
                setLoadError("Erreur réseau : les builds n'ont pas pu être récupérés.");
            } finally {
                setIsLoading(false);
            }
        };
        runFilters();
    }, [guildId]);

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
    };

    // Use debounced search to trigger filtering
    useEffect(() => {
        if (!didMountRef.current) {
            didMountRef.current = true;
            return;
        }
        if (debouncedSearch !== undefined) {
            applyFilters(debouncedSearch, activeTags, selectedClass, selectedGender, sortBy, activeTab, selectedSource);
        }
    }, [debouncedSearch, activeTags, selectedClass, selectedGender, sortBy, activeTab, selectedSource, applyFilters]);

    const handleElementChange = (element: string | null) => {
        setSelectedElement(element);
        applyFilters(searchQuery, element ? [element, ...selectedTags] : selectedTags, selectedClass, selectedGender, sortBy, activeTab, selectedSource);
    };

    const handleToggleAdvancedTag = (tagId: string) => {
        const nextTags = selectedTags.includes(tagId)
            ? selectedTags.filter(t => t !== tagId)
            : [...selectedTags, tagId];
        setSelectedTags(nextTags);
        applyFilters(searchQuery, selectedElement ? [selectedElement, ...nextTags] : nextTags, selectedClass, selectedGender, sortBy, activeTab, selectedSource);
    };

    const handleClassChange = (classId: string | number | null) => {
        const idStr = classId !== null ? String(classId) : null;
        setSelectedClass(idStr);
        applyFilters(searchQuery, activeTags, idStr, selectedGender, sortBy, activeTab, selectedSource);
    };

    const handleGenderChange = (gender: string | null) => {
        setSelectedGender(gender);
        applyFilters(searchQuery, activeTags, selectedClass, gender, sortBy, activeTab, selectedSource);
    };

    const handleSourceChange = (source: "dofusbook" | null) => {
        setSelectedSource(source);
        applyFilters(searchQuery, activeTags, selectedClass, selectedGender, sortBy, activeTab, source);
    };
    
    const handleSortChange = (newSort: "newest" | "votes") => {
        setSortBy(newSort);
        applyFilters(searchQuery, activeTags, selectedClass, selectedGender, newSort, activeTab, selectedSource);
    };

    const handleTabChange = (newTab: "STUFF" | "SKIN") => {
        setActiveTab(newTab);
        // Reseting filters when changing tab to avoid confusing state
        setSelectedElement(null);
        setSelectedTags([]);
        setSelectedClass(null);
        setSelectedGender(null);
        setSelectedSource(null);
        applyFilters(searchQuery, [], null, null, sortBy, newTab, null);
    };

    const handleResetFilters = () => {
        setSearchQuery("");
        setSelectedElement(null);
        setSelectedTags([]);
        setSelectedClass(null);
        setSelectedGender(null);
        setSelectedSource(null);
        applyFilters("", [], null, null, sortBy, activeTab, null);
    };

    // Infinite scroll: load next page
    const loadMore = () => {
        const runLoadMore = async () => {
            setIsLoading(true);
            setLoadError(null);
            try {
                if (activeTab === "STUFF") {
                    const nextPage = stuffPage + 1;
                    const res = await getStuffGalleryPage(
                        guildId, 
                        nextPage, 
                        searchQuery || undefined, 
                        activeTags.length > 0 ? activeTags : undefined,
                        selectedClass || undefined,
                        sortBy,
                        selectedSource || undefined
                    );
                    if (res.success && res.data) {
                        setStuffBuilds(prev => [...prev, ...res.data!.builds]);
                        setStuffHasMore(res.data.hasMore);
                        setStuffPage(nextPage);
                    } else {
                        setLoadError(res.error || "Erreur lors du chargement des builds suivants");
                    }
                } else {
                    const nextPage = skinPage + 1;
                    const res = await getSkinGalleryPage(
                        guildId,
                        nextPage,
                        searchQuery || undefined,
                        selectedClass || undefined,
                        selectedGender || undefined,
                        sortBy
                    );
                    if (res.success && res.data) {
                        setSkinBuilds(prev => [...prev, ...res.data!.skins]);
                        setSkinHasMore(res.data.hasMore);
                        setSkinPage(nextPage);
                    } else {
                        setLoadError(res.error || "Erreur lors du chargement des skins suivants");
                    }
                }
            } catch {
                setLoadError("Erreur réseau lors du chargement de la suite.");
            } finally {
                setIsLoading(false);
            }
        };
        runLoadMore();
    };

    const handleRefresh = async (build: GalleryBuild) => {
        if (refreshingIds.has(build.id)) return;
        
        setRefreshingIds(prev => new Set(prev).add(build.id));
        toast.info(`Rafraîchissement de "${build.name}"...`);

        try {
            const res = await refreshBuildMetadata(guildId, build.author.id, build.url);
            if (res.success) {
                toast.success("Build mis à jour !");
                applyFilters(searchQuery, activeTags, selectedClass, selectedGender, sortBy, activeTab, selectedSource);
            } else {
                toast.error(res.error || "Échec du rafraîchissement");
            }
        } catch (e) {
            toast.error("Erreur serveur");
        } finally {
            setRefreshingIds(prev => {
                const next = new Set(prev);
                next.delete(build.id);
                return next;
            });
        }
    };

    const handleVoteStuff = async (build: GalleryBuild) => {
        if (votingIds.has(build.id)) return;
        setVotingIds(prev => new Set(prev).add(build.id));

        const originalVoted = build.hasVoted;
        const offset = originalVoted ? -1 : 1;
        
        setStuffBuilds(current => current.map(b =>
            b.id === build.id
                ? { ...b, hasVoted: !originalVoted, votesCount: Math.max(0, b.votesCount + offset) }
                : b
        ));

        try {
            const res = await toggleBuildVote(guildId, build.id);
            if (!res.success) throw new Error(res.error);
        } catch (error) {
            setStuffBuilds(current => current.map(b =>
                b.id === build.id
                    ? { ...b, hasVoted: originalVoted, votesCount: build.votesCount }
                    : b
            ));
            toast.error("Erreur lors du vote");
        } finally {
            setVotingIds(prev => {
                const next = new Set(prev);
                next.delete(build.id);
                return next;
            });
        }
    };

    const handleVoteSkin = async (skin: GallerySkin) => {
        if (votingIds.has(skin.id)) return;
        setVotingIds(prev => new Set(prev).add(skin.id));

        const originalVoted = skin.hasVoted;
        const offset = originalVoted ? -1 : 1;
        
        setSkinBuilds(current => current.map(s =>
            s.id === skin.id
                ? { ...s, hasVoted: !originalVoted, votesCount: Math.max(0, s.votesCount + offset) }
                : s
        ));

        try {
            const res = await toggleSkinVote(guildId, skin.id);
            if (!res.success) throw new Error(res.error);
        } catch (error: any) {
            setSkinBuilds(current => current.map(s =>
                s.id === skin.id
                    ? { ...s, hasVoted: originalVoted, votesCount: skin.votesCount }
                    : s
            ));
            toast.error(error.message || "Erreur lors du vote");
        } finally {
            setVotingIds(prev => {
                const next = new Set(prev);
                next.delete(skin.id);
                return next;
            });
        }
    };

    const handleShare = async (id: string, type: "STUFF" | "SKIN", authorId?: string) => {
        if (sharingIds.has(id)) return;
        setSharingIds(prev => new Set(prev).add(id));
        
        try {
            const res = await shareGalleryItemOnDiscord(guildId, id, type, authorId);
            if (res.success) {
                toast.success("Partagé sur Discord ! 🚀");
            } else {
                toast.error(res.error || "Erreur lors du partage");
            }
        } catch (e) {
            toast.error("Erreur serveur lors du partage");
        } finally {
            setSharingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const handleCopyLink = (url: string) => {
        navigator.clipboard.writeText(url);
        toast.success("Lien copié dans le presse-papier ! 📋");
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Hero Header avec fond immersif subtil et accents SigilOS */}
            <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-b from-surface/80 via-surface/40 to-background/90 p-6 lg:p-8 shadow-xl backdrop-blur-xl">
                {/* Background Artwork Layer */}
                <div 
                    className="absolute inset-0 bg-cover bg-center opacity-10 pointer-events-none mix-blend-luminosity scale-105"
                    style={{ backgroundImage: "url('/assets/dofus/gallery-hero-bg.png')" }}
                />
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-success/15 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-sky-500/10 rounded-full blur-[100px] pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface/90 border border-success/30 text-success text-xs font-semibold shrink-0 w-fit shadow-sm shadow-success/10">
                                <ShieldCheck className="w-3.5 h-3.5 text-success" />
                                <span>Galerie Certifiée SigilOS</span>
                            </div>
                            
                            <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as any)} className="w-full sm:w-auto">
                                <TabsList className="bg-background/80 border border-border/80 h-11 p-1 rounded-2xl shadow-inner backdrop-blur-md">
                                    <TabsTrigger 
                                        value="STUFF" 
                                        className="rounded-xl px-5 h-full text-xs font-bold gap-2 data-[state=active]:bg-success data-[state=active]:text-success-foreground data-[state=active]:shadow-md transition-all duration-200"
                                    >
                                        <Sword className={cn("w-4 h-4 transition-transform", activeTab === "STUFF" ? "scale-110" : "opacity-50")} />
                                        Équipements
                                        <span className={cn(
                                            "tabular-nums text-[11px] px-1.5 py-0.5 rounded-md font-extrabold ml-1",
                                            activeTab === "STUFF" ? "bg-black/20 text-success-foreground" : "bg-surface text-muted-foreground"
                                        )}>
                                            {stuffTotal}
                                        </span>
                                    </TabsTrigger>
                                    <TabsTrigger 
                                        value="SKIN" 
                                        className="rounded-xl px-5 h-full text-xs font-bold gap-2 data-[state=active]:bg-sky-500 data-[state=active]:text-foreground data-[state=active]:shadow-md transition-all duration-200"
                                    >
                                        <Sparkles className={cn("w-4 h-4 transition-transform", activeTab === "SKIN" ? "scale-110" : "opacity-50")} />
                                        Skins & Looks
                                        <span className={cn(
                                            "tabular-nums text-[11px] px-1.5 py-0.5 rounded-md font-extrabold ml-1",
                                            activeTab === "SKIN" ? "bg-black/20 text-foreground" : "bg-surface text-muted-foreground"
                                        )}>
                                            {skinTotal}
                                        </span>
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        <div>
                            <h1 className="text-2xl lg:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
                                Galerie <span className={cn("transition-colors duration-200 bg-clip-text text-transparent bg-gradient-to-r", activeTab === "STUFF" ? "from-success to-emerald-300" : "from-sky-400 to-cyan-300")}>
                                    {activeTab === "STUFF" ? "Équipements" : "Apparences"}
                                </span>
                            </h1>
                            <p className="text-muted-foreground max-w-xl text-xs lg:text-sm leading-relaxed mt-1">
                                {activeTab === "STUFF" 
                                    ? "Découvrez les meilleurs builds optimisés partagés par les membres de la guilde pour vos raids, songes et PvM."
                                    : "L'élégance à l'état pur. Explorez les plus beaux looks, codes couleurs et cosmétiques de la communauté."}
                            </p>
                        </div>
                    </div>

                    {/* Search bar */}
                    <div className="relative group w-full lg:w-96" data-tour="galerie-search">
                        <Search className={cn(
                            "absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors",
                            activeTab === "STUFF" ? "group-focus-within:text-success" : "group-focus-within:text-sky-400"
                        )} />
                        <Input
                            placeholder={activeTab === "STUFF" ? "Rechercher un build, un pseudo..." : "Rechercher un skin, un auteur..."}
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="bg-surface/90 border-border/80 pl-11 h-12 rounded-2xl focus:ring-2 focus:ring-success/20 focus:border-success/60 transition-all text-sm text-foreground placeholder:text-muted-foreground shadow-sm"
                        />
                        {isLoading && (
                            <Loader2 className={cn(
                                "absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin",
                                activeTab === "STUFF" ? "text-success" : "text-sky-500"
                            )} />
                        )}
                    </div>
                </div>
            </div>

            {/* Filter Bar — 3 groupes : Filtres / Tri / Résultats */}
            <div className="sticky top-0 z-30 pt-1">
                <div className="bg-surface/95 backdrop-blur-xl border border-border/80 rounded-2xl px-5 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-lg">
                    {/* Groupe Filtres */}
                    <div className="flex items-center gap-3 flex-wrap min-h-[40px]">
                        <div className="flex items-center gap-2 bg-background/60 p-1 rounded-2xl border border-border/70 shadow-inner" data-tour="galerie-filters">
                            <ClassFilter selectedClass={selectedClass} onSelectClass={handleClassChange} />
                        </div>

                        {activeTab === "SKIN" && (
                            <GenderFilter selectedGender={selectedGender} onSelectGender={handleGenderChange} />
                        )}

                        {activeTab === "STUFF" && (
                            <>
                                <div className="w-px h-6 bg-border/60 shrink-0 hidden sm:block" />

                                {/* Éléments */}
                                <div className="flex items-center gap-1.5 bg-background/60 p-1 rounded-2xl border border-border/70 shadow-inner" aria-label="Filtres par élément">
                                    <button
                                        onClick={() => handleElementChange(null)}
                                        aria-pressed={!selectedElement}
                                        className={cn(
                                            "h-8 px-3.5 rounded-xl text-xs font-bold transition-all shrink-0 shadow-sm",
                                            !selectedElement
                                                ? "bg-surface text-foreground border border-border shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                                                : "text-muted-foreground hover:text-foreground hover:bg-surface/60"
                                        )}
                                    >
                                        Tous
                                    </button>

                                    {["eau","feu","terre","air","multi"].map(id => {
                                        const tag = DO_TAGS.find(t => t.id === id)!;
                                        const active = selectedElement === id;
                                        return (
                                            <button
                                                key={id}
                                                onClick={() => handleElementChange(active ? null : id)}
                                                aria-pressed={active}
                                                className={cn(
                                                    "h-8 px-3 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 shadow-sm",
                                                    active
                                                        ? `${tag.className} ring-2 ring-white/20 shadow-md font-bold`
                                                        : "text-muted-foreground hover:text-foreground hover:bg-surface/80 border border-transparent"
                                                )}
                                            >
                                                {active && <Check className="w-3 h-3 shrink-0" />}
                                                {tag.text}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="w-px h-6 bg-border/60 shrink-0 hidden sm:block" />

                                {/* Tags avancés */}
                                <div className="flex items-center bg-background/60 p-1 rounded-2xl border border-border/70 shadow-inner">
                                    <AdvancedTagFilter selectedTags={selectedTags} onToggleTag={handleToggleAdvancedTag} />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Groupe Tri + Résultats */}
                    <div className="flex items-center gap-4 text-sm w-full lg:w-auto shrink-0 justify-between lg:justify-end border-t border-border/50 pt-3 lg:border-0 lg:pt-0 flex-wrap">
                        {/* Tri */}
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider shrink-0">Trier par</span>
                            <Select value={sortBy} onValueChange={(v) => handleSortChange(v as "newest" | "votes")}>
                                <SelectTrigger size="sm" aria-label="Trier les résultats" className="w-[8.5rem] rounded-xl bg-background/80 border-border/80 text-xs font-semibold shadow-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent align="end" className="bg-background/95 backdrop-blur-xl border-border rounded-xl shadow-xl">
                                    <SelectItem value="newest">
                                        <span className="flex items-center gap-2 font-medium"><RefreshCw className="w-3.5 h-3.5 text-success" /> Récents</span>
                                    </SelectItem>
                                    <SelectItem value="votes">
                                        <span className="flex items-center gap-2 font-medium"><Star className="w-3.5 h-3.5 text-warning fill-warning" /> Favoris</span>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Résultats */}
                        <div className="flex items-center gap-3">
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 tabular-nums">
                                <span className="text-foreground font-bold px-1.5 py-0.5 rounded-md bg-background border border-border/60">{activeTab === "STUFF" ? stuffBuilds.length : skinBuilds.length}</span>
                                <span>{activeTab === "STUFF" ? "builds" : "skins"} sur {activeTab === "STUFF" ? stuffTotal : skinTotal}</span>
                            </p>
                            {/* Espace du bouton Réinitialiser TOUJOURS réservé */}
                            <div className="w-px h-4 bg-border/60 shrink-0" />
                            <button
                                onClick={handleResetFilters}
                                tabIndex={activeFilterCount > 0 ? 0 : -1}
                                aria-hidden={activeFilterCount === 0}
                                className={cn(
                                    "text-xs text-muted-foreground hover:text-foreground transition-colors font-semibold flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-lg hover:bg-surface",
                                    activeFilterCount === 0 && "invisible"
                                )}
                            >
                                <RefreshCw className="w-3 h-3 text-warning" /> Réinitialiser{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div data-tour="galerie-grid" className={cn(
                "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8",
                isLoading && (activeTab === "STUFF" ? stuffBuilds.length > 0 : skinBuilds.length > 0) && "opacity-50 pointer-events-none transition-opacity"
            )}>
                {activeTab === "STUFF" ? (
                    loadError ? (
                        <ErrorState onRetry={() => applyFilters(searchQuery, activeTags, selectedClass, selectedGender, sortBy, "STUFF", selectedSource)} />
                    ) : stuffBuilds.length > 0 ? (
                        stuffBuilds.map((build) => (
                            <div key={build.id} className="group/card flex flex-col gap-3">
                                <div className="relative">
                                    <DofusbookPreview url={build.url} title={build.name} tags={build.tags} classId={build.classId ? Number(build.classId) : undefined} initialData={build.previewData} />
                                    
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent transition-all duration-300 rounded-[2.5rem] flex flex-col justify-end p-4 z-10 pointer-events-none opacity-90 group-hover/card:opacity-100">
                                        <div className="flex items-center justify-end gap-1.5 backdrop-blur-md bg-black/40 p-1.5 rounded-2xl border border-white/10 w-fit ml-auto shadow-lg">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleRefresh(build); }}
                                                disabled={refreshingIds.has(build.id)}
                                                className="p-1.5 bg-white/10 rounded-xl text-foreground hover:bg-white/20 transition-colors pointer-events-auto disabled:opacity-50"
                                                title="Actualiser depuis Dofusbook"
                                                aria-label="Actualiser les données du build"
                                            >
                                                <RefreshCw className={cn("w-3.5 h-3.5", refreshingIds.has(build.id) && "animate-spin")} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleVoteStuff(build); }}
                                                disabled={votingIds.has(build.id)}
                                                className={cn(
                                                    "p-1.5 rounded-xl transition-all pointer-events-auto disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm",
                                                    build.hasVoted 
                                                        ? "bg-warning text-warning-foreground font-black shadow-warning/20 shadow-md" 
                                                        : "bg-white/10 text-muted-foreground hover:text-warning hover:bg-white/20"
                                                )}
                                                title={build.hasVoted ? "Retirer mon vote" : "Voter pour ce stuff !"}
                                                aria-label={build.hasVoted ? "Retirer mon vote pour ce build" : "Voter pour ce build"}
                                            >
                                                <Star className={cn("w-3.5 h-3.5", build.hasVoted && "fill-current")} />
                                                {build.votesCount > 0 && (
                                                    <span className="text-[11px] font-black">{build.votesCount}</span>
                                                )}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigator.clipboard.writeText(build.url);
                                                    toast.success("Lien copié !");
                                                }}
                                                className="p-1.5 bg-white/10 rounded-xl text-foreground hover:bg-white/20 transition-colors pointer-events-auto"
                                                title="Copier le lien"
                                                aria-label="Copier le lien du build"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                            {currentProfileId === build.author.id && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleShare(build.id, "STUFF", build.author.id); }}
                                                    disabled={sharingIds.has(build.id) || !stuffShareConfigured}
                                                    className={cn(
                                                        "p-1.5 rounded-xl transition-all pointer-events-auto disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed shadow-sm flex items-center justify-center",
                                                        "bg-[#5865F2] text-white hover:bg-[#4752C4] hover:shadow-md hover:shadow-[#5865F2]/25"
                                                    )}
                                                    title={stuffShareConfigured ? "Propulser sur Discord !" : "Non configuré (Admin)"}
                                                    aria-label="Partager ce build sur Discord"
                                                >
                                                    {sharingIds.has(build.id) ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                                                        </svg>
                                                    )}
                                                </button>
                                            )}
                                            <a 
                                                href={build.url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="p-1.5 bg-success rounded-xl text-success-foreground hover:bg-success/90 transition-colors pointer-events-auto shadow-sm shadow-success/20"
                                                aria-label="Ouvrir ce build sur Dofusbook"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                                <BuildStatsLine previewData={build.previewData} />
                                <div className="flex items-center justify-between px-3 py-1.5 bg-surface/40 rounded-2xl border border-border/50">
                                    <div className="flex items-center gap-2">
                                        <Avatar className="w-6 h-6 border border-border/80 shadow-xs">
                                            <AvatarImage src={build.author.image || undefined} />
                                            <AvatarFallback className="text-[10px] font-bold bg-surface text-muted-foreground">
                                                {build.author.name.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-xs text-muted-foreground">
                                            Par <span className="text-foreground font-bold">{build.author.name}</span>
                                        </span>
                                        {build.createdAt && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="text-[11px] text-muted-foreground/80 font-semibold ml-0.5 cursor-default">
                                                            · {new Date(build.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="bg-surface border-border text-xs text-foreground">
                                                        <p>Ajouté le {new Date(build.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
                                                        {build.updatedAt && build.updatedAt !== build.createdAt && (
                                                            <p className="text-muted-foreground">Mis à jour le {new Date(build.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
                                                        )}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border bg-success/15 text-success border-success/30 shadow-xs">
                                        DofusBook
                                    </span>
                                </div>
                            </div>
                        ))
                    ) : !isLoading ? (
                        <EmptyState guildId={guildId} tab="STUFF" hasActiveFilters={activeFilterCount > 0} onReset={handleResetFilters} />
                    ) : (
                        <GallerySkeleton />
                    )
                ) : (
                    loadError ? (
                        <ErrorState onRetry={() => applyFilters(searchQuery, activeTags, selectedClass, selectedGender, sortBy, "SKIN", selectedSource)} />
                    ) : skinBuilds.length > 0 ? (
                        skinBuilds.map((skin) => (
                            <div key={skin.id} className="group/card flex flex-col gap-3">
                                <div 
                                    onClick={() => setSelectedSkin(skin)}
                                    className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-border bg-surface group-hover/card:border-sky-500/50 transition-all cursor-pointer"
                                >
                                    {skin.thumbnailUrl ? (
                                        <div className="absolute inset-x-0 top-0 bottom-14 flex items-center justify-center">
                                            <NextImage 
                                                src={skin.thumbnailUrl} 
                                                alt={skin.name} 
                                                fill 
                                                className="object-contain object-[50%_20%] group-hover/card:scale-105 transition-transform duration-300 bg-background/30" 
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-background">
                                            <NextImage src="/assets/ui/logo-v2.png" alt="Sigil" width={64} height={64} className="opacity-10 grayscale" />
                                        </div>
                                    )}

                                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent p-4 flex flex-col justify-end">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-sm font-semibold text-foreground truncate max-w-[150px]">{skin.name}</h3>
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs px-1.5 py-0.5 rounded-md bg-surface text-foreground/70 font-medium">
                                                    {skin.provider}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                {skin.metadata?.class && DOFUS_CLASSES.find(c => getNumericClassId(c) === Number(skin.metadata?.class))?.icon && (
                                                    <div className="w-6 h-6 rounded-lg bg-black/50 border border-border flex items-center justify-center" title={DOFUS_CLASSES.find(c => getNumericClassId(c) === Number(skin.metadata?.class))?.name || skin.metadata.class}>
                                                        <NextImage 
                                                            src={DOFUS_CLASSES.find(c => getNumericClassId(c) === Number(skin.metadata?.class))?.icon || ""} 
                                                            alt="" width={14} height={14} 
                                                        />
                                                    </div>
                                                )}
                                                {skin.metadata?.gender && (
                                                    <div className="w-6 h-6 rounded-lg bg-black/50 border border-border flex items-center justify-center">
                                                        {skin.metadata.gender === "M" ? <Mars className="w-3 h-3 text-info" /> : <Venus className="w-3 h-3 text-pink-400" />}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleVoteSkin(skin); }}
                                                    disabled={votingIds.has(skin.id)}
                                                    className={cn(
                                                        "p-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5",
                                                        skin.hasVoted 
                                                            ? "bg-warning text-warning-foreground" 
                                                            : "bg-elevated/90 text-muted-foreground hover:text-warning hover:bg-muted"
                                                    )}
                                                >
                                                    <Star className={cn("w-3.5 h-3.5", skin.hasVoted && "fill-current")} />
                                                    {skin.votesCount > 0 && (
                                                        <span className="text-xs font-semibold">{skin.votesCount}</span>
                                                    )}
                                                </button>
                                                {currentProfileId === skin.author.id && (
                                                     <button
                                                         onClick={(e) => { e.stopPropagation(); handleShare(skin.id, "SKIN"); }}
                                                         disabled={sharingIds.has(skin.id) || !skinShareConfigured}
                                                         className={cn(
                                                             "p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center",
                                                             "bg-info text-info-foreground hover:bg-info"
                                                         )}
                                                         title={skinShareConfigured ? "Partager sur Discord" : "Non configuré (Admin)"}
                                                     >
                                                         {sharingIds.has(skin.id) ? (
                                                             <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                         ) : (
                                                             <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                                                 <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                                                            </svg>
                                                        )}
                                                    </button>
                                                )}
                                                <a 
                                                    href={skin.url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 bg-elevated/90 border border-border rounded-lg text-foreground hover:bg-muted transition-colors flex items-center justify-center"
                                                    title={`Voir sur ${skin.provider === 'BARBOFUS' ? 'Barbofus' : skin.provider === 'DOFUSSKINMANGA' ? 'SkinManga' : 'Source'}`}
                                                >
                                                    <img 
                                                        src={`https://www.google.com/s2/favicons?domain=${skin.provider === 'BARBOFUS' ? 'barbofus.com' : skin.provider === 'DOFUSSKINMANGA' ? 'dofusskinmanga.com' : 'google.com'}&sz=32`}
                                                        alt="" 
                                                        className="w-3.5 h-3.5 object-contain rounded"
                                                    />
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between px-2">
                                    <div className="flex items-center gap-2.5">
                                        <Avatar className="w-6 h-6 border border-border">
                                            <AvatarImage src={skin.author.image || undefined} />
                                            <AvatarFallback className="text-caption bg-surface text-muted-foreground">
                                                {skin.author.name.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-caption text-muted-foreground">
                                            Par <span className="text-foreground font-bold">{skin.author.name}</span>
                                        </span>
                                    </div>
                                    <span className="text-caption text-muted-foreground font-medium" suppressHydrationWarning>
                                        {new Date(skin.createdAt).toLocaleDateString("fr-FR")}
                                    </span>
                                </div>
                            </div>
                        ))
                    ) : !isLoading ? (
                        <EmptyState guildId={guildId} tab="SKIN" hasActiveFilters={activeFilterCount > 0} onReset={handleResetFilters} />
                    ) : (
                        <GallerySkeleton />
                    )
                )}
            </div>

            {/* Load More button */}
            {((activeTab === "STUFF" && stuffHasMore) || (activeTab === "SKIN" && skinHasMore)) && !isLoading && (
                <div className="flex justify-center mt-12">
                    <Button
                        onClick={loadMore}
                        variant="outline"
                        className={cn(
                            "gap-2 border-border hover:bg-surface transition-all px-12 h-12 rounded-2xl font-black text-xs uppercase tracking-widest",
                            activeTab === "STUFF" ? "hover:border-success/30 hover:text-success" : "hover:border-sky-500/30 hover:text-sky-400"
                        )}
                    >
                        <ChevronDown className="w-4 h-4" />
                        Charger plus {activeTab === "STUFF" ? "de builds" : "de skins"}
                        <span className="text-caption text-muted-foreground ml-1">
                            ({(activeTab === "STUFF" ? stuffTotal - stuffBuilds.length : skinTotal - skinBuilds.length)} restants)
                        </span>
                    </Button>
                </div>
            )}

            {/* Skin Detail Modal */}
            <Dialog open={!!selectedSkin} onOpenChange={(open) => !open && setSelectedSkin(null)}>
                <DialogContent className="bg-background/95 backdrop-blur-2xl border-border text-foreground sm:max-w-xl w-[95vw] h-auto max-h-[90vh] p-0 rounded-[2rem] overflow-hidden shadow-2xl">
                    <DialogTitle className="sr-only">Détails du Look</DialogTitle>
                    <DialogDescription className="sr-only">Aperçu et métadonnées du skin partagé par la guilde.</DialogDescription>
                    {selectedSkin && (
                        <div className="flex flex-col h-full max-h-[90vh]">
                            {/* Visual Header */}
                            <div className="relative aspect-video bg-black/40 flex items-center justify-center shrink-0 border-b border-border">
                                {selectedSkin.thumbnailUrl ? (
                                    <NextImage 
                                        src={selectedSkin.thumbnailUrl} 
                                        alt={selectedSkin.name}
                                        fill
                                        className="object-contain p-6"
                                        unoptimized
                                    />
                                ) : (
                                    <Sparkles className="w-16 h-16 text-foreground" />
                                )}
                                
                                <div className="absolute top-4 left-4 flex flex-col gap-2">
                                    <div className="bg-sky-500/20 backdrop-blur-xl px-3 py-1 rounded-full border border-sky-500/30 w-fit">
                                        <span className="text-caption font-black text-sky-400 tracking-widest uppercase">
                                            {selectedSkin.provider}
                                        </span>
                                    </div>
                                    <div className="bg-background/80 backdrop-blur-xl px-3 py-1 rounded-xl border border-border w-fit shadow-2xl flex items-center gap-2">
                                        <Avatar className="w-4 h-4 border border-border">
                                            <AvatarImage src={selectedSkin.author.image || undefined} />
                                            <AvatarFallback className="text-caption bg-surface">{selectedSkin.author.name.substring(0,2)}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-caption font-black text-muted-foreground tracking-tighter uppercase">
                                            Partagé par <span className="text-foreground">{selectedSkin.author.name}</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
 
                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
                                <div className="p-6 space-y-8">
                                    <div>
                                        <h2 className="text-2xl font-black text-foreground uppercase tracking-tight leading-none">
                                            {selectedSkin.name}
                                        </h2>
                                        <div className="flex flex-wrap items-center gap-3 mt-4">
                                            {selectedSkin.metadata?.class && (
                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-xl shadow-inner">
                                                    <span className="text-caption font-black uppercase tracking-widest">
                                                        {(() => {
                                                            const classData = DOFUS_CLASSES.find(c => getNumericClassId(c) === Number(selectedSkin.metadata!.class));
                                                            return classData ? classData.name : selectedSkin.metadata.class;
                                                        })()}
                                                    </span>
                                                </div>
                                            )}
                                            {selectedSkin.metadata?.gender && (
                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-info/10 text-info border border-info/20 rounded-xl shadow-inner">
                                                     <span className="text-caption font-black uppercase tracking-widest">
                                                        {selectedSkin.metadata.gender === "M" ? "Mâle" : "Femelle"}
                                                    </span>
                                                </div>
                                            )}
                                            {selectedSkin.metadata?.head && (
                                                <div className="flex items-center gap-2 px-1 py-1 pr-3 bg-surface/80 text-foreground border border-border rounded-xl shadow-inner group/head">
                                                    <div className="w-6 h-6 rounded-lg overflow-hidden bg-black/40 border border-border">
                                                        {String(selectedSkin.metadata.head).startsWith('http') ? (
                                                            <NextImage src={selectedSkin.metadata.head} alt="Head" width={24} height={24} className="object-cover group-hover/head:scale-110 transition-transform" unoptimized />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-caption font-bold text-muted-foreground">
                                                                #{selectedSkin.metadata.head}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-caption font-black uppercase tracking-widest opacity-70">
                                                        Visage {String(selectedSkin.metadata.head).startsWith('http') ? "" : selectedSkin.metadata.head}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Colors */}
                                    {selectedSkin.colors && Object.keys(selectedSkin.colors).length > 0 && (
                                        <div className="space-y-4">
                                            <h3 className="text-caption font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                                <div className="w-1 h-1 rounded-full bg-sky-500" />
                                                Harmonie de Couleurs
                                            </h3>
                                            <div className="grid grid-cols-2 gap-2">
                                                {Object.entries(selectedSkin.colors).map(([label, hex]) => (
                                                    <button 
                                                        key={label} 
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(hex as string);
                                                            toast.success(`Couleur ${label} (${hex}) copiée ! 🎨`);
                                                        }}
                                                        className="bg-surface border border-border rounded-xl p-2 flex items-center justify-between gap-3 hover:bg-sky-500/10 hover:border-sky-500/30 transition-all text-left group/color cursor-pointer active:scale-95"
                                                        title="Cliquer pour copier le code hexadécimal"
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div 
                                                                className="w-8 h-8 rounded-lg shadow-inner border border-border shrink-0 transition-transform group-hover/color:scale-105"
                                                                style={{ backgroundColor: hex as string }}
                                                            />
                                                            <div className="min-w-0">
                                                                <p className="text-caption font-bold text-muted-foreground truncate uppercase tracking-tighter group-hover/color:text-sky-300 transition-colors">{label}</p>
                                                                <p className="text-caption font-black text-foreground uppercase font-mono">{hex as string}</p>
                                                            </div>
                                                        </div>
                                                        <div className="p-1.5 rounded-lg bg-surface text-muted-foreground group-hover/color:bg-sky-500/20 group-hover/color:text-sky-400 transition-all shrink-0">
                                                            <Copy className="w-3.5 h-3.5" />
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Equipment */}
                                    {selectedSkin.equipment && Array.isArray(selectedSkin.equipment) && selectedSkin.equipment.length > 0 && (
                                        <div className="space-y-4 pb-4">
                                            <h3 className="text-caption font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                                <div className="w-1 h-1 rounded-full bg-info" />
                                                Composition du Look
                                            </h3>
                                            <div className="grid grid-cols-1 gap-2">
                                                {selectedSkin.equipment.map((item: any, idx: number) => (
                                                    <div key={idx} className="bg-surface/40 border border-border rounded-xl p-2.5 flex items-center justify-between group/item hover:bg-surface/80 transition-all">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-black/40 rounded-lg flex items-center justify-center p-1 border border-border">
                                                                {item.icon ? (
                                                                    <NextImage src={item.icon} alt={item.name} width={32} height={32} unoptimized />
                                                                ) : (
                                                                    <Sparkles className="w-5 h-5 text-foreground" />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="text-label font-bold text-foreground group-hover/item:text-sky-400 transition-colors leading-tight">{item.name}</p>
                                                                <p className="text-caption text-muted-foreground font-medium uppercase tracking-wider">{item.type}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Sticky Footer */}
                            <div className="p-4 bg-surface/80 backdrop-blur-lg border-t border-border grid grid-cols-2 gap-3 shrink-0">
                                <Button 
                                    asChild
                                    variant="outline" 
                                    className="rounded-xl border-border bg-surface hover:bg-surface hover:border-border-strong h-12 text-xs font-bold text-foreground hover:text-foreground transition-all gap-2"
                                >
                                    <a href={selectedSkin.url} target="_blank" rel="noopener noreferrer" className="gap-2">
                                        <img 
                                            src={`https://www.google.com/s2/favicons?domain=${selectedSkin.provider === 'BARBOFUS' ? 'barbofus.com' : selectedSkin.provider === 'DOFUSSKINMANGA' ? 'dofusskinmanga.com' : 'google.com'}&sz=32`}
                                            alt="" 
                                            className="w-4 h-4 object-contain rounded"
                                        />
                                        Voir sur {selectedSkin.provider === 'BARBOFUS' ? 'Barbofus' : selectedSkin.provider === 'DOFUSSKINMANGA' ? 'SkinManga' : 'Source'}
                                    </a>
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className="rounded-xl border-sky-500/20 bg-sky-500/5 text-sky-400 hover:bg-sky-500 hover:text-foreground hover:border-sky-500 h-12 text-xs font-black uppercase tracking-widest transition-all gap-2"
                                    onClick={() => handleCopyLink(selectedSkin.url)}
                                >
                                    <Copy className="w-4 h-4" />
                                    Copier Lien
                                </Button>
                                {currentProfileId === selectedSkin.author.id && (
                                    <Button 
                                        variant="outline" 
                                        className="rounded-xl border-info/30 bg-info/10 text-info hover:bg-info hover:text-info-foreground hover:border-info h-12 text-xs font-black uppercase tracking-widest transition-all gap-2 col-span-2"
                                        onClick={() => handleShare(selectedSkin.id, "SKIN", selectedSkin.author.id)}
                                        disabled={sharingIds.has(selectedSkin.id) || !skinShareConfigured}
                                    >
                                        {sharingIds.has(selectedSkin.id) ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                                            </svg>
                                        )}
                                        {sharingIds.has(selectedSkin.id) ? "Envoi..." : "Propulser sur Discord"}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function EmptyState({ guildId, tab, hasActiveFilters, onReset }: { guildId: string, tab: "STUFF"|"SKIN", hasActiveFilters: boolean, onReset: () => void }) {
    return (
        <div className="col-span-full py-20 bg-background/20 rounded-3xl border border-dashed border-border flex flex-col items-center justify-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-surface/50 flex items-center justify-center border border-border">
                <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
                <h3 className="text-foreground font-semibold text-lg">
                    {hasActiveFilters
                        ? `Aucun ${tab === "STUFF" ? "build" : "skin"} ne correspond à ces filtres`
                        : `Aucun ${tab === "STUFF" ? "build" : "skin"} trouvé`}
                </h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    {hasActiveFilters
                        ? "Essayez d'élargir votre recherche ou de réinitialiser les filtres."
                        : tab === "STUFF"
                            ? "Importez vos stuffs DofusBook depuis votre profil pour qu'ils s'affichent ici."
                            : "Importez vos skins Barbofus ou SkinManga depuis votre profil pour inspirer la guilde !"}
                </p>
            </div>
            <div className="flex items-center gap-3 mt-2">
                {hasActiveFilters && (
                    <Button variant="outline" size="sm" onClick={onReset} className="border-border hover:bg-surface text-muted-foreground">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Réinitialiser les filtres
                    </Button>
                )}
                <a href={`/dashboard/${guildId}/profile?tab=${tab === "STUFF" ? "combat" : "skins"}`}>
                    <Button size="sm" className={cn("font-bold text-success-foreground", tab === "STUFF" ? "bg-success hover:bg-success" : "bg-sky-600 hover:bg-sky-500")}>
                        Mon Profil
                        <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                </a>
            </div>
        </div>
    );
}


/**
 * Ligne de statistiques clés sur la carte : `12 PA · 5 PM · 1 588 INT · 28 % Crit.`
 * (3-4 stats max, format localisé fr-FR, espace insécable avant %).
 */
const frNumber = new Intl.NumberFormat("fr-FR");

function BuildStatsLine({ previewData }: { previewData?: DofusbookPreviewData | null }) {
    const items = useMemo(() => {
        if (!previewData) return [] as { label: string; value: string }[];
        const stats = previewData?.stats;
        const elements = previewData?.elements;
        if (!stats || typeof stats !== "object") return [] as { label: string; value: string }[];

        const parts: { label: string; value: string }[] = [];
        if (typeof stats.pa === "number") parts.push({ label: "PA", value: String(stats.pa) });
        if (typeof stats.pm === "number") parts.push({ label: "PM", value: String(stats.pm) });

        // Caractéristique principale (hors sagesse/puissance)
        if (elements && typeof elements === "object") {
            const mains: [keyof DofusbookPreviewData["elements"], string][] = [["fo", "FOR"], ["in", "INT"], ["ch", "CHA"], ["ag", "AGI"]];
            let bestLabel: string | null = null;
            let bestVal = 0;
            for (const [key, label] of mains) {
                const v = Number(elements[key]) || 0;
                if (v > bestVal) { bestVal = v; bestLabel = label; }
            }
            if (bestLabel && bestVal > 0) {
                parts.push({ label: bestLabel, value: frNumber.format(bestVal) });
            }
        }

        // Critique ou soin selon le ciblage du build
        if (typeof stats.cc === "number" && stats.cc > 0) {
            parts.push({ label: "Crit.", value: `${frNumber.format(stats.cc)}\u00A0%` });
        } else if (typeof stats.so === "number" && stats.so > 0) {
            parts.push({ label: "Soin", value: frNumber.format(stats.so) });
        }

        return parts.slice(0, 4);
    }, [previewData]);

    if (items.length === 0) return null;

    return (
        <div className="flex flex-wrap items-center gap-1.5 px-1" aria-label="Statistiques clés du build">
            {items.map((item) => (
                <div 
                    key={item.label} 
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface border border-border/80 text-[11px] font-bold shadow-2xs"
                >
                    <span className="tabular-nums text-foreground font-extrabold">{item.value}</span>
                    <span className="text-muted-foreground text-[10px] uppercase tracking-wider">{item.label}</span>
                </div>
            ))}
        </div>
    );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="col-span-full py-16 bg-background/20 rounded-3xl border border-dashed border-danger/30 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center border border-danger/20">
                <Info className="w-7 h-7 text-danger" />
            </div>
            <div className="space-y-1">
                <h3 className="text-foreground font-semibold text-lg">Erreur de chargement</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    La galerie n'a pas pu être chargée. Vérifiez votre connexion puis réessayez.
                </p>
            </div>
            <Button variant="outline" size="sm" onClick={onRetry} className="border-border hover:bg-surface text-muted-foreground gap-2">
                <RefreshCw className="w-4 h-4" /> Réessayer
            </Button>
        </div>
    );
}

function GallerySkeleton() {
    return (
        <>
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-3" aria-hidden>
                    <Skeleton className="aspect-[4/3] rounded-2xl" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
            ))}
        </>
    );
}

