"use client";

import { useState, useCallback, useMemo, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Trophy, Sword, RefreshCw, Frown, Users, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
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

    const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
        { id: "posts", label: "Recherche DJ", icon: Search },
        { id: "tracker", label: "Mes Succès", icon: Trophy },
        { id: "directory", label: "Succès DJ en commun", icon: Users },
    ];

    return (
        <div className="space-y-6">
            {/* Gamified Tabs */}
            <div className="relative flex bg-slate-950/50 border border-slate-800/80 rounded-2xl p-1.5 w-max shadow-inner">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`relative z-10 flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-colors ${isActive ? "text-white" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                                }`}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="main-tab-indicator"
                                    className="absolute inset-0 -z-10 bg-indigo-600 rounded-xl border border-indigo-500/50 shadow-lg shadow-indigo-900/40"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                                />
                            )}
                            <Icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            <div>
                {/* === POSTS TAB === */}
                {activeTab === "posts" && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                                    className="w-10 h-10 border-slate-700 text-slate-400 hover:text-white"
                                    title="Rafraîchir"
                                >
                                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                                </Button>
                                <Button
                                    onClick={() => setIsCreateOpen(true)}
                                    disabled={!canCreate}
                                    title={canCreate ? "Créer un post" : "Tu as atteint la limite de 3 posts actifs"}
                                    className={`font-black h-10 gap-2 shadow-lg ${canCreate
                                        ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/25"
                                        : "bg-amber-600/20 text-amber-400 border border-amber-500/30 cursor-not-allowed opacity-70"
                                        }`}
                                >
                                    {canCreate ? (
                                        <Plus className="w-4 h-4" />
                                    ) : (
                                        <AlertTriangle className="w-4 h-4" />
                                    )}
                                    Nouveau post
                                    {!canCreate && (
                                        <span className="ml-1 text-xs font-bold bg-amber-500/20 px-1.5 py-0.5 rounded">
                                            {myActivePosts.length}/3
                                        </span>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Anti-spam hint */}
                        {!canCreate && (
                            <div className="flex items-center gap-3 text-sm text-amber-400 bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span>
                                    Tu as <strong>{myActivePosts.length}/3</strong> posts actifs.{" "}
                                    <button
                                        onClick={() => setFilters({ ...DEFAULT_FILTERS, search: "" })}
                                        className="underline underline-offset-2 hover:text-amber-300 transition-colors"
                                    >
                                        Ferme ou expire un post existant
                                    </button>{" "}
                                    pour en créer un nouveau.
                                </span>
                            </div>
                        )}

                        {/* Posts grid */}
                        {filteredPosts.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center min-h-[320px] border border-dashed border-slate-800 rounded-2xl bg-slate-900/20"
                            >
                                <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4">
                                    <Search className="w-6 h-6 text-slate-600" />
                                </div>
                                <h3 className="text-base font-bold text-slate-400 mb-1">Aucun post actif</h3>
                                <p className="text-sm text-slate-600 text-center max-w-xs">
                                    {filters.search || filters.mode
                                        ? "Modifie les filtres pour voir plus de posts."
                                        : "Sois le premier à créer un post de recherche de groupe !"}
                                </p>
                                {canCreate && (
                                    <Button
                                        className="mt-5 bg-indigo-600 hover:bg-indigo-500 font-bold"
                                        onClick={() => setIsCreateOpen(true)}
                                    >
                                        <Plus className="w-4 h-4 mr-2" /> Créer un post
                                    </Button>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div
                                layout
                                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                            >
                                <AnimatePresence>
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
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </div>
                )}

                {/* === TRACKER TAB === */}
                {activeTab === "tracker" && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <AchievementTracker guildId={guildId} />
                    </div>
                )}

                {/* === DIRECTORY TAB === */}
                {activeTab === "directory" && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
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
