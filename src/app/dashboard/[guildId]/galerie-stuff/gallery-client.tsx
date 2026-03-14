"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { Link2, Search, Filter, ShieldCheck, ExternalLink, ChevronDown, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DofusbookPreview } from "@/components/dofus/dofusbook-preview";
import { DO_TAGS } from "@/lib/dofus-tags";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getStuffGalleryPage, refreshBuildMetadata, type GalleryBuild } from "@/server/actions/gallery-actions";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";

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
    const [isPending, startTransition] = useTransition();
    const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());

    // Debounced search - triggers server-side re-fetch after 300ms
    const debouncedSearch = useDebounce(searchQuery, 300);

    // Reset and re-fetch from page 1 when filters change
    const applyFilters = useCallback((query: string, tag: string | null) => {
        startTransition(async () => {
            const res = await getStuffGalleryPage(guildId, 1, query || undefined, tag || undefined);
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
            applyFilters(debouncedSearch, selectedTag);
        }
    }, [debouncedSearch, selectedTag, applyFilters]);

    const handleTagChange = (tag: string | null) => {
        setSelectedTag(tag);
        applyFilters(searchQuery, tag);
    };

    // Infinite scroll: load next page
    const loadMore = () => {
        startTransition(async () => {
            const nextPage = page + 1;
            const res = await getStuffGalleryPage(
                guildId, 
                nextPage, 
                searchQuery || undefined, 
                selectedTag || undefined
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
                applyFilters(searchQuery, selectedTag);
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
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-8 lg:p-12">
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full -mr-20 -mt-20 shrink-0" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full -ml-20 -mb-20 shrink-0" />
                
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Communauté SigilOS 2026
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tight mb-4">
                            Galerie <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-indigo-400">Stuff</span>
                        </h1>
                        <p className="text-zinc-400 max-w-xl text-lg leading-relaxed">
                            Découvrez les meilleurs builds partagés par les membres de la guilde. 
                            Une bibliothèque communautaire pour optimiser vos personnages Dofus.
                        </p>
                        <p className="mt-2 text-zinc-600 text-sm">
                            {total} build{total !== 1 ? "s" : ""} disponible{total !== 1 ? "s" : ""}
                        </p>
                    </div>

                    <div className="flex flex-col gap-4 w-full lg:w-96">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
                            <Input
                                placeholder="Rechercher un build, un pseudo..."
                                value={searchQuery}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                className="bg-zinc-950/50 border-white/5 pl-10 h-12 rounded-2xl focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all"
                            />
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleTagChange(null)}
                                className={cn(
                                    "rounded-xl h-9 px-4 text-xs font-semibold shrink-0 transition-all",
                                    !selectedTag ? "bg-white/10 text-white border border-white/20" : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                Tous les tags
                            </Button>
                            {DO_TAGS.map(tag => (
                                <Button
                                    key={tag.id}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleTagChange(selectedTag === tag.id ? null : tag.id)}
                                    className={cn(
                                        "rounded-xl h-9 px-4 text-xs font-semibold shrink-0 transition-all gap-1.5",
                                        selectedTag === tag.id ? tag.className : "bg-zinc-950/30 text-zinc-500 hover:text-zinc-300 border border-transparent"
                                    )}
                                >
                                    {tag.text}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Loading state for filter changes */}
            {isPending && (
                <div className="flex items-center justify-center gap-2 text-zinc-500 text-sm py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Chargement...
                </div>
            )}

            {/* Grid — 24 cards max per page, then "load more" */}
            <div className={cn(
                "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6",
                isPending && "opacity-50 pointer-events-none transition-opacity"
            )}>
                {builds.length > 0 ? (
                    builds.map((build, idx) => (
                        <div key={build.id} className="group/card flex flex-col gap-3">
                            <div className="relative">
                                <DofusbookPreview url={build.url} title={build.name} tags={build.tags} classId={build.classId} initialData={build.previewData} />
                                
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
                            <Filter className="w-8 h-8 text-zinc-700" />
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
