"use client";

import { useState, useCallback, useMemo, useTransition, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { io } from "socket.io-client";
import { buildWsUrl } from "@/lib/socket-utils";
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

    // Real-time updates via WebSocket
    useEffect(() => {
        const socketUrl = buildWsUrl();
        const socket = io(socketUrl, {
            path: "/socket.io/",
            query: { guildId }
        });

        socket.on("connect", () => {
            console.log("[WS] 📡 Connecté pour Dungeon Finder");
        });

        socket.on("dj:finder:update", (data: any) => {
            console.log("[WS] 🔄 Update DJ reçu", data);
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

    const TABS: { id: Tab; label: string; sub: string; icon: React.ElementType; color: string }[] = [
        { id: "posts", label: "Recherche DJ", sub: "Trouver un groupe", icon: Search, color: "indigo" },
        { id: "tracker", label: "Mes Succès", sub: "Ma progression", icon: Trophy, color: "amber" },
        { id: "directory", label: "Succès Commun", sub: "La guilde", icon: Users, color: "emerald" },
    ];

    return (
        <div className="space-y-8">
            {/* Dissociated Professional Tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    const colorVariants = {
                        indigo: {
                            border: "border-indigo-500/40",
                            icon: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
                            sub: "text-indigo-400/80",
                            glow: "bg-indigo-500",
                            shadow: "shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                        },
                        amber: {
                            border: "border-amber-500/40",
                            icon: "bg-amber-500/10 border-amber-500/20 text-amber-400",
                            sub: "text-amber-400/80",
                            glow: "bg-amber-500",
                            shadow: "shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                        },
                        emerald: {
                            border: "border-emerald-500/40",
                            icon: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
                            sub: "text-emerald-400/80",
                            glow: "bg-emerald-500",
                            shadow: "shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                        }
                    }[tab.color] || {
                        border: "border-indigo-500/40",
                        icon: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
                        sub: "text-indigo-400/80",
                        glow: "bg-indigo-500",
                        shadow: "shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                    };

                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`relative group overflow-hidden flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 ${isActive
                                ? `bg-zinc-900 ${colorVariants.border} shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)]`
                                : "bg-zinc-950/40 border-white/5 hover:border-white/10 hover:bg-zinc-900/60"
                                }`}
                        >
                            {/* Accent Glow */}
                            {isActive && (
                                <div className={`absolute -bottom-px inset-x-4 h-px bg-gradient-to-r from-transparent via-${tab.color}-500 to-transparent ${colorVariants.shadow}`} />
                            )}

                            {/* Icon Box */}
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300 ${isActive
                                ? colorVariants.icon
                                : "bg-white/5 border-white/5 text-slate-500 group-hover:text-slate-300"
                                }`}>
                                <Icon className="w-6 h-6" />
                            </div>

                            {/* Labels */}
                            <div className="text-left">
                                <p className={`font-black text-sm uppercase tracking-wider transition-colors ${isActive ? "text-white" : "text-slate-500"}`}>
                                    {tab.label}
                                </p>
                                <p className={`text-[10px] font-medium transition-colors ${isActive ? colorVariants.sub : "text-slate-600"}`}>
                                    {tab.sub}
                                </p>
                            </div>

                            {/* Active Indicator */}
                            {isActive && (
                                <motion.div
                                    layoutId="tab-glow"
                                    className={`absolute inset-0 ${colorVariants.glow}/5 opacity-20 pointer-events-none`}
                                />
                            )}
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
                                className="flex flex-col items-center justify-center min-h-[320px] border border-dashed border-white/10 rounded-2xl bg-zinc-950/50 shadow-inner"
                            >
                                <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-white/10 shadow-sm flex items-center justify-center mb-4">
                                    <Search className="w-6 h-6 text-slate-500" />
                                </div>
                                <h3 className="text-base font-bold text-slate-300 mb-1">Aucun post actif</h3>
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
