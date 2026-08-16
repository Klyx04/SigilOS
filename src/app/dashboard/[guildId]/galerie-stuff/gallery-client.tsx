"use client";

import { useState, useCallback, useEffect } from "react";
import { Link2, Search, ShieldCheck, ExternalLink, ChevronDown, Loader2, RefreshCw, ChevronRight, Copy, Star, Sword, Sparkles, Info, Mars, Venus, Megaphone, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DofusbookPreview } from "@/components/dofus/dofusbook-preview";
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

const ADVANCED_TAG_IDS = ["tank","soin","pp","dopou","docrit","ini","retpa","retpm","terrefeu","terreeau","terreair","feueau","feuair","eauair","multinocrit","sagesse","leveling","songes"];

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
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const [selectedGender, setSelectedGender] = useState<string | null>(null);
    const [selectedSource, setSelectedSource] = useState<"dofusbook" | null>(null);
    const [sortBy, setSortBy] = useState<"newest" | "votes">("newest");
    
    const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
    const [votingIds, setVotingIds] = useState<Set<string>>(new Set());
    const [sharingIds, setSharingIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [selectedSkin, setSelectedSkin] = useState<GallerySkin | null>(null);

    // Debounced search - triggers server-side re-fetch after 300ms
    const debouncedSearch = useDebounce(searchQuery, 300);

    // Reset and re-fetch from page 1 when filters change
    const applyFilters = useCallback((
        query: string, 
        tag: string | null, 
        classId: string | null, 
        gender: string | null, 
        sortKey: "newest" | "votes", 
        tab: "STUFF" | "SKIN",
        source: "dofusbook" | null
    ) => {
        const runFilters = async () => {
            setIsLoading(true);
            try {
                if (tab === "STUFF") {
                    const res = await getStuffGalleryPage(guildId, 1, query || undefined, tag || undefined, classId || undefined, sortKey, source || undefined);
                    if (res.success && res.data) {
                        setStuffBuilds(res.data.builds);
                        setStuffTotal(res.data.total);
                        setStuffHasMore(res.data.hasMore);
                        setStuffShareConfigured(res.data.isDiscordShareConfigured);
                        setStuffPage(1);
                    }
                } else {
                    const res = await getSkinGalleryPage(guildId, 1, query || undefined, classId || undefined, gender || undefined, sortKey);
                    if (res.success && res.data) {
                        setSkinBuilds(res.data.skins);
                        setSkinTotal(res.data.total);
                        setSkinHasMore(res.data.hasMore);
                        setSkinShareConfigured(res.data.isDiscordShareConfigured);
                        setSkinPage(1);
                    }
                }
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
        if (debouncedSearch !== undefined) {
            applyFilters(debouncedSearch, selectedTag, selectedClass, selectedGender, sortBy, activeTab, selectedSource);
        }
    }, [debouncedSearch, selectedTag, selectedClass, selectedGender, sortBy, activeTab, selectedSource, applyFilters]);

    const handleTagChange = (tag: string | null) => {
        setSelectedTag(tag);
        applyFilters(searchQuery, tag, selectedClass, selectedGender, sortBy, activeTab, selectedSource);
    };

    const handleClassChange = (classId: string | number | null) => {
        const idStr = classId !== null ? String(classId) : null;
        setSelectedClass(idStr);
        applyFilters(searchQuery, selectedTag, idStr, selectedGender, sortBy, activeTab, selectedSource);
    };

    const handleGenderChange = (gender: string | null) => {
        setSelectedGender(gender);
        applyFilters(searchQuery, selectedTag, selectedClass, gender, sortBy, activeTab, selectedSource);
    };

    const handleSourceChange = (source: "dofusbook" | null) => {
        setSelectedSource(source);
        applyFilters(searchQuery, selectedTag, selectedClass, selectedGender, sortBy, activeTab, source);
    };
    
    const handleSortChange = (newSort: "newest" | "votes") => {
        setSortBy(newSort);
        applyFilters(searchQuery, selectedTag, selectedClass, selectedGender, newSort, activeTab, selectedSource);
    };

    const handleTabChange = (newTab: "STUFF" | "SKIN") => {
        setActiveTab(newTab);
        // Reseting filters when changing tab to avoid confusing state
        setSelectedTag(null);
        setSelectedClass(null);
        setSelectedGender(null);
        setSelectedSource(null);
        applyFilters(searchQuery, null, null, null, sortBy, newTab, null);
    };

    // Infinite scroll: load next page
    const loadMore = () => {
        const runLoadMore = async () => {
            setIsLoading(true);
            try {
                if (activeTab === "STUFF") {
                    const nextPage = stuffPage + 1;
                    const res = await getStuffGalleryPage(
                        guildId, 
                        nextPage, 
                        searchQuery || undefined, 
                        selectedTag || undefined,
                        selectedClass || undefined,
                        sortBy,
                        selectedSource || undefined
                    );
                    if (res.success && res.data) {
                        setStuffBuilds(prev => [...prev, ...res.data!.builds]);
                        setStuffHasMore(res.data.hasMore);
                        setStuffPage(nextPage);
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
                    }
                }
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
                applyFilters(searchQuery, selectedTag, selectedClass, selectedGender, sortBy, activeTab, selectedSource);
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
            {/* Hero Header */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40 p-8 lg:p-10">
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-xs font-medium shrink-0 w-fit">
                                <ShieldCheck className="w-3.5 h-3.5 text-zinc-500" />
                                Galerie de Guilde
                            </div>
                            
                            <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as any)} className="w-full sm:w-auto">
                                <TabsList className="bg-black/60 border border-white/10 h-14 p-1.5 rounded-xl">
                                    <TabsTrigger 
                                        value="STUFF" 
                                        className="rounded-lg px-6 h-full text-sm font-semibold gap-3 data-[state=active]:bg-emerald-500 data-[state=active]:text-white transition-colors duration-200"
                                    >
                                        <Sword className={cn("w-4 h-4 transition-transform", activeTab === "STUFF" ? "scale-110" : "opacity-40")} />
                                        Équipements
                                        <span className={cn(
                                            "ml-1 px-1.5 py-0.5 rounded-md text-xs font-semibold",
                                            activeTab === "STUFF" ? "bg-white/20 text-white" : "bg-white/5 text-zinc-600"
                                        )}>
                                            {stuffTotal}
                                        </span>
                                    </TabsTrigger>
                                    <TabsTrigger 
                                        value="SKIN" 
                                        className="rounded-lg px-6 h-full text-sm font-semibold gap-3 data-[state=active]:bg-sky-500 data-[state=active]:text-white transition-colors duration-200"
                                    >
                                        <Sparkles className={cn("w-4 h-4 transition-transform", activeTab === "SKIN" ? "scale-110" : "opacity-40")} />
                                        Skins & Looks
                                        <span className={cn(
                                            "ml-1 px-1.5 py-0.5 rounded-md text-xs font-semibold",
                                            activeTab === "SKIN" ? "bg-white/20 text-white" : "bg-white/5 text-zinc-600"
                                        )}>
                                            {skinTotal}
                                        </span>
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        <div>
                            <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight mb-2">
                                Galerie <span className={cn("transition-colors duration-200", activeTab === "STUFF" ? "text-emerald-400" : "text-sky-400")}>Guilde</span>
                            </h1>
                            <p className="text-zinc-400 max-w-xl text-base leading-relaxed">
                                {activeTab === "STUFF" 
                                    ? "Découvrez les meilleurs builds optis partagés par les membres de la guilde."
                                    : "L'élégance à l'état pur. Explorez les plus beaux looks et skins de la communauté."}
                            </p>
                        </div>
                    </div>

                    {/* Search bar */}
                    <div className="relative group w-full lg:w-96" data-tour="galerie-search">
                        <Search className={cn(
                            "absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 transition-colors",
                            activeTab === "STUFF" ? "group-focus-within:text-emerald-400" : "group-focus-within:text-sky-400"
                        )} />
                        <Input
                            placeholder={activeTab === "STUFF" ? "Rechercher un build, un pseudo..." : "Rechercher un skin, un auteur..."}
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="bg-zinc-950/80 border-white/10 pl-11 h-14 rounded-2xl focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all text-sm text-white placeholder:text-zinc-600 shadow-2xl"
                        />
                        {isLoading && (
                            <Loader2 className={cn(
                                "absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin",
                                activeTab === "STUFF" ? "text-emerald-500" : "text-sky-500"
                            )} />
                        )}
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="sticky top-0 z-30 pt-2">
                <div className="bg-zinc-950/80 border border-white/10 rounded-2xl px-5 py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    {/* Left: Filters */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* 1. Class Filter */}
                        <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/5" data-tour="galerie-filters">
                            <ClassFilter selectedClass={selectedClass} onSelectClass={handleClassChange} />
                        </div>

                        {activeTab === "SKIN" && (
                            <GenderFilter selectedGender={selectedGender} onSelectGender={handleGenderChange} />
                        )}

                        {activeTab === "STUFF" && (
                            <>
                                <div className="w-px h-6 bg-white/10 shrink-0 hidden sm:block" />

                                {/* 2. Primary Elements */}
                                <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
                                    <button
                                        onClick={() => handleTagChange(null)}
                                        className={cn(
                                            "h-8 px-4 rounded-lg text-xs font-semibold transition-colors shrink-0",
                                            !selectedTag || ADVANCED_TAG_IDS.includes(selectedTag) ? "bg-white text-black" : "text-zinc-500 hover:text-white hover:bg-white/10"
                                        )}
                                    >
                                        Tous
                                    </button>

                                    {["eau","feu","terre","air","multi"].map(id => {
                                        const tag = DO_TAGS.find(t => t.id === id)!;
                                        return (
                                            <button
                                                key={id}
                                                onClick={() => handleTagChange(selectedTag === id ? null : id)}
                                                className={cn(
                                                    "h-8 px-3 rounded-lg text-xs font-medium transition-colors shrink-0",
                                                    selectedTag === id ? `${tag.className} ring-1 ring-white/20` : "text-zinc-500 hover:text-white hover:bg-white/10"
                                                )}
                                            >
                                                {tag.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="w-px h-6 bg-white/10 shrink-0 hidden sm:block" />

                                {/* 3. Advanced / Specialities */}
                                <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/5">
                                    <AdvancedTagFilter selectedTag={selectedTag} onSelectTag={handleTagChange} />
                                </div>


                            </>
                        )}
                    </div>

                    {/* Right: Count & Reset & Sort */}
                    <div className="flex items-center gap-4 text-sm w-full xl:w-auto shrink-0 justify-between xl:justify-end border-t border-white/5 pt-4 xl:border-0 xl:pt-0 flex-wrap">
                        <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/5 mr-2">
                            <button
                                onClick={() => handleSortChange("newest")}
                                className={cn(
                                    "flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-medium transition-colors shrink-0",
                                    sortBy === "newest" ? "bg-white text-black" : "text-zinc-500 hover:text-white hover:bg-white/10"
                                )}
                            >
                                <RefreshCw className="w-3.5 h-3.5" /> Récents
                            </button>
                            <button
                                onClick={() => handleSortChange("votes")}
                                className={cn(
                                    "flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-medium transition-colors shrink-0",
                                    sortBy === "votes" ? "bg-yellow-500 text-black" : "text-zinc-500 hover:text-yellow-400 hover:bg-white/10"
                                )}
                            >
                                <Star className={cn("w-3.5 h-3.5", sortBy === "votes" && "fill-black")} /> Favoris
                            </button>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <p className="text-sm text-zinc-500 flex items-center gap-2 tabular-nums">
                                <span className="text-white font-semibold">{activeTab === "STUFF" ? stuffBuilds.length : skinBuilds.length}</span>
                                <span> sur {activeTab === "STUFF" ? stuffTotal : skinTotal} item{ (activeTab === "STUFF" ? stuffTotal : skinTotal) !== 1 ? "s" : ""}</span>
                            </p>
                            {/* Espace du bouton Reset TOUJOURS réservé → pas de saut de page
                                quand un filtre devient actif (#67 anti-layout-shift) */}
                            <div className="w-px h-4 bg-white/10 shrink-0" />
                            <button
                                onClick={() => { setSearchQuery(""); setSelectedTag(null); setSelectedClass(null); setSelectedGender(null); setSelectedSource(null); applyFilters("", null, null, null, sortBy, activeTab, null); }}
                                tabIndex={(searchQuery || selectedTag || selectedClass || selectedGender || selectedSource) ? 0 : -1}
                                aria-hidden={!(searchQuery || selectedTag || selectedClass || selectedGender || selectedSource)}
                                className={cn(
                                    "text-xs text-zinc-400 hover:text-white transition-colors font-medium flex items-center gap-1 shrink-0",
                                    !(searchQuery || selectedTag || selectedClass || selectedGender || selectedSource) && "invisible"
                                )}
                            >
                                <RefreshCw className="w-3 h-3" /> Reset
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div data-tour="galerie-grid" className={cn(
                "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8",
                isLoading && "opacity-50 pointer-events-none transition-opacity"
            )}>
                {activeTab === "STUFF" ? (
                    stuffBuilds.length > 0 ? (
                        stuffBuilds.map((build) => (
                            <div key={build.id} className="group/card flex flex-col gap-3">
                                <div className="relative">
                                    <DofusbookPreview url={build.url} title={build.name} tags={build.tags} classId={build.classId ? Number(build.classId) : undefined} initialData={build.previewData} />
                                    
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent transition-all duration-300 rounded-2xl flex flex-col justify-end p-4 z-10 pointer-events-none">
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleRefresh(build); }}
                                                disabled={refreshingIds.has(build.id)}
                                                className="p-1.5 bg-zinc-800/90 rounded-lg text-white hover:bg-zinc-700 transition-colors pointer-events-auto disabled:opacity-50"
                                                title="Actualiser depuis Dofusbook"
                                            >
                                                <RefreshCw className={cn("w-3.5 h-3.5", refreshingIds.has(build.id) && "animate-spin")} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleVoteStuff(build); }}
                                                disabled={votingIds.has(build.id)}
                                                className={cn(
                                                    "p-1.5 rounded-lg transition-colors pointer-events-auto disabled:opacity-50 flex items-center justify-center gap-1.5",
                                                    build.hasVoted 
                                                        ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30" 
                                                        : "bg-zinc-800/90 text-zinc-400 hover:text-yellow-400 hover:bg-zinc-700"
                                                )}
                                                title={build.hasVoted ? "Retirer mon vote" : "Voter pour ce stuff !"}
                                            >
                                                <Star className={cn("w-3.5 h-3.5", build.hasVoted && "fill-current")} />
                                                {build.votesCount > 0 && (
                                                    <span className="text-caption font-bold">{build.votesCount}</span>
                                                )}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigator.clipboard.writeText(build.url);
                                                    toast.success("Lien copié !");
                                                }}
                                                className="p-1.5 bg-zinc-800/90 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors pointer-events-auto"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                            {currentProfileId === build.author.id && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleShare(build.id, "STUFF", build.author.id); }}
                                                    disabled={sharingIds.has(build.id) || !stuffShareConfigured}
                                                    className={cn(
                                                        "p-1.5 rounded-lg transition-colors pointer-events-auto disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed",
                                                        "bg-indigo-500 text-white hover:bg-indigo-400"
                                                    )}
                                                    title={stuffShareConfigured ? "Propulser sur Discord !" : "Non configuré (Admin)"}
                                                >
                                                    {sharingIds.has(build.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Megaphone className="w-3.5 h-3.5" />}
                                                </button>
                                            )}
                                            <a 
                                                href={build.url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="p-1.5 bg-emerald-500 rounded-lg text-white hover:bg-emerald-400 transition-colors pointer-events-auto"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between px-2">
                                    <div className="flex items-center gap-2.5">
                                        <Avatar className="w-6 h-6 border border-white/10">
                                            <AvatarImage src={build.author.image || undefined} />
                                            <AvatarFallback className="text-caption bg-zinc-900 text-zinc-500">
                                                {build.author.name.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-xs text-zinc-500">
                                            Par <span className="text-zinc-300 font-semibold">{build.author.name}</span>
                                        </span>
                                        {build.createdAt && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="text-xs text-zinc-600 font-medium ml-1 cursor-default">
                                                            {new Date(build.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="bg-zinc-900 border-zinc-700 text-caption text-zinc-300">
                                                        <p>Ajouté le {new Date(build.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
                                                        {build.updatedAt && build.updatedAt !== build.createdAt && (
                                                            <p className="text-zinc-500">Mis à jour le {new Date(build.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
                                                        )}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                    </div>
                                    <span className="text-xs font-medium uppercase tracking-wide px-2 py-0.5 rounded-md border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                        DofusBook
                                    </span>
                                </div>
                            </div>
                        ))
                    ) : !isLoading && (
                        <EmptyState guildId={guildId} tab="STUFF" searchQuery={searchQuery} onReset={() => handleTabChange("STUFF")} />
                    )
                ) : (
                    skinBuilds.length > 0 ? (
                        skinBuilds.map((skin) => (
                            <div key={skin.id} className="group/card flex flex-col gap-3">
                                <div 
                                    onClick={() => setSelectedSkin(skin)}
                                    className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 bg-zinc-900 group-hover/card:border-sky-500/50 transition-all cursor-pointer"
                                >
                                    {skin.thumbnailUrl ? (
                                        <div className="absolute inset-x-0 top-0 bottom-14 flex items-center justify-center">
                                            <NextImage 
                                                src={skin.thumbnailUrl} 
                                                alt={skin.name} 
                                                fill 
                                                className="object-contain object-[50%_20%] group-hover/card:scale-105 transition-transform duration-300 bg-zinc-950/30" 
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-zinc-950">
                                            <NextImage src="/assets/dofus/logo-sigil.png" alt="Sigil" width={64} height={64} className="opacity-10 grayscale" />
                                        </div>
                                    )}

                                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent p-4 flex flex-col justify-end">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-sm font-semibold text-white truncate max-w-[150px]">{skin.name}</h3>
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs px-1.5 py-0.5 rounded-md bg-white/10 text-white/70 font-medium">
                                                    {skin.provider}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                {skin.metadata?.class && DOFUS_CLASSES.find(c => getNumericClassId(c) === Number(skin.metadata?.class))?.icon && (
                                                    <div className="w-6 h-6 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center" title={DOFUS_CLASSES.find(c => getNumericClassId(c) === Number(skin.metadata?.class))?.name || skin.metadata.class}>
                                                        <NextImage 
                                                            src={DOFUS_CLASSES.find(c => getNumericClassId(c) === Number(skin.metadata?.class))?.icon || ""} 
                                                            alt="" width={14} height={14} 
                                                        />
                                                    </div>
                                                )}
                                                {skin.metadata?.gender && (
                                                    <div className="w-6 h-6 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center">
                                                        {skin.metadata.gender === "M" ? <Mars className="w-3 h-3 text-blue-400" /> : <Venus className="w-3 h-3 text-pink-400" />}
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
                                                            ? "bg-yellow-500 text-black" 
                                                            : "bg-zinc-800/90 text-zinc-400 hover:text-yellow-400 hover:bg-zinc-700"
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
                                                             "bg-indigo-500 text-white hover:bg-indigo-400"
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
                                                    className="p-1.5 bg-zinc-800/90 border border-white/10 rounded-lg text-white hover:bg-zinc-700 transition-colors flex items-center justify-center"
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
                                        <Avatar className="w-6 h-6 border border-white/10">
                                            <AvatarImage src={skin.author.image || undefined} />
                                            <AvatarFallback className="text-caption bg-zinc-900 text-zinc-500">
                                                {skin.author.name.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-caption text-zinc-500">
                                            Par <span className="text-zinc-300 font-bold">{skin.author.name}</span>
                                        </span>
                                    </div>
                                    <span className="text-caption text-zinc-600 font-medium" suppressHydrationWarning>
                                        {new Date(skin.createdAt).toLocaleDateString("fr-FR")}
                                    </span>
                                </div>
                            </div>
                        ))
                    ) : !isLoading && (
                        <EmptyState guildId={guildId} tab="SKIN" searchQuery={searchQuery} onReset={() => handleTabChange("SKIN")} />
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
                            "gap-2 border-white/10 hover:bg-white/5 transition-all px-12 h-12 rounded-2xl font-black text-xs uppercase tracking-widest",
                            activeTab === "STUFF" ? "hover:border-emerald-500/30 hover:text-emerald-400" : "hover:border-sky-500/30 hover:text-sky-400"
                        )}
                    >
                        <ChevronDown className="w-4 h-4" />
                        Charger plus {activeTab === "STUFF" ? "de builds" : "de skins"}
                        <span className="text-caption text-zinc-500 ml-1">
                            ({(activeTab === "STUFF" ? stuffTotal - stuffBuilds.length : skinTotal - skinBuilds.length)} restants)
                        </span>
                    </Button>
                </div>
            )}

            {/* Skin Detail Modal */}
            <Dialog open={!!selectedSkin} onOpenChange={(open) => !open && setSelectedSkin(null)}>
                <DialogContent className="bg-zinc-950/95 backdrop-blur-2xl border-white/10 text-white sm:max-w-xl w-[95vw] h-auto max-h-[90vh] p-0 rounded-[2rem] overflow-hidden shadow-2xl">
                    <DialogTitle className="sr-only">Détails du Look</DialogTitle>
                    <DialogDescription className="sr-only">Aperçu et métadonnées du skin partagé par la guilde.</DialogDescription>
                    {selectedSkin && (
                        <div className="flex flex-col h-full max-h-[90vh]">
                            {/* Visual Header */}
                            <div className="relative aspect-video bg-black/40 flex items-center justify-center shrink-0 border-b border-white/5">
                                {selectedSkin.thumbnailUrl ? (
                                    <NextImage 
                                        src={selectedSkin.thumbnailUrl} 
                                        alt={selectedSkin.name}
                                        fill
                                        className="object-contain p-6"
                                        unoptimized
                                    />
                                ) : (
                                    <Sparkles className="w-16 h-16 text-zinc-800" />
                                )}
                                
                                <div className="absolute top-4 left-4 flex flex-col gap-2">
                                    <div className="bg-sky-500/20 backdrop-blur-xl px-3 py-1 rounded-full border border-sky-500/30 w-fit">
                                        <span className="text-caption font-black text-sky-400 tracking-widest uppercase">
                                            {selectedSkin.provider}
                                        </span>
                                    </div>
                                    <div className="bg-zinc-950/80 backdrop-blur-xl px-3 py-1 rounded-xl border border-white/10 w-fit shadow-2xl flex items-center gap-2">
                                        <Avatar className="w-4 h-4 border border-white/10">
                                            <AvatarImage src={selectedSkin.author.image || undefined} />
                                            <AvatarFallback className="text-caption bg-zinc-900">{selectedSkin.author.name.substring(0,2)}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-caption font-black text-zinc-400 tracking-tighter uppercase">
                                            Partagé par <span className="text-white">{selectedSkin.author.name}</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
 
                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
                                <div className="p-6 space-y-8">
                                    <div>
                                        <h2 className="text-2xl font-black text-white uppercase tracking-tight leading-none">
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
                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl shadow-inner">
                                                     <span className="text-caption font-black uppercase tracking-widest">
                                                        {selectedSkin.metadata.gender === "M" ? "Mâle" : "Femelle"}
                                                    </span>
                                                </div>
                                            )}
                                            {selectedSkin.metadata?.head && (
                                                <div className="flex items-center gap-2 px-1 py-1 pr-3 bg-zinc-900/80 text-zinc-300 border border-white/5 rounded-xl shadow-inner group/head">
                                                    <div className="w-6 h-6 rounded-lg overflow-hidden bg-black/40 border border-white/5">
                                                        {String(selectedSkin.metadata.head).startsWith('http') ? (
                                                            <NextImage src={selectedSkin.metadata.head} alt="Head" width={24} height={24} className="object-cover group-hover/head:scale-110 transition-transform" unoptimized />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-caption font-bold text-zinc-600">
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
                                            <h3 className="text-caption font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
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
                                                        className="bg-white/5 border border-white/5 rounded-xl p-2 flex items-center justify-between gap-3 hover:bg-sky-500/10 hover:border-sky-500/30 transition-all text-left group/color cursor-pointer active:scale-95"
                                                        title="Cliquer pour copier le code hexadécimal"
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div 
                                                                className="w-8 h-8 rounded-lg shadow-inner border border-white/10 shrink-0 transition-transform group-hover/color:scale-105"
                                                                style={{ backgroundColor: hex as string }}
                                                            />
                                                            <div className="min-w-0">
                                                                <p className="text-caption font-bold text-zinc-500 truncate uppercase tracking-tighter group-hover/color:text-sky-300 transition-colors">{label}</p>
                                                                <p className="text-caption font-black text-white uppercase font-mono">{hex as string}</p>
                                                            </div>
                                                        </div>
                                                        <div className="p-1.5 rounded-lg bg-white/5 text-zinc-400 group-hover/color:bg-sky-500/20 group-hover/color:text-sky-400 transition-all shrink-0">
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
                                            <h3 className="text-caption font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                                <div className="w-1 h-1 rounded-full bg-purple-500" />
                                                Composition du Look
                                            </h3>
                                            <div className="grid grid-cols-1 gap-2">
                                                {selectedSkin.equipment.map((item: any, idx: number) => (
                                                    <div key={idx} className="bg-zinc-900/40 border border-white/5 rounded-xl p-2.5 flex items-center justify-between group/item hover:bg-zinc-900/80 transition-all">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-black/40 rounded-lg flex items-center justify-center p-1 border border-white/5">
                                                                {item.icon ? (
                                                                    <NextImage src={item.icon} alt={item.name} width={32} height={32} unoptimized />
                                                                ) : (
                                                                    <Sparkles className="w-5 h-5 text-zinc-800" />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="text-label font-bold text-white group-hover/item:text-sky-400 transition-colors leading-tight">{item.name}</p>
                                                                <p className="text-caption text-zinc-500 font-medium uppercase tracking-wider">{item.type}</p>
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
                            <div className="p-4 bg-zinc-900/80 backdrop-blur-lg border-t border-white/5 grid grid-cols-2 gap-3 shrink-0">
                                <Button 
                                    asChild
                                    variant="outline" 
                                    className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 h-12 text-xs font-bold text-zinc-300 hover:text-white transition-all gap-2"
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
                                    className="rounded-xl border-sky-500/20 bg-sky-500/5 text-sky-400 hover:bg-sky-500 hover:text-white hover:border-sky-500 h-12 text-xs font-black uppercase tracking-widest transition-all gap-2"
                                    onClick={() => handleCopyLink(selectedSkin.url)}
                                >
                                    <Copy className="w-4 h-4" />
                                    Copier Lien
                                </Button>
                                {currentProfileId === selectedSkin.author.id && (
                                    <Button 
                                        variant="outline" 
                                        className="rounded-xl border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500 hover:text-white hover:border-indigo-500 h-12 text-xs font-black uppercase tracking-widest transition-all gap-2 col-span-2"
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

function EmptyState({ guildId, tab, searchQuery, onReset }: { guildId: string, tab: "STUFF"|"SKIN", searchQuery: string, onReset: () => void }) {
    return (
        <div className="col-span-full py-20 bg-zinc-950/20 rounded-3xl border border-dashed border-white/5 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-zinc-900/50 flex items-center justify-center border border-white/5">
                <Search className="w-8 h-8 text-zinc-700" />
            </div>
            <div className="space-y-1">
                <h3 className="text-zinc-300 font-semibold text-lg">Aucun {tab === "STUFF" ? "build" : "skin"} trouvé</h3>
                <p className="text-zinc-500 text-sm max-w-md mx-auto">
                    {tab === "STUFF" 
                        ? "Importez vos stuffs DofusBook depuis votre profil pour qu'ils s'affichent ici."
                        : "Importez vos skins Barbofus ou SkinManga depuis votre profil pour inspirer la guilde !"}
                </p>
            </div>
            <div className="flex items-center gap-3 mt-2">
                {searchQuery && (
                    <Button variant="outline" size="sm" onClick={onReset} className="border-white/10 hover:bg-white/5 text-zinc-400">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Réinitialiser
                    </Button>
                )}
                <a href={`/dashboard/${guildId}/profile?tab=${tab === "STUFF" ? "combat" : "skins"}`}>
                    <Button size="sm" className={cn("font-bold text-white", tab === "STUFF" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-sky-600 hover:bg-sky-500")}>
                        Mon Profil
                        <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                </a>
            </div>
        </div>
    );
}