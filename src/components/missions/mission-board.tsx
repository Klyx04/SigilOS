'use client';

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MissionCard } from "./mission-card";
import { InterestModal } from "./interest-modal";
import { ResetCountdown } from "./reset-countdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mission, MissionCategory, MissionInterest, UserProfile, User, Submission, SubmissionStatus } from "@prisma/client";
import { Filter, Swords, Skull, Zap, Clock, Infinity as InfinityIcon, CheckCircle2, Hourglass, Sparkles, RefreshCcw, SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ResidencyCountdown } from "./residency-countdown";

interface MissionBoardProps {
    missions: (Mission & {
        interests: (MissionInterest & {
            profile: UserProfile & {
                user: User | null
            }
        })[];
        submissions?: Submission[];
        linkedEvent?: { id: string, title: string, startDate: Date } | null;
    })[];
    currentUserId: string;
    guildId: string; // Discord Guild ID for uploads
    isRestricted?: boolean;
    availableAt?: string;
}

const STATUS_FILTERS: { label: string; value: 'ALL' | 'PENDING' | 'VALIDATED'; icon?: React.ComponentType<{ className?: string }> }[] = [
    { label: "Tout", value: "ALL" },
    { label: "En attente", value: "PENDING", icon: Hourglass },
    { label: "Validé", value: "VALIDATED", icon: CheckCircle2 },
];

// Classic categories only (non-EVENT)
const CATEGORY_FILTERS: { label: string; value: MissionCategory; icon?: React.ComponentType<{ className?: string }> }[] = [
    { label: "Donjon", value: "DONJON", icon: Swords },
    { label: "Régulation", value: "REGULATION", icon: Skull },
    { label: "Anomalie", value: "ANOMALIE", icon: Zap },
    { label: "Songes", value: "SONGES", icon: InfinityIcon },
    { label: "Expédition", value: "EXPEDITION", icon: Clock },
];

// Pool type for Dofus 3.5 split
type MissionPool = 'CLASSIQUES' | 'SPECIALES';


