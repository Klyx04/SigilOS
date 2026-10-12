'use client';

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MissionCard } from "./mission-card";
import { InterestModal } from "./interest-modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mission, MissionCategory, MissionInterest, UserProfile, User, Submission } from "@prisma/client";
import { Filter, Swords, Skull, Zap, Clock, Infinity as InfinityIcon, CheckCircle2, Hourglass, RefreshCcw, SearchX } from "lucide-react";
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
    guildId: string;
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

const CATEGORY_FILTERS: { label: string; value: MissionCategory; icon?: React.ComponentType<{ className?: string }> }[] = [
    { label: "Donjon", value: "DONJON", icon: Swords },
    { label: "Régulation", value: "REGULATION", icon: Skull },
    { label: "Anomalie", value: "ANOMALIE", icon: Zap },
    { label: "Songes", value: "SONGES", icon: InfinityIcon },
    { label: "Expédition", value: "EXPEDITION", icon: Clock },
];

type MissionPool = 'CLASSIQUES' | 'SPECIALES';

export function MissionBoard({
    missions,
    currentUserId,
    guildId,
    isRestricted,
    availableAt,
    vitrineMode = false,
    hideUpload = false
}: MissionBoardProps) {
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
        setSelectedCategory('ALL');
    };

    return (
        <div className="space-y-6">
            {isRestricted && availableAt && (
                <ResidencyCountdown availableAt={availableAt} className="mb-6" />
            )}

            {/* Toolbar */}
            <div className="flex flex-col gap-3 bg-surface p-3 rounded-xl border border-border" data-tour="missions-toolbar">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Left: Pool & Status Selectors */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Pool Toggle */}
                        <div className="flex items-center gap-1 p-1 bg-elevated/80 border border-border rounded-lg" data-tour="missions-pool">
                            {(['CLASSIQUES', 'SPECIALES'] as MissionPool[]).map(pool => {
                                const isActive = missionPool === pool;
                                return (
                                    <button
                                        key={pool}
                                        onClick={() => handlePoolChange(pool)}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all uppercase tracking-wider",
                                            isActive
                                                ? pool === 'CLASSIQUES'
                                                    ? "bg-primary text-primary-foreground shadow-sm"
                                                    : "bg-warning text-warning-foreground shadow-sm"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <span>{pool === 'CLASSIQUES' ? '⚔️' : '✨'}</span>
                                        <span>{pool}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {!vitrineMode && (
                            <div className="flex items-center gap-1 p-1 bg-elevated/80 border border-border rounded-lg">
                                {STATUS_FILTERS.map(f => {
                                    const isActive = selectedCategory === f.value;
                                    return (
                                        <button
                                            key={f.value}
                                            onClick={() => setSelectedCategory(f.value)}
                                            className={cn(
                                                "px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all uppercase tracking-wider",
                                                isActive
                                                    ? "bg-surface text-foreground shadow-sm border border-border"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            {f.label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Right: Filters & Tools */}
                    <div className="flex items-center gap-2 ml-auto">
                        {missionPool === 'CLASSIQUES' && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowFilters(!showFilters)}
                                className={cn(
                                    "h-8.5 rounded-lg px-3 text-xs font-bold uppercase tracking-wider transition-all",
                                    (showFilters || activeCategoryCount > 0)
                                        ? "bg-elevated text-foreground border-border-strong"
                                        : "bg-surface text-muted-foreground border-border"
                                )}
                            >
                                <Filter className={cn("w-3.5 h-3.5 mr-1.5", activeCategoryCount > 0 && "text-primary")} />
                                Catégories
                                {activeCategoryCount > 0 && (
                                    <span className="ml-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-mono">
                                        {activeCategoryCount}
                                    </span>
                                )}
                            </Button>
                        )}

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8.5 w-8.5 text-muted-foreground hover:text-foreground hover:bg-elevated rounded-lg"
                            onClick={() => startTransition(() => router.refresh())}
                            disabled={isPending}
                            title="Actualiser les missions"
                        >
                            <RefreshCcw className={cn("w-3.5 h-3.5", isPending && "animate-spin")} />
                        </Button>
                    </div>
                </div>

                {/* Collapsible Category Filters */}
                {showFilters && missionPool === 'CLASSIQUES' && (
                    <div className="pt-2.5 border-t border-border flex flex-wrap gap-2">
                        {CATEGORY_FILTERS.map(f => {
                            const IconComponent = f.icon;
                            const isActive = selectedCategory === f.value;

                            return (
                                <button
                                    key={f.value}
                                    onClick={() => setSelectedCategory(isActive ? 'ALL' : f.value)}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all",
                                        isActive
                                            ? "bg-primary/10 border-primary/30 text-primary"
                                            : "bg-surface border-border text-muted-foreground hover:bg-elevated hover:text-foreground"
                                    )}
                                >
                                    {IconComponent && <IconComponent className="w-3.5 h-3.5" />}
                                    <span>{f.label}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5" data-tour="missions-grid">
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
                            variant="minimal"
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
