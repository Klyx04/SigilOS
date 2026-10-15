"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { io } from "socket.io-client";
import { buildWsUrl } from "@/lib/socket-utils";
import { Plus, Search, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DjPostCard } from "./DjPostCard";
import { DjPostCreateModal } from "./DjPostCreateModal";
import { DjFiltersBar, type DjFiltersState } from "./DjFiltersBar";
import type { DjPostWithDetails } from "@/server/actions/dungeon-finder-actions";

const DEFAULT_FILTERS: DjFiltersState = {
    search: "",
    mode: "",
    minLevel: 1,
    maxLevel: 1000,
    showClosed: false,
    onlyWithAchievement: false,
    onlyWithSpots: false,
};

interface DungeonFinderClientProps {
    guildId: string;
    initialPosts: DjPostWithDetails[];
    currentProfileId?: string;
    isAdmin?: boolean;
    // Server action bound at page level
    refreshPosts: () => Promise<DjPostWithDetails[]>;
    isDiscordConfigured?: boolean;
}

/**
 * #138 — Module Donjons & Quêtes = POSTS UNIQUEMENT (un seul onglet).
 * Les succès (checklist + annuaire) vivent désormais dans /succes (module dédié).
 * Pont sortant : ?dungeonId= (deep-link depuis le module Succès) pré-remplit la création.
 */
