"use client";

import { useState, useCallback, useMemo, useTransition, useEffect } from "react";
import { io } from "socket.io-client";
import { buildWsUrl } from "@/lib/socket-utils";
import { Plus, Search, Trophy, Sword, RefreshCw, Frown, Users, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DjPostCard } from "./DjPostCard";
import { DjPostCreateModal } from "./DjPostCreateModal";
import { DjFiltersBar, type DjFiltersState } from "./DjFiltersBar";
import { AchievementTracker } from "./AchievementTracker";
import { DungeonDirectory } from "./DungeonDirectory";
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

type Tab = "posts" | "tracker" | "directory";

interface DungeonFinderClientProps {
    guildId: string;
    initialPosts: DjPostWithDetails[];
    currentProfileId?: string;
    isAdmin?: boolean;
    // Server action bound at page level
    refreshPosts: () => Promise<DjPostWithDetails[]>;
    isDiscordConfigured?: boolean;
}

export function DungeonFinderClient({
    guildId,
    initialPosts,
    currentProfileId,
    isAdmin,
    refreshPosts,
    isDiscordConfigured,
}: DungeonFinderClientProps) {
    const [activeTab, setActiveTab] = useState<Tab>("posts");
    const [posts, setPosts] = useState<DjPostWithDetails[]>(initialPosts);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [filters, setFilters] = useState<DjFiltersState>(DEFAULT_FILTERS);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [initialDungeonId, setInitialDungeonId] = useState<string | undefined>(undefined);

    function handleCreateGroupDirect(dungeonId: string) {
        setInitialDungeonId(dungeonId);
        setIsCreateOpen(true);
    }

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


    const myActivePosts = posts.filter((p) => p.profileId === currentProfileId && p.status === "OPEN");
    const canCreate = myActivePosts.length < 3;

    const TABS: { id: Tab; label: string; sub: string; icon: React.ElementType; color: "indigo" | "amber" | "emerald" }[] = [
        { id: "posts", label: "Recherche DJ", sub: "Trouver un groupe", icon: Search, color: "indigo" },
        { id: "tracker", label: "Mes Succès", sub: "Ma progression", icon: Trophy, color: "amber" },
        { id: "directory", label: "Succès Commun", sub: "La guilde", icon: Users, color: "emerald" },
    ];

    return (
        <div className="space-y-8">
            {/* Dissociated Professional Tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-tour="donjons-filters">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    const colorVariants = {
                        indigo: {
                            border: "border-info/50",
                            icon: "bg-info/15 border-info/30 text-info",
                            sub: "text-info",
                            glow: "bg-info",
                            shadow: "",
                            inactiveIcon: "bg-info/8 border-info/15 text-info",
                            inactiveSub: "text-info/70",
                            inactiveBorder: "border-info/20"
                        },
                        amber: {
                            border: "border-warning/50",
                            icon: "bg-warning/15 border-warning/30 text-warning",
                            sub: "text-warning",
                            glow: "bg-warning",
                            shadow: "",
                            inactiveIcon: "bg-warning/8 border-warning/15 text-warning",
                            inactiveSub: "text-warning/70",
                            inactiveBorder: "border-warning/20"
                        },
                        emerald: {
                            border: "border-success/50",
                            icon: "bg-success/15 border-success/30 text-success",
                            sub: "text-success",
                            glow: "bg-success",
                            shadow: "",
                            inactiveIcon: "bg-success/8 border-success/15 text-success",
                            inactiveSub: "text-success/70",
                            inactiveBorder: "border-success/20"
                        }
                    }[tab.color];

                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "relative group flex items-center gap-4 p-5 rounded-2xl border transition-colors",
                                isActive
                                    ? cn("bg-elevated/90 z-10", colorVariants.border)
                                    : cn("bg-surface/70 hover:bg-elevated/70", colorVariants.inactiveBorder)
                            )}
                        >
                            {/* Top Indicator */}
                            {isActive && (
                                <span className={cn(
                                    "absolute top-0 inset-x-0 h-[2px] z-20",
                                    tab.color === 'indigo' ? 'bg-info' :
                                    tab.color === 'amber' ? 'bg-warning' :
                                    'bg-success'
                                )} />
                            )}

                            {/* Icon Box */}
                            <div className={cn(
                                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border",
                                isActive
                                    ? colorVariants.icon
                                    : colorVariants.inactiveIcon + " group-hover:brightness-125"
                            )}>
                                {isActive && (
                                    <div className={cn(
                                        "absolute inset-0 opacity-20 bg-gradient-to-br",
                                        tab.color === 'indigo' ? 'from-info to-info' :
                                        tab.color === 'amber' ? 'from-warning to-warning' :
                                        'from-success to-success'
                                    )} />
                                )}
                                <Icon className={cn("w-5 h-5 relative z-10", isActive ? "scale-110" : "scale-100 transition-transform group-")} />
                            </div>

                            {/* Labels */}
                            <div className="text-left relative z-10">
                                <p className={cn(
                                    "font-black text-caption uppercase tracking-widest transition-colors duration-300",
                                    isActive ? "text-foreground" : "text-foreground group-hover:text-foreground"
                                )}>
                                    {tab.label}
                                </p>
                                <p className={cn(
                                    "text-caption font-bold mt-1 transition-colors duration-300",
                                    isActive ? colorVariants.sub : colorVariants.inactiveSub + " group-hover:" + colorVariants.sub
                                )}>
                                    {tab.sub}
                                </p>
                            </div>
                        </button>
                    );
                })}
            </div>

            <div>
                {/* === POSTS TAB === */}
                {activeTab === "posts" && (
                    <div className="space-y-5">
                        {/* Toolbar */}
                        <div className="flex flex-col xl:flex-row xl:items-start gap-4">
                            <div className="flex-1">
                                <DjFiltersBar
                                    filters={filters}
                                    onChange={setFilters}
                                    total={posts.filter((p) => p.status === "OPEN" || p.status === "FULL").length}
                                    filtered={filteredPosts.length}
                                />
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <Button
                                    variant="outline" size="icon"
                                    onClick={handleRefresh}
                                    disabled={isRefreshing}
                                    className="w-10 h-10 border-border text-muted-foreground hover:text-foreground"
                                    title="Rafraîchir"
                                >
                                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                                </Button>
                                <Button
                                    onClick={() => setIsCreateOpen(true)}
                                    disabled={!canCreate}
                                    title={canCreate ? "Créer un post" : "Tu as atteint la limite de 3 posts actifs"}
                                    className={`font-black h-10 gap-2 ${canCreate
                                        ? "bg-background hover:bg-surface text-foreground"
                                        : "bg-elevated/50 text-muted-foreground border border-border cursor-not-allowed opacity-70"
                                        }`}
                                >
                                    {canCreate ? (
                                        <Plus className="w-4 h-4" />
                                    ) : (
                                        <AlertTriangle className="w-4 h-4" />
                                    )}
                                    Nouveau post
                                    {!canCreate && (
                                        <span className="ml-1 text-xs font-bold bg-warning/20 px-1.5 py-0.5 rounded">
                                            {myActivePosts.length}/3
                                        </span>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Anti-spam hint */}
                        {!canCreate && (
                            <div className="flex items-center gap-3 text-sm text-warning bg-warning/8 border border-warning/20 rounded-xl px-4 py-3">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span>
                                    Tu as <strong>{myActivePosts.length}/3</strong> posts actifs.{" "}
                                    <button
                                        onClick={() => setFilters({ ...DEFAULT_FILTERS, search: "" })}
                                        className="underline underline-offset-2 hover:text-warning transition-colors"
                                    >
                                        Ferme ou expire un post existant
                                    </button>{" "}
                                    pour en créer un nouveau.
                                </span>
                            </div>
                        )}

                        {/* Posts grid */}
                        {filteredPosts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center min-h-[320px] border border-dashed border-border rounded-2xl bg-background/50">
                                <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center mb-4">
                                    <Search className="w-6 h-6 text-muted-foreground" />
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
                                        className="mt-5 bg-background hover:bg-surface text-foreground font-bold"
                                        onClick={() => setIsCreateOpen(true)}
                                    >
                                        <Plus className="w-4 h-4 mr-2" /> Créer un post
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div
                                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-tour="donjons-list"
                            >
                                {filteredPosts.map((post) => (
                                    <DjPostCard
                                        key={post.id}
                                        post={post}
                                        guildId={guildId}
                                        currentProfileId={currentProfileId}
                                        isAdmin={isAdmin}
                                        onRefresh={handleRefresh}
                                        isDiscordConfigured={isDiscordConfigured}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* === TRACKER TAB === */}
                {activeTab === "tracker" && (
                    <div>
                        <AchievementTracker guildId={guildId} />
                    </div>
                )}

                {/* === DIRECTORY TAB === */}
                {activeTab === "directory" && (
                    <div>
                        <DungeonDirectory guildId={guildId} onCreatePost={handleCreateGroupDirect} />
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
