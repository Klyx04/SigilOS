"use client";

import { useState, useCallback, useEffect } from "react";
import { Link2, Search, ShieldCheck, ExternalLink, ChevronDown, Loader2, RefreshCw, ChevronRight, Copy, Star, Sword, Sparkles, Info, Mars, Venus, Megaphone, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DofusbookPreview } from "@/components/dofus/dofusbook-preview";
import { DofusroomPreview } from "@/components/dofus/dofusroom-preview";
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
    const [selectedSource, setSelectedSource] = useState<"dofusbook" | "dofusroom" | null>(null);
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
        source: "dofusbook" | "dofusroom" | null
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

    const handleSourceChange = (source: "dofusbook" | "dofusroom" | null) => {
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
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-8 lg:p-10">
                <div className={cn(
                    "absolute top-0 right-0 w-96 h-96 blur-[120px] rounded-full -mr-20 -mt-20 shrink-0 transition-colors duration-500",
                    activeTab === "STUFF" ? "bg-emerald-500/10" : "bg-sky-500/10"
                )} />
                <div className={cn(
                    "absolute bottom-0 left-0 w-64 h-64 blur-[100px] rounded-full -ml-20 -mb-20 shrink-0 transition-colors duration-500",
                    activeTab === "STUFF" ? "bg-indigo-500/10" : "bg-purple-500/10"
                )} />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 text-[10px] font-black uppercase tracking-widest shrink-0 w-fit">
                                <ShieldCheck className="w-3.5 h-3.5 text-zinc-500" />
                                Galerie de Guilde 2026
                            </div>
                            
                            <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as any)} className="w-full sm:w-auto">
                                <TabsList className="bg-black/60 border border-white/10 h-14 p-1.5 rounded-2xl shadow-2xl">
                                    <TabsTrigger 
                                        value="STUFF" 
                                        className="rounded-xl px-6 h-full text-[12px] font-black uppercase tracking-widest gap-3 data-[state=active]:bg-emerald-500 data-[state=active]:text-white transition-all duration-300"
                                    >
                                        <Sword className={cn("w-4 h-4 transition-transform", activeTab === "STUFF" ? "scale-110" : "opacity-40")} />
                                        ÉQUIPEMENTS
                                        <span className={cn(
                                            "ml-1 px-1.5 py-0.5 rounded-md text-[9px] font-black",
                                            activeTab === "STUFF" ? "bg-white/20 text-white" : "bg-white/5 text-zinc-600"
                                        )}>
                                            {stuffTotal}
                                        </span>
                                    </TabsTrigger>
                                    <TabsTrigger 
                                        value="SKIN" 
                                        className="rounded-xl px-6 h-full text-[12px] font-black uppercase tracking-widest gap-3 data-[state=active]:bg-sky-500 data-[state=active]:text-white transition-all duration-300"
                                    >
                                        <Sparkles className={cn("w-4 h-4 transition-transform", activeTab === "SKIN" ? "scale-110" : "opacity-40")} />
                                        SKINS & LOOKS
                                        <span className={cn(
                                            "ml-1 px-1.5 py-0.5 rounded-md text-[9px] font-black",
                                            activeTab === "SKIN" ? "bg-white/20 text-white" : "bg-white/5 text-zinc-600"
                                        )}>
                                            {skinTotal}
                                        </span>
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        <div>
                            <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tight mb-2">
                                Galerie <span className={cn(
                                    "text-transparent bg-clip-text bg-gradient-to-r transition-all duration-500",
                                    activeTab === "STUFF" ? "from-emerald-400 to-indigo-400" : "from-sky-400 to-purple-400"
                                )}>Guilde</span>
                            </h1>
                            <p className="text-zinc-400 max-w-xl text-base leading-relaxed">
                                {activeTab === "STUFF" 
                                    ? "Découvrez les meilleurs builds optis partagés par les membres de la guilde."
                                    : "L'élégance à l'état pur. Explorez les plus beaux looks et skins de la communauté."}
                            </p>
                        </div>
                    </div>

                    {/* Search bar */}
                    <div className="relative group w-full lg:w-96">
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

            {/* Premium Filter Bar */}
            <div className="sticky top-0 z-30 pt-2">
                <div className="bg-zinc-950/80 backdrop-blur-2xl border border-white/10 rounded-[1.5rem] px-5 py-4 shadow-2xl flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    {/* Left: Filters */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* 1. Class Filter */}
                        <div className="flex items-center gap-2 bg-black/40 p-1 rounded-2xl border border-white/5">
                            <ClassFilter selectedClass={selectedClass} onSelectClass={handleClassChange} />
                        </div>

                        {activeTab === "SKIN" && (
                            <GenderFilter selectedGender={selectedGender} onSelectGender={handleGenderChange} />
                        )}

                        {activeTab === "STUFF" && (
                            <>
                                <div className="w-px h-6 bg-white/10 shrink-0 hidden sm:block" />

                                {/* 2. Primary Elements */}
                                <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-2xl border border-white/5">
                                    <button
                                        onClick={() => handleTagChange(null)}
                                        className={cn(
                                            "h-8 px-4 rounded-xl text-[11px] font-black transition-all shrink-0",
                                            !selectedTag || ADVANCED_TAG_IDS.includes(selectedTag) ? "bg-white text-black shadow-md" : "text-zinc-500 hover:text-white hover:bg-white/10"
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
                                                    "h-8 px-3 rounded-xl text-[11px] font-bold transition-all shrink-0",
                                                    selectedTag === id ? `${tag.className} shadow-lg ring-1 ring-white/20` : "text-zinc-500 hover:text-white hover:bg-white/10"
                                                )}
                                            >
                                                {tag.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="w-px h-6 bg-white/10 shrink-0 hidden sm:block" />

                                {/* 3. Advanced / Specialities */}
                                <div className="flex items-center bg-black/40 p-1 rounded-2xl border border-white/5">
                                    <AdvancedTagFilter selectedTag={selectedTag} onSelectTag={handleTagChange} />
                                </div>

                                <div className="w-px h-6 bg-white/10 shrink-0 hidden sm:block" />

                                {/* 4. Source Filter */}
                                <div className="flex items-center bg-black/40 p-1 rounded-2xl border border-white/5 gap-1">
                                    <button
                                        onClick={() => handleSourceChange(null)}
                                        className={cn(
                                            "h-8 px-3 rounded-xl text-[11px] font-black transition-all shrink-0",
                                            !selectedSource ? "bg-white text-black shadow-md" : "text-zinc-500 hover:text-white hover:bg-white/10"
                                        )}
                                    >
                                        Tous sites
                                    </button>
                                    <button
                                        onClick={() => handleSourceChange("dofusbook")}
                                        className={cn(
                                            "h-8 px-3 rounded-xl text-[11px] font-bold transition-all shrink-0",
                                            selectedSource === "dofusbook" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-zinc-500 hover:text-emerald-400 hover:bg-white/10"
                                        )}
                                    >
                                        Dofusbook
                                    </button>
                                    <button
                                        onClick={() => handleSourceChange("dofusroom")}
                                        className={cn(
                                            "h-8 px-3 rounded-xl text-[11px] font-bold transition-all shrink-0",
                                            selectedSource === "dofusroom" ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20" : "text-zinc-500 hover:text-sky-400 hover:bg-white/10"
                                        )}
                                    >
                                        DofusRoom
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Right: Count & Reset & Sort */}
                    <div className="flex items-center gap-4 text-sm w-full xl:w-auto shrink-0 justify-between xl:justify-end border-t border-white/5 pt-4 xl:border-0 xl:pt-0 flex-wrap">
                        <div className="flex items-center gap-2 bg-black/40 p-1 rounded-2xl border border-white/5 mr-2">
                            <button
                                onClick={() => handleSortChange("newest")}
                                className={cn(
                                    "flex items-center gap-1.5 h-8 px-3 rounded-xl text-[11px] font-bold transition-all shrink-0",
                                    sortBy === "newest" ? "bg-white text-black shadow-md" : "text-zinc-500 hover:text-white hover:bg-white/10"
                                )}
                            >
                                <RefreshCw className="w-3.5 h-3.5" /> Récents
                            </button>
                            <button
                                onClick={() => handleSortChange("votes")}
                                className={cn(
                                    "flex items-center gap-1.5 h-8 px-3 rounded-xl text-[11px] font-bold transition-all shrink-0",
                                    sortBy === "votes" ? "bg-yellow-500 text-black shadow-md shadow-yellow-500/20" : "text-zinc-500 hover:text-yellow-400 hover:bg-white/10"
                                )}
                            >
                                <Star className={cn("w-3.5 h-3.5", sortBy === "votes" && "fill-black")} /> Favoris
                            </button>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <p className="text-[11px] text-zinc-500 flex items-center gap-2">
                                <span className={cn(
                                    "w-2 h-2 rounded-full animate-pulse shrink-0",
                                    activeTab === "STUFF" ? "bg-emerald-500/50" : "bg-sky-500/50"
                                )} />
                                <span className="text-white font-black">{activeTab === "STUFF" ? stuffBuilds.length : skinBuilds.length}</span>
                                <span> sur {activeTab === "STUFF" ? stuffTotal : skinTotal} item{ (activeTab === "STUFF" ? stuffTotal : skinTotal) !== 1 ? "s" : ""}</span>
                            </p>
                            {(searchQuery || selectedTag || selectedClass || selectedGender || selectedSource) ? (
                                <>
                                    <div className="w-px h-4 bg-white/10 shrink-0" />
                                    <button
                                        onClick={() => { setSearchQuery(""); setSelectedTag(null); setSelectedClass(null); setSelectedGender(null); setSelectedSource(null); applyFilters("", null, null, null, sortBy, activeTab, null); }}
                                        className="text-[10px] text-zinc-400 hover:text-white transition-colors font-bold uppercase tracking-widest flex items-center gap-1 shrink-0"
                                    >
                                        <RefreshCw className="w-3 h-3" /> Reset
                                    </button>
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className={cn(
                "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8",
                isLoading && "opacity-50 pointer-events-none transition-opacity"
            )}>
                {activeTab === "STUFF" ? (
                    stuffBuilds.length > 0 ? (
                        stuffBuilds.map((build) => (
                            <div key={build.id} className="group/card flex flex-col gap-3">
                                <div className="relative">
                                    {build.source === "dofusroom" ? (
                                        <DofusroomPreview url={build.url} title={build.name} tags={build.tags} classId={build.classId ? Number(build.classId) : undefined} initialData={build.previewData} />
                                    ) : (
                                        <DofusbookPreview url={build.url} title={build.name} tags={build.tags} classId={build.classId ? Number(build.classId) : undefined} initialData={build.previewData} />
                                    )}
                                    
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent transition-all duration-300 rounded-2xl flex flex-col justify-end p-4 z-10 pointer-events-none">
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleRefresh(build); }}
                                                disabled={refreshingIds.has(build.id)}
                                                className="p-1.5 bg-zinc-800/90 rounded-lg text-white hover:bg-zinc-700 transition-colors shadow-lg pointer-events-auto disabled:opacity-50"
                                                title={build.source === "dofusroom" ? "Actualiser depuis DofusRoom" : "Actualiser depuis Dofusbook"}
                                            >
                                                <RefreshCw className={cn("w-3.5 h-3.5", refreshingIds.has(build.id) && "animate-spin")} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleVoteStuff(build); }}
                                                disabled={votingIds.has(build.id)}
                                                className={cn(
                                                    "p-1.5 rounded-lg transition-colors shadow-lg pointer-events-auto disabled:opacity-50 flex items-center justify-center gap-1.5",
                                                    build.hasVoted 
                                                        ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30" 
                                                        : "bg-zinc-800/90 text-zinc-400 hover:text-yellow-400 hover:bg-zinc-700"
                                                )}
                                                title={build.hasVoted ? "Retirer mon vote" : "Voter pour ce stuff !"}
                                            >
                                                <Star className={cn("w-3.5 h-3.5", build.hasVoted && "fill-current")} />
                                                {build.votesCount > 0 && (
                                                    <span className="text-[10px] font-bold">{build.votesCount}</span>
                                                )}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigator.clipboard.writeText(build.url);
                                                    toast.success("Lien copié !");
                                                }}
                                                className="p-1.5 bg-zinc-800/90 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors shadow-lg pointer-events-auto"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                            {currentProfileId === build.author.id && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleShare(build.id, "STUFF", build.author.id); }}
                                                    disabled={sharingIds.has(build.id) || !stuffShareConfigured}
                                                    className={cn(
                                                        "p-1.5 rounded-lg transition-colors shadow-lg pointer-events-auto disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed",
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
                                                className="p-1.5 bg-emerald-500 rounded-lg text-white hover:bg-emerald-400 transition-colors shadow-lg pointer-events-auto"
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
                                            <AvatarFallback className="text-[9px] bg-zinc-900 text-zinc-500">
                                                {build.author.name.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-[11px] text-zinc-500">
                                            Par <span className="text-zinc-300 font-bold">{build.author.name}</span>
                                        </span>
                                    </div>
                                    <span className={cn(
                                        "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border",
                                        build.source === "dofusroom"
                                            ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    )}>
                                        {build.source === "dofusroom" ? "DofusRoom" : "DofusBook"}
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
                                        <NextImage 
                                            src={skin.thumbnailUrl} 
                                            alt={skin.name} 
                                            fill 
                                            className="object-contain group-hover/card:scale-105 transition-transform duration-500 bg-zinc-950/30" 
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-zinc-950">
                                            <NextImage src="/assets/dofus/logo-sigil.png" alt="Sigil" width={64} height={64} className="opacity-10 grayscale" />
                                        </div>
                                    )}

                                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent p-4 flex flex-col justify-end">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-sm font-black text-white truncate max-w-[150px]">{skin.name}</h3>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/10 text-white/60 font-black uppercase tracking-tighter">
                                                    {skin.provider}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
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
                                                        "p-1.5 rounded-lg transition-colors shadow-lg disabled:opacity-50 flex items-center justify-center gap-1.5",
                                                        skin.hasVoted 
                                                            ? "bg-yellow-500 text-black" 
                                                            : "bg-zinc-800/90 text-zinc-400 hover:text-yellow-400 hover:bg-zinc-700"
                                                    )}
                                                >
                                                    <Star className={cn("w-3.5 h-3.5", skin.hasVoted && "fill-current")} />
                                                    {skin.votesCount > 0 && (
                                                        <span className="text-[10px] font-black">{skin.votesCount}</span>
                                                    )}
                                                </button>
                                                {currentProfileId === skin.author.id && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleShare(skin.id, "SKIN"); }}
                                                        disabled={sharingIds.has(skin.id) || !skinShareConfigured}
                                                        className={cn(
                                                            "p-1.5 rounded-lg transition-colors shadow-lg disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed",
                                                            "bg-indigo-500 text-white hover:bg-indigo-400"
                                                        )}
                                                        title={skinShareConfigured ? "Partager sur Discord" : "Non configuré (Admin)"}
                                                    >
                                                        {sharingIds.has(skin.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Megaphone className="w-3.5 h-3.5" />}
                                                    </button>
                                                )}
                                                <a 
                                                    href={skin.url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 bg-sky-500 rounded-lg text-white hover:bg-sky-400 transition-colors shadow-lg"
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between px-2">
                                    <div className="flex items-center gap-2.5">
                                        <Avatar className="w-6 h-6 border border-white/10">
                                            <AvatarImage src={skin.author.image || undefined} />
                                            <AvatarFallback className="text-[9px] bg-zinc-900 text-zinc-500">
                                                {skin.author.name.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-[11px] text-zinc-500">
                                            Par <span className="text-zinc-300 font-bold">{skin.author.name}</span>
                                        </span>
                                    </div>
                                    <span className="text-[9px] text-zinc-600 font-medium">
                                        {new Date(skin.createdAt).toLocaleDateString()}
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
                        <span className="text-[10px] text-zinc-500 ml-1">
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
                                        <span className="text-[10px] font-black text-sky-400 tracking-widest uppercase">
                                            {selectedSkin.provider}
                                        </span>
                                    </div>
                                    <div className="bg-zinc-950/80 backdrop-blur-xl px-3 py-1 rounded-xl border border-white/10 w-fit shadow-2xl flex items-center gap-2">
                                        <Avatar className="w-4 h-4 border border-white/10">
                                            <AvatarImage src={selectedSkin.author.image || undefined} />
                                            <AvatarFallback className="text-[6px] bg-zinc-900">{selectedSkin.author.name.substring(0,2)}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-[10px] font-black text-zinc-400 tracking-tighter uppercase">
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
                                                    <span className="text-[10px] font-black uppercase tracking-widest">
                                                        {(() => {
                                                            const classData = DOFUS_CLASSES.find(c => getNumericClassId(c) === Number(selectedSkin.metadata!.class));
                                                            return classData ? classData.name : selectedSkin.metadata.class;
                                                        })()}
                                                    </span>
                                                </div>
                                            )}
                                            {selectedSkin.metadata?.gender && (
                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl shadow-inner">
                                                     <span className="text-[10px] font-black uppercase tracking-widest">
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
                                                            <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-zinc-600">
                                                                #{selectedSkin.metadata.head}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-[9px] font-black uppercase tracking-widest opacity-70">
                                                        Visage {String(selectedSkin.metadata.head).startsWith('http') ? "" : selectedSkin.metadata.head}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Colors */}
                                    {selectedSkin.colors && Object.keys(selectedSkin.colors).length > 0 && (
                                        <div className="space-y-4">
                                            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-2">
                                                <div className="w-1 h-1 rounded-full bg-sky-500" />
                                                Harmonie de Couleurs
                                            </h3>
                                            <div className="grid grid-cols-2 gap-2">
                                                {Object.entries(selectedSkin.colors).map(([label, hex]) => (
                                                    <div key={label} className="bg-white/5 border border-white/5 rounded-xl p-2 flex items-center gap-3 hover:bg-white/10 transition-colors">
                                                        <div 
                                                            className="w-8 h-8 rounded-lg shadow-inner border border-white/10 shrink-0"
                                                            style={{ backgroundColor: hex as string }}
                                                        />
                                                        <div className="min-w-0">
                                                            <p className="text-[9px] font-bold text-zinc-500 truncate uppercase tracking-tighter">{label}</p>
                                                            <p className="text-[11px] font-black text-white uppercase font-mono">{hex as string}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Equipment */}
                                    {selectedSkin.equipment && Array.isArray(selectedSkin.equipment) && selectedSkin.equipment.length > 0 && (
                                        <div className="space-y-4 pb-4">
                                            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-2">
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
                                                                <p className="text-[12px] font-bold text-white group-hover/item:text-sky-400 transition-colors leading-tight">{item.name}</p>
                                                                <p className="text-[9px] text-zinc-500 font-medium uppercase tracking-wider">{item.type}</p>
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
                                    className="rounded-xl border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10 h-12 text-xs"
                                >
                                    <a href={selectedSkin.url} target="_blank" rel="noopener noreferrer" className="gap-2">
                                        <ExternalLink className="w-4 h-4" />
                                        Voir Source
                                    </a>
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className="rounded-xl border-white/5 bg-sky-500/10 text-sky-400 hover:bg-sky-500 hover:text-white h-12 text-xs font-black uppercase tracking-widest"
                                    onClick={() => handleCopyLink(selectedSkin.url)}
                                >
                                    <Copy className="w-4 h-4 mr-2" />
                                    Copier Lien
                                </Button>
                                {currentProfileId === selectedSkin.author.id && (
                                    <Button 
                                        variant="outline" 
                                        className="rounded-xl border-indigo-500/30 bg-indigo-500/5 text-indigo-400 hover:bg-indigo-500 hover:text-white h-12 text-xs font-black uppercase tracking-widest col-span-2"
                                        onClick={() => handleShare(selectedSkin.id, "SKIN", selectedSkin.author.id)}
                                        disabled={sharingIds.has(selectedSkin.id) || !skinShareConfigured}
                                    >
                                        <Megaphone className="w-4 h-4 mr-2" />
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

