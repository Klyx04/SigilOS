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
    vitrineMode?: boolean;
    /** Masque le bouton PREUVE / upload pour les super-admins (God) — #204. */
    hideUpload?: boolean;
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


export function MissionBoard({ missions, currentUserId, guildId, isRestricted, availableAt, vitrineMode = false, hideUpload = false }: MissionBoardProps) {
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
        DONJON: { bg: "bg-info/10", border: "border-info/20", text: "text-info", icon: "text-info", shadow: "shadow-indigo-500/10" },
        REGULATION: { bg: "bg-danger/10", border: "border-danger/20", text: "text-danger", icon: "text-danger", shadow: "shadow-rose-500/10" },
        ANOMALIE: { bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/20", text: "text-fuchsia-400", icon: "text-fuchsia-400", shadow: "shadow-fuchsia-500/10" },
        SONGES: { bg: "bg-info/10", border: "border-info/20", text: "text-info", icon: "text-info", shadow: "shadow-cyan-500/10" },
        EXPEDITION: { bg: "bg-warning/10", border: "border-warning/20", text: "text-warning", icon: "text-warning", shadow: "shadow-amber-500/10" },
        EVENT: { bg: "bg-warning/10", border: "border-warning/20", text: "text-warning", icon: "text-warning", shadow: "shadow-yellow-500/10" },
    };

    return (
        <div className="space-y-6">
            {isRestricted && availableAt && (
                <ResidencyCountdown availableAt={availableAt} className="mb-6" />
            )}
            {/* 🛠️ Simplified Toolbar */}
            <div className="flex flex-col gap-4 bg-surface/40 p-3 rounded-2xl border border-border backdrop-blur-sm" data-tour="missions-toolbar">

                {/* PRIMARY ACTIONS ROW */}
                <div className="flex flex-wrap items-center justify-between gap-3">

                    {/* Left: Pool & Status Logic Combined */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                        {/* Pool Toggle */}
                        <div className="flex items-center gap-1 p-1 bg-black/40 border border-border rounded-full shrink-0" data-tour="missions-pool">
                            {(['CLASSIQUES', 'SPECIALES'] as MissionPool[]).map(pool => {
                                const isActive = missionPool === pool;
                                return (
                                    <button
                                        key={pool}
                                        onClick={() => handlePoolChange(pool)}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-1.5 text-caption font-black rounded-full transition-all uppercase tracking-widest",
                                            isActive
                                                ? pool === 'CLASSIQUES'
                                                    ? "bg-info text-info-foreground shadow-lg"
                                                    : "bg-warning text-warning-foreground shadow-lg"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        {pool === 'CLASSIQUES' ? '⚔️' : '✨'} {pool}
                                    </button>
                                );
                            })}
                        </div>

                        {!vitrineMode && (
                            <>
                                <div className="h-4 w-px bg-surface mx-1" />

                                {/* Status Toggle */}
                                <div className="flex items-center gap-1 p-1 bg-black/40 border border-border rounded-full shrink-0">
                                    {STATUS_FILTERS.map(f => {
                                        const isActive = selectedCategory === f.value;
                                        return (
                                            <button
                                                key={f.value}
                                                onClick={() => setSelectedCategory(f.value)}
                                                className={cn(
                                                    "px-3 py-1.5 text-caption font-bold rounded-full transition-all uppercase tracking-wider",
                                                    isActive ? "bg-surface text-foreground shadow-md" : "text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                {f.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Right: Filters & Tools */}
                    <div className="flex items-center gap-2 ml-auto">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowFilters(!showFilters)}
                            className={cn(
                                "h-9 rounded-full px-4 text-caption font-black uppercase tracking-widest transition-all",
                                (showFilters || activeCategoryCount > 0)
                                    ? "bg-surface text-foreground border-border-strong"
                                    : "bg-transparent text-muted-foreground border-border"
                            )}
                        >
                            <Filter className={cn("w-3.5 h-3.5 mr-2", activeCategoryCount > 0 && "text-success animate-pulse")} />
                            Catégories
                            {activeCategoryCount > 0 && (
                                <span className="ml-2 w-4 h-4 rounded-full bg-success text-success-foreground text-caption flex items-center justify-center">
                                    {activeCategoryCount}
                                </span>
                            )}
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-surface rounded-full"
                            onClick={() => startTransition(() => router.refresh())}
                            disabled={isPending}
                        >
                            <RefreshCcw className={cn("w-3.5 h-3.5", isPending && "animate-spin")} />
                        </Button>
                    </div>
                </div>

                {/* SECONDARY: Category Filters (Collapsible) */}
                {showFilters && missionPool === 'CLASSIQUES' && (
                    <div className="pt-2 border-t border-border animate-in slide-in-from-top-2 duration-300">
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
                                            "group flex items-center gap-2 px-3 py-1.5 text-caption font-bold rounded-lg border transition-all",
                                            isActive
                                                ? cn(style.bg, style.border, style.text, "ring-1 ring-white/10")
                                                : "bg-surface border-border text-muted-foreground hover:bg-surface hover:border-border-strong hover:text-foreground"
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-tour="missions-grid">
                {filteredMissions.map((mission) => (
                    <div key={mission.id} className="h-full">
                        <MissionCard
                            mission={mission}
                            currentUserId={currentUserId}
                            guildId={guildId}
                            onInterestClick={handleInterestClick}
                            isRestricted={isRestricted}
                            linkedEvent={(mission as any).linkedEvent}
                            vitrineMode={vitrineMode}
                            hideUpload={hideUpload}
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
