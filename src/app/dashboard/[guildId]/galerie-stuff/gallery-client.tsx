"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { Link2, Search, ShieldCheck, ExternalLink, ChevronDown, Loader2, RefreshCw, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DofusbookPreview } from "@/components/dofus/dofusbook-preview";
import { DO_TAGS } from "@/lib/dofus-tags";
import { DOFUS_CLASSES } from "@/lib/dofus-assets";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getStuffGalleryPage, refreshBuildMetadata, type GalleryBuild } from "@/server/actions/gallery-actions";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import NextImage from "next/image";

const BI_ELEMENT_IDS = ["terrefeu","terreeau","terreair","feueau","feuair","eauair","multinocrit","sagesse","leveling","songes"];

// Extract numeric icon ID from icon path (e.g. "/assets/dofus/classes/9.png" → 9)
function getNumericClassId(cls: typeof DOFUS_CLASSES[number]): number | null {
    const match = cls.icon.match(/classes\/(\d+)\.png/);
    return match ? parseInt(match[1]) : null;
}

function BiElementFilter({
    selectedTag, onSelectTag
}: { selectedTag: string | null; onSelectTag: (id: string | null) => void }) {
    const biTags = DO_TAGS.filter(t => BI_ELEMENT_IDS.includes(t.id));
    const activeInBi = biTags.find(t => t.id === selectedTag);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button className={cn(
                    "h-8 px-3 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 shrink-0",
                    activeInBi ? activeInBi.className : "bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10"
                )}>
                    {activeInBi ? activeInBi.text : "Bi-éléments"}
                    <ChevronRight className="w-3 h-3 opacity-60" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-52 bg-zinc-950 border-white/10 rounded-2xl p-2 shadow-2xl" align="start" side="bottom">
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest px-2 pt-1 pb-2">Bi-éléments & spéciaux</p>
                <div className="flex flex-col gap-0.5">
                    {biTags.map(tag => (
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
                    <ChevronRight className="w-3 h-3 opacity-60" />
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
    const [isPending, startTransition] = useTransition();
    const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());

    // Debounced search - triggers server-side re-fetch after 300ms
    const debouncedSearch = useDebounce(searchQuery, 300);

    // Reset and re-fetch from page 1 when filters change
    const applyFilters = useCallback((query: string, tag: string | null, classId?: string | number | null) => {
        const classIdStr = classId !== null && classId !== undefined ? String(classId) : undefined;
        startTransition(async () => {
            const res = await getStuffGalleryPage(guildId, 1, query || undefined, tag || undefined, classIdStr);
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
            applyFilters(debouncedSearch, selectedTag, selectedClass);
        }
    }, [debouncedSearch, selectedTag, selectedClass, applyFilters]);

    const handleTagChange = (tag: string | null) => {
        setSelectedTag(tag);
        applyFilters(searchQuery, tag, selectedClass);
    };

    const handleClassChange = (classId: number | null) => {
        setSelectedClass(classId);
        applyFilters(searchQuery, selectedTag, classId !== null ? String(classId) : null);
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
                selectedClass !== null ? String(selectedClass) : undefined
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
                applyFilters(searchQuery, selectedTag, selectedClass);
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

    return (
        <div className="space-y-6 pb-20">
            {/* Hero Header */}
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-8 lg:p-10">
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full -mr-20 -mt-20 shrink-0" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full -ml-20 -mb-20 shrink-0" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-3">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Communauté SigilOS 2026
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

            {/* Filter Bar — primary + advanced popover */}
            <div className="sticky top-0 z-30">
                <div className="bg-zinc-950/95 backdrop-blur-xl border border-white/8 rounded-2xl px-4 py-3 shadow-xl flex flex-col gap-3">
                    {/* Primary row */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* ALL */}
                        <button
                            onClick={() => handleTagChange(null)}
                            className={cn(
                                "h-8 px-4 rounded-xl text-[11px] font-black transition-all shrink-0",
                                !selectedTag ? "bg-white text-black" : "bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10"
                            )}
                        >
                            Tous · <span className={!selectedTag ? "text-zinc-500" : "text-zinc-600"}>{total}</span>
                        </button>

                        <div className="w-px h-5 bg-white/8 shrink-0" />

                        {/* Pure elements */}
                        {["eau","feu","terre","air","multi"].map(id => {
                            const tag = DO_TAGS.find(t => t.id === id)!;
                            return (
                                <button
                                    key={id}
                                    onClick={() => handleTagChange(selectedTag === id ? null : id)}
                                    className={cn(
                                        "h-8 px-3 rounded-xl text-[11px] font-bold transition-all shrink-0",
                                        selectedTag === id ? tag.className : "bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10"
                                    )}
                                >
                                    {tag.text}
                                </button>
                            );
                        })}

                        <div className="w-px h-5 bg-white/8 shrink-0" />

                        {/* Style tags */}
                        {["tank","soin","pp","dopou","docrit","ini","retpa","retpm"].map(id => {
                            const tag = DO_TAGS.find(t => t.id === id)!;
                            if (!tag) return null;
                            return (
                                <button
                                    key={id}
                                    onClick={() => handleTagChange(selectedTag === id ? null : id)}
                                    className={cn(
                                        "h-8 px-3 rounded-xl text-[11px] font-bold transition-all shrink-0",
                                        selectedTag === id ? tag.className : "bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10"
                                    )}
                                >
                                    {tag.text}
                                </button>
                            );
                        })}

                        <div className="w-px h-5 bg-white/8 shrink-0" />

                        {/* Class filter */}
                        <ClassFilter selectedClass={selectedClass} onSelectClass={handleClassChange} />

                        <div className="w-px h-5 bg-white/8 shrink-0" />

                        {/* Bi-element dropdown */}
                        <BiElementFilter selectedTag={selectedTag} onSelectTag={handleTagChange} />
                    </div>

                    {/* Count + reset */}
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] text-zinc-600">
                            <span className="text-zinc-400 font-bold">{builds.length}</span>
                            <span> / {total} build{total !== 1 ? "s" : ""}</span>
                            {selectedClass && <span className="text-blue-400 ml-2">· {DOFUS_CLASSES.find(c => getNumericClassId(c) === selectedClass)?.name}</span>}
                            {selectedTag && <span className="text-emerald-600 ml-2">· {DO_TAGS.find(t => t.id === selectedTag)?.label}</span>}
                            {searchQuery && <span className="text-zinc-500 ml-2">· "{searchQuery}"</span>}
                        </p>
                        {(searchQuery || selectedTag || selectedClass) && (
                            <button
                                onClick={() => { setSearchQuery(""); setSelectedTag(null); setSelectedClass(null); applyFilters("", null, null); }}
                                className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors font-medium underline underline-offset-2"
                            >
                                Réinitialiser
                            </button>
                        )}
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
                                
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-all duration-300 rounded-2xl flex flex-col justify-end p-4 z-10 pointer-events-none">
                                    <div className="flex items-center justify-end gap-2">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleRefresh(build); }}
                                            disabled={refreshingIds.has(build.id)}
                                            className="p-1.5 bg-zinc-800/90 rounded-lg text-white hover:bg-zinc-700 transition-colors shadow-lg pointer-events-auto disabled:opacity-50"
                                            title="Recacher les données"
                                        >
                                            <RefreshCw className={cn("w-3.5 h-3.5", refreshingIds.has(build.id) && "animate-spin")} />
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
                            
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <Avatar className="w-5 h-5 border border-white/5 opacity-60 group-hover/card:opacity-100 transition-opacity">
                                        <AvatarImage src={build.author.image || undefined} />
                                        <AvatarFallback className="text-[8px] bg-zinc-900 border-white/5 text-zinc-500 font-bold">
                                            {build.author.name.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="text-[10px] text-zinc-500 font-medium group-hover/card:text-zinc-300 transition-colors">
                                        Par <span className="text-zinc-400">{build.author.name}</span>
                                    </span>
                                </div>
                                <div className="text-[10px] text-zinc-600 font-mono">
                                    REF-{String(idx + 1).padStart(3, '0')}
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
                            <h3 className="text-zinc-300 font-semibold">Aucun build trouvé</h3>
                            <p className="text-zinc-500 text-sm">Ajustez vos filtres ou lancez une nouvelle recherche.</p>
                        </div>
                        {(searchQuery || selectedTag) && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => { setSearchQuery(""); handleTagChange(null); }}
                                className="border-white/10 hover:bg-white/5"
                            >
                                Réinitialiser
                            </Button>
                        )}
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