export function MissionBoard({ missions, currentUserId, guildId, isRestricted, availableAt }: MissionBoardProps) {
    const router = useRouter();
    const [selectedCategory, setSelectedCategory] = useState<MissionCategory | 'ALL' | 'PENDING' | 'VALIDATED'>('ALL');
    const [missionPool, setMissionPool] = useState<MissionPool>('CLASSIQUES');
    const [showFilters, setShowFilters] = useState(false);
    const [isPending, startTransition] = useTransition();

    // Interest Modal State
    const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);

    // Split missions between classic and event pools
    const classicMissions = missions.filter(m => m.category !== 'EVENT');
    const specialMissions = missions.filter(m => m.category === 'EVENT');
    const activeMissions = missionPool === 'CLASSIQUES' ? classicMissions : specialMissions;

    // Filter Logic within active pool
    const filteredMissions = activeMissions.filter(m => {
        if (selectedCategory === 'ALL') return true;
        if (selectedCategory === 'PENDING') return m.submissions?.[0]?.status === 'PENDING';
        if (selectedCategory === 'VALIDATED') return m.submissions?.[0]?.status === 'VALIDATED';
        return m.category === selectedCategory;
    });

    // Count active category filters (ignoring ALL/PENDING/VALIDATED)
    const activeCategoryCount = CATEGORY_FILTERS.some(f => f.value === selectedCategory) ? 1 : 0;

    // Find selected mission for modal
    const selectedMission = selectedMissionId
        ? missions.find(m => m.id === selectedMissionId)
        : null;

    const handleInterestClick = (missionId: string) => {
        setSelectedMissionId(missionId);
    };

    const handleCloseModal = () => {
        setSelectedMissionId(null);
    };

    const handlePoolChange = (pool: MissionPool) => {
        setMissionPool(pool);
        setSelectedCategory('ALL'); // Reset category filter when switching pools
    };

    // Category Styling Map
    const CATEGORY_STYLES: Record<MissionCategory, { bg: string; border: string; text: string; icon: string; shadow: string }> = {
        DONJON: { bg: "bg-indigo-500/10", border: "border-indigo-500/20", text: "text-indigo-400", icon: "text-indigo-400", shadow: "shadow-indigo-500/10" },
        REGULATION: { bg: "bg-rose-500/10", border: "border-rose-500/20", text: "text-rose-400", icon: "text-rose-400", shadow: "shadow-rose-500/10" },
        ANOMALIE: { bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/20", text: "text-fuchsia-400", icon: "text-fuchsia-400", shadow: "shadow-fuchsia-500/10" },
        SONGES: { bg: "bg-cyan-500/10", border: "border-cyan-500/20", text: "text-cyan-400", icon: "text-cyan-400", shadow: "shadow-cyan-500/10" },
        EXPEDITION: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", icon: "text-amber-400", shadow: "shadow-amber-500/10" },
        EVENT: { bg: "bg-yellow-500/10", border: "border-yellow-500/20", text: "text-yellow-400", icon: "text-yellow-400", shadow: "shadow-yellow-500/10" },
    };

    return (
        <div className="space-y-6">
            {isRestricted && availableAt && (
                <ResidencyCountdown availableAt={availableAt} className="mb-6" />
            )}
            {/* 🛠️ Simplified Toolbar */}
            <div className="flex flex-col gap-4 bg-zinc-900/40 p-3 rounded-2xl border border-white/5 backdrop-blur-sm">

                {/* PRIMARY ACTIONS ROW */}
                <div className="flex flex-wrap items-center justify-between gap-3">

                    {/* Left: Pool & Status Logic Combined */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                        {/* Pool Toggle */}
                        <div className="flex items-center gap-1 p-1 bg-black/40 border border-white/5 rounded-full shrink-0">
                            {(['CLASSIQUES', 'SPECIALES'] as MissionPool[]).map(pool => {
                                const isActive = missionPool === pool;
                                return (
                                    <button
                                        key={pool}
                                        onClick={() => handlePoolChange(pool)}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-1.5 text-[10px] font-black rounded-full transition-all uppercase tracking-widest",
                                            isActive
                                                ? pool === 'CLASSIQUES'
                                                    ? "bg-indigo-500 text-white shadow-lg"
                                                    : "bg-yellow-500 text-black shadow-lg"
                                                : "text-zinc-500 hover:text-white"
                                        )}
                                    >
                                        {pool === 'CLASSIQUES' ? '⚔️' : '✨'} {pool}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="h-4 w-px bg-white/10 mx-1" />

                        {/* Status Toggle */}
                        <div className="flex items-center gap-1 p-1 bg-black/40 border border-white/5 rounded-full shrink-0">
                            {STATUS_FILTERS.map(f => {
                                const isActive = selectedCategory === f.value;
                                return (
                                    <button
                                        key={f.value}
                                        onClick={() => setSelectedCategory(f.value)}
                                        className={cn(
                                            "px-3 py-1.5 text-[10px] font-bold rounded-full transition-all uppercase tracking-wider",
                                            isActive ? "bg-zinc-100 text-zinc-950 shadow-md" : "text-zinc-500 hover:text-white"
                                        )}
                                    >
                                        {f.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Right: Filters & Tools */}
                    <div className="flex items-center gap-2 ml-auto">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowFilters(!showFilters)}
                            className={cn(
                                "h-9 rounded-full px-4 text-[10px] font-black uppercase tracking-widest transition-all",
                                (showFilters || activeCategoryCount > 0)
                                    ? "bg-white/10 text-white border-white/20"
                                    : "bg-transparent text-zinc-400 border-white/5"
                            )}
                        >
                            <Filter className={cn("w-3.5 h-3.5 mr-2", activeCategoryCount > 0 && "text-emerald-400 animate-pulse")} />
                            Catégories
                            {activeCategoryCount > 0 && (
                                <span className="ml-2 w-4 h-4 rounded-full bg-emerald-500 text-black text-[9px] flex items-center justify-center">
                                    {activeCategoryCount}
                                </span>
                            )}
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-zinc-500 hover:text-white hover:bg-white/5 rounded-full"
                            onClick={() => startTransition(() => router.refresh())}
                            disabled={isPending}
                        >
                            <RefreshCcw className={cn("w-3.5 h-3.5", isPending && "animate-spin")} />
                        </Button>
                    </div>
                </div>

                {/* SECONDARY: Category Filters (Collapsible) */}
                {showFilters && missionPool === 'CLASSIQUES' && (
                    <div className="pt-2 border-t border-white/5 animate-in slide-in-from-top-2 duration-300">
                        <div className="flex flex-wrap gap-2">
                            {CATEGORY_FILTERS.map(f => {
                                const IconComponent = f.icon;
                                const isActive = selectedCategory === f.value;
                                const style = CATEGORY_STYLES[f.value as MissionCategory];

                                return (
                                    <button
                                        key={f.value}
                                        onClick={() => setSelectedCategory(isActive ? 'ALL' : f.value)}
                                        className={cn(
                                            "group flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-all",
                                            isActive
                                                ? cn(style.bg, style.border, style.text, "ring-1 ring-white/10")
                                                : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:border-white/20 hover:text-white"
                                        )}
                                    >
                                        {IconComponent && <IconComponent className="w-3 h-3" />}
                                        {f.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>


            {/* Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredMissions.map((mission) => (
                    <div key={mission.id} className="h-full">
                        <MissionCard
                            mission={mission}
                            currentUserId={currentUserId}
                            guildId={guildId}
                            onInterestClick={handleInterestClick}
                            isRestricted={isRestricted}
                            linkedEvent={(mission as any).linkedEvent}
                        />
                    </div>
                ))}

                {filteredMissions.length === 0 ? (
                    <div className="col-span-full py-12">
                        <EmptyState
                            icon={SearchX}
                            title="Aucune mission trouvée"
                            description="Ajustez vos filtres ou revenez plus tard pour voir les nouveaux défis."
                            variant="glow"
                        />
                    </div>
                ) : null}
            </div>

            {/* Interest Modal */}
            {selectedMission && (
                <InterestModal
                    isOpen={!!selectedMissionId}
                    onClose={handleCloseModal}
                    missionTitle={selectedMission.title || "Mission"}
                    missionId={selectedMission.id}
                    interests={selectedMission.interests}
                    currentUserId={currentUserId}
                />
            )}
        </div>
    );
}