export function DungeonFinderClient({
    guildId,
    initialPosts,
    currentProfileId,
    isAdmin,
    refreshPosts,
    isDiscordConfigured,
}: DungeonFinderClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [posts, setPosts] = useState<DjPostWithDetails[]>(initialPosts);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [filters, setFilters] = useState<DjFiltersState>(DEFAULT_FILTERS);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [initialDungeonId, setInitialDungeonId] = useState<string | undefined>(undefined);
    const handledDeepLink = useRef(false);

    async function handleRefresh() {
        setIsRefreshing(true);
        try {
            const fresh = await refreshPosts();
            setPosts(fresh);
        } catch {
            // Silently fail
        } finally {
            setIsRefreshing(false);
        }
    }

    // Real-time updates via WebSocket
    useEffect(() => {
        const socketUrl = buildWsUrl();
        const socket = io(socketUrl, {
            path: "/socket.io/",
            withCredentials: true,
            query: { guildId }
        });

        socket.on("connect", () => {
            // No-op — le socket est prêt, les events arrivent ensuite.
        });

        socket.on("dj:finder:update", (_data: any) => {
            handleRefresh();
        });

        return () => {
            socket.disconnect();
        };
    }, [guildId]);

    // Pont depuis le module Succès : ?dungeonId= → ouvre le modal de création pré-rempli.
    useEffect(() => {
        if (handledDeepLink.current) return;
        const dungeonId = searchParams.get("dungeonId");
        if (dungeonId) {
            handledDeepLink.current = true;
            setInitialDungeonId(dungeonId);
            setIsCreateOpen(true);
            const params = new URLSearchParams(searchParams.toString());
            params.delete("dungeonId");
            router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
        }
    }, [searchParams, router]);

    // Client-side filter
    const filteredPosts = useMemo(() => {
        const term = filters.search.toLowerCase();
        return posts.filter((p) => {
            if (!filters.showClosed && (p.status === "CLOSED" || p.status === "EXPIRED")) return false;
            if (filters.mode && p.mode !== filters.mode) return false;
            if (term) {
                const dName = p.dungeon?.name.toLowerCase() || "";
                const dBoss = p.dungeon?.bossName.toLowerCase() || "";
                const qName = p.questName?.toLowerCase() || "";
                if (!dName.includes(term) && !dBoss.includes(term) && !qName.includes(term)) return false;
            }
            if (p.dungeon) {
                if (p.dungeon.level < filters.minLevel || p.dungeon.level > filters.maxLevel) return false;
            }
            if (filters.onlyWithSpots) {
                const accepted = (p._acceptedCount ?? 0) + 1;
                if (accepted >= p.maxMembers) return false;
            }
            if (filters.onlyWithAchievement) {
                if (!p.wantedAchievementIds || p.wantedAchievementIds.length === 0) return false;
            }
            return true;
        });
    }, [posts, filters]);

    /**
     * Répartition des posts par mode, dans le même périmètre que la liste affichée
     * (posts fermés exclus tant que « Posts fermés » n'est pas coché) : le compteur
     * des segments de filtre ne peut donc pas mentir.
     */
    const modeCounts = useMemo(() => {
        const scope = posts.filter(
            (p) => filters.showClosed || (p.status !== "CLOSED" && p.status !== "EXPIRED")
        );
        const counts: Record<string, number> = { "": scope.length };
        for (const p of scope) counts[p.mode] = (counts[p.mode] ?? 0) + 1;
        return counts;
    }, [posts, filters.showClosed]);

    const myActivePosts = useMemo(
        () => posts.filter((p) => p.profileId === currentProfileId && p.status === "OPEN"),
        [posts, currentProfileId]
    );
    const activePostsCount = useMemo(
        () => posts.filter((p) => p.status === "OPEN" || p.status === "FULL").length,
        [posts]
    );
    const canCreate = myActivePosts.length < 3;

    return (
        <div className="space-y-8">
            <div className="space-y-5">
                {/* Toolbar — sticky sous la navbar : dissociée du scroll des résultats */}
                <div className="flex flex-col xl:flex-row xl:items-start gap-3 sticky top-14 z-20 bg-background/85 backdrop-blur-md pb-3 border-b border-border/40">
                    <div className="flex-1">
                        <DjFiltersBar
                            filters={filters}
                            onChange={setFilters}
                            total={activePostsCount}
                            filtered={filteredPosts.length}
                            modeCounts={modeCounts}
                        />
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="w-10 h-10 rounded-xl border border-border/70 bg-surface/40 hover:bg-surface/80 text-muted-foreground hover:text-foreground transition-all"
                            title="Rafraîchir"
                        >
                            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
                        </Button>
                        <Button
                            onClick={() => setIsCreateOpen(true)}
                            disabled={!canCreate}
                            title={canCreate ? "Créer un post" : "Tu as atteint la limite de 3 posts actifs"}
                            className={`font-bold h-10 px-4 rounded-xl gap-2 transition-all cursor-pointer ${canCreate
                                ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-md shadow-emerald-950/20 border border-emerald-400/40"
                                : "bg-surface/40 text-muted-foreground border border-border/60 cursor-not-allowed opacity-60"
                                }`}
                        >
                            {canCreate ? (
                                <Plus className="w-4 h-4 text-black stroke-[2.5]" />
                            ) : (
                                <AlertTriangle className="w-4 h-4 text-amber-400" />
                            )}
                            Nouveau post
                            {!canCreate && (
                                <span className="ml-1 font-mono text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-md">
                                    {myActivePosts.length}/3
                                </span>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Anti-spam hint — sobre et anti-slop */}
                {!canCreate && (
                    <div className="flex items-center justify-between gap-3 text-xs bg-surface/40 border border-border/70 rounded-xl px-4 py-2.5 text-muted-foreground backdrop-blur-sm">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
                            <span className="truncate">
                                Limite atteinte : <strong className="text-foreground">{myActivePosts.length}/3 posts actifs</strong>. Termine un post pour en ouvrir un nouveau.
                            </span>
                        </div>
                        <button
                            onClick={() => setFilters({ ...DEFAULT_FILTERS, search: "" })}
                            className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2 shrink-0 transition-colors"
                        >
                            Mes posts
                        </button>
                    </div>
                )}

                {/* Posts grid */}
                {filteredPosts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-[340px] border border-dashed border-border/70 rounded-2xl bg-surface/20 backdrop-blur-sm p-8">
                        <div className="w-14 h-14 rounded-2xl bg-surface/80 border border-border/80 flex items-center justify-center mb-4 shadow-inner">
                            <Search className="w-6 h-6 text-muted-foreground/60" />
                        </div>
                        <h3 className="text-base font-bold text-foreground mb-1">Aucun post actif</h3>
                        <p className="text-sm text-muted-foreground text-center max-w-xs">
                            {filters.search || filters.mode
                                ? "Modifie les filtres pour voir plus de posts."
                                : "Sois le premier à créer un post de recherche de groupe !"}
                        </p>
                        {canCreate && (
                            <Button
                                data-tour="donjons-create"
                                className="mt-5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold h-10 px-5 rounded-xl shadow-md shadow-emerald-950/20"
                                onClick={() => setIsCreateOpen(true)}
                            >
                                <Plus className="w-4 h-4 mr-2 stroke-[2.5]" /> Créer un post
                            </Button>
                        )}
                    </div>
                ) : (
                    <div
                        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4.5 min-h-[420px] content-start" data-tour="donjons-list"
                    >
                        {filteredPosts.map((post) => (
                            <DjPostCard
                                key={post.id}
                                post={post}
                                guildId={guildId}
                                currentProfileId={currentProfileId}
                                isAdmin={isAdmin}
                                onRefresh={handleRefresh}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Create modal */}
            <DjPostCreateModal
                guildId={guildId}
                isOpen={isCreateOpen}
                initialDungeonId={initialDungeonId}
                isDiscordConfigured={isDiscordConfigured}
                onClose={() => {
                    setIsCreateOpen(false);
                    setInitialDungeonId(undefined);
                }}
                onCreated={handleRefresh}
            />
        </div>
    );
}
