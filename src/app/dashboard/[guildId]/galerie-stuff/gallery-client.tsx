"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { Link2, Search, ShieldCheck, ExternalLink, ChevronDown, Loader2, RefreshCw, ChevronRight, Copy, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DofusbookPreview } from "@/components/dofus/dofusbook-preview";
import { DO_TAGS } from "@/lib/dofus-tags";
import { DOFUS_CLASSES } from "@/lib/dofus-assets";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getStuffGalleryPage, refreshBuildMetadata, type GalleryBuild } from "@/server/actions/gallery-actions";
import { toggleBuildVote } from "@/server/actions/vote-actions";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import NextImage from "next/image";

const ADVANCED_TAG_IDS = ["tank","soin","pp","dopou","docrit","ini","retpa","retpm","terrefeu","terreeau","terreair","feueau","feuair","eauair","multinocrit","sagesse","leveling","songes"];

// Extract numeric icon ID from icon path (e.g. "/assets/dofus/classes/9.png" → 9)
function getNumericClassId(cls: typeof DOFUS_CLASSES[number]): number | null {
    const match = cls.icon.match(/classes\/(\d+)\.png/);
    return match ? parseInt(match[1]) : null;
}

function AdvancedTagFilter({
    selectedTag, onSelectTag
}: { selectedTag: string | null; onSelectTag: (id: string | null) => void }) {
    const advancedTags = DO_TAGS.filter(t => ADVANCED_TAG_IDS.includes(t.id));
    const activeInAdvanced = advancedTags.find(t => t.id === selectedTag);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button className={cn(
                    "h-8 px-3 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 shrink-0",
                    activeInAdvanced ? activeInAdvanced.className : "bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10"
                )}>
                    {activeInAdvanced ? activeInAdvanced.text : "Spécialités & Bi-éléments"}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 bg-zinc-950 border-white/10 rounded-2xl p-2 shadow-2xl" align="start" side="bottom">
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest px-2 pt-1 pb-2">Tags avancés</p>
                <div className="grid grid-cols-2 gap-1 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                    {advancedTags.map(tag => (
                        <button
                            key={tag.id}
                            onClick={() => onSelectTag(selectedTag === tag.id ? null : tag.id)}
                            className={cn(
                                "flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-left w-full transition-all",
                                selectedTag === tag.id ? tag.className : "text-zinc-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            {tag.text}
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

function ClassFilter({
    selectedClass, onSelectClass
}: { selectedClass: number | null; onSelectClass: (id: number | null) => void }) {
    const active = DOFUS_CLASSES.find(c => getNumericClassId(c) === selectedClass);
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button className={cn(
                    "h-8 px-3 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 shrink-0",
                    active ? "bg-white/10 text-white border border-white/20" : "bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10"
                )}>
                    {active ? (
                        <>
                            <NextImage src={active.icon} alt={active.name} width={14} height={14} className="object-contain" />
                            {active.name}
                        </>
                    ) : "Classe"}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 bg-zinc-950 border-white/10 rounded-2xl p-2 shadow-2xl" align="start" side="bottom">
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest px-2 pt-1 pb-2">Filtrer par classe</p>
                <div className="grid grid-cols-3 gap-1">
                    {DOFUS_CLASSES.map(cls => {
                        const numId = getNumericClassId(cls);
                        if (numId === null) return null;
                        return (
                            <button
                                key={cls.id}
                                onClick={() => onSelectClass(selectedClass === numId ? null : numId)}
                                className={cn(
                                    "flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-semibold transition-all",
                                    selectedClass === numId
                                        ? "bg-white/10 text-white ring-1 ring-white/20"
                                        : "text-zinc-500 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <NextImage src={cls.icon} alt={cls.name} width={24} height={24} className="object-contain" />
                                {cls.name}
                            </button>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}

interface GalleryClientProps {
    initialBuilds: GalleryBuild[];
    initialTotal: number;
    initialHasMore: boolean;
    guildId: string;
}

export function GalleryClient({ initialBuilds, initialTotal, initialHasMore, guildId }: GalleryClientProps) {
    const [builds, setBuilds] = useState<GalleryBuild[]>(initialBuilds);
    const [total, setTotal] = useState(initialTotal);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [selectedClass, setSelectedClass] = useState<number | null>(null);
    const [sortBy, setSortBy] = useState<"newest" | "votes">("newest");
    const [isPending, startTransition] = useTransition();
    const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
    const [votingIds, setVotingIds] = useState<Set<string>>(new Set());

    // Debounced search - triggers server-side re-fetch after 300ms
    const debouncedSearch = useDebounce(searchQuery, 300);

    // Reset and re-fetch from page 1 when filters change
    const applyFilters = useCallback((query: string, tag: string | null, classId?: string | number | null, sortKey?: "newest" | "votes") => {
        const classIdStr = classId !== null && classId !== undefined ? String(classId) : undefined;
        startTransition(async () => {
            const res = await getStuffGalleryPage(guildId, 1, query || undefined, tag || undefined, classIdStr, sortKey || sortBy);
            if (res.success && res.data) {
                setBuilds(res.data.builds);
                setTotal(res.data.total);
                setHasMore(res.data.hasMore);
                setPage(1);
            }
        });
    }, [guildId]);

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
    };

    // Use debounced search to trigger filtering
    useEffect(() => {
        if (debouncedSearch !== undefined) {
            applyFilters(debouncedSearch, selectedTag, selectedClass, sortBy);
        }
    }, [debouncedSearch, selectedTag, selectedClass, sortBy, applyFilters]);

    const handleTagChange = (tag: string | null) => {
        setSelectedTag(tag);
        applyFilters(searchQuery, tag, selectedClass, sortBy);
    };

    const handleClassChange = (classId: number | null) => {
        setSelectedClass(classId);
        applyFilters(searchQuery, selectedTag, classId !== null ? String(classId) : null, sortBy);
    };
    
    const handleSortChange = (newSort: "newest" | "votes") => {
        setSortBy(newSort);
        applyFilters(searchQuery, selectedTag, selectedClass, newSort);
    };

    // Infinite scroll: load next page
    const loadMore = () => {
        startTransition(async () => {
            const nextPage = page + 1;
            const res = await getStuffGalleryPage(
                guildId, 
                nextPage, 
                searchQuery || undefined, 
                selectedTag || undefined,
                selectedClass !== null ? String(selectedClass) : undefined,
                sortBy
            );
            if (res.success && res.data) {
                setBuilds(prev => [...prev, ...res.data!.builds]);
                setHasMore(res.data.hasMore);
                setPage(nextPage);
            }
        });
    };

    const handleRefresh = async (build: GalleryBuild) => {
        if (refreshingIds.has(build.id)) return;
        
        setRefreshingIds(prev => new Set(prev).add(build.id));
        toast.info(`Rafraîchissement de "${build.name}"...`);

        try {
            const res = await refreshBuildMetadata(guildId, build.author.id, build.url);
            if (res.success) {
                toast.success("Build mis à jour !");
                // The page will revalidate and refresh data automatically via revalidatePath
                // But we can also trigger a local refresh of current builds list if needed
                applyFilters(searchQuery, selectedTag, selectedClass, sortBy);
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

    const handleVote = async (build: GalleryBuild) => {
        if (votingIds.has(build.id)) return;

        setVotingIds(prev => new Set(prev).add(build.id));

        // Optimistic update
        const originalVoted = build.hasVoted;
        const offset = originalVoted ? -1 : 1;
        setBuilds(current => current.map(b =>
            b.id === build.id
                ? { ...b, hasVoted: !originalVoted, votesCount: Math.max(0, b.votesCount + offset) }
                : b
        ));

        try {
            const res = await toggleBuildVote(guildId, build.id);
            if (!res.success) {
                // Revert
                setBuilds(current => current.map(b =>
                    b.id === build.id
                        ? { ...b, hasVoted: originalVoted, votesCount: build.votesCount }
                        : b
                ));
                toast.error(res.error || "Erreur lors du vote");
            }
        } catch (error) {
            // Revert
            setBuilds(current => current.map(b =>
                b.id === build.id
                    ? { ...b, hasVoted: originalVoted, votesCount: build.votesCount }
                    : b
            ));
            toast.error("Erreur réseau");
        } finally {
            setVotingIds(prev => {
                const next = new Set(prev);
                next.delete(build.id);
                return next;
            });
        }
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Hero Header */}
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-8 lg:p-10">
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full -mr-20 -mt-20 shrink-0" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full -ml-20 -mb-20 shrink-0" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div>
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                Communauté SigilOS 2026
                            </div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium" title="Statistiques, équipements et forgemagie mis à jour dynamiquement via le proxy Dofusbook">
                                <RefreshCw className="w-3 h-3" />
                                Synchro Temps Réel Dofusbook
                            </div>
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tight mb-2">
                            Galerie <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-indigo-400">Stuff</span>
                        </h1>
                        <p className="text-zinc-400 max-w-xl text-base leading-relaxed">
                            Découvrez les meilleurs builds partagés par les membres de la guilde.
                        </p>
                    </div>

                    {/* Search bar */}
                    <div className="relative group w-full lg:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
                        <Input
                            placeholder="Rechercher un build, un pseudo..."
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="bg-zinc-950/80 border-white/10 pl-11 h-12 rounded-2xl focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all text-sm text-white placeholder:text-zinc-600"
                        />
                        {isPending && (
                            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 animate-spin" />
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
                                        {tag.text}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="w-px h-6 bg-white/10 shrink-0 hidden sm:block" />

                        {/* 3. Advanced / Specialities */}
                        <div className="flex items-center bg-black/40 p-1 rounded-2xl border border-white/5">
                            <AdvancedTagFilter selectedTag={selectedTag} onSelectTag={handleTagChange} />
                        </div>
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
                                <span className="w-2 h-2 rounded-full bg-emerald-500/50 animate-pulse shrink-0" />
                                <span className="text-white font-black">{builds.length}</span>
                                <span> sur {total} build{total !== 1 ? "s" : ""}</span>
                                {selectedClass && <span className="text-blue-400 font-bold ml-1 hidden sm:inline">· {DOFUS_CLASSES.find(c => getNumericClassId(c) === selectedClass)?.name}</span>}
                            </p>
                            {(searchQuery || selectedTag || selectedClass) ? (
                                <>
                                    <div className="w-px h-4 bg-white/10 shrink-0" />
                                    <button
                                        onClick={() => { setSearchQuery(""); setSelectedTag(null); setSelectedClass(null); applyFilters("", null, null); }}
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

            {/* Grid — 24 cards max per page, then "load more" */}
            <div className={cn(
                "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6",
                isPending && "opacity-50 pointer-events-none transition-opacity"
            )}>
                {builds.length > 0 ? (
                    builds.map((build, idx) => (
                        <div key={build.id} className="group/card flex flex-col gap-3">
                            <div className="relative">
                                <DofusbookPreview url={build.url} title={build.name} tags={build.tags} classId={build.classId ? Number(build.classId) : undefined} initialData={build.previewData} />
                                
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent transition-all duration-300 rounded-2xl flex flex-col justify-end p-4 z-10 pointer-events-none">
                                    <div className="flex items-center justify-end gap-2">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleRefresh(build); }}
                                            disabled={refreshingIds.has(build.id)}
                                            className="p-1.5 bg-zinc-800/90 rounded-lg text-white hover:bg-zinc-700 transition-colors shadow-lg pointer-events-auto disabled:opacity-50"
                                            title="Actualiser depuis Dofusbook"
                                        >
                                            <RefreshCw className={cn("w-3.5 h-3.5", refreshingIds.has(build.id) && "animate-spin")} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleVote(build);
                                            }}
                                            disabled={votingIds.has(build.id)}
                                            className={cn(
                                                "p-1.5 rounded-lg transition-colors shadow-lg pointer-events-auto disabled:opacity-50 flex items-center justify-center gap-1.5",
                                                build.hasVoted 
                                                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30" 
                                                    : "bg-zinc-800/90 text-zinc-400 hover:text-yellow-400 hover:bg-zinc-700"
                                            )}
                                            title={build.hasVoted ? "Retirer mon vote" : "Voter pour mettre en avant ce stuff !"}
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
                                                toast.success("Lien Dofusbook copié !");
                                            }}
                                            className="p-1.5 bg-zinc-800/90 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors shadow-lg pointer-events-auto"
                                            title="Copier le lien"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                        </button>
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
                                    <Avatar className="w-6 h-6 border border-white/10 opacity-70 group-hover/card:opacity-100 transition-opacity">
                                        <AvatarImage src={build.author.image || undefined} />
                                        <AvatarFallback className="text-[9px] bg-zinc-900 border-white/5 text-zinc-500 font-bold">
                                            {build.author.name.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="text-[11px] text-zinc-500 font-medium group-hover/card:text-zinc-300 transition-colors">
                                        Par <span className="text-zinc-300 font-bold text-[12px]">{build.author.name}</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                ) : !isPending ? (
                    <div className="col-span-full py-20 bg-zinc-950/20 rounded-3xl border border-dashed border-white/5 flex flex-col items-center justify-center text-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-zinc-900/50 flex items-center justify-center border border-white/5">
                            <Search className="w-8 h-8 text-zinc-700" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-zinc-300 font-semibold text-lg">Aucun build trouvé</h3>
                            <p className="text-zinc-500 text-sm max-w-md mx-auto">
                                S'il s'agit de votre première visite, vous devez importer vos stuffs DofusBook depuis l'onglet "Stuffs" de <strong>votre Profil</strong> pour qu'ils s'affichent ici.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                            {(searchQuery || selectedTag || selectedClass) && (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => { setSearchQuery(""); handleTagChange(null); handleClassChange(null); }}
                                    className="border-white/10 hover:bg-white/5 text-zinc-400"
                                >
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Réinitialiser les filtres
                                </Button>
                            )}
                            <a href={`/dashboard/${guildId}/profile?tab=combat`}>
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
                                    Aller sur mon profil
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            </a>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Load More button */}
            {hasMore && !isPending && (
                <div className="flex justify-center mt-6">
                    <Button
                        onClick={loadMore}
                        variant="outline"
                        className="gap-2 border-white/10 hover:bg-white/5 hover:border-emerald-500/30 hover:text-emerald-400 transition-all px-8"
                    >
                        <ChevronDown className="w-4 h-4" />
                        Charger plus de builds
                        <span className="text-xs text-zinc-500 ml-1">({total - builds.length} restants)</span>
                    </Button>
                </div>
            )}
        </div>
    );
}
